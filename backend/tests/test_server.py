"""The companion WebSocket protocol, driven end to end against a fake Claude client."""

import asyncio
import json

import websockets

from aether.server import CompanionServer
from test_core import FakeClient


async def connect(server):
    listener = await server.start("127.0.0.1", 0)
    port = listener.sockets[0].getsockname()[1]
    ws = await websockets.connect(f"ws://127.0.0.1:{port}")
    return listener, ws


async def recv(ws, kind):
    while True:
        message = json.loads(await asyncio.wait_for(ws.recv(), 5))
        if message["type"] == kind:
            return message["payload"]


def send(ws, kind, payload=None):
    return ws.send(json.dumps({"type": kind, "payload": payload or {}, "timestamp": 0}))


def test_ping_goal_models_and_memory(tmp_path):
    async def scenario():
        home = tmp_path / "home"
        server = CompanionServer(home, tmp_path, client=FakeClient())
        listener, ws = await connect(server)
        try:
            assert (await recv(ws, "status_update"))["activity"] == "Ready"

            await send(ws, "ping")
            pong = await recv(ws, "pong")
            assert pong["name"] == "Aether" and pong["model"] == "claude-opus-5-5"

            await send(ws, "goal_submit", {"goal_text": "hi", "goal_id": "g1"})
            assert (await recv(ws, "goal_started"))["goal_text"] == "hi"
            assert (await recv(ws, "stream_token"))["token"] == "Hello"
            assert (await recv(ws, "goal_complete"))["result"] == "Hello there"

            await send(ws, "models_list_request")
            assert "claude-opus-5-5" in (await recv(ws, "models_list"))["models"]
            await send(ws, "model_select", {"model": "claude-sonnet-5-5"})
            await recv(ws, "status_update")
            assert server.agent.model == "claude-sonnet-5-5"
            await send(ws, "model_select", {"model": "llama3.1:8b"})
            assert server.agent.model == "claude-sonnet-5-5"

            (home / "memories" / "user.md").write_text("Likes tea")
            await send(ws, "memory_fetch")
            update = await recv(ws, "memory_update")
            assert update["count"] == 1 and update["memories"][0]["id"] == "user.md"
            assert update["memories"][0]["content"] == "Likes tea"

            await send(ws, "memory_delete", {"memory_id": "../aether.db"})
            assert (await recv(ws, "memory_update"))["count"] == 1 and (home / "aether.db").exists()
            await send(ws, "memory_delete", {"memory_id": "user.md"})
            assert (await recv(ws, "memory_update"))["count"] == 0
        finally:
            await ws.close()
            listener.close()
            await listener.wait_closed()

    asyncio.run(scenario())


def test_approval_round_trip(tmp_path):
    async def scenario():
        server = CompanionServer(tmp_path / "home", tmp_path, client=FakeClient())
        listener, ws = await connect(server)
        try:
            await recv(ws, "status_update")

            pending = asyncio.create_task(asyncio.to_thread(server.approve, "run_shell", "run: ls"))
            request = await recv(ws, "approval_required")
            assert request["tool_name"] == "run_shell"
            assert request["risk_level"] == "high"
            assert request["action_description"] == "run: ls"
            await send(ws, "approval_response", {"request_id": request["request_id"], "outcome": "approved"})
            assert await pending is True

            pending = asyncio.create_task(asyncio.to_thread(server.approve, "write_file", "write 3 characters to x"))
            request = await recv(ws, "approval_required")
            assert request["risk_level"] == "medium"
            await send(ws, "approval_response", {"request_id": request["request_id"], "outcome": "denied"})
            assert await pending is False
            assert server.pending == {}
        finally:
            await ws.close()
            listener.close()
            await listener.wait_closed()

    asyncio.run(scenario())
