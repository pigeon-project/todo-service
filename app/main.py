from __future__ import annotations

import json
import re
import uuid
from wsgiref.simple_server import make_server
from typing import Any, Dict, Optional, Tuple

from . import db
from .auth import AuthError, authenticate
from .lexorank import midpoint
from .utils import error_response, json_body, now_iso, respond_json


VERSION = "1.0.0"


def path_params(pattern: str, path: str) -> Optional[Tuple[str, ...]]:
    m = re.fullmatch(pattern, path)
    return m.groups() if m else None


def require_auth(environ) -> Dict[str, Any]:
    try:
        return authenticate(environ.get("HTTP_AUTHORIZATION"))
    except AuthError as e:
        raise


def etag(value: str) -> str:
    return f'"{value}"'


def app(environ, start_response):
    method = environ["REQUEST_METHOD"].upper()
    path = environ.get("PATH_INFO", "")
    query = environ.get("QUERY_STRING", "")
    request_id = environ.get("HTTP_X_REQUEST_ID", str(uuid.uuid4()))

    # Health & version (no auth)
    if method == "GET" and path == "/v1/health":
        return respond_json(start_response, "200 OK", {"status": "ok"})
    if method == "GET" and path == "/v1/version":
        return respond_json(start_response, "200 OK", {"version": VERSION})

    # Static index page
    if method == "GET" and path == "/":
        body = b"<html><body><h1>TODO Service</h1><p>API is available under /v1</p></body></html>"
        start_response("200 OK", [("Content-Type", "text/html; charset=utf-8"), ("Content-Length", str(len(body)))])
        return [body]

    # All other endpoints require auth
    try:
        user = require_auth(environ)
        user_id = str(user.get("sub"))
    except AuthError as e:
        return error_response(start_response, "401 Unauthorized", e.code, e.message, request_id)

    # Boards: create
    if method == "POST" and path == "/v1/boards":
        try:
            body, _raw = json_body(environ)
        except ValueError:
            return error_response(start_response, "400 Bad Request", "invalid_json", "Invalid JSON", request_id)
        name = (body.get("name") or "").strip()
        description = body.get("description")
        if not (1 <= len(name) <= 140):
            return error_response(start_response, "422 Unprocessable Entity", "validation_error", "name must be 1..140 chars", request_id)
        now = now_iso()
        b_id = str(uuid.uuid4())
        with db.get_conn() as conn:
            conn.execute(
                "INSERT INTO boards(id, name, description, owner, created_at, updated_at, etag) VALUES (?,?,?,?,?,?,?)",
                (b_id, name, description, user_id, now, now, now),
            )
            conn.execute(
                "INSERT INTO memberships(board_id, user_id, role, status, invited_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
                (b_id, user_id, "admin", "active", user_id, now, now),
            )
            row = db.get_one(conn, "SELECT * FROM boards WHERE id=?", (b_id,))
        board = {
            "id": row["id"],
            "name": row["name"],
            "description": row["description"],
            "owner": row["owner"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
            "myRole": "admin",
            "membersCount": 1,
        }
        headers = [("ETag", etag(row["etag"]))]
        return respond_json(start_response, "201 Created", board, headers)

    # Boards: list
    if method == "GET" and path == "/v1/boards":
        limit = 50
        m = re.search(r"(^|&)limit=(\d+)", query)
        if m:
            limit = max(1, min(200, int(m.group(2))))
        with db.get_conn() as conn:
            rows = db.query(
                conn,
                """
                SELECT b.*, m.role as my_role,
                  (SELECT COUNT(*) FROM memberships mm WHERE mm.board_id = b.id) as members_count
                FROM boards b
                JOIN memberships m ON m.board_id = b.id AND m.user_id = ?
                ORDER BY b.created_at DESC
                LIMIT ?
                """,
                (user_id, limit),
            )
        boards = [
            {
                "id": r["id"],
                "name": r["name"],
                "description": r["description"],
                "owner": r["owner"],
                "createdAt": r["created_at"],
                "updatedAt": r["updated_at"],
                "myRole": r["my_role"],
                "membersCount": r["members_count"],
            }
            for r in rows
        ]
        return respond_json(start_response, "200 OK", {"boards": boards, "nextCursor": None})

    # Get a board with columns and cards
    m = path_params(r"/v1/boards/([a-f0-9\-]{36})", path)
    if method == "GET" and m:
        board_id = m[0]
        with db.get_conn() as conn:
            mem = db.get_one(conn, "SELECT role FROM memberships WHERE board_id=? AND user_id=?", (board_id, user_id))
            if not mem:
                return error_response(start_response, "404 Not Found", "not_found", "Board not found", request_id)
            b = db.get_one(conn, "SELECT * FROM boards WHERE id=?", (board_id,))
            cols = db.query(conn, "SELECT * FROM columns WHERE board_id=? ORDER BY sort_key ASC, created_at ASC, id ASC", (board_id,))
            cards = db.query(conn, "SELECT * FROM cards WHERE board_id=? ORDER BY sort_key ASC, created_at ASC, id ASC", (board_id,))
        if not b:
            return error_response(start_response, "404 Not Found", "not_found", "Board not found", request_id)
        board = {
            "id": b["id"],
            "name": b["name"],
            "description": b["description"],
            "owner": b["owner"],
            "createdAt": b["created_at"],
            "updatedAt": b["updated_at"],
            "myRole": mem["role"],
            "membersCount": None,
        }
        # we can compute members count lazily if needed
        columns = [
            {
                "id": c["id"],
                "boardId": c["board_id"],
                "name": c["name"],
                "sortKey": c["sort_key"],
                "createdAt": c["created_at"],
                "updatedAt": c["updated_at"],
            }
            for c in cols
        ]
        cards_out = [
            {
                "id": r["id"],
                "boardId": r["board_id"],
                "columnId": r["column_id"],
                "title": r["title"],
                "description": r["description"],
                "sortKey": r["sort_key"],
                "createdAt": r["created_at"],
                "updatedAt": r["updated_at"],
                "version": r["version"],
            }
            for r in cards
        ]
        headers = [("ETag", etag(b["etag"]))]
        return respond_json(start_response, "200 OK", {"board": board, "columns": columns, "cards": cards_out}, headers)

    # Create a column
    m = path_params(r"/v1/boards/([a-f0-9\-]{36})/columns", path)
    if method == "POST" and m:
        board_id = m[0]
        try:
            body, _ = json_body(environ)
        except ValueError:
            return error_response(start_response, "400 Bad Request", "invalid_json", "Invalid JSON", request_id)
        name = (body.get("name") or "").strip()
        before_id = body.get("beforeColumnId")
        after_id = body.get("afterColumnId")
        if not (1 <= len(name) <= 80):
            return error_response(start_response, "422 Unprocessable Entity", "validation_error", "name must be 1..80 chars", request_id)
        now = now_iso()
        with db.get_conn() as conn:
            mem = db.get_one(conn, "SELECT role FROM memberships WHERE board_id=? AND user_id=?", (board_id, user_id))
            if not mem or mem["role"] not in ("admin", "writer"):
                return error_response(start_response, "403 Forbidden", "forbidden", "Insufficient permissions", request_id)
            # compute anchors
            def get_key(cid):
                if not cid:
                    return None
                row = db.get_one(conn, "SELECT sort_key FROM columns WHERE id=? AND board_id=?", (cid, board_id))
                return row["sort_key"] if row else None

            left = get_key(after_id)
            right = get_key(before_id)
            # default: append at end if no anchors
            key = midpoint(left, right)
            c_id = str(uuid.uuid4())
            conn.execute(
                "INSERT INTO columns(id, board_id, name, sort_key, created_at, updated_at, etag) VALUES (?,?,?,?,?,?,?)",
                (c_id, board_id, name, key, now, now, now),
            )
            row = db.get_one(conn, "SELECT * FROM columns WHERE id=?", (c_id,))
        col = {
            "id": row["id"],
            "boardId": row["board_id"],
            "name": row["name"],
            "sortKey": row["sort_key"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }
        headers = [("ETag", etag(row["etag"]))]
        return respond_json(start_response, "201 Created", col, headers)

    # Move (reorder) a column
    m = path_params(r"/v1/boards/([a-f0-9\-]{36})/columns/([a-f0-9\-]{36}):move", path)
    if method == "POST" and m:
        board_id, column_id = m
        try:
            body, _ = json_body(environ)
        except ValueError:
            return error_response(start_response, "400 Bad Request", "invalid_json", "Invalid JSON", request_id)
        before_id = body.get("beforeColumnId")
        after_id = body.get("afterColumnId")
        with db.get_conn() as conn:
            mem = db.get_one(conn, "SELECT role FROM memberships WHERE board_id=? AND user_id=?", (board_id, user_id))
            if not mem or mem["role"] not in ("admin", "writer"):
                return error_response(start_response, "403 Forbidden", "forbidden", "Insufficient permissions", request_id)
            col = db.get_one(conn, "SELECT * FROM columns WHERE id=? AND board_id=?", (column_id, board_id))
            if not col:
                return error_response(start_response, "404 Not Found", "not_found", "Column not found", request_id)
            def get_key(cid):
                if not cid:
                    return None
                row = db.get_one(conn, "SELECT sort_key FROM columns WHERE id=? AND board_id=?", (cid, board_id))
                return row["sort_key"] if row else None
            left = get_key(after_id)
            right = get_key(before_id)
            key = midpoint(left, right)
            now = now_iso()
            conn.execute(
                "UPDATE columns SET sort_key=?, updated_at=?, etag=? WHERE id=?",
                (key, now, now, column_id),
            )
            row = db.get_one(conn, "SELECT * FROM columns WHERE id=?", (column_id,))
        out = {
            "id": row["id"],
            "boardId": row["board_id"],
            "name": row["name"],
            "sortKey": row["sort_key"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }
        headers = [("ETag", etag(row["etag"]))]
        return respond_json(start_response, "200 OK", out, headers)

    # Create a card
    m = path_params(r"/v1/boards/([a-f0-9\-]{36})/columns/([a-f0-9\-]{36})/cards", path)
    if method == "POST" and m:
        board_id, column_id = m
        try:
            body, _ = json_body(environ)
        except ValueError:
            return error_response(start_response, "400 Bad Request", "invalid_json", "Invalid JSON", request_id)
        title = (body.get("title") or "").strip()
        description = body.get("description")
        before_id = body.get("beforeCardId")
        after_id = body.get("afterCardId")
        if not (1 <= len(title) <= 200):
            return error_response(start_response, "422 Unprocessable Entity", "validation_error", "title must be 1..200 chars", request_id)
        with db.get_conn() as conn:
            mem = db.get_one(conn, "SELECT role FROM memberships WHERE board_id=? AND user_id=?", (board_id, user_id))
            if not mem or mem["role"] not in ("admin", "writer"):
                return error_response(start_response, "403 Forbidden", "forbidden", "Insufficient permissions", request_id)
            col = db.get_one(conn, "SELECT id FROM columns WHERE id=? AND board_id=?", (column_id, board_id))
            if not col:
                return error_response(start_response, "404 Not Found", "not_found", "Column not found", request_id)
            def get_key(cid):
                if not cid:
                    return None
                row = db.get_one(conn, "SELECT sort_key FROM cards WHERE id=? AND board_id=? AND column_id=?", (cid, board_id, column_id))
                return row["sort_key"] if row else None
            left = get_key(after_id)
            right = get_key(before_id)
            key = midpoint(left, right)
            now = now_iso()
            card_id = str(uuid.uuid4())
            conn.execute(
                """
                INSERT INTO cards(id, board_id, column_id, title, description, sort_key, version, created_at, updated_at, etag)
                VALUES (?,?,?,?,?,?,?,?,?,?)
                """,
                (card_id, board_id, column_id, title, description, key, 0, now, now, now),
            )
            row = db.get_one(conn, "SELECT * FROM cards WHERE id=?", (card_id,))
        out = {
            "id": row["id"],
            "boardId": row["board_id"],
            "columnId": row["column_id"],
            "title": row["title"],
            "description": row["description"],
            "sortKey": row["sort_key"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
            "version": row["version"],
        }
        headers = [("ETag", etag(row["etag"]))]
        return respond_json(start_response, "201 Created", out, headers)

    # Move a card
    m = path_params(r"/v1/boards/([a-f0-9\-]{36})/cards/([a-f0-9\-]{36}):move", path)
    if method == "POST" and m:
        board_id, card_id = m
        try:
            body, _ = json_body(environ)
        except ValueError:
            return error_response(start_response, "400 Bad Request", "invalid_json", "Invalid JSON", request_id)
        to_column_id = body.get("toColumnId")
        before_id = body.get("beforeCardId")
        after_id = body.get("afterCardId")
        expected_version = body.get("expectedVersion")
        with db.get_conn() as conn:
            mem = db.get_one(conn, "SELECT role FROM memberships WHERE board_id=? AND user_id=?", (board_id, user_id))
            if not mem or mem["role"] not in ("admin", "writer"):
                return error_response(start_response, "403 Forbidden", "forbidden", "Insufficient permissions", request_id)
            card = db.get_one(conn, "SELECT * FROM cards WHERE id=?", (card_id,))
            if not card:
                return error_response(start_response, "404 Not Found", "not_found", "Card not found", request_id)
            if card["board_id"] != board_id:
                return error_response(start_response, "409 Conflict", "invalid_move", "Card can be moved only within the same board.", request_id)
            target_col = to_column_id or card["column_id"]
            # anchors must belong to target column
            def get_key(cid):
                if not cid:
                    return None
                row = db.get_one(conn, "SELECT sort_key, column_id FROM cards WHERE id=? AND board_id=?", (cid, board_id))
                if not row or row["column_id"] != target_col:
                    return None
                return row["sort_key"]

            left = get_key(after_id)
            right = get_key(before_id)
            key = midpoint(left, right)
            now = now_iso()
            if expected_version is not None and int(card["version"]) != int(expected_version):
                return error_response(start_response, "412 Precondition Failed", "precondition_failed", "Version mismatch", request_id)
            new_version = int(card["version"]) + 1
            conn.execute(
                "UPDATE cards SET column_id=?, sort_key=?, version=?, updated_at=?, etag=? WHERE id=?",
                (target_col, key, new_version, now, now, card_id),
            )
            row = db.get_one(conn, "SELECT * FROM cards WHERE id=?", (card_id,))
        out = {
            "id": row["id"],
            "boardId": row["board_id"],
            "columnId": row["column_id"],
            "title": row["title"],
            "description": row["description"],
            "sortKey": row["sort_key"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
            "version": row["version"],
        }
        headers = [("ETag", etag(row["etag"]))]
        return respond_json(start_response, "200 OK", out, headers)

    return error_response(start_response, "404 Not Found", "not_found", "Endpoint not found", request_id)


def run(host: str = "0.0.0.0", port: int = 8000):
    db.init_db()
    with make_server(host, port, app) as httpd:
        print(f"Serving on http://{host}:{port}")
        httpd.serve_forever()


if __name__ == "__main__":
    run()

