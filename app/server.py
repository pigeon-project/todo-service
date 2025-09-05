import json
import re
import uuid
from http import HTTPStatus
from typing import Any, Callable, Optional, Tuple

from . import db
from .rank import midpoint


def json_response(start_response: Callable, status: int, payload: dict, headers: Optional[list[tuple[str, str]]] = None):
    body = json.dumps(payload).encode("utf-8")
    hdrs = [("Content-Type", "application/json; charset=utf-8"), ("Content-Length", str(len(body)))]
    if headers:
        hdrs.extend(headers)
    start_response(f"{status} {HTTPStatus(status).phrase}", hdrs)
    return [body]


def parse_json(environ) -> Tuple[Optional[dict], Optional[str]]:
    try:
        length = int(environ.get("CONTENT_LENGTH") or 0)
    except (ValueError, TypeError):
        length = 0
    if length == 0:
        return {}, None
    try:
        data = environ["wsgi.input"].read(length)
        return json.loads(data.decode("utf-8")), None
    except json.JSONDecodeError as e:
        return None, f"invalid_json: {str(e)}"


def get_current_user(environ) -> str:
    auth = environ.get("HTTP_AUTHORIZATION", "")
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
        # For this demo implementation, treat the token as user id
        return token or "user_demo"
    return "user_demo"


def not_found(start_response):
    return json_response(start_response, 404, {"error": {"code": "not_found", "message": "Not Found"}})


def method_not_allowed(start_response):
    return json_response(start_response, 405, {"error": {"code": "method_not_allowed", "message": "Method Not Allowed"}})


def validate_non_empty_trimmed(value: str, min_len: int, max_len: int) -> bool:
    if value is None:
        return False
    s = value.strip()
    return len(s) >= min_len and len(s) <= max_len


def app(environ, start_response):
    path = environ.get("PATH_INFO", "")
    method = environ.get("REQUEST_METHOD", "GET").upper()
    user_id = get_current_user(environ)
    conn = db.connect()
    cur = conn.cursor()

    try:
        # Health and version
        if path == "/v1/health" and method == "GET":
            return json_response(start_response, 200, {"status": "ok"})
        if path == "/v1/version" and method == "GET":
            return json_response(start_response, 200, {"version": "1.0.0"})

        # Serve a very small static root page
        if path == "/" and method == "GET":
            html = b"""<!doctype html><html><head><meta charset='utf-8'><title>TODO Service</title></head>
            <body><h1>TODO Service API</h1><p>See /v1/health and /v1/version</p></body></html>"""
            start_response("200 OK", [("Content-Type", "text/html; charset=utf-8"), ("Content-Length", str(len(html)))])
            return [html]

        # Create board
        if path == "/v1/boards" and method == "POST":
            body, err = parse_json(environ)
            if err is not None:
                return json_response(start_response, 400, {"error": {"code": "invalid_json", "message": err}})
            name = (body.get("name") or "").strip()
            description = body.get("description")
            if not validate_non_empty_trimmed(name, 1, 140):
                return json_response(start_response, 422, {"error": {"code": "validation_error", "message": "name must be 1..140"}})
            now = db.utcnow_iso()
            board_id = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO boards(id, name, description, owner, created_at, updated_at) VALUES(?,?,?,?,?,?)",
                (board_id, name, description, user_id, now, now),
            )
            # Creator is admin by default
            cur.execute(
                "INSERT OR REPLACE INTO memberships(board_id, user_id, role, status, invited_by, created_at, updated_at) VALUES(?,?,?,?,?,?,?)",
                (board_id, user_id, "admin", "active", user_id, now, now),
            )
            conn.commit()
            return json_response(
                start_response,
                201,
                {
                    "id": board_id,
                    "name": name,
                    "description": description,
                    "owner": user_id,
                    "createdAt": now,
                    "updatedAt": now,
                    "myRole": "admin",
                    "membersCount": 1,
                },
            )

        # List boards (only where user is owner or member)
        if path == "/v1/boards" and method == "GET":
            limit = int((environ.get("QUERY_STRING", "").split("limit=")[-1].split("&")[0] or 50) if "limit=" in environ.get("QUERY_STRING", "") else 50)
            if limit < 1:
                limit = 1
            if limit > 200:
                limit = 200
            # No real cursor implementation for brevity; return first N
            cur.execute(
                """
                SELECT b.id, b.name, b.description, b.owner, b.created_at, b.updated_at,
                       CASE WHEN b.owner = ? THEN 'admin' ELSE COALESCE(m.role,'reader') END AS myRole,
                       (
                         SELECT COUNT(*) FROM memberships mm WHERE mm.board_id = b.id AND mm.status='active'
                       ) AS membersCount
                FROM boards b
                LEFT JOIN memberships m ON m.board_id = b.id AND m.user_id = ?
                WHERE b.owner = ? OR EXISTS (SELECT 1 FROM memberships mx WHERE mx.board_id = b.id AND mx.user_id = ?)
                ORDER BY b.created_at DESC, b.id DESC
                LIMIT ?
                """,
                (user_id, user_id, user_id, user_id, limit),
            )
            boards = []
            for r in cur.fetchall():
                boards.append(
                    {
                        "id": r["id"],
                        "name": r["name"],
                        "description": r["description"],
                        "owner": r["owner"],
                        "createdAt": r["created_at"],
                        "updatedAt": r["updated_at"],
                        "myRole": r["myRole"],
                        "membersCount": r["membersCount"],
                    }
                )
            return json_response(start_response, 200, {"boards": boards, "nextCursor": None})

        # Get a board with columns and cards
        m = re.fullmatch(r"/v1/boards/([a-f0-9\-]{36})", path)
        if m and method == "GET":
            board_id = m.group(1)
            cur.execute("SELECT * FROM boards WHERE id=?", (board_id,))
            b = cur.fetchone()
            if not b:
                return not_found(start_response)
            # TODO: authz - ensure user is member (skip for demo)
            board_obj = {
                "id": b["id"],
                "name": b["name"],
                "description": b["description"],
                "owner": b["owner"],
                "createdAt": b["created_at"],
                "updatedAt": b["updated_at"],
                "myRole": "admin" if b["owner"] == user_id else "writer",
                "membersCount": 1,
            }
            cur.execute(
                "SELECT * FROM columns WHERE board_id=? ORDER BY sort_key ASC, created_at ASC, id ASC",
                (board_id,),
            )
            columns = [
                {
                    "id": r["id"],
                    "boardId": r["board_id"],
                    "name": r["name"],
                    "sortKey": r["sort_key"],
                    "createdAt": r["created_at"],
                    "updatedAt": r["updated_at"],
                }
                for r in cur.fetchall()
            ]
            cur.execute(
                "SELECT * FROM cards WHERE board_id=? ORDER BY column_id ASC, sort_key ASC, created_at ASC, id ASC",
                (board_id,),
            )
            cards = [
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
                for r in cur.fetchall()
            ]
            return json_response(start_response, 200, {"board": board_obj, "columns": columns, "cards": cards})

        # Create a column
        m = re.fullmatch(r"/v1/boards/([a-f0-9\-]{36})/columns", path)
        if m and method == "POST":
            board_id = m.group(1)
            body, err = parse_json(environ)
            if err is not None:
                return json_response(start_response, 400, {"error": {"code": "invalid_json", "message": err}})
            name = (body.get("name") or "").strip()
            before_id = body.get("beforeColumnId")
            after_id = body.get("afterColumnId")
            if not validate_non_empty_trimmed(name, 1, 80):
                return json_response(start_response, 422, {"error": {"code": "validation_error", "message": "name must be 1..80"}})
            # Fetch anchors
            left_key = None
            right_key = None
            if before_id:
                cur.execute("SELECT sort_key FROM columns WHERE id=? AND board_id=?", (before_id, board_id))
                row = cur.fetchone()
                if not row:
                    return json_response(start_response, 422, {"error": {"code": "validation_error", "message": "beforeColumnId invalid"}})
                left_key = row["sort_key"]
            if after_id:
                cur.execute("SELECT sort_key FROM columns WHERE id=? AND board_id=?", (after_id, board_id))
                row = cur.fetchone()
                if not row:
                    return json_response(start_response, 422, {"error": {"code": "validation_error", "message": "afterColumnId invalid"}})
                right_key = row["sort_key"]
            if not before_id and not after_id:
                # insert at end: left = last sort_key
                cur.execute(
                    "SELECT sort_key FROM columns WHERE board_id=? ORDER BY sort_key DESC, created_at DESC, id DESC LIMIT 1",
                    (board_id,),
                )
                row = cur.fetchone()
                left_key = row["sort_key"] if row else None
                right_key = None
            key = midpoint(left_key, right_key)
            now = db.utcnow_iso()
            col_id = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO columns(id, board_id, name, sort_key, created_at, updated_at) VALUES(?,?,?,?,?,?)",
                (col_id, board_id, name, key, now, now),
            )
            conn.commit()
            return json_response(
                start_response,
                201,
                {
                    "id": col_id,
                    "boardId": board_id,
                    "name": name,
                    "sortKey": key,
                    "createdAt": now,
                    "updatedAt": now,
                },
            )

        # Move a column
        m = re.fullmatch(r"/v1/boards/([a-f0-9\-]{36})/columns/([a-f0-9\-]{36}):move", path)
        if m and method == "POST":
            board_id, column_id = m.group(1), m.group(2)
            body, err = parse_json(environ)
            if err is not None:
                return json_response(start_response, 400, {"error": {"code": "invalid_json", "message": err}})
            before_id = body.get("beforeColumnId")
            after_id = body.get("afterColumnId")
            left_key = None
            right_key = None
            if before_id:
                cur.execute("SELECT sort_key FROM columns WHERE id=? AND board_id=?", (before_id, board_id))
                row = cur.fetchone()
                if not row:
                    return json_response(start_response, 422, {"error": {"code": "validation_error", "message": "beforeColumnId invalid"}})
                left_key = row["sort_key"]
            if after_id:
                cur.execute("SELECT sort_key FROM columns WHERE id=? AND board_id=?", (after_id, board_id))
                row = cur.fetchone()
                if not row:
                    return json_response(start_response, 422, {"error": {"code": "validation_error", "message": "afterColumnId invalid"}})
                right_key = row["sort_key"]
            key = midpoint(left_key, right_key)
            now = db.utcnow_iso()
            cur.execute(
                "UPDATE columns SET sort_key=?, updated_at=? WHERE id=? AND board_id=?",
                (key, now, column_id, board_id),
            )
            if cur.rowcount == 0:
                return not_found(start_response)
            conn.commit()
            return json_response(start_response, 200, {"id": column_id, "sortKey": key, "updatedAt": now})

        # Create a card
        m = re.fullmatch(r"/v1/boards/([a-f0-9\-]{36})/columns/([a-f0-9\-]{36})/cards", path)
        if m and method == "POST":
            board_id, column_id = m.group(1), m.group(2)
            body, err = parse_json(environ)
            if err is not None:
                return json_response(start_response, 400, {"error": {"code": "invalid_json", "message": err}})
            title = (body.get("title") or "").strip()
            description = body.get("description")
            if not validate_non_empty_trimmed(title, 1, 200):
                return json_response(start_response, 422, {"error": {"code": "validation_error", "message": "title must not be empty"}})
            before_id = body.get("beforeCardId")
            after_id = body.get("afterCardId")
            left_key = None
            right_key = None
            if before_id:
                cur.execute(
                    "SELECT sort_key FROM cards WHERE id=? AND board_id=? AND column_id=?",
                    (before_id, board_id, column_id),
                )
                row = cur.fetchone()
                if not row:
                    return json_response(start_response, 422, {"error": {"code": "validation_error", "message": "beforeCardId invalid"}})
                left_key = row["sort_key"]
            if after_id:
                cur.execute(
                    "SELECT sort_key FROM cards WHERE id=? AND board_id=? AND column_id=?",
                    (after_id, board_id, column_id),
                )
                row = cur.fetchone()
                if not row:
                    return json_response(start_response, 422, {"error": {"code": "validation_error", "message": "afterCardId invalid"}})
                right_key = row["sort_key"]
            if not before_id and not after_id:
                cur.execute(
                    "SELECT sort_key FROM cards WHERE board_id=? AND column_id=? ORDER BY sort_key DESC, created_at DESC, id DESC LIMIT 1",
                    (board_id, column_id),
                )
                row = cur.fetchone()
                left_key = row["sort_key"] if row else None
                right_key = None
            key = midpoint(left_key, right_key)
            now = db.utcnow_iso()
            card_id = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO cards(id, board_id, column_id, title, description, sort_key, created_at, updated_at, version) VALUES(?,?,?,?,?,?,?,?,0)",
                (card_id, board_id, column_id, title, description, key, now, now),
            )
            conn.commit()
            return json_response(
                start_response,
                201,
                {
                    "id": card_id,
                    "boardId": board_id,
                    "columnId": column_id,
                    "title": title,
                    "description": description,
                    "sortKey": key,
                    "createdAt": now,
                    "updatedAt": now,
                    "version": 0,
                },
            )

        # Move a card (possibly to another column on same board)
        m = re.fullmatch(r"/v1/boards/([a-f0-9\-]{36})/cards/([a-f0-9\-]{36}):move", path)
        if m and method == "POST":
            board_id, card_id = m.group(1), m.group(2)
            body, err = parse_json(environ)
            if err is not None:
                return json_response(start_response, 400, {"error": {"code": "invalid_json", "message": err}})
            to_column_id = body.get("toColumnId")
            before_id = body.get("beforeCardId")
            after_id = body.get("afterCardId")
            expected_version = body.get("expectedVersion")

            cur.execute("SELECT * FROM cards WHERE id=? AND board_id=?", (card_id, board_id))
            card = cur.fetchone()
            if not card:
                return not_found(start_response)
            if expected_version is not None and int(expected_version) != int(card["version"]):
                return json_response(start_response, 412, {"error": {"code": "precondition_failed", "message": "stale version"}})

            target_column = card["column_id"]
            if to_column_id:
                # Validate target column belongs to the same board
                cur.execute("SELECT 1 FROM columns WHERE id=? AND board_id=?", (to_column_id, board_id))
                if not cur.fetchone():
                    return json_response(start_response, 409, {"error": {"code": "invalid_move", "message": "Card can be moved only within the same board."}})
                target_column = to_column_id

            left_key = None
            right_key = None
            if before_id:
                cur.execute(
                    "SELECT sort_key FROM cards WHERE id=? AND board_id=? AND column_id=?",
                    (before_id, board_id, target_column),
                )
                row = cur.fetchone()
                if not row:
                    return json_response(start_response, 422, {"error": {"code": "validation_error", "message": "beforeCardId invalid"}})
                left_key = row["sort_key"]
            if after_id:
                cur.execute(
                    "SELECT sort_key FROM cards WHERE id=? AND board_id=? AND column_id=?",
                    (after_id, board_id, target_column),
                )
                row = cur.fetchone()
                if not row:
                    return json_response(start_response, 422, {"error": {"code": "validation_error", "message": "afterCardId invalid"}})
                right_key = row["sort_key"]
            if not before_id and not after_id:
                cur.execute(
                    "SELECT sort_key FROM cards WHERE board_id=? AND column_id=? ORDER BY sort_key DESC, created_at DESC, id DESC LIMIT 1",
                    (board_id, target_column),
                )
                row = cur.fetchone()
                left_key = row["sort_key"] if row else None
                right_key = None

            key = midpoint(left_key, right_key)
            now = db.utcnow_iso()
            new_version = int(card["version"]) + 1
            cur.execute(
                "UPDATE cards SET column_id=?, sort_key=?, updated_at=?, version=? WHERE id=? AND board_id=?",
                (target_column, key, now, new_version, card_id, board_id),
            )
            conn.commit()
            return json_response(start_response, 200, {"id": card_id, "columnId": target_column, "sortKey": key, "updatedAt": now, "version": new_version})

        # Invite member (email only for this demo)
        m = re.fullmatch(r"/v1/boards/([a-f0-9\-]{36})/members", path)
        if m and method == "POST":
            board_id = m.group(1)
            body, err = parse_json(environ)
            if err is not None:
                return json_response(start_response, 400, {"error": {"code": "invalid_json", "message": err}})
            role = body.get("role") or "reader"
            if role not in ("admin", "writer", "reader"):
                return json_response(start_response, 422, {"error": {"code": "validation_error", "message": "invalid role"}})
            email = body.get("email")
            invited_user_id = body.get("userId")
            now = db.utcnow_iso()
            inv_id = str(uuid.uuid4())
            token = str(uuid.uuid4())
            # Store as-is for demo (not hashed)
            cur.execute("SELECT 1 FROM boards WHERE id=?", (board_id,))
            if not cur.fetchone():
                return not_found(start_response)
            cur.execute(
                "INSERT INTO invitations(id, board_id, email, role, status, token, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?)",
                (inv_id, board_id, email, role, "pending", token, now, now),
            )
            if invited_user_id:
                cur.execute(
                    "INSERT OR REPLACE INTO memberships(board_id, user_id, role, status, invited_by, created_at, updated_at) VALUES(?,?,?,?,?,?,?)",
                    (board_id, invited_user_id, role, "pending", user_id, now, now),
                )
            conn.commit()
            return json_response(start_response, 201, {"invitation": {"id": inv_id, "boardId": board_id, "email": email, "role": role, "status": "pending", "token": token}})

        # Default fallthrough
        return not_found(start_response)
    finally:
        conn.close()

