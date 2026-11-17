"""WebSocket backend for the Aether Companion app (the my-ai-guy frontend).

Speaks the protocol in `src/lib/wsClient.js`: JSON envelopes `{type, payload, timestamp}` over
`ws://<host>:8765`. Run with `aether-server` or `python -m aether.server`.
"""

from __future__ import annotations

import asyncio
import datetime as dt
import json
import os
import time
import uuid
from concurrent.futures import Future
from concurrent.futures import TimeoutError as FutureTimeout
from pathlib import Path

import anthropic
from websockets.asyncio.server import Server, ServerConnection, serve
from websockets.exceptions import ConnectionClosed

from . import __version__
from .agent import DEFAULT_MODEL, Agent

MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"]
NODE_TYPES = {"memory": "memory", "tasks": "planner"}  # other tools render as "executor" in the app
RISK = {"run_shell": "high", "write_file": "medium"}
APPROVAL_TIMEOUT = 600  # seconds; an unanswered approval counts as denied


def envelope(kind: str, payload: dict | None = None) -> str:
    return json.dumps({"type": kind, "payload": payload or {}, "timestamp": int(time.time() * 1000)})


class CompanionServer:
    def __init__(
        self,
        home: Path,
        workdir: Path,
        model: str = DEFAULT_MODEL,
        client: anthropic.Anthropic | None = None,
    ):
        self.agent = Agent(home=home, workdir=workdir, approve=self.approve, model=model, client=client)
        self.memory_root = home / "memories"
        self.clients: set[ServerConnection] = set()
        self.pending: dict[str, Future[bool]] = {}
        self.goals: set[asyncio.Task] = set()
        self.goal_lock = asyncio.Lock()
        self.loop: asyncio.AbstractEventLoop | None = None

    # ---- outbound ---------------------------------------------------------------------------

    async def broadcast(self, kind: str, payload: dict | None = None) -> None:
        text = envelope(kind, payload)
        for ws in list(self.clients):
            try:
                await ws.send(text)
            except ConnectionClosed:
                self.clients.discard(ws)

    def emit(self, kind: str, payload: dict | None = None) -> None:
        """Thread-safe broadcast for callbacks that run on the agent's worker thread."""
        asyncio.run_coroutine_threadsafe(self.broadcast(kind, payload), self.loop)

    # ---- approvals (called on the agent thread) ---------------------------------------------

    def approve(self, tool_name: str, action: str) -> bool:
        request_id = uuid.uuid4().hex
        answer: Future[bool] = Future()
        self.pending[request_id] = answer
        self.emit(
            "approval_required",
            {
                "request_id": request_id,
                "tool_name": tool_name,
                "action_description": action,
                "reason": "Aether needs this to continue the current goal.",
                "risk_level": RISK.get(tool_name, "medium"),
            },
        )
        try:
            return answer.result(timeout=APPROVAL_TIMEOUT)
        except FutureTimeout:
            return False
        finally:
            self.pending.pop(request_id, None)

    # ---- goals ------------------------------------------------------------------------------

    async def run_goal(self, goal_text: str) -> None:
        async with self.goal_lock:
            await self.broadcast("goal_started", {"goal_text": goal_text})
            await self.broadcast("status_update", {"activity": f"Working on: {goal_text[:80]}"})
            reply: list[str] = []

            def on_text(token: str) -> None:
                reply.append(token)
                self.emit("stream_token", {"token": token})

            def on_event(kind: str, payload: dict) -> None:
                node_id = payload["id"]
                if kind == "tool_start":
                    node_type = NODE_TYPES.get(payload["name"], "executor")
                    self.emit("node_start", {"node_id": node_id, "name": payload["name"], "type": node_type})
                    self.emit("node_update", {"node_id": node_id, "content": json.dumps(payload["input"])[:500], "status": "thinking"})
                elif payload["is_error"]:
                    self.emit("node_error", {"node_id": node_id, "error": str(payload["result"])[:2000]})
                else:
                    self.emit("node_complete", {"node_id": node_id, "result": str(payload["result"])[:2000]})

            stop_reason = "end_turn"
            try:
                stop_reason = await asyncio.to_thread(self.agent.run, goal_text, on_text, on_event)
            except anthropic.APIError as err:
                reply.append(f"\nAether could not reach the Claude API: {err}")
                await self.broadcast("node_error", {"node_id": "api", "error": str(err)})
            if stop_reason == "refusal":
                reply.append("\n[Aether declined this request for safety reasons]")
            await self.broadcast("goal_complete", {"result": "".join(reply)})
            await self.broadcast("status_update", {"activity": "Ready", "memory_count": len(self.memory_files())})

    # ---- memory -----------------------------------------------------------------------------

    def memory_files(self) -> list[Path]:
        if not self.memory_root.exists():
            return []
        return sorted(p for p in self.memory_root.rglob("*") if p.is_file())

    def memories(self) -> list[dict]:
        items = []
        for path in self.memory_files():
            rel = path.relative_to(self.memory_root).as_posix()
            modified = dt.datetime.fromtimestamp(path.stat().st_mtime, tz=dt.timezone.utc)
            items.append(
                {
                    "id": rel,
                    "content": path.read_text(encoding="utf-8", errors="replace")[:4000],
                    "type": "general",
                    "importance": 0.5,
                    "timestamp": modified.isoformat(),
                    "tags": rel.split("/")[:-1],
                }
            )
        return items

    def delete_memory(self, memory_id: str) -> None:
        target = (self.memory_root / memory_id).resolve()
        if target.is_relative_to(self.memory_root.resolve()) and target.is_file():
            target.unlink()

    # ---- protocol ---------------------------------------------------------------------------

    async def dispatch(self, ws: ServerConnection, kind: str, payload: dict) -> None:
        if kind == "ping":
            await ws.send(envelope("pong", {"name": "Aether", "version": __version__, "model": self.agent.model}))
        elif kind == "goal_submit":
            goal_text = str(payload.get("goal_text", "")).strip()
            if goal_text:
                task = asyncio.create_task(self.run_goal(goal_text))
                self.goals.add(task)
                task.add_done_callback(self.goals.discard)
        elif kind == "approval_response":
            answer = self.pending.get(str(payload.get("request_id")))
            if answer and not answer.done():
                answer.set_result(payload.get("outcome") == "approved")
        elif kind == "memory_fetch":
            memories = self.memories()
            await ws.send(envelope("memory_update", {"memories": memories, "count": len(memories)}))
        elif kind == "memory_delete":
            self.delete_memory(str(payload.get("memory_id", "")))
            memories = self.memories()
            await self.broadcast("memory_update", {"memories": memories, "count": len(memories)})
        elif kind == "models_list_request":
            await ws.send(envelope("models_list", {"models": MODELS}))
        elif kind == "model_select":
            if payload.get("model") in MODELS:
                self.agent.model = payload["model"]
                await self.broadcast("status_update", {"activity": f"Model set to {self.agent.model}"})
        # shortcut: goal_pause/resume/interrupt, voice_* and memory_update_importance are accepted and ignored;
        # voice comes in phase 2, and interrupting needs cancellation support in Agent.run.

    async def handle(self, ws: ServerConnection) -> None:
        self.clients.add(ws)
        try:
            await ws.send(envelope("status_update", {"activity": "Ready", "memory_count": len(self.memory_files())}))
            async for raw in ws:
                try:
                    message = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if isinstance(message, dict):
                    await self.dispatch(ws, str(message.get("type")), message.get("payload") or {})
        finally:
            self.clients.discard(ws)

    async def start(self, host: str, port: int) -> Server:
        self.loop = asyncio.get_running_loop()
        return await serve(self.handle, host, port)

    async def serve_forever(self, host: str, port: int) -> None:
        server = await self.start(host, port)
        async with server:
            await asyncio.Future()


def main() -> None:
    home = Path(os.environ.get("AETHER_HOME", Path.home() / ".aether"))
    host = os.environ.get("AETHER_BIND", "127.0.0.1")
    port = int(os.environ.get("AETHER_PORT", "8765"))
    server = CompanionServer(home, Path.cwd(), model=os.environ.get("AETHER_MODEL", DEFAULT_MODEL))
    print(f"Aether backend listening on ws://{host}:{port} ({server.agent.model}). Memory and tasks in {home}.")
    if host in ("127.0.0.1", "localhost"):
        print("Only this computer can connect. Set AETHER_BIND=0.0.0.0 to let your phone on the same network connect.")
    else:
        print("Warning: there is no password yet. Anyone on this network can send goals and approve commands.")
    try:
        asyncio.run(server.serve_forever(host, port))
    except KeyboardInterrupt:
        print("\nAether backend stopped.")


if __name__ == "__main__":
    main()
