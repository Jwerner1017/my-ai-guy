"""Client-side tools Aether can call. File tools stay inside the working directory; every write and
every shell command goes through `approve` first. Hosted mode (`computer=False`) gets only the task planner."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Callable, Literal

from anthropic import beta_tool

from .store import Store, format_tasks

MAX_CHARS = 100_000
# approve(tool_name, description) -> whether the user allowed it
Approve = Callable[[str, str], bool]


def build_tools(workdir: Path, store: Store, approve: Approve, computer: bool = True) -> list:
    root = workdir.resolve()

    def resolve(path: str) -> Path:
        target = (root / path).resolve()
        if target != root and not target.is_relative_to(root):
            raise ValueError(f"{path} is outside the working directory {root}")
        return target

    def clip(text: str) -> str:
        if len(text) <= MAX_CHARS:
            return text
        return text[:MAX_CHARS] + f"\n[truncated: {len(text):,} characters total]"

    @beta_tool
    def list_directory(path: str = ".") -> str:
        """List the files and folders at a path inside the working directory. Call it to find files before reading them.

        Args:
            path: Folder path relative to the working directory. Defaults to the working directory itself.
        """
        entries = sorted(resolve(path).iterdir(), key=lambda e: e.name)
        return "\n".join(e.name + ("/" if e.is_dir() else "") for e in entries) or "(empty)"

    @beta_tool
    def read_file(path: str) -> str:
        """Read a UTF-8 text file inside the working directory. Call it when the user asks about a file or before you edit one.

        Args:
            path: File path relative to the working directory.
        """
        return clip(resolve(path).read_text(encoding="utf-8"))

    # eager_input_streaming: `content` is the one large tool argument, so stream it instead of buffering.
    @beta_tool(eager_input_streaming=True)
    def write_file(path: str, content: str) -> str:
        """Create or overwrite a UTF-8 text file inside the working directory. The user approves each write.

        Args:
            path: File path relative to the working directory. Missing parent folders are created.
            content: The complete new contents of the file.
        """
        target = resolve(path)
        if not approve("write_file", f"write {len(content):,} characters to {target}"):
            return "The user declined this write. Ask them how to proceed."
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return f"Wrote {len(content):,} characters to {target}"

    @beta_tool
    def run_shell(command: str, timeout_seconds: int = 120) -> str:
        """Run a shell command in the working directory and return its exit code and output. Use it for anything the other tools cannot do: git, package installs, scripts, system information. The user approves every command.

        Args:
            command: The command line to run with the system shell.
            timeout_seconds: Kill the command after this many seconds.
        """
        if not approve("run_shell", f"run: {command}"):
            return "The user declined to run this command. Ask them how to proceed."
        try:
            result = subprocess.run(
                command, shell=True, cwd=root, capture_output=True, text=True, timeout=timeout_seconds
            )
        except subprocess.TimeoutExpired:
            return f"Timed out after {timeout_seconds} seconds."
        return clip(f"exit code {result.returncode}\n{result.stdout}{result.stderr}".rstrip())

    @beta_tool
    def tasks(
        action: Literal["list", "add", "update"],
        title: str = "",
        task_id: int = 0,
        status: str = "",
        notes: str = "",
    ) -> str:
        """Plan and track multi-step work; the list persists across sessions. Call `list` first on any request that takes several steps, `add` one task per step before you start, and `update` each task as you finish it.

        Args:
            action: list shows open tasks; add creates one; update changes status or notes.
            title: The task in one short sentence (add).
            task_id: Which task to change (update).
            status: todo, doing, done or blocked (update).
            notes: Progress notes or the result (add or update).
        """
        if action == "add":
            if not title:
                raise ValueError("title is required to add a task")
            return f"Added task #{store.add_task(title, notes)}: {title}"
        if action == "update":
            if store.update_task(task_id, status, notes):
                return f"Updated task #{task_id}"
            return f"No task #{task_id}, or nothing to change."
        return format_tasks(store.list_tasks())

    # The hosted service must never touch its own disk or shell on a user's behalf.
    return [list_directory, read_file, write_file, run_shell, tasks] if computer else [tasks]
