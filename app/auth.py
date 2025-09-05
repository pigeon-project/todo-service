from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


security = HTTPBearer(auto_error=False)


class User:
    def __init__(self, user_id: str):
        self.id = user_id


def get_current_user(creds: HTTPAuthorizationCredentials | None = Depends(security)) -> User:
    # Minimal bearer handling: expect header "Authorization: Bearer <userId>"
    if creds is None or not creds.scheme.lower() == "bearer" or not creds.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    token = creds.credentials.strip()
    user_id = token  # Treat token as user id for this exercise
    return User(user_id)

