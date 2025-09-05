from __future__ import annotations

from typing import Optional, List
from pydantic import BaseModel, Field


class ErrorEnvelope(BaseModel):
    code: str
    message: str
    details: dict | None = None
    requestId: str | None = None


class HealthResponse(BaseModel):
    status: str = "ok"


class VersionResponse(BaseModel):
    version: str = "1.0.0"


class CreateBoardRequest(BaseModel):
    name: str = Field(min_length=1, max_length=140)
    description: Optional[str] = None


class BoardSummary(BaseModel):
    id: str
    name: str
    description: Optional[str]
    owner: str
    createdAt: str
    updatedAt: str
    myRole: str
    membersCount: int


class BoardsListResponse(BaseModel):
    boards: List[BoardSummary]
    nextCursor: Optional[str] = None


class BoardResponse(BaseModel):
    board: BoardSummary
    columns: list[dict]
    cards: list[dict]


class CreateColumnRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    beforeColumnId: Optional[str] = None
    afterColumnId: Optional[str] = None


class MoveColumnRequest(BaseModel):
    beforeColumnId: Optional[str] = None
    afterColumnId: Optional[str] = None


class CreateCardRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    beforeCardId: Optional[str] = None
    afterCardId: Optional[str] = None


class MoveCardRequest(BaseModel):
    toColumnId: Optional[str] = None
    beforeCardId: Optional[str] = None
    afterCardId: Optional[str] = None
    expectedVersion: Optional[int] = None


class InviteMemberRequest(BaseModel):
    email: Optional[str] = None
    userId: Optional[str] = None
    role: str = Field(pattern=r"^(admin|writer|reader)$")

