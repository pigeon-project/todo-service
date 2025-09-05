from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


class BoardCreate(BaseModel):
    name: str = Field(min_length=1, max_length=140)
    description: Optional[str] = Field(default=None, max_length=2000)


class BoardSummary(BaseModel):
    id: str
    name: str
    description: Optional[str]
    owner: str
    createdAt: datetime
    updatedAt: datetime
    myRole: str
    membersCount: int


class BoardsList(BaseModel):
    boards: List[BoardSummary]
    nextCursor: Optional[str]


class ColumnCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    beforeColumnId: Optional[str] = None
    afterColumnId: Optional[str] = None


class ColumnOut(BaseModel):
    id: str
    boardId: str
    name: str
    sortKey: str
    createdAt: datetime
    updatedAt: datetime


class CardCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    beforeCardId: Optional[str] = None
    afterCardId: Optional[str] = None


class CardMove(BaseModel):
    toColumnId: Optional[str] = None
    beforeCardId: Optional[str] = None
    afterCardId: Optional[str] = None
    expectedVersion: Optional[int] = None


class CardOut(BaseModel):
    id: str
    boardId: str
    columnId: str
    title: str
    description: Optional[str]
    sortKey: str
    createdAt: datetime
    updatedAt: datetime
    version: int


class BoardDetail(BaseModel):
    board: BoardSummary
    columns: List[ColumnOut]
    cards: List[CardOut]


class InviteByEmail(BaseModel):
    email: str
    role: str


class MembershipOut(BaseModel):
    boardId: str
    userId: str
    role: str
    status: str
    invitedBy: str
    createdAt: datetime
    updatedAt: datetime


class InvitationOut(BaseModel):
    id: str
    boardId: str
    email: Optional[str]
    role: str
    status: str
    token: str


class InviteResponse(BaseModel):
    membership: MembershipOut
    invitation: InvitationOut

