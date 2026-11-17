# Aether backend

The brain of My AI Guy: a personal AI assistant on Claude Opus 5.5 with native tool use. It reads and writes files, runs shell commands (with your approval), searches and reads the web, keeps memory across sessions, and plans multi-step work with a persistent task list. It serves the companion app in this repo over WebSocket and also has a terminal chat.

## Install

Python 3.10 or newer.

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -e .
export ANTHROPIC_API_KEY=sk-ant-...                   # from https://platform.claude.com
```

## Run the backend for the app

```bash
cd ~/some/project     # the file tools work inside the folder you start it from
aether-server         # ws://127.0.0.1:8765
```

Then open the companion app, choose manual connection, and enter `127.0.0.1` and port `8765`. The app sends goals, streams the reply, shows each tool call, and asks you to approve shell commands and file writes.

To reach it from your phone on the same Wi-Fi, start it with `AETHER_BIND=0.0.0.0`. There is no password yet, so do that only on a network you trust. A browser page served over https (the hosted app) cannot open a plain `ws://` connection to a LAN address; use the app on the same computer, a locally served build (`npm run dev`), or wait for the TLS step in the UI phase.

## Terminal chat

```bash
aether
```

Commands: `/tasks` shows open tasks, `/new` starts a fresh conversation (memory and tasks are kept), `/quit` exits. Every shell command and file write is shown to you first and needs a `y`.

## Settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | required | Your Anthropic API key |
| `AETHER_MODEL` | `claude-opus-5-5` | Claude model to use |
| `AETHER_HOME` | `~/.aether` | Memory files (`memories/`) and the SQLite database |
| `AETHER_BIND` | `127.0.0.1` | Address `aether-server` listens on; `0.0.0.0` opens it to the network |
| `AETHER_PORT` | `8765` | Port `aether-server` listens on |
| `AETHER_AUTO_APPROVE` | unset | `1` skips approval prompts in the terminal chat (sandbox only) |

## Layout

- `aether/agent.py` the agent loop (Claude tool runner, streaming, persisted conversation)
- `aether/tools.py` client-side tools: files, shell, task planner
- `aether/store.py` SQLite store for the conversation and tasks
- `aether/server.py` WebSocket server speaking the app protocol in `src/lib/wsClient.js`
- `aether/__main__.py` the terminal chat
- `tests/` offline tests: `pip install -e ".[dev]" && pytest`
