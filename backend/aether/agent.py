"""The agent loop: Claude with tools, the conversation persisted between runs."""

from __future__ import annotations

import datetime as dt
import platform
from pathlib import Path
from typing import Callable

import anthropic

# Shipped with the SDK but not re-exported from anthropic.lib.tools yet.
from anthropic.lib.tools._beta_builtin_memory_tool import BetaLocalFilesystemMemoryTool

from .store import Store
from .tools import Approve, build_tools

DEFAULT_MODEL = "claude-opus-5-5"

SYSTEM = """You are Aether, a personal AI assistant that runs on the user's own computer. You get things done rather than describe how they could be done.

Working rules:
- At the start of a session, view /memories to recall who the user is and what you were working on. Save durable facts about the user, their preferences and their decisions there. Never store secrets or passwords.
- For any request that takes several steps, plan it with the `tasks` tool before acting and update the tasks as you finish them.
- Use the file tools to read and write files. Use `run_shell` for everything else. Every shell command and file write is shown to the user for approval, so make each one count.
- Use web_search for anything that may have changed since your training, and web_fetch to read a page the user names.
- Be concise and plain-spoken. Report what you did and what it depends on. When you are blocked, ask one clear question.

Environment: {os}. Working directory: {workdir}. Today is {date}."""


class Agent:
    def __init__(
        self,
        home: Path,
        workdir: Path,
        approve: Approve,
        model: str = DEFAULT_MODEL,
        client: anthropic.Anthropic | None = None,
    ):
        self.client = client or anthropic.Anthropic()
        self.model = model
        self.store = Store(home / "aether.db")
        self.messages: list[dict] = self.store.load_messages()
        self.tools = [
            BetaLocalFilesystemMemoryTool(str(home)),  # files under <home>/memories
            *build_tools(workdir, self.store, approve),
            {"type": "web_search_20260209", "name": "web_search"},
            {"type": "web_fetch_20260209", "name": "web_fetch"},
        ]
        self.system = SYSTEM.format(os=platform.platform(), workdir=workdir.resolve(), date=dt.date.today().isoformat())

    def new_conversation(self) -> None:
        """Forget the chat history. Memory files and tasks are kept."""
        self.messages = []
        self.store.save_messages(self.messages)

    def run(
        self,
        user_text: str,
        on_text: Callable[[str], None],
        on_event: Callable[[str, dict], None] = lambda kind, payload: None,
    ) -> str:
        """Send one user turn, run tools until Claude is done, and stream reply text to `on_text`.

        `on_event` gets ("tool_start", {id, name, input}) before each tool runs and
        ("tool_end", {id, name, result, is_error}) after. Returns the final stop reason
        ("end_turn", "refusal", "max_tokens", ...).
        """
        self.messages.append({"role": "user", "content": user_text})
        runner = self.client.beta.messages.tool_runner(
            model=self.model,
            max_tokens=64000,
            stream=True,
            max_iterations=50,
            system=[{"type": "text", "text": self.system, "cache_control": {"type": "ephemeral"}}],
            messages=self.messages,
            tools=self.tools,
            output_config={"effort": "high"},
            # On a safety refusal the API re-runs the turn on a fallback model inside the same call.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
        stop_reason = "end_turn"
        try:
            for stream in runner:
                for text in stream.text_stream:
                    on_text(text)
                message = stream.get_final_message()
                self.messages.append({"role": "assistant", "content": [block.to_dict() for block in message.content]})
                calls = {b.id: b for b in message.content if b.type in ("tool_use", "server_tool_use")}
                for call in calls.values():
                    on_event("tool_start", {"id": call.id, "name": call.name, "input": call.input})
                for block in message.content:  # web_search / web_fetch results arrive in the same message
                    if block.type.endswith("_tool_result") and block.tool_use_id in calls:
                        on_event("tool_end", {"id": block.tool_use_id, "name": calls[block.tool_use_id].name, "result": "done", "is_error": False})
                tool_results = runner.generate_tool_call_response()
                if tool_results:
                    self.messages.append(tool_results)
                    for result in tool_results["content"]:
                        call = calls.get(result["tool_use_id"])
                        on_event("tool_end", {
                            "id": result["tool_use_id"],
                            "name": call.name if call else "",
                            "result": result.get("content", ""),
                            "is_error": bool(result.get("is_error")),
                        })
                stop_reason = message.stop_reason or stop_reason
        finally:
            # shortcut: history is never compacted, so a very long chat eventually hits the context limit;
            # add server-side compaction (beta compact-2026-01-12) when that happens. `/new` resets it today.
            self.store.save_messages(self.messages)
        return stop_reason
