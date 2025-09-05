import os
import sqlite3
from contextlib import contextmanager

DB_PATH = os.environ.get("TODO_DB_PATH", os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "todo.db")))


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def db() -> sqlite3.Connection:
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with db() as conn:
        c = conn.cursor()
        c.execute("PRAGMA foreign_keys = ON")
        # boards
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS boards (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              description TEXT,
              owner TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            )
            """
        )
        # columns
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS columns (
              id TEXT PRIMARY KEY,
              board_id TEXT NOT NULL,
              name TEXT NOT NULL,
              sort_key TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY(board_id) REFERENCES boards(id) ON DELETE CASCADE
            )
            """
        )
        # cards
        c.execute(
            """
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
              FOREIGN KEY(board_id) REFERENCES boards(id) ON DELETE CASCADE,
              FOREIGN KEY(column_id) REFERENCES columns(id) ON DELETE CASCADE
            )
            """
        )
        # memberships
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS memberships (
              board_id TEXT NOT NULL,
              user_id TEXT NOT NULL,
              role TEXT NOT NULL CHECK (role IN ('admin','writer','reader')),
              status TEXT NOT NULL CHECK (status IN ('active','pending')),
              invited_by TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              PRIMARY KEY (board_id, user_id),
              FOREIGN KEY(board_id) REFERENCES boards(id) ON DELETE CASCADE
            )
            """
        )
        # invitations (simplified, store token plain for demo only)
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS invitations (
              id TEXT PRIMARY KEY,
              board_id TEXT NOT NULL,
              email TEXT,
              role TEXT NOT NULL CHECK (role IN ('admin','writer','reader')),
              status TEXT NOT NULL CHECK (status IN ('pending','accepted','expired','revoked')),
              token TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY(board_id) REFERENCES boards(id) ON DELETE CASCADE
            )
            """
        )

