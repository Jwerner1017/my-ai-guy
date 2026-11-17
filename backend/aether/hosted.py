"""The hosted, multi-user Aether service behind myaiguy.me: `aether-hosted`.

- Accounts are the app's Base44 users. A socket's first message is `{"type": "auth", "payload": {"token": ...}}`
  carrying the user's Base44 access token, which is checked against Base44 before anything else runs.
- Each user gets their own agent, memory, tasks and conversation under `<AETHER_HOME>/users/<id>`. Hosted
  agents have no file or shell tools: they run on our server, not the user's computer.
- Stripe Checkout sells the Pro and Power plans, the Stripe customer portal manages them, and Stripe webhooks
  set each account's plan. Every goal is metered against the plan's monthly caps (see `accounts.py`).
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Callable

import anthropic
import stripe
from aiohttp import web

from .accounts import GOAL_SHARE, PLANS, Accounts, blocked, cost_usd, route
from .server import CompanionServer, envelope

USER_ID = re.compile(r"[A-Za-z0-9_-]{1,64}")  # also a directory name, so nothing else gets through
PAID = ("active", "trialing", "past_due")  # past_due keeps access while Stripe retries the card
# verify(token) -> {"id", "email"} for a signed-in user, or None
Verify = Callable[[str], "dict | None"]


def SIGN_IN() -> web.Response:
    return web.json_response({"error": "Sign in first."}, status=401)


def base44_verifier(app_id: str, server_url: str = "https://base44.app") -> Verify:
    """Check a Base44 access token by asking Base44 who it belongs to (the SDK's `auth.me()`)."""

    def verify(token: str) -> dict | None:
        request = urllib.request.Request(
            f"{server_url}/api/apps/{app_id}/entities/User/me",
            headers={"Authorization": f"Bearer {token}", "X-App-Id": app_id},
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                user = json.load(response)
        except (urllib.error.URLError, TimeoutError, ValueError):
            return None
        user_id = str(user.get("id", "")) if isinstance(user, dict) else ""
        return {"id": user_id, "email": str(user.get("email", ""))} if USER_ID.fullmatch(user_id) else None

    return verify


async def health(request: web.Request) -> web.Response:
    return web.Response(text="ok")


class HostedSession(CompanionServer):
    """One user's assistant. Every browser tab the user opens shares it."""

    def __init__(self, home: Path, user_id: str, accounts: Accounts, client: anthropic.Anthropic | None = None):
        super().__init__(home, home, client=client, computer=False)
        self.user_id = user_id
        self.accounts = accounts
        self.choice = "auto"  # "auto" lets `route` pick per goal; a model name pins it

    def plan(self):
        return PLANS[self.accounts.summary(self.user_id)["plan"]]

    async def send_account(self) -> None:
        await self.broadcast("account_update", self.accounts.summary(self.user_id))

    async def run_goal(self, goal_text: str) -> None:
        async with self.goal_lock:
            summary = self.accounts.summary(self.user_id)
            reason = blocked(summary)
            if reason:
                await self.broadcast("goal_started", {"goal_text": goal_text})
                await self.broadcast("goal_complete", {"result": f"{reason} Upgrade or wait until the 1st for more.", "limit_reached": True})
                await self.send_account()
                return
            plan = PLANS[summary["plan"]]
            self.agent.model = route(plan, goal_text, self.choice, 1 - summary["allowance_used"])
            budget = min(summary["allowance_left_usd"], plan.allowance_usd * GOAL_SHARE)
            spent = 0.0

            def keep_going(model: str, usage) -> bool:  # runs on the agent thread
                nonlocal spent
                spent += cost_usd(model, usage)
                return spent < budget

            try:
                await self.execute_goal(goal_text, keep_going)
            finally:
                self.accounts.record(self.user_id, spent, messages=1 if spent else 0)  # API down: not counted
            await self.send_account()

    async def dispatch(self, ws: web.WebSocketResponse, kind: str, payload: dict) -> None:
        if kind == "models_list_request":
            await ws.send_str(envelope("models_list", {"models": ["auto", *self.plan().models]}))
        elif kind == "model_select":
            if payload.get("model") in ("auto", *self.plan().models):
                self.choice = payload["model"]
                await self.broadcast("status_update", {"activity": f"Model set to {self.choice}"})
        elif kind == "account_fetch":
            await self.send_account()
        else:
            await super().dispatch(ws, kind, payload)


class HostedServer:
    def __init__(
        self,
        home: Path,
        verify: Verify,
        stripe_client,
        prices: dict[str, str],
        webhook_secret: str,
        app_url: str = "https://myaiguy.me",
        client: anthropic.Anthropic | None = None,
    ):
        self.home = home
        self.verify = verify
        self.stripe = stripe_client
        self.prices = prices  # plan name -> Stripe price id
        self.plan_for_price = {price: plan for plan, price in prices.items()}
        self.webhook_secret = webhook_secret
        self.app_url = app_url.rstrip("/")
        self.client = client
        self.accounts = Accounts(home / "accounts.db")
        # shortcut: sessions stay in memory until restart; evict idle ones once there are thousands of users.
        self.sessions: dict[str, HostedSession] = {}

    def session(self, user_id: str) -> HostedSession:
        if user_id not in self.sessions:
            session = HostedSession(self.home / "users" / user_id, user_id, self.accounts, client=self.client)
            session.loop = asyncio.get_running_loop()
            self.sessions[user_id] = session
        return self.sessions[user_id]

    async def user_for(self, token: str | None) -> dict | None:
        user = await asyncio.to_thread(self.verify, token) if token else None
        if user:
            self.accounts.ensure(user["id"], user["email"])
        return user

    # ---- WebSocket --------------------------------------------------------------------------

    async def handle_socket(self, request: web.Request) -> web.WebSocketResponse:
        ws = web.WebSocketResponse(heartbeat=30)
        await ws.prepare(request)
        try:
            first = await ws.receive_json(timeout=15)
            token = first["payload"]["token"] if first.get("type") == "auth" else None
        except (asyncio.TimeoutError, TypeError, ValueError, KeyError, AttributeError):
            token = None
        user = await self.user_for(token if isinstance(token, str) else None)
        if not user:
            await ws.send_str(envelope("auth_error", {"message": "Sign in at myaiguy.me to use hosted Aether."}))
            await ws.close(code=4401, message=b"unauthorized")
            return ws
        session = self.session(user["id"])
        await ws.send_str(envelope("account_update", self.accounts.summary(user["id"])))
        await session.serve_socket(ws)
        return ws

    # ---- Billing (HTTP) ---------------------------------------------------------------------

    async def billing_user(self, request: web.Request) -> dict | None:
        header = request.headers.get("Authorization", "")
        return await self.user_for(header.removeprefix("Bearer ").strip() or None)

    async def portal_url(self, customer_id: str) -> str:
        portal = await asyncio.to_thread(
            self.stripe.v1.billing_portal.sessions.create,
            {"customer": customer_id, "return_url": f"{self.app_url}/settings"},
        )
        return portal.url

    async def checkout(self, request: web.Request) -> web.Response:
        user = await self.billing_user(request)
        if not user:
            return SIGN_IN()
        try:
            plan = (await request.json()).get("plan")
        except (ValueError, AttributeError):
            plan = None
        if plan not in self.prices:
            return web.json_response({"error": f"Choose one of: {', '.join(self.prices)}."}, status=400)
        account = self.accounts.get(user["id"])
        if account["plan"] != "free" and account["stripe_customer_id"]:
            # Already subscribed: plan switches and cancellations happen in the portal, never a second subscription.
            return web.json_response({"url": await self.portal_url(account["stripe_customer_id"])})
        params = {
            "mode": "subscription",
            "line_items": [{"price": self.prices[plan], "quantity": 1}],
            "client_reference_id": user["id"],
            "subscription_data": {"metadata": {"user_id": user["id"]}},
            "allow_promotion_codes": True,
            "success_url": f"{self.app_url}/thank-you?tier={plan}",
            "cancel_url": f"{self.app_url}/landing#pricing",
        }
        if account["stripe_customer_id"]:
            params["customer"] = account["stripe_customer_id"]
        elif user["email"]:
            params["customer_email"] = user["email"]
        session = await asyncio.to_thread(self.stripe.v1.checkout.sessions.create, params)
        return web.json_response({"url": session.url})

    async def portal(self, request: web.Request) -> web.Response:
        user = await self.billing_user(request)
        if not user:
            return SIGN_IN()
        customer = self.accounts.get(user["id"])["stripe_customer_id"]
        if not customer:
            return web.json_response({"error": "There is no billing account yet. Choose a plan first."}, status=400)
        return web.json_response({"url": await self.portal_url(customer)})

    async def webhook(self, request: web.Request) -> web.Response:
        payload = await request.read()
        try:
            stripe.Webhook.construct_event(payload, request.headers.get("Stripe-Signature", ""), self.webhook_secret)
        except (ValueError, stripe.SignatureVerificationError):
            return web.Response(status=400, text="bad signature")
        user_id = self.apply_event(json.loads(payload))
        if user_id in self.sessions:
            await self.sessions[user_id].send_account()
        return web.Response(text="ok")

    def apply_event(self, event: dict) -> str | None:
        """Update an account from a verified Stripe event; returns the user it changed."""
        obj = event["data"]["object"]
        kind = event["type"]
        if kind == "checkout.session.completed":
            user_id = obj.get("client_reference_id")
            if user_id and obj.get("customer") and self.accounts.get(user_id):
                self.accounts.link_customer(user_id, obj["customer"])
                return user_id
            return None
        if not kind.startswith("customer.subscription."):
            return None
        account = self.accounts.get((obj.get("metadata") or {}).get("user_id") or "") or self.accounts.by_customer(obj.get("customer") or "")
        if not account:
            return None  # not one of ours
        price = obj["items"]["data"][0]["price"]["id"] if obj.get("items", {}).get("data") else None
        plan = self.plan_for_price.get(price, "free")
        if kind == "customer.subscription.deleted" or obj.get("status") not in PAID:
            if account["stripe_subscription_id"] not in (None, obj["id"]):
                return None  # an old subscription ending must not cancel the current one
            plan = "free"
        self.accounts.set_plan(account["user_id"], plan, at=event["created"], customer=obj.get("customer"), subscription=obj["id"])
        return account["user_id"]

    # ---- App --------------------------------------------------------------------------------

    def app(self, origins: tuple[str, ...] = ()) -> web.Application:
        allowed = set(origins) or {self.app_url}

        @web.middleware
        async def cors(request: web.Request, handler):
            """Let the app's own origin call the billing routes from the browser."""
            if not request.path.startswith("/billing/"):
                return await handler(request)
            response = web.Response(status=204) if request.method == "OPTIONS" else await handler(request)
            origin = request.headers.get("Origin", "")
            if origin in allowed:
                response.headers.update({
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Headers": "Authorization, Content-Type",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Vary": "Origin",
                })
            return response

        app = web.Application(middlewares=[cors])
        app.router.add_get("/", self.handle_socket)
        app.router.add_get("/health", health)
        app.router.add_post("/billing/checkout", self.checkout)
        app.router.add_post("/billing/portal", self.portal)
        app.router.add_post("/stripe/webhook", self.webhook)
        return app

    async def serve_forever(self, host: str, port: int, origins: tuple[str, ...] = ()) -> None:
        runner = web.AppRunner(self.app(origins))
        await runner.setup()
        await web.TCPSite(runner, host, port).start()
        try:
            await asyncio.Event().wait()
        finally:
            await runner.cleanup()


REQUIRED = ("ANTHROPIC_API_KEY", "BASE44_APP_ID", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_PRO", "STRIPE_PRICE_POWER")


def main() -> None:
    missing = [name for name in REQUIRED if not os.environ.get(name)]
    if missing:
        sys.exit(f"Set these environment variables first: {', '.join(missing)} (see backend/README.md).")
    env = os.environ
    home = Path(env.get("AETHER_HOME", Path.home() / ".aether-hosted"))
    host, port = env.get("AETHER_BIND", "127.0.0.1"), int(env.get("AETHER_PORT", "8765"))
    app_url = env.get("AETHER_APP_URL", "https://myaiguy.me")
    origins = tuple(o.strip() for o in env.get("AETHER_ALLOWED_ORIGINS", app_url).split(",") if o.strip())
    server = HostedServer(
        home,
        verify=base44_verifier(env["BASE44_APP_ID"], env.get("BASE44_SERVER_URL", "https://base44.app")),
        stripe_client=stripe.StripeClient(env["STRIPE_SECRET_KEY"]),
        prices={"pro": env["STRIPE_PRICE_PRO"], "power": env["STRIPE_PRICE_POWER"]},
        webhook_secret=env["STRIPE_WEBHOOK_SECRET"],
        app_url=app_url,
    )
    mode = "TEST mode" if env["STRIPE_SECRET_KEY"].startswith("sk_test_") else "LIVE mode"
    print(f"Hosted Aether on http://{host}:{port} (Stripe {mode}). Accounts and user data in {home}.")
    try:
        asyncio.run(server.serve_forever(host, port, origins))
    except KeyboardInterrupt:
        print("\nHosted Aether stopped.")


if __name__ == "__main__":
    main()
