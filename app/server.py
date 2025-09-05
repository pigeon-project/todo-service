import json
import re
import sqlite3
import sys
import uuid
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Optional

from .db import init_db, db
from .lexorank import midpoint
from .util import now_iso, parse_bearer_user, json_response_envelope, error_envelope


API_PREFIX = "/v1"
VERSION = "1.0.0"


def uid() -> str:
    return str(uuid.uuid4())


def read_json(handler: BaseHTTPRequestHandler) -> tuple[Optional[dict], Optional[str]]:
    try:
        length = int(handler.headers.get("Content-Length", "0"))
        if length > 1024 * 1024:
            return None, "payload_too_large"
        body = handler.rfile.read(length) if length > 0 else b""
        if not body:
            return {}, None
        return json.loads(body.decode("utf-8")), None
    except json.JSONDecodeError:
        return None, "invalid_json"


def get_request_id(handler: BaseHTTPRequestHandler) -> str:
    rid = handler.headers.get("X-Request-Id")
    return rid if rid else uid()


def user_id_from(handler: BaseHTTPRequestHandler) -> str:
    return parse_bearer_user(handler.headers.get("Authorization"))


def send_json(handler: BaseHTTPRequestHandler, status: int, data: dict, request_id: str) -> None:
    # Echo request id
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("X-Request-Id", request_id)
    payload = json_response_envelope(data)
    handler.send_header("Content-Length", str(len(payload)))
    handler.end_headers()
    handler.wfile.write(payload)


def send_error(handler: BaseHTTPRequestHandler, status: int, code: str, message: str, request_id: str, details: Optional[dict] = None) -> None:
    send_json(handler, status, error_envelope(code, message, request_id, details), request_id)


def get_board_role(conn: sqlite3.Connection, board_id: str, user_id: str) -> Optional[str]:
    cur = conn.execute("SELECT role, status FROM memberships WHERE board_id = ? AND user_id = ?", (board_id, user_id))
    row = cur.fetchone()
    if row and row[1] == "active":
        return row[0]
    # Owner is implicit admin
    cur = conn.execute("SELECT owner FROM boards WHERE id = ?", (board_id,))
    b = cur.fetchone()
    if b and b[0] == user_id:
        return "admin"
    return None


class Handler(BaseHTTPRequestHandler):
    # Disable logging to stderr for each request line
    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
        return

    def do_GET(self) -> None:  # noqa: N802
        rid = get_request_id(self)
        path = self.path
        if path == f"{API_PREFIX}/health":
            return send_json(self, HTTPStatus.OK, {"status": "ok"}, rid)
        if path == f"{API_PREFIX}/version":
            return send_json(self, HTTPStatus.OK, {"version": VERSION}, rid)
        # GET /v1/boards
        if path.startswith(f"{API_PREFIX}/boards"):
            m = re.fullmatch(r"/v1/boards(?:\?(.*))?", path)
            if m:
                return self.get_boards(rid)
            m = re.fullmatch(r"/v1/boards/([a-f0-9\-]+)", path)
            if m:
                return self.get_board_detail(rid, m.group(1))
        return send_error(self, HTTPStatus.NOT_FOUND, "not_found", "Route not found", rid)

    def do_POST(self) -> None:  # noqa: N802
        rid = get_request_id(self)
        path = self.path
        # POST /v1/boards
        if path == f"{API_PREFIX}/boards":
            return self.create_board(rid)
        # POST /v1/boards/{id}/columns
        m = re.fullmatch(r"/v1/boards/([a-f0-9\-]+)/columns", path)
        if m and self.command == "POST":
            return self.create_column(rid, m.group(1))
        # POST /v1/boards/{id}/columns/{colId}:move
        m = re.fullmatch(r"/v1/boards/([a-f0-9\-]+)/columns/([a-f0-9\-]+):move", path)
        if m:
            return self.move_column(rid, m.group(1), m.group(2))
        # POST /v1/boards/{id}/columns/{colId}/cards
        m = re.fullmatch(r"/v1/boards/([a-f0-9\-]+)/columns/([a-f0-9\-]+)/cards", path)
        if m:
            return self.create_card(rid, m.group(1), m.group(2))
        # POST /v1/boards/{id}/cards/{cardId}:move
        m = re.fullmatch(r"/v1/boards/([a-f0-9\-]+)/cards/([a-f0-9\-]+):move", path)
        if m:
            return self.move_card(rid, m.group(1), m.group(2))
        # POST /v1/boards/{id}/members (invite)
        m = re.fullmatch(r"/v1/boards/([a-f0-9\-]+)/members", path)
        if m:
            return self.invite_member(rid, m.group(1))
        return send_error(self, HTTPStatus.NOT_FOUND, "not_found", "Route not found", rid)

    # ============ Handlers ============
    def create_board(self, rid: str) -> None:
        user = user_id_from(self)
        data, err = read_json(self)
        if err:
            return send_error(self, HTTPStatus.BAD_REQUEST, err, "Invalid JSON", rid)
        name = (data or {}).get("name")
        description = (data or {}).get("description")
        if not isinstance(name, str) or len(name.strip()) == 0 or len(name) > 140:
            return send_error(self, HTTPStatus.UNPROCESSABLE_ENTITY, "validation_error", "name is required (1..140)", rid, {"name": "required_non_empty"})
        board_id = uid()
        now = now_iso()
        with db() as conn:
            conn.execute(
                "INSERT INTO boards(id,name,description,owner,created_at,updated_at) VALUES(?,?,?,?,?,?)",
                (board_id, name.strip(), description if (isinstance(description, str) or description is None) else None, user, now, now),
            )
            conn.execute(
                "INSERT OR REPLACE INTO memberships(board_id,user_id,role,status,invited_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
                (board_id, user, "admin", "active", user, now, now),
            )
        return send_json(
            self,
            HTTPStatus.CREATED,
            {
                "id": board_id,
                "name": name.strip(),
                "description": description if (isinstance(description, str) or description is None) else None,
                "owner": user,
                "createdAt": now,
                "updatedAt": now,
                "myRole": "admin",
                "membersCount": 1,
            },
            rid,
        )

    def get_boards(self, rid: str) -> None:
        user = user_id_from(self)
        with db() as conn:
            cur = conn.execute(
                """
                SELECT b.id, b.name, b.description, b.owner, b.created_at, b.updated_at,
                       (SELECT role FROM memberships m WHERE m.board_id = b.id AND m.user_id = ?) as my_role,
                       (SELECT COUNT(*) FROM memberships mm WHERE mm.board_id = b.id AND mm.status='active') as members_count
                FROM boards b
                WHERE EXISTS (SELECT 1 FROM memberships m WHERE m.board_id = b.id AND m.user_id = ?)
                ORDER BY b.created_at DESC
                """,
                (user, user),
            )
            items = []
            for r in cur.fetchall():
                items.append(
                    {
                        "id": r[0],
                        "name": r[1],
                        "description": r[2],
                        "owner": r[3],
                        "createdAt": r[4],
                        "updatedAt": r[5],
                        "myRole": r[6] or ("admin" if r[3] == user else "reader"),
                        "membersCount": int(r[7] or 1),
                    }
                )
        return send_json(self, HTTPStatus.OK, {"boards": items, "nextCursor": None}, rid)

    def get_board_detail(self, rid: str, board_id: str) -> None:
        user = user_id_from(self)
        with db() as conn:
            role = get_board_role(conn, board_id, user)
            if not role:
                return send_error(self, HTTPStatus.FORBIDDEN, "forbidden", "Not a member", rid)
            bcur = conn.execute("SELECT id,name,description,owner,created_at,updated_at FROM boards WHERE id=?", (board_id,))
            b = bcur.fetchone()
            if not b:
                return send_error(self, HTTPStatus.NOT_FOUND, "not_found", "Board not found", rid)
            ccur = conn.execute(
                "SELECT id,board_id,name,sort_key,created_at,updated_at FROM columns WHERE board_id=? ORDER BY sort_key ASC, created_at ASC, id ASC",
                (board_id,),
            )
            columns = [
                {
                    "id": r[0],
                    "boardId": r[1],
                    "name": r[2],
                    "sortKey": r[3],
                    "createdAt": r[4],
                    "updatedAt": r[5],
                }
                for r in ccur.fetchall()
            ]
            kard = conn.execute(
                "SELECT id,board_id,column_id,title,description,sort_key,created_at,updated_at,version FROM cards WHERE board_id=? ORDER BY sort_key ASC, created_at ASC, id ASC",
                (board_id,),
            )
            cards = [
                {
                    "id": r[0],
                    "boardId": r[1],
                    "columnId": r[2],
                    "title": r[3],
                    "description": r[4],
                    "sortKey": r[5],
                    "createdAt": r[6],
                    "updatedAt": r[7],
                    "version": int(r[8] or 0),
                }
                for r in kard.fetchall()
            ]
            board = {
                "id": b[0],
                "name": b[1],
                "description": b[2],
                "owner": b[3],
                "createdAt": b[4],
                "updatedAt": b[5],
                "myRole": role,
                "membersCount": 1,  # simplified
            }
        return send_json(self, HTTPStatus.OK, {"board": board, "columns": columns, "cards": cards}, rid)

    def create_column(self, rid: str, board_id: str) -> None:
        user = user_id_from(self)
        data, err = read_json(self)
        if err:
            return send_error(self, HTTPStatus.BAD_REQUEST, err, "Invalid JSON", rid)
        name = (data or {}).get("name")
        before_id = (data or {}).get("beforeColumnId")
        after_id = (data or {}).get("afterColumnId")
        if not isinstance(name, str) or len(name.strip()) == 0:
            return send_error(self, HTTPStatus.UNPROCESSABLE_ENTITY, "validation_error", "name is required", rid, {"name": "required_non_empty"})
        with db() as conn:
            role = get_board_role(conn, board_id, user)
            if role not in ("admin", "writer"):
                return send_error(self, HTTPStatus.FORBIDDEN, "forbidden", "Insufficient role", rid)
            left_key = None
            right_key = None
            if before_id:
                cur = conn.execute("SELECT sort_key FROM columns WHERE id=? AND board_id=?", (before_id, board_id))
                r = cur.fetchone()
                if r:
                    right_key = r[0]
            if after_id:
                cur = conn.execute("SELECT sort_key FROM columns WHERE id=? AND board_id=?", (after_id, board_id))
                r = cur.fetchone()
                if r:
                    left_key = r[0]
            # If no anchors, insert at end: left=last
            if not left_key and not right_key:
                cur = conn.execute("SELECT sort_key FROM columns WHERE board_id=? ORDER BY sort_key DESC LIMIT 1", (board_id,))
                r = cur.fetchone()
                left_key = r[0] if r else None
            skey = midpoint(left_key, right_key)
            col_id = uid()
            now = now_iso()
            conn.execute(
                "INSERT INTO columns(id,board_id,name,sort_key,created_at,updated_at) VALUES(?,?,?,?,?,?)",
                (col_id, board_id, name.strip(), skey, now, now),
            )
        return send_json(
            self,
            HTTPStatus.CREATED,
            {
                "id": col_id,
                "boardId": board_id,
                "name": name.strip(),
                "sortKey": skey,
                "createdAt": now,
                "updatedAt": now,
            },
            rid,
        )

    def move_column(self, rid: str, board_id: str, column_id: str) -> None:
        user = user_id_from(self)
        data, err = read_json(self)
        if err:
            return send_error(self, HTTPStatus.BAD_REQUEST, err, "Invalid JSON", rid)
        before_id = (data or {}).get("beforeColumnId")
        after_id = (data or {}).get("afterColumnId")
        with db() as conn:
            role = get_board_role(conn, board_id, user)
            if role not in ("admin", "writer"):
                return send_error(self, HTTPStatus.FORBIDDEN, "forbidden", "Insufficient role", rid)
            cur = conn.execute("SELECT id, board_id FROM columns WHERE id=?", (column_id,))
            r = cur.fetchone()
            if not r or r[1] != board_id:
                return send_error(self, HTTPStatus.NOT_FOUND, "not_found", "Column not found", rid)
            left_key = None
            right_key = None
            if before_id:
                cur = conn.execute("SELECT sort_key, board_id FROM columns WHERE id=?", (before_id,))
                rb = cur.fetchone()
                if not rb or rb[1] != board_id:
                    return send_error(self, HTTPStatus.CONFLICT, "invalid_move", "Anchors must be on same board", rid)
                right_key = rb[0]
            if after_id:
                cur = conn.execute("SELECT sort_key, board_id FROM columns WHERE id=?", (after_id,))
                ra = cur.fetchone()
                if not ra or ra[1] != board_id:
                    return send_error(self, HTTPStatus.CONFLICT, "invalid_move", "Anchors must be on same board", rid)
                left_key = ra[0]
            # If no anchors, move to end
            if not left_key and not right_key:
                cur = conn.execute("SELECT sort_key FROM columns WHERE board_id=? ORDER BY sort_key DESC LIMIT 1", (board_id,))
                rlast = cur.fetchone()
                left_key = rlast[0] if rlast else None
            newkey = midpoint(left_key, right_key)
            now = now_iso()
            conn.execute("UPDATE columns SET sort_key=?, updated_at=? WHERE id=?", (newkey, now, column_id))
        return send_json(self, HTTPStatus.OK, {"id": column_id, "sortKey": newkey}, rid)

    def create_card(self, rid: str, board_id: str, column_id: str) -> None:
        user = user_id_from(self)
        data, err = read_json(self)
        if err:
            return send_error(self, HTTPStatus.BAD_REQUEST, err, "Invalid JSON", rid)
        title = (data or {}).get("title")
        description = (data or {}).get("description")
        before_id = (data or {}).get("beforeCardId")
        after_id = (data or {}).get("afterCardId")
        if not isinstance(title, str) or len(title.strip()) == 0:
            return send_error(self, HTTPStatus.UNPROCESSABLE_ENTITY, "validation_error", "title must not be empty", rid, {"title": "required_non_empty"})
        with db() as conn:
            role = get_board_role(conn, board_id, user)
            if role not in ("admin", "writer"):
                return send_error(self, HTTPStatus.FORBIDDEN, "forbidden", "Insufficient role", rid)
            # ensure column exists and belongs to board
            cur = conn.execute("SELECT board_id FROM columns WHERE id=?", (column_id,))
            r = cur.fetchone()
            if not r or r[0] != board_id:
                return send_error(self, HTTPStatus.NOT_FOUND, "not_found", "Column not found", rid)
            left_key = None
            right_key = None
            if before_id:
                cur = conn.execute("SELECT sort_key, column_id FROM cards WHERE id=? AND board_id=?", (before_id, board_id))
                rb = cur.fetchone()
                if rb and rb[1] == column_id:
                    right_key = rb[0]
            if after_id:
                cur = conn.execute("SELECT sort_key, column_id FROM cards WHERE id=? AND board_id=?", (after_id, board_id))
                ra = cur.fetchone()
                if ra and ra[1] == column_id:
                    left_key = ra[0]
            if not left_key and not right_key:
                cur = conn.execute("SELECT sort_key FROM cards WHERE board_id=? AND column_id=? ORDER BY sort_key DESC LIMIT 1", (board_id, column_id))
                rlast = cur.fetchone()
                left_key = rlast[0] if rlast else None
            skey = midpoint(left_key, right_key)
            card_id = uid()
            now = now_iso()
            conn.execute(
                "INSERT INTO cards(id,board_id,column_id,title,description,sort_key,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
                (card_id, board_id, column_id, title.strip(), description if (isinstance(description, str) or description is None) else None, skey, 0, now, now),
            )
        return send_json(
            self,
            HTTPStatus.CREATED,
            {
                "id": card_id,
                "boardId": board_id,
                "columnId": column_id,
                "title": title.strip(),
                "description": description if (isinstance(description, str) or description is None) else None,
                "sortKey": skey,
                "createdAt": now,
                "updatedAt": now,
                "version": 0,
            },
            rid,
        )

    def move_card(self, rid: str, board_id: str, card_id: str) -> None:
        user = user_id_from(self)
        data, err = read_json(self)
        if err:
            return send_error(self, HTTPStatus.BAD_REQUEST, err, "Invalid JSON", rid)
        to_col = (data or {}).get("toColumnId")
        before_id = (data or {}).get("beforeCardId")
        after_id = (data or {}).get("afterCardId")
        expected_version = (data or {}).get("expectedVersion")
        with db() as conn:
            role = get_board_role(conn, board_id, user)
            if role not in ("admin", "writer"):
                return send_error(self, HTTPStatus.FORBIDDEN, "forbidden", "Insufficient role", rid)
            cur = conn.execute("SELECT id,board_id,column_id,version FROM cards WHERE id=?", (card_id,))
            c = cur.fetchone()
            if not c:
                return send_error(self, HTTPStatus.NOT_FOUND, "not_found", "Card not found", rid)
            if c[1] != board_id:
                return send_error(self, HTTPStatus.CONFLICT, "invalid_move", "Card can be moved only within the same board.", rid)
            current_col = c[2]
            if to_col is None:
                to_col = current_col
            # Verify to_col belongs to board
            cur = conn.execute("SELECT board_id FROM columns WHERE id=?", (to_col,))
            rc = cur.fetchone()
            if not rc or rc[0] != board_id:
                return send_error(self, HTTPStatus.CONFLICT, "invalid_move", "Target column must be in same board", rid)
            if isinstance(expected_version, int) and expected_version != int(c[3] or 0):
                return send_error(self, HTTPStatus.PRECONDITION_FAILED, "stale", "Version mismatch", rid)
            left_key = None
            right_key = None
            if before_id:
                cur = conn.execute("SELECT sort_key,column_id,board_id FROM cards WHERE id=?", (before_id,))
                rb = cur.fetchone()
                if not rb or rb[2] != board_id or rb[1] != to_col:
                    return send_error(self, HTTPStatus.CONFLICT, "invalid_move", "Anchors must be in target column", rid)
                right_key = rb[0]
            if after_id:
                cur = conn.execute("SELECT sort_key,column_id,board_id FROM cards WHERE id=?", (after_id,))
                ra = cur.fetchone()
                if not ra or ra[2] != board_id or ra[1] != to_col:
                    return send_error(self, HTTPStatus.CONFLICT, "invalid_move", "Anchors must be in target column", rid)
                left_key = ra[0]
            if not left_key and not right_key:
                cur = conn.execute("SELECT sort_key FROM cards WHERE board_id=? AND column_id=? ORDER BY sort_key DESC LIMIT 1", (board_id, to_col))
                rlast = cur.fetchone()
                left_key = rlast[0] if rlast else None
            newkey = midpoint(left_key, right_key)
            now = now_iso()
            conn.execute(
                "UPDATE cards SET column_id=?, sort_key=?, version=version+1, updated_at=? WHERE id=?",
                (to_col, newkey, now, card_id),
            )
        return send_json(self, HTTPStatus.OK, {"id": card_id, "columnId": to_col, "sortKey": newkey}, rid)

    def invite_member(self, rid: str, board_id: str) -> None:
        user = user_id_from(self)
        data, err = read_json(self)
        if err:
            return send_error(self, HTTPStatus.BAD_REQUEST, err, "Invalid JSON", rid)
        email = (data or {}).get("email")
        role = (data or {}).get("role") or "reader"
        if not isinstance(email, str) or "@" not in email:
            return send_error(self, HTTPStatus.UNPROCESSABLE_ENTITY, "validation_error", "email required", rid, {"email": "required"})
        if role not in ("admin", "writer", "reader"):
            return send_error(self, HTTPStatus.UNPROCESSABLE_ENTITY, "validation_error", "invalid role", rid, {"role": "invalid"})
        with db() as conn:
            r = get_board_role(conn, board_id, user)
            if r != "admin":
                return send_error(self, HTTPStatus.FORBIDDEN, "forbidden", "Only admins can invite", rid)
            inv_id = uid()
            token = uid().replace("-", "")
            now = now_iso()
            conn.execute(
                "INSERT INTO invitations(id,board_id,email,role,status,token,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
                (inv_id, board_id, email, role, "pending", token, now, now),
            )
            # In a real system, user would accept to become member; here, add pending membership placeholder
            conn.execute(
                "INSERT OR IGNORE INTO memberships(board_id,user_id,role,status,invited_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
                (board_id, f"email:{email}", role, "pending", user, now, now),
            )
        return send_json(self, HTTPStatus.CREATED, {"membership": {"boardId": board_id, "userId": f"email:{email}", "role": role, "status": "pending"}, "invitation": {"id": inv_id, "boardId": board_id, "email": email, "role": role, "status": "pending", "token": token}}, rid)


def run(host: str = "0.0.0.0", port: int = 8000) -> None:
    init_db()
    httpd = HTTPServer((host, port), Handler)
    print(f"TODO Service listening on {host}:{port}")
    httpd.serve_forever()


if __name__ == "__main__":
    p = 8000
    if len(sys.argv) > 1:
        try:
            p = int(sys.argv[1])
        except Exception:
            pass
    run(port=p)

