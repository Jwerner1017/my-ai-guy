# My AI Guy (Aether Companion)

This is the web app for **Aether Companion**, a private AI assistant, live at **https://myaiguy.me**. It includes:

- A public landing and pricing page (`/landing`) for two tiers: a **Self-Host** license ($49 one-time) and **Hosted Pro** ($19/month). After checkout, buyers go to `/thank-you`.
- A signed-in dashboard: goals (`/goals`), memory browser (`/memory`), voice mode (`/voice`), tools and approvals (`/tools`), settings (`/settings`), and onboarding.

The app is built and hosted on **Base44**. It's a React 18 + Vite 6 SPA (React Router 6, Tailwind 3, shadcn/ui) that uses the Base44 SDK for auth and data. It also has two Base44 backend functions (Deno) for Wix Payments checkout.

> Base44 syncs this repo in both directions. Anything pushed here shows up in the Base44 Builder, and publishing from Base44 deploys myaiguy.me.

## Layout

| Path | What it is |
|---|---|
| `src/pages/` | Route pages (see `src/App.jsx` for the router) |
| `src/components/` | UI, including `components/aether/*` and the shadcn `components/ui/*` |
| `src/api/base44Client.js` | Base44 SDK client |
| `base44/config.jsonc` | Base44 CLI project config (`serveCommand: npm run dev`) |
| `base44/entities/` | Base44 data entities (`User`) |
| `base44/functions/create-checkout/` | Creates a Wix Payments checkout for `self_host` / `hosted_pro` |
| `base44/functions/wix-payments-webhook/` | Receives Wix Payments events and verifies the RS256 JWT signature (fails closed) |

## Environment variables

These are names only. Never commit values. `.env*` files are gitignored.

**Frontend (Vite)**: put these in `.env.local` for frontend-only work against the hosted backend. `base44 dev` injects local values for you.

| Name | Required | Purpose |
|---|---|---|
| `VITE_BASE44_APP_ID` | yes | Base44 app id |
| `VITE_BASE44_APP_BASE_URL` | yes (frontend-only dev) | Deployed Base44 app URL that the Vite plugin proxies `/api` to |
| `VITE_BASE44_FUNCTIONS_VERSION` | no | Pins a backend-functions version (defaults to the current one) |
| `BASE44_LEGACY_SDK_IMPORTS` | no | `true` enables legacy `@/entities` / `@/integrations` imports in `vite.config.js` |

**Backend functions (Base44 secrets)**: set these in the Base44 dashboard, not in the repo.

| Name | Used by | Purpose |
|---|---|---|
| `WIX_PAYMENTS_API_KEY` | `create-checkout` | Wix Payments API key |
| `WIX_PAYMENTS_SITE_ID` | `create-checkout` | Wix site id |
| `WIX_PAYMENTS_WEBHOOK_PUBLIC_KEY` | `wix-payments-webhook` | Public key used to verify webhook JWTs |

## Run locally

Prerequisites: Node 20+ and npm.

```bash
npm ci                         # install from the lockfile
npm install -g base44@latest   # Base44 CLI (only needed for `base44 dev` / publishing)
```

- **Full stack** (local Base44 backend plus frontend): `base44 dev`, then open the frontend URL it prints.
- **Frontend only**, against the hosted backend: create `.env.local` with `VITE_BASE44_APP_ID` and `VITE_BASE44_APP_BASE_URL`, then run `npm run dev`.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serves the built `dist/` |
| `npm run lint` / `lint:fix` | ESLint (quiet) / autofix |
| `npm run typecheck` | `tsc -p jsconfig.json` |

## Publish

Push to git, then publish from the Base44 dashboard (`base44 dashboard open`). Publishing deploys myaiguy.me.

## Docs

- Base44 + GitHub: https://docs.base44.com/Integrations/Using-GitHub
- Base44 CLI: https://docs.base44.com/developers/references/cli/commands/introduction
