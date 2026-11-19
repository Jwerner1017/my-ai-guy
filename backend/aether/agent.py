"""The agent loop: Claude with tools, the conversation persisted between runs."""

from __future__ import annotations

import datetime as dt
import json
import platform
import re
import shutil
from pathlib import Path
from typing import Callable

import anthropic

# Shipped with the SDK but not re-exported from anthropic.lib.tools yet.
from anthropic.lib.tools._beta_builtin_memory_tool import BetaLocalFilesystemMemoryTool

from .store import Store
from .tools import Approve, build_tools

DEFAULT_MODEL = "claude-opus-5-5"

SYSTEM = """You are Aether, a personal AI assistant. You get things done rather than describe how they could be done.

Working rules:
- At the start of a session, view /memories to recall who the user is and what you were working on. Save durable facts about the user, their preferences and their decisions there. Never store secrets or passwords.
- For any request that takes several steps, plan it with the `tasks` tool before acting and update the tasks as you finish them.
{tool_rule}
- Use web_search for anything that may have changed since your training, and web_fetch to read a page the user names.
- Be concise and plain-spoken. Report what you did and what it depends on. When you are blocked, ask one clear question.

{where} Today is {{date}}."""  # {date} is filled in per run
COMPUTER_RULE = "- Use the file tools to read and write files. Use `run_shell` for everything else. Every shell command and file write is shown to the user for approval, so make each one count."
HOSTED_RULE = "- You run as a hosted service with no access to the user's files or computer. When a request needs them, say so and suggest the self-hosted version."

# cli-hub (pip install cli-anything-hub) records every CLI it installs here, whatever the source.
CLI_HUB_FILE = Path.home() / ".cli-hub" / "installed.json"
COMMAND_NAME = re.compile(r"[A-Za-z0-9][\w.-]*")


def cli_anything_rule(installed_file: Path | None = None) -> str:
    """A prompt line naming the CLI-Anything CLIs on this computer, or "" when cli-hub isn't set up."""
    try:
        installed = json.loads((installed_file or CLI_HUB_FILE).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        installed = {}
    commands = set()
    for entry in installed.values() if isinstance(installed, dict) else []:
        command = entry.get("entry_point") if isinstance(entry, dict) else None
        # The file is local but goes into the prompt, so only plain command names that are really on PATH.
        if isinstance(command, str) and COMMAND_NAME.fullmatch(command) and shutil.which(command):
            commands.add(command)
    hub = shutil.which("cli-hub") is not None
    if not commands and not hub:
        return ""
    rule = "\n- CLI-Anything tools drive desktop software (image, office, audio, video, 3D, diagrams) through `run_shell`."
    if commands:
        rule += (
            f" Installed: {', '.join(f'`{c}`' for c in sorted(commands))}."
            " Run `<command> --help` first, put `--json` right after the command name for machine-readable output,"
            " use absolute paths, and check that exported files exist."
        )
    if hub:
        rule += " `cli-hub search <task>` finds more, `cli-hub info <name>` lists what one needs, and `cli-hub install <name>` adds it."
    return rule

# Haiku 5.5 takes the basic web tools and has no server-side refusal fallback (a fallback list 400s there).
WEB_TOOLS = [{"type": "web_search_20260209", "name": "web_search"}, {"type": "web_fetch_20260209", "name": "web_fetch"}]
BASIC_WEB_TOOLS = [{"type": "web_search_20250305", "name": "web_search"}, {"type": "web_fetch_20250910", "name": "web_fetch"}]
BASIC_WEB_MODELS = {"claude-haiku-5-5"}
EFFORT = {"claude-haiku-5-5": "medium", "claude-sonnet-5-5": "medium"}  # everything else runs at "high"

# keep_going(model, usage) is called after each model call; returning False ends the turn early.
KeepGoing = Callable[[str, object], bool]


class Agent:
    def __init__(
        self,
        home: Path,
        workdir: Path,
        approve: Approve,
        model: str = DEFAULT_MODEL,
        client: anthropic.Anthropic | None = None,
        computer: bool = True,
    ):
        self.client = client or anthropic.Anthropic()
        self.model = model
        self.store = Store(home / "aether.db")
        self.messages: list[dict] = self.store.load_messages()
        self.tools = [
            BetaLocalFilesystemMemoryTool(str(home)),  # files under <home>/memories
            *build_tools(workdir, self.store, approve, computer=computer),
        ]
        where = f"You run on the user's own computer ({platform.platform()}). Working directory: {workdir.resolve()}." if computer else ""
        # {clis} is filled in per run, like {date}, so a CLI installed mid-chat shows up on the next turn.
        self.system = SYSTEM.format(tool_rule=COMPUTER_RULE + "{clis}" if computer else HOSTED_RULE, where=where).strip()

    def new_conversation(self) -> None:
        """Forget the chat history. Memory files and tasks are kept."""
        self.messages = []
        self.store.save_messages(self.messages)

    def run(
        self,
        user_text: str,
        on_text: Callable[[str], None],
        on_event: Callable[[str, dict], None] = lambda kind, payload: None,
        keep_going: KeepGoing = lambda model, usage: True,
    ) -> str:
        """Send one user turn, run tools until Claude is done, and stream reply text to `on_text`.

        `on_event` gets ("tool_start", {id, name, input}) before each tool runs and
        ("tool_end", {id, name, result, is_error}) after. Returns the final stop reason
        ("end_turn", "refusal", "max_tokens", ...), or "budget" when `keep_going` stopped it.
        """
        self.messages.append({"role": "user", "content": user_text})
        system = self.system.replace("{date}", dt.date.today().isoformat())
        if "{clis}" in system:
            system = system.replace("{clis}", cli_anything_rule())
        basic = self.model in BASIC_WEB_MODELS
        # On a safety refusal the API re-runs the turn on a fallback model inside the same call.
        fallback = {} if basic else {"betas": ["server-side-fallback-2026-07-01"], "fallbacks": "default"}
        runner = self.client.beta.messages.tool_runner(
            model=self.model,
            max_tokens=64000,
            stream=True,
            max_iterations=50,
            # The date and the CLI list sit in the system prompt, so the cache turns over once a day or on a new CLI.
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            messages=self.messages,
            tools=[*self.tools, *(BASIC_WEB_TOOLS if basic else WEB_TOOLS)],
            output_config={"effort": EFFORT.get(self.model, "high")},
            **fallback,
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
                # Usage is always reported; the turn only stops early if Claude still has tool work queued.
                if not keep_going(message.model or self.model, message.usage) and tool_results:
                    stop_reason = "budget"  # history ends on tool results, so the next turn is still valid
                    break
        finally:
            # shortcut: history is never compacted, so a very long chat eventually hits the context limit;
            # add server-side compaction (beta compact-2026-01-12) when that happens. `/new` resets it today.
            self.store.save_messages(self.messages)
        return stop_reason
