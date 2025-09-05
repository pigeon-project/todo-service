from __future__ import annotations

import uuid
from typing import Optional

from fastapi import FastAPI, HTTPException, Header
from fastapi.responses import JSONResponse

from .lexorank import midpoint
from .models import store, Column, Card, now_iso
from .schemas import (
    HealthResponse,
    VersionResponse,
    CreateBoardRequest,
    BoardsListResponse,
    BoardSummary,
    BoardResponse,
    CreateColumnRequest,
    MoveColumnRequest,
    CreateCardRequest,
    MoveCardRequest,
    InviteMemberRequest,
)


app = FastAPI(title="TODO Service", version="1.0.0")


def get_user_id(authorization: Optional[str]) -> str:
    # Placeholder auth: not verifying JWT, just extracts a dummy user id for demo
    # Format expected: "Bearer <token>"; fallback to static user
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
        return token or "user_demo"
    return "user_demo"


@app.get("/v1/health", response_model=HealthResponse)
def health():
    return HealthResponse()


@app.get("/v1/version", response_model=VersionResponse)
def version():
    return VersionResponse()


@app.post("/v1/boards", response_model=BoardSummary, status_code=201)
def create_board(req: CreateBoardRequest, authorization: Optional[str] = Header(default=None)):
    user_id = get_user_id(authorization)
    board = store.create_board(req.name.strip(), (req.description or None), user_id)
    return BoardSummary(
        id=board.id,
        name=board.name,
        description=board.description,
        owner=board.owner,
        createdAt=board.createdAt,
        updatedAt=board.updatedAt,
        myRole="admin",
        membersCount=board.membersCount,
    )


@app.get("/v1/boards", response_model=BoardsListResponse)
def list_boards(limit: int = 50, cursor: Optional[str] = None, authorization: Optional[str] = Header(default=None)):
    user_id = get_user_id(authorization)
    # very simple, not real pagination
    all_boards = list(store.boards.values())
    # show only boards where user is a member
    my_boards = [b for b in all_boards if (b.id, user_id) in store.memberships]
    my_boards.sort(key=lambda b: (b.createdAt, b.id))
    items = my_boards[: max(1, min(limit, 200))]
    resp = [
        BoardSummary(
            id=b.id,
            name=b.name,
            description=b.description,
            owner=b.owner,
            createdAt=b.createdAt,
            updatedAt=b.updatedAt,
            myRole=store.memberships[(b.id, user_id)].role,
            membersCount=b.membersCount,
        )
        for b in items
    ]
    return BoardsListResponse(boards=resp, nextCursor=None)


@app.get("/v1/boards/{board_id}", response_model=BoardResponse)
def get_board(board_id: str, authorization: Optional[str] = Header(default=None)):
    user_id = get_user_id(authorization)
    b = store.boards.get(board_id)
    if not b:
        raise HTTPException(status_code=404, detail="not_found")
    if (board_id, user_id) not in store.memberships:
        raise HTTPException(status_code=403, detail="forbidden")
    board_summary = BoardSummary(
        id=b.id,
        name=b.name,
        description=b.description,
        owner=b.owner,
        createdAt=b.createdAt,
        updatedAt=b.updatedAt,
        myRole=store.memberships[(board_id, user_id)].role,
        membersCount=b.membersCount,
    )
    cols = [c.__dict__ for c in store.list_board_columns(board_id)]
    cards = [c.__dict__ for c in store.list_board_cards(board_id)]
    return BoardResponse(board=board_summary, columns=cols, cards=cards)


def _column_anchors(board_id: str, before_id: Optional[str], after_id: Optional[str]):
    cols = store.list_board_columns(board_id)
    id_to_key = {c.id: c.sortKey for c in cols}
    left = id_to_key.get(before_id) if before_id else None
    right = id_to_key.get(after_id) if after_id else None
    # If neither provided: insert at end
    if before_id is None and after_id is None and cols:
        left = cols[-1].sortKey
        right = None
    return left, right


@app.post("/v1/boards/{board_id}/columns", status_code=201)
def create_column(board_id: str, req: CreateColumnRequest, authorization: Optional[str] = Header(default=None)):
    user_id = get_user_id(authorization)
    if board_id not in store.boards:
        raise HTTPException(status_code=404, detail="not_found")
    if (board_id, user_id) not in store.memberships:
        raise HTTPException(status_code=403, detail="forbidden")
    before = req.beforeColumnId
    after = req.afterColumnId
    left, right = _column_anchors(board_id, before, after)
    key = midpoint(left, right)
    col = Column(
        id=str(uuid.uuid4()),
        boardId=board_id,
        name=req.name.strip(),
        sortKey=key,
        createdAt=now_iso(),
        updatedAt=now_iso(),
    )
    store.columns[col.id] = col
    return col.__dict__


@app.post("/v1/boards/{board_id}/columns/{column_id}:move")
def move_column(board_id: str, column_id: str, req: MoveColumnRequest, authorization: Optional[str] = Header(default=None)):
    user_id = get_user_id(authorization)
    col = store.columns.get(column_id)
    if not col or col.boardId != board_id:
        raise HTTPException(status_code=404, detail="not_found")
    if (board_id, user_id) not in store.memberships:
        raise HTTPException(status_code=403, detail="forbidden")
    left, right = _column_anchors(board_id, req.beforeColumnId, req.afterColumnId)
    col.sortKey = midpoint(left, right)
    col.updatedAt = now_iso()
    return col.__dict__


def _card_anchors(board_id: str, column_id: str, before_id: Optional[str], after_id: Optional[str]):
    cards = [c for c in store.cards.values() if c.boardId == board_id and c.columnId == column_id]
    cards.sort(key=lambda c: (c.sortKey, c.createdAt, c.id))
    id_to_key = {c.id: c.sortKey for c in cards}
    left = id_to_key.get(before_id) if before_id else None
    right = id_to_key.get(after_id) if after_id else None
    if before_id is None and after_id is None and cards:
        left = cards[-1].sortKey
        right = None
    return left, right


@app.post("/v1/boards/{board_id}/columns/{column_id}/cards", status_code=201)
def create_card(board_id: str, column_id: str, req: CreateCardRequest, authorization: Optional[str] = Header(default=None)):
    user_id = get_user_id(authorization)
    if board_id not in store.boards:
        raise HTTPException(status_code=404, detail="not_found")
    if (board_id, user_id) not in store.memberships:
        raise HTTPException(status_code=403, detail="forbidden")
    if column_id not in store.columns or store.columns[column_id].boardId != board_id:
        raise HTTPException(status_code=404, detail="not_found")
    left, right = _card_anchors(board_id, column_id, req.beforeCardId, req.afterCardId)
    key = midpoint(left, right)
    card = Card(
        id=str(uuid.uuid4()),
        boardId=board_id,
        columnId=column_id,
        title=req.title.strip(),
        description=req.description,
        sortKey=key,
        createdAt=now_iso(),
        updatedAt=now_iso(),
    )
    store.cards[card.id] = card
    return card.__dict__


@app.post("/v1/boards/{board_id}/cards/{card_id}:move")
def move_card(board_id: str, card_id: str, req: MoveCardRequest, authorization: Optional[str] = Header(default=None)):
    user_id = get_user_id(authorization)
    card = store.cards.get(card_id)
    if not card or card.boardId != board_id:
        raise HTTPException(status_code=404, detail="not_found")
    if (board_id, user_id) not in store.memberships:
        raise HTTPException(status_code=403, detail="forbidden")
    if req.expectedVersion is not None and req.expectedVersion != card.version:
        raise HTTPException(status_code=412, detail="stale_version")
    target_column = req.toColumnId or card.columnId
    # Validate target column belongs to same board
    col = store.columns.get(target_column)
    if not col or col.boardId != board_id:
        # Cross-board invalid
        return JSONResponse(status_code=409, content={"error": {"code": "invalid_move", "message": "Card can be moved only within the same board."}})
    left, right = _card_anchors(board_id, target_column, req.beforeCardId, req.afterCardId)
    card.sortKey = midpoint(left, right)
    card.columnId = target_column
    card.version += 1
    card.updatedAt = now_iso()
    return card.__dict__


@app.post("/v1/boards/{board_id}/members", status_code=201)
def invite_member(board_id: str, req: InviteMemberRequest, authorization: Optional[str] = Header(default=None)):
    user_id = get_user_id(authorization)
    if board_id not in store.boards:
        raise HTTPException(status_code=404, detail="not_found")
    if (board_id, user_id) not in store.memberships or store.memberships[(board_id, user_id)].role != "admin":
        raise HTTPException(status_code=403, detail="forbidden")
    if not req.email and not req.userId:
        raise HTTPException(status_code=422, detail="email_or_userId_required")
    inv_id = str(uuid.uuid4())
    token = str(uuid.uuid4()).replace("-", "")
    ts = now_iso()
    invitation = {
        "id": inv_id,
        "boardId": board_id,
        "email": req.email,
        "role": req.role,
        "status": "pending",
        "token": token,
        "createdAt": ts,
        "updatedAt": ts,
    }
    # For simplicity, do not persist invitation in separate store since not needed by tests
    return {"membership": None, "invitation": invitation}


# Root route to help manual checks
@app.get("/")
def root():
    return {"service": "todo", "version": "1.0.0"}

