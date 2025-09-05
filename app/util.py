import base64
import json
from datetime import datetime, timezone
from typing import Optional


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def parse_bearer_user(auth_header: Optional[str]) -> str:
    # Simplified: treat token as user id if simple string; try parse JWT without verifying
    if not auth_header or not auth_header.lower().startswith("bearer "):
        return "user_anonymous"
    token = auth_header.split(" ", 1)[1].strip()
    # Try decode JWT payload for `sub`
    parts = token.split(".")
    if len(parts) == 3:
        try:
            payload_b64 = parts[1] + "==="  # pad
            data = json.loads(base64.urlsafe_b64decode(payload_b64))
            sub = data.get("sub")
            if isinstance(sub, str) and sub:
                return sub
        except Exception:
            pass
    # Fallback: use token string as user id (demo only)
    return token or "user_anonymous"


def json_response_envelope(data: dict) -> bytes:
    return json.dumps(data, separators=(",", ":")).encode("utf-8")


def error_envelope(code: str, message: str, request_id: str, details: Optional[dict] = None) -> dict:
    err = {"error": {"code": code, "message": message, "requestId": request_id}}
    if details:
        err["error"]["details"] = details
    return err

