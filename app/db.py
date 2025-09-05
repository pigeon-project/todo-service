import os
import sqlite3
from datetime import datetime, timezone


DB_PATH = os.environ.get("TODO_DB_PATH", os.path.join(os.path.dirname(__file__), "data.db"))


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = connect()
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS boards (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          owner TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS columns (
          id TEXT PRIMARY KEY,
          board_id TEXT NOT NULL,
          name TEXT NOT NULL,
          sort_key TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_columns_board_sort ON columns(board_id, sort_key, created_at, id);

        CREATE TABLE IF NOT EXISTS cards (
          id TEXT PRIMARY KEY,
          board_id TEXT NOT NULL,
          column_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          sort_key TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
          FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_cards_board_col_sort ON cards(board_id, column_id, sort_key, created_at, id);

        CREATE TABLE IF NOT EXISTS memberships (
          board_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin','writer','reader')),
          status TEXT NOT NULL CHECK (status IN ('active','pending')),
          invited_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (board_id, user_id),
          FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS invitations (
          id TEXT PRIMARY KEY,
          board_id TEXT NOT NULL,
          email TEXT,
          role TEXT NOT NULL CHECK (role IN ('admin','writer','reader')),
          status TEXT NOT NULL CHECK (status IN ('pending','accepted','expired','revoked')),
          token TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
        );
        """
    )
    conn.commit()
    conn.close()

