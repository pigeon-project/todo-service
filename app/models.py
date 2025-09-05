from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional
from uuid import uuid4


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Board:
    id: str
    name: str
    description: Optional[str]
    owner: str
    createdAt: str
    updatedAt: str
    membersCount: int = 1


@dataclass
class Column:
    id: str
    boardId: str
    name: str
    sortKey: str
    createdAt: str
    updatedAt: str


@dataclass
class Card:
    id: str
    boardId: str
    columnId: str
    title: str
    description: Optional[str]
    sortKey: str
    createdAt: str
    updatedAt: str
    version: int = 0


@dataclass
class Invitation:
    id: str
    boardId: str
    email: Optional[str]
    role: str
    status: str
    token: str
    createdAt: str
    updatedAt: str


@dataclass
class BoardMembership:
    boardId: str
    userId: str
    role: str
    status: str
    invitedBy: str
    createdAt: str
    updatedAt: str
    user: dict


class Store:
    """In-memory store sufficient for demo and tests.

    This is NOT thread-safe or persistent; it's fine for a single-process test server.
    """

    def __init__(self) -> None:
        self.boards: Dict[str, Board] = {}
        self.columns: Dict[str, Column] = {}
        self.cards: Dict[str, Card] = {}
        self.memberships: Dict[tuple[str, str], BoardMembership] = {}
        self.invitations: Dict[str, Invitation] = {}

    # Helper creators
    def create_board(self, name: str, description: Optional[str], owner: str) -> Board:
        board_id = str(uuid4())
        ts = now_iso()
        board = Board(
            id=board_id,
            name=name,
            description=description,
            owner=owner,
            createdAt=ts,
            updatedAt=ts,
            membersCount=1,
        )
        self.boards[board_id] = board
        # creator as admin
        self.memberships[(board_id, owner)] = BoardMembership(
            boardId=board_id,
            userId=owner,
            role="admin",
            status="active",
            invitedBy=owner,
            createdAt=ts,
            updatedAt=ts,
            user={"id": owner, "displayName": owner, "avatarUrl": None},
        )
        return board

    def list_board_columns(self, board_id: str) -> List[Column]:
        cols = [c for c in self.columns.values() if c.boardId == board_id]
        cols.sort(key=lambda c: (c.sortKey, c.createdAt, c.id))
        return cols

    def list_board_cards(self, board_id: str) -> List[Card]:
        cards = [c for c in self.cards.values() if c.boardId == board_id]
        cards.sort(key=lambda c: (c.sortKey, c.createdAt, c.id))
        return cards


store = Store()

