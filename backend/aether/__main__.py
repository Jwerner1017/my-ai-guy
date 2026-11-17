"""Terminal chat with Aether: `aether` or `python -m aether`."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import anthropic

from .agent import DEFAULT_MODEL, Agent
from .store import format_tasks

HELP = "Commands: /tasks (open tasks), /new (fresh conversation, keeps memory), /quit"


def approve(tool_name: str, action: str) -> bool:
    if os.environ.get("AETHER_AUTO_APPROVE") == "1":
        return True
    answer = input(f"\n  Aether wants to {action}\n  Allow? [y/N] ")
    return answer.strip().lower() in ("y", "yes")


def main() -> None:
    home = Path(os.environ.get("AETHER_HOME", Path.home() / ".aether"))
    agent = Agent(home=home, workdir=Path.cwd(), approve=approve, model=os.environ.get("AETHER_MODEL", DEFAULT_MODEL))
    print(f"Aether online ({agent.model}). Memory and tasks live in {home}.\n{HELP}\n")

    while True:
        try:
            line = input("you> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return
        if not line:
            continue
        if line in ("/quit", "/exit"):
            return
        if line == "/new":
            agent.new_conversation()
            print("Started a fresh conversation. Memory and tasks are kept.\n")
            continue
        if line == "/tasks":
            print(format_tasks(agent.store.list_tasks()) + "\n")
            continue

        print("aether> ", end="", flush=True)
        try:
            stop_reason = agent.run(line, on_text=lambda text: print(text, end="", flush=True))
        except anthropic.AuthenticationError:
            sys.exit("\nNo valid Anthropic credentials. Set ANTHROPIC_API_KEY (keys: https://platform.claude.com) and run again.")
        except anthropic.APIStatusError as err:
            print(f"\n[API error {err.status_code}: {err.message}]\n")
            continue
        except KeyboardInterrupt:
            print("\n[cancelled]\n")
            continue
        if stop_reason == "refusal":
            print("\n[Aether declined this request for safety reasons]")
        elif stop_reason == "max_tokens":
            print("\n[The reply hit the output limit and was cut off]")
        print("\n")


if __name__ == "__main__":
    main()
