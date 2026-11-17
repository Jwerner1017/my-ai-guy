"""The hosted service: sign-in, per-plan limits and routing, metering, and Stripe billing, all offline."""

import asyncio
import hashlib
import hmac
import json
import time
from contextlib import asynccontextmanager
from types import SimpleNamespace

import aiohttp
import pytest
from aiohttp import web

from aether.accounts import HAIKU, OPUS, PLANS, SONNET, Accounts, blocked, cost_usd, route
from aether.agent import Agent
from aether.hosted import HostedServer
from test_core import USAGE, FakeClient, FakeRunner, FakeStream, fake_message
from test_server import recv, send

SECRET = "whsec_test"
PRICES = {"pro": "price_pro", "power": "price_power"}
USERS = {"tok-ann": {"id": "ann", "email": "ann@example.com"}, "tok-bob": {"id": "bob", "email": ""}}


class FakeStripe:
    def __init__(self):
        self.calls = []
        create = lambda kind: lambda params: self.calls.append((kind, params)) or SimpleNamespace(url=f"https://stripe.test/{kind}")
        self.v1 = SimpleNamespace(
            checkout=SimpleNamespace(sessions=SimpleNamespace(create=create("checkout"))),
            billing_portal=SimpleNamespace(sessions=SimpleNamespace(create=create("portal"))),
        )


def make_server(tmp_path, client=None):
    return HostedServer(tmp_path, verify=USERS.get, stripe_client=FakeStripe(), prices=PRICES, webhook_secret=SECRET, client=client or FakeClient())


@asynccontextmanager
async def running(server):
    runner = web.AppRunner(server.app())
    await runner.setup()
    await web.TCPSite(runner, "127.0.0.1", 0).start()
    try:
        async with aiohttp.ClientSession(base_url=f"http://127.0.0.1:{runner.addresses[0][1]}") as http:
            yield http
    finally:
        await runner.cleanup()


def signed(event: dict, secret: str = SECRET) -> tuple[str, dict]:
    body = json.dumps(event)
    stamp = int(time.time())
    signature = hmac.new(secret.encode(), f"{stamp}.{body}".encode(), hashlib.sha256).hexdigest()
    return body, {"Stripe-Signature": f"t={stamp},v1={signature}", "Content-Type": "application/json"}


def subscription_event(kind, sub_id="sub_1", status="active", price="price_pro", created=100, user_id="ann", customer="cus_1"):
    return {
        "type": kind,
        "created": created,
        "data": {"object": {
            "id": sub_id, "status": status, "customer": customer, "metadata": {"user_id": user_id} if user_id else {},
            "items": {"data": [{"price": {"id": price}}]},
        }},
    }


# ---- pricing, routing and the ledger ---------------------------------------------------------


def test_cost_counts_tokens_cache_and_searches():
    usage = SimpleNamespace(input_tokens=2_000, output_tokens=1_000, cache_creation_input_tokens=4_000,
                            cache_read_input_tokens=10_000, server_tool_use=SimpleNamespace(web_search_requests=2))
    # 2K x $2 + 4K x $2.50 + 10K x $0.10 + 1K x $10 per million, plus two $0.01 searches
    assert cost_usd(SONNET, usage) == pytest.approx((4_000 + 10_000 + 1_000 + 10_000) / 1e6 + 0.02)
    assert cost_usd(HAIKU, USAGE) == pytest.approx((1_000 * 0.10 + 100 * 0.50) / 1e6)
    long_prompt = SimpleNamespace(input_tokens=150_000, output_tokens=0, cache_creation_input_tokens=0, cache_read_input_tokens=0, server_tool_use=None)
    assert cost_usd(HAIKU, long_prompt) == pytest.approx(150_000 * 0.50 / 1e6)
    assert cost_usd("claude-opus-4-8", USAGE) > cost_usd(OPUS, USAGE)  # unknown fallback models price high


def test_route_respects_plan_choice_and_allowance():
    free, pro, power = PLANS["free"], PLANS["pro"], PLANS["power"]
    assert route(free, "write me a business plan for a bakery") == HAIKU
    assert route(pro, "what's the capital of France?") == HAIKU
    assert route(pro, "research the best e-bikes under $1500 and compare them") == SONNET
    assert route(pro, "give me an in-depth strategy for my startup") == SONNET  # no Opus on Pro
    assert route(power, "give me an in-depth strategy for my startup") == OPUS
    assert route(power, "research e-bikes", allowance_left=0.05) == HAIKU
    assert route(pro, "hi", choice=SONNET) == SONNET
    assert route(pro, "hi", choice=OPUS) == HAIKU  # a model the plan lacks falls back to routing


def test_ledger_caps_and_plan_events(tmp_path):
    accounts = Accounts(tmp_path / "accounts.db")
    accounts.ensure("ann", "ann@example.com")
    assert accounts.summary("ann")["plan"] == "free" and blocked(accounts.summary("ann")) is None

    accounts.record("ann", cost=0.05, messages=29)
    assert blocked(accounts.summary("ann")) is None
    accounts.record("ann", cost=0.01)
    assert "30 messages" in blocked(accounts.summary("ann"))

    accounts.ensure("bob")
    accounts.record("bob", cost=0.25)
    summary = accounts.summary("bob")
    assert summary["allowance_used"] == 1.0 and summary["allowance_left_usd"] == 0
    assert "allowance" in blocked(summary)

    assert accounts.set_plan("ann", "pro", at=200, customer="cus_1", subscription="sub_1")
    assert not accounts.set_plan("ann", "free", at=150)  # an older event arriving late is ignored
    assert accounts.get("ann")["plan"] == "pro" and accounts.by_customer("cus_1")["user_id"] == "ann"
    assert blocked(accounts.summary("ann")) is None  # 30 of 300 messages on Pro
    with pytest.raises(ValueError):
        accounts.set_plan("ann", "platinum", at=300)


def test_agent_stops_when_budget_runs_out(tmp_path):
    call = SimpleNamespace(type="tool_use", id="toolu_1", name="tasks", input={"action": "list"},
                           to_dict=lambda: {"type": "tool_use", "id": "toolu_1", "name": "tasks", "input": {"action": "list"}})

    class Looping(FakeRunner):
        def __iter__(self):
            while True:
                stream = FakeStream("")
                stream.message = fake_message("tool_use", [call])
                yield stream

        def generate_tool_call_response(self):
            return {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "toolu_1", "content": "No open tasks."}]}

    client = FakeClient()
    client.beta.messages.tool_runner = lambda **params: Looping(params)
    agent = Agent(home=tmp_path, workdir=tmp_path, approve=lambda *_: True, client=client, computer=False)
    calls = []
    stop = agent.run("loop", on_text=lambda _: None, keep_going=lambda model, usage: calls.append(model) or len(calls) < 3)
    assert stop == "budget" and len(calls) == 3
    assert agent.messages[-1]["content"][0]["type"] == "tool_result"  # safe to send the next turn


def test_hosted_agent_has_no_computer_tools_and_haiku_gets_basic_web_tools(tmp_path):
    client = FakeClient()
    agent = Agent(home=tmp_path, workdir=tmp_path, approve=lambda *_: True, client=client, model=HAIKU, computer=False)
    agent.run("hi", on_text=lambda _: None)
    params = client.last_params
    names = {t.get("name") if isinstance(t, dict) else t.name for t in params["tools"]}
    assert names == {"memory", "tasks", "web_search", "web_fetch"}
    assert {"type": "web_search_20250305", "name": "web_search"} in params["tools"]
    assert "fallbacks" not in params and params["output_config"] == {"effort": "medium"}
    assert "run_shell" not in params["system"][0]["text"] and "{date}" not in params["system"][0]["text"]


# ---- the hosted socket -----------------------------------------------------------------------


def test_socket_requires_a_valid_sign_in(tmp_path):
    async def scenario():
        async with running(make_server(tmp_path)) as http:
            async with http.ws_connect("/") as ws:
                await send(ws, "ping")  # anything but auth first is refused
                assert "Sign in" in (await recv(ws, "auth_error"))["message"]
                assert (await ws.receive()).type == aiohttp.WSMsgType.CLOSE and ws.close_code == 4401
            async with http.ws_connect("/") as ws:
                await send(ws, "auth", {"token": "forged"})
                await recv(ws, "auth_error")

    asyncio.run(scenario())


def test_goals_are_routed_metered_and_capped(tmp_path):
    async def scenario():
        client = FakeClient()
        server = make_server(tmp_path, client)
        async with running(server) as http:
            async with http.ws_connect("/") as ws:
                await send(ws, "auth", {"token": "tok-ann"})
                account = await recv(ws, "account_update")
                assert account["plan"] == "free" and account["messages_used"] == 0 and account["models"] == [HAIKU]
                await recv(ws, "status_update")

                await send(ws, "models_list_request")
                assert (await recv(ws, "models_list"))["models"] == ["auto", HAIKU]
                await send(ws, "model_select", {"model": OPUS})  # not on the free plan: ignored
                await send(ws, "goal_submit", {"goal_text": "hi"})
                assert (await recv(ws, "goal_complete"))["result"] == "Hello there"
                account = await recv(ws, "account_update")
                assert account["messages_used"] == 1 and account["allowance_used"] > 0
                assert client.last_params["model"] == HAIKU
                assert (tmp_path / "users" / "ann" / "memories").is_dir()

                server.accounts.record("ann", cost=0, messages=29)
                client.last_params = None
                await send(ws, "goal_submit", {"goal_text": "one more"})
                done = await recv(ws, "goal_complete")
                assert done["limit_reached"] and "Upgrade" in done["result"]
                assert client.last_params is None  # no Claude call once the cap is hit

            # A second user is fully separate.
            async with http.ws_connect("/") as ws:
                await send(ws, "auth", {"token": "tok-bob"})
                assert (await recv(ws, "account_update"))["messages_used"] == 0
            assert set(server.sessions) == {"ann", "bob"}

    asyncio.run(scenario())


# ---- billing over HTTP -----------------------------------------------------------------------


def test_checkout_portal_and_cors(tmp_path):
    async def scenario():
        server = make_server(tmp_path)
        auth = {"Authorization": "Bearer tok-ann", "Origin": "https://myaiguy.me"}
        async with running(server) as http:
            assert (await http.post("/billing/checkout", json={"plan": "pro"})).status == 401
            assert (await http.post("/billing/checkout", json={"plan": "gold"}, headers=auth)).status == 400
            assert (await http.post("/billing/portal", headers=auth)).status == 400  # no customer yet

            response = await http.post("/billing/checkout", json={"plan": "power"}, headers=auth)
            assert (await response.json())["url"] == "https://stripe.test/checkout"
            assert response.headers["Access-Control-Allow-Origin"] == "https://myaiguy.me"
            kind, params = server.stripe.calls[-1]
            assert kind == "checkout" and params["line_items"] == [{"price": "price_power", "quantity": 1}]
            assert params["client_reference_id"] == "ann" and params["subscription_data"]["metadata"] == {"user_id": "ann"}
            assert params["customer_email"] == "ann@example.com"

            preflight = await http.options("/billing/checkout", headers={"Origin": "https://myaiguy.me"})
            assert preflight.status == 204 and "Authorization" in preflight.headers["Access-Control-Allow-Headers"]
            stranger = await http.options("/billing/checkout", headers={"Origin": "https://evil.example"})
            assert "Access-Control-Allow-Origin" not in stranger.headers

            # Once subscribed, "checkout" opens the portal instead of starting a second subscription.
            server.accounts.set_plan("ann", "pro", at=1, customer="cus_1", subscription="sub_1")
            response = await http.post("/billing/checkout", json={"plan": "power"}, headers=auth)
            assert (await response.json())["url"] == "https://stripe.test/portal"
            assert server.stripe.calls[-1] == ("portal", {"customer": "cus_1", "return_url": "https://myaiguy.me/settings"})

    asyncio.run(scenario())


def test_stripe_webhooks_set_the_plan(tmp_path):
    async def post(http, event, secret=SECRET):
        body, headers = signed(event, secret)
        return await http.post("/stripe/webhook", data=body, headers=headers)

    async def scenario():
        server = make_server(tmp_path)
        server.accounts.ensure("ann", "ann@example.com")
        plan = lambda: server.accounts.get("ann")["plan"]
        async with running(server) as http:
            assert (await post(http, subscription_event("customer.subscription.created"), secret="whsec_wrong")).status == 400
            assert plan() == "free"

            completed = {"type": "checkout.session.completed", "created": 99,
                         "data": {"object": {"client_reference_id": "ann", "customer": "cus_1"}}}
            assert (await post(http, completed)).status == 200
            assert server.accounts.by_customer("cus_1")["user_id"] == "ann"

            await post(http, subscription_event("customer.subscription.created", created=100))
            assert plan() == "pro"
            # Upgrade in the portal; the event carries no metadata, so the customer id finds the account.
            await post(http, subscription_event("customer.subscription.updated", price="price_power", created=200, user_id=None))
            assert plan() == "power"
            await post(http, subscription_event("customer.subscription.updated", price="price_pro", created=150))
            assert plan() == "power"  # stale event ignored
            await post(http, subscription_event("customer.subscription.deleted", sub_id="sub_old", created=300))
            assert plan() == "power"  # an old subscription ending leaves the current one alone
            await post(http, subscription_event("customer.subscription.updated", status="past_due", price="price_power", created=400))
            assert plan() == "power"  # grace period while Stripe retries the card
            await post(http, subscription_event("customer.subscription.deleted", created=500))
            assert plan() == "free"
            assert (await post(http, subscription_event("customer.subscription.created", user_id="nobody", customer="cus_x"))).status == 200

    asyncio.run(scenario())
