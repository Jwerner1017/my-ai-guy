"""SQLite persistence: the running conversation and the task list."""

from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    messages TEXT NOT NULL,
    updated REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'todo',
    notes TEXT NOT NULL DEFAULT '',
    created REAL NOT NULL
);
"""
STATUSES = ("todo", "doing", "done", "blocked")


def format_tasks(tasks: list[dict]) -> str:
    lines = [f"#{t['id']} [{t['status']}] {t['title']}" + (f": {t['notes']}" if t["notes"] else "") for t in tasks]
    return "\n".join(lines) or "No open tasks."


class Store:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        # The server runs the agent on a worker thread; goals run one at a time, so sharing is safe.
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.executescript(SCHEMA)

    def load_messages(self, conversation: str = "main") -> list[dict]:
        row = self.db.execute("SELECT messages FROM conversations WHERE id = ?", (conversation,)).fetchone()
        return json.loads(row[0]) if row else []

    def save_messages(self, messages: list[dict], conversation: str = "main") -> None:
        self.db.execute(
            "INSERT OR REPLACE INTO conversations VALUES (?, ?, ?)",
            (conversation, json.dumps(messages), time.time()),
        )
        self.db.commit()

    def add_task(self, title: str, notes: str = "") -> int:
        cur = self.db.execute("INSERT INTO tasks (title, notes, created) VALUES (?, ?, ?)", (title, notes, time.time()))
        self.db.commit()
        return cur.lastrowid

    def update_task(self, task_id: int, status: str = "", notes: str = "") -> bool:
        if status and status not in STATUSES:
            raise ValueError(f"status must be one of {', '.join(STATUSES)}")
        sets, args = [], []
        if status:
            sets.append("status = ?")
            args.append(status)
        if notes:
            sets.append("notes = ?")
            args.append(notes)
        if not sets:
            return False
        cur = self.db.execute(f"UPDATE tasks SET {', '.join(sets)} WHERE id = ?", (*args, task_id))
        self.db.commit()
        return cur.rowcount == 1

    def list_tasks(self, include_done: bool = False) -> list[dict]:
        where = "" if include_done else "WHERE status != 'done'"
        rows = self.db.execute(f"SELECT id, title, status, notes FROM tasks {where} ORDER BY id").fetchall()
        return [dict(zip(("id", "title", "status", "notes"), row)) for row in rows]
