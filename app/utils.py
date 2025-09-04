import datetime as dt
import json
from typing import Any, Dict, Tuple


def now_iso() -> str:
    return dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def json_body(environ) -> Tuple[Dict[str, Any], str]:
    try:
        length = int(environ.get("CONTENT_LENGTH") or "0")
    except ValueError:
        length = 0
    body = environ["wsgi.input"].read(length) if length > 0 else b""
    if not body:
        return {}, ""
    try:
        return json.loads(body.decode("utf-8")), body.decode("utf-8")
    except Exception:
        raise ValueError("Invalid JSON")


def respond_json(start_response, status: str, data: Dict[str, Any], headers=None):
    payload = json.dumps(data).encode("utf-8")
    hdrs = [("Content-Type", "application/json; charset=utf-8"), ("Content-Length", str(len(payload)))]
    if headers:
        hdrs.extend(headers)
    start_response(status, hdrs)
    return [payload]


def error_response(start_response, status: str, code: str, message: str, request_id: str = ""):
    body = {"error": {"code": code, "message": message, "requestId": request_id}}
    return respond_json(start_response, status, body)

