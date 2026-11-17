"""Hosted plans, what usage costs, which model a goal runs on, and the per-account usage ledger.

Each plan has two hard monthly caps: a message count, and a usage allowance in US dollars of Claude API
spend. The allowance protects the margin: a plan can never cost more to serve than it earns.
"""

from __future__ import annotations

import re
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path

HAIKU, SONNET, OPUS = "claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"


@dataclass(frozen=True)
class Plan:
    name: str
    title: str
    messages: int  # goals per calendar month (UTC)
    allowance_usd: float  # Claude API spend per calendar month
    models: tuple[str, ...]  # cheapest first


# Keep in step with the plan cards in src/pages/Landing.jsx and the Stripe prices (STRIPE_PRICE_PRO / _POWER).
PLANS = {
    "free": Plan("free", "Free", 30, 0.20, (HAIKU,)),
    "pro": Plan("pro", "Pro", 300, 6.00, (HAIKU, SONNET)),  # $12/month
    "power": Plan("power", "Power", 1000, 20.00, (HAIKU, SONNET, OPUS)),  # $39/month
}
GOAL_SHARE = 0.25  # one goal may use at most this share of the monthly allowance

# USD per million tokens: (input, output, cache read). Cache writes bill at 1.25x input (5-minute TTL).
PRICES = {
    OPUS: (4.00, 20.00, 0.20),
    SONNET: (2.00, 10.00, 0.10),
    HAIKU: (0.10, 0.50, 0.01),
}
HAIKU_LONG = (0.50, 2.50, 0.05)  # Haiku's rate card for prompts over 100K tokens
UNKNOWN_PRICE = (5.00, 25.00, 0.50)  # a refusal fallback model (e.g. claude-opus-4-8); priced high on purpose
WEB_SEARCH_USD = 0.01


def cost_usd(model: str, usage) -> float:
    """What one model call cost, from the `usage` block on its response."""
    fresh = usage.input_tokens or 0
    written = usage.cache_creation_input_tokens or 0
    cached = usage.cache_read_input_tokens or 0
    price_in, price_out, price_cached = PRICES.get(model, UNKNOWN_PRICE)
    if model == HAIKU and fresh + written + cached > 100_000:
        price_in, price_out, price_cached = HAIKU_LONG
    searches = getattr(usage.server_tool_use, "web_search_requests", 0) or 0
    tokens = fresh * price_in + written * price_in * 1.25 + cached * price_cached + (usage.output_tokens or 0) * price_out
    return tokens / 1_000_000 + searches * WEB_SEARCH_USD


# shortcut: keyword routing, no classifier call; replace with a Haiku classifier if it routes badly in practice.
WORK = re.compile(r"\b(code|debug|fix|build|plan|research|analy[sz]|compare|write|draft|summari[sz]|explain|step|report|script|refactor|email)", re.I)
DEEP = re.compile(r"\b(architect|strateg|prove|in[- ]depth|thorough|complex|deep dive|business plan)", re.I)


def route(plan: Plan, text: str, choice: str = "auto", allowance_left: float = 1.0) -> str:
    """Pick the model for one goal. `allowance_left` is the unused share of the month's allowance (0-1)."""
    if choice in plan.models:
        return choice
    cheapest = plan.models[0]
    if len(plan.models) == 1 or allowance_left < 0.1:
        return cheapest  # stretch the last of the allowance
    deep = len(text) > 2000 or DEEP.search(text)
    if len(text) <= 280 and not deep and not WORK.search(text):
        return cheapest  # short chat and quick questions
    return OPUS if deep and OPUS in plan.models else SONNET


SCHEMA = """
CREATE TABLE IF NOT EXISTS accounts (
    user_id TEXT PRIMARY KEY,
    email TEXT NOT NULL DEFAULT '',
    plan TEXT NOT NULL DEFAULT 'free',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    plan_updated REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS usage (
    user_id TEXT NOT NULL,
    period TEXT NOT NULL,
    messages INTEGER NOT NULL DEFAULT 0,
    cost_usd REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, period)
);
"""
COLUMNS = ("user_id", "email", "plan", "stripe_customer_id", "stripe_subscription_id", "plan_updated")


def period() -> str:
    # shortcut: allowances reset on the 1st (UTC), not on each subscriber's billing date.
    return time.strftime("%Y-%m", time.gmtime())


class Accounts:
    """Plans and usage per user. Used only from the server's event-loop thread."""

    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path)
        self.db.executescript(SCHEMA)

    def _one(self, where: str, *args) -> dict | None:
        row = self.db.execute(f"SELECT {', '.join(COLUMNS)} FROM accounts WHERE {where}", args).fetchone()
        return dict(zip(COLUMNS, row)) if row else None

    def ensure(self, user_id: str, email: str = "") -> dict:
        self.db.execute("INSERT OR IGNORE INTO accounts (user_id) VALUES (?)", (user_id,))
        if email:
            self.db.execute("UPDATE accounts SET email = ? WHERE user_id = ?", (email, user_id))
        self.db.commit()
        return self.get(user_id)

    def get(self, user_id: str) -> dict | None:
        return self._one("user_id = ?", user_id)

    def by_customer(self, customer_id: str) -> dict | None:
        return self._one("stripe_customer_id = ?", customer_id)

    def link_customer(self, user_id: str, customer_id: str) -> None:
        self.ensure(user_id)
        self.db.execute("UPDATE accounts SET stripe_customer_id = ? WHERE user_id = ?", (customer_id, user_id))
        self.db.commit()

    def set_plan(self, user_id: str, plan: str, at: float, customer: str | None = None, subscription: str | None = None) -> bool:
        """Apply a plan change dated `at` (the Stripe event time). Older events than the last one applied are ignored."""
        if plan not in PLANS:
            raise ValueError(f"unknown plan {plan!r}")
        self.ensure(user_id)
        cur = self.db.execute(
            "UPDATE accounts SET plan = ?, plan_updated = ?, stripe_customer_id = COALESCE(?, stripe_customer_id),"
            " stripe_subscription_id = COALESCE(?, stripe_subscription_id) WHERE user_id = ? AND plan_updated <= ?",
            (plan, at, customer, subscription, user_id, at),
        )
        self.db.commit()
        return cur.rowcount == 1

    def record(self, user_id: str, cost: float, messages: int = 1) -> None:
        self.db.execute(
            "INSERT INTO usage (user_id, period, messages, cost_usd) VALUES (?, ?, ?, ?)"
            " ON CONFLICT (user_id, period) DO UPDATE SET messages = messages + excluded.messages, cost_usd = cost_usd + excluded.cost_usd",
            (user_id, period(), messages, cost),
        )
        self.db.commit()

    def summary(self, user_id: str) -> dict:
        """The `account_update` payload: plan, usage this month, and what is left."""
        account = self.get(user_id) or {"plan": "free", "stripe_customer_id": None}
        plan = PLANS[account["plan"]]
        row = self.db.execute("SELECT messages, cost_usd FROM usage WHERE user_id = ? AND period = ?", (user_id, period())).fetchone()
        messages, cost = row or (0, 0.0)
        return {
            "plan": plan.name,
            "plan_title": plan.title,
            "messages_used": messages,
            "message_limit": plan.messages,
            "allowance_used": round(min(cost / plan.allowance_usd, 1.0), 4),
            "allowance_left_usd": round(max(plan.allowance_usd - cost, 0.0), 4),
            "models": list(plan.models),
            "period": period(),
            "billing": bool(account["stripe_customer_id"]),
        }


def blocked(summary: dict) -> str | None:
    """Why the next goal can't run, or None when it can."""
    if summary["messages_used"] >= summary["message_limit"]:
        return f"You've used all {summary['message_limit']} messages in your {summary['plan_title']} plan this month."
    if summary["allowance_used"] >= 1.0:
        return f"You've used this month's usage allowance on the {summary['plan_title']} plan."
    return None
