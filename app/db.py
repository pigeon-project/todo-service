import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterable


DB_PATH = os.environ.get("TODO_DB_PATH", "/tmp/todo.sqlite3")


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_conn():
    conn = _connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS boards (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              description TEXT,
              owner TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              etag TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS memberships (
              board_id TEXT NOT NULL,
              user_id TEXT NOT NULL,
              role TEXT NOT NULL CHECK (role IN ('admin','writer','reader')),
              status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending')),
              invited_by TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              PRIMARY KEY (board_id, user_id),
              FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS columns (
              id TEXT PRIMARY KEY,
              board_id TEXT NOT NULL,
              name TEXT NOT NULL,
              sort_key TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              etag TEXT NOT NULL,
              FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS cards (
              id TEXT PRIMARY KEY,
              board_id TEXT NOT NULL,
              column_id TEXT NOT NULL,
              title TEXT NOT NULL,
              description TEXT,
              sort_key TEXT NOT NULL,
              version INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              etag TEXT NOT NULL,
              FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
              FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE
            );
            """
        )


def query(conn: sqlite3.Connection, sql: str, params: Iterable[Any] = ()):  # type: ignore[override]
    cur = conn.execute(sql, params)
    return [dict(r) for r in cur.fetchall()]


def get_one(conn: sqlite3.Connection, sql: str, params: Iterable[Any] = ()):  # type: ignore[override]
    cur = conn.execute(sql, params)
    row = cur.fetchone()
    return dict(row) if row else None

