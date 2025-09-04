import base64
import hashlib
import hmac
import json
import os
from typing import Any, Dict, Optional


class AuthError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def b64url_decode(data: str) -> bytes:
    pad = '=' * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def verify_jwt_hs256(token: str, secret: str) -> Dict[str, Any]:
    parts = token.split(".")
    if len(parts) != 3:
        raise AuthError("invalid_token", "Malformed JWT")
    header_b64, payload_b64, signature_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}".encode()
    expected = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    try:
        signature = b64url_decode(signature_b64)
    except Exception as e:
        raise AuthError("invalid_token", "Invalid signature encoding") from e
    if not hmac.compare_digest(signature, expected):
        raise AuthError("invalid_token", "Invalid signature")
    try:
        payload = json.loads(b64url_decode(payload_b64))
    except Exception as e:
        raise AuthError("invalid_token", "Invalid payload encoding") from e
    return payload


def authenticate(authorization: Optional[str]) -> Dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AuthError("unauthorized", "Missing Bearer token")
    token = authorization.split(" ", 1)[1].strip()
    # Debug mode: token like "debug-<userId>"
    if token.startswith("debug-"):
        return {"sub": token[len("debug-"):]}
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise AuthError("unauthorized", "JWT_SECRET not configured; use debug-<userId> token")
    payload = verify_jwt_hs256(token, secret)
    if not isinstance(payload, dict) or "sub" not in payload:
        raise AuthError("unauthorized", "Token missing 'sub'")
    return payload

