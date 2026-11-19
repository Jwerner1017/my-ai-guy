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

## Desktop software (CLI-Anything)

Aether can drive desktop software such as GIMP, LibreOffice, Blender, Audacity or draw.io through [CLI-Anything](https://github.com/HKUDS/CLI-Anything) command-line tools. Install them with CLI-Hub on the computer that runs `aether` or `aether-server`, plus the desktop app each one wraps:

```bash
pip install cli-anything-hub
cli-hub install gimp          # also needs GIMP itself, e.g. apt install gimp
```

At startup Aether reads `~/.cli-hub/installed.json`, tells Claude which of those commands are on your PATH, and Claude runs them through `run_shell`, so you still approve every command. Restart Aether after installing a new one. The hosted service never gets them.

## Hosted service (`aether-hosted`)

The hosted, multi-user version behind myaiguy.me. People sign in with their myaiguy.me (Base44) account, and every account gets its own agent, memory, tasks and conversation under `$AETHER_HOME/users/<id>`. Hosted agents have no file or shell tools, because they run on your server, not the user's computer. Stripe sells the paid plans.

| Plan | Price | Messages / month | Usage allowance / month | Models |
|---|---|---|---|---|
| Free | $0 | 30 | $0.20 | Claude Haiku 5.5 |
| Pro | $12 | 300 | $6 | Haiku 5.5 and Sonnet 5.5, routed per request |
| Power | $39 | 1,000 | $20 | adds Opus 5.5 for hard, multi-step work |

- **Both caps are hard.** A goal is refused once either is used up, and one goal may spend at most a quarter of the monthly allowance. The allowance is real Claude API spend (tokens, cache, web searches), so a plan never costs more to serve than it earns. Both reset on the 1st of the month (UTC).
- **Routing.** In "auto" mode, short chat goes to Haiku, real work to Sonnet, and long or "in-depth" requests to Opus on Power. Under 10% of the allowance left, everything goes to Haiku. Users can pin any model their plan includes.
- Change limits and prices in `aether/accounts.py` (`PLANS`), the Stripe prices, and the cards in `src/pages/Landing.jsx`. Keep all three in step.

### Set up Stripe (test mode first)

1. In the Stripe Dashboard, in **test mode**, create a product "Aether Pro" with a $12/month recurring price and "Aether Power" with $39/month. Copy both price ids (`price_...`).
2. Turn on the customer portal (Settings, Billing, Customer portal) and allow plan switching between the two prices and cancellation.
3. Add a webhook endpoint at `https://<your-api-host>/stripe/webhook` for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`. Copy its signing secret (`whsec_...`). For local testing: `stripe listen --forward-to localhost:8765/stripe/webhook`.
4. Test with card `4242 4242 4242 4242`. Switch to live keys only when you are ready to charge real cards; the server prints which mode it runs in.

### Run it

```bash
pip install -e .
export ANTHROPIC_API_KEY=sk-ant-...
export BASE44_APP_ID=...                      # same value as VITE_BASE44_APP_ID
export STRIPE_SECRET_KEY=sk_test_...
export STRIPE_WEBHOOK_SECRET=whsec_...
export STRIPE_PRICE_PRO=price_... STRIPE_PRICE_POWER=price_...
aether-hosted                                 # http + ws on 127.0.0.1:8765
```

Put it behind TLS (browsers on https://myaiguy.me can only open `wss://`). With Caddy, `api.myaiguy.me { reverse_proxy 127.0.0.1:8765 }` is the whole config. Then set `VITE_AETHER_HOSTED_URL=wss://api.myaiguy.me` for the web app. Until that variable is set, the app shows the hosted plans as "Coming soon".

Routes: `GET /` (WebSocket; first message must be `{"type": "auth", "payload": {"token": "<Base44 access token>"}}`), `GET /health`, `POST /billing/checkout` (`{"plan": "pro" | "power"}`), `POST /billing/portal`, `POST /stripe/webhook`. The billing routes take `Authorization: Bearer <Base44 access token>` and return `{"url"}` to redirect to.

## Settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | required | Your Anthropic API key |
| `AETHER_MODEL` | `claude-opus-5-5` | Claude model to use |
| `AETHER_HOME` | `~/.aether` | Memory files (`memories/`) and the SQLite database |
| `AETHER_BIND` | `127.0.0.1` | Address `aether-server` listens on; `0.0.0.0` opens it to the network |
| `AETHER_PORT` | `8765` | Port `aether-server` listens on |
| `AETHER_AUTO_APPROVE` | unset | `1` skips approval prompts in the terminal chat (sandbox only) |

Hosted service only (`aether-hosted`):

| Variable | Default | Meaning |
|---|---|---|
| `BASE44_APP_ID` | required | The Base44 app whose users can sign in |
| `BASE44_SERVER_URL` | `https://base44.app` | Base44 API host used to check sign-in tokens |
| `STRIPE_SECRET_KEY` | required | `sk_test_...` until you go live |
| `STRIPE_WEBHOOK_SECRET` | required | Signing secret of the webhook endpoint |
| `STRIPE_PRICE_PRO`, `STRIPE_PRICE_POWER` | required | Stripe price ids for the two paid plans |
| `AETHER_APP_URL` | `https://myaiguy.me` | Where Stripe sends people back to |
| `AETHER_ALLOWED_ORIGINS` | `AETHER_APP_URL` | Comma-separated origins allowed to call the billing routes |
| `AETHER_HOME` | `~/.aether-hosted` | Accounts database and each user's data |

## Layout

- `aether/agent.py` the agent loop (Claude tool runner, streaming, persisted conversation)
- `aether/tools.py` client-side tools: files, shell, task planner
- `aether/store.py` SQLite store for the conversation and tasks
- `aether/server.py` WebSocket server speaking the app protocol in `src/lib/wsClient.js`
- `aether/hosted.py` the hosted service: Base44 sign-in, per-user sessions, Stripe Checkout, portal and webhooks
- `aether/accounts.py` plans, prices per token, model routing and the usage ledger
- `aether/__main__.py` the terminal chat
- `tests/` offline tests: `pip install -e ".[dev]" && pytest`
