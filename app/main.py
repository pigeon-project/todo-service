from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from app.auth import get_current_user, User
from app.db import init_db, session_scope, Board, Column, Card, Membership, Invitation, now_utc
from app.lexorank import midpoint, normalize_key
from app.schemas import (
    BoardCreate,
    BoardsList,
    BoardSummary,
    BoardDetail,
    ColumnCreate,
    ColumnOut,
    CardCreate,
    CardOut,
    CardMove,
    InviteByEmail,
    InviteResponse,
    MembershipOut,
    InvitationOut,
)

app = FastAPI(title="TODO Service", openapi_url=None, docs_url=None, redoc_url=None)
init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def sort_columns_query(board_id: str):
    def key(c: Column):
        return (c.sort_key, c.created_at, c.id)
    with session_scope() as s:
        cols = s.query(Column).filter(Column.board_id == board_id).all()
        return sorted(cols, key=key)


def sort_cards_query(board_id: str):
    def key(c: Card):
        return (c.sort_key, c.created_at, c.id)
    with session_scope() as s:
        cards = s.query(Card).filter(Card.board_id == board_id).all()
        return sorted(cards, key=key)


@app.get("/v1/health")
def health():
    return {"status": "ok"}


@app.get("/v1/version")
def version():
    return {"version": "1.0.0"}


@app.post("/v1/boards", response_model=BoardSummary, status_code=201)
def create_board(body: BoardCreate, user: User = Depends(get_current_user)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail={"error": {"code": "validation_error", "message": "name must not be empty"}})
    board_id = str(uuid.uuid4())
    now = now_utc()
    with session_scope() as s:
        b = Board(
            id=board_id,
            name=name,
            description=(body.description.strip() if body.description else None),
            owner=user.id,
            created_at=now,
            updated_at=now,
        )
        s.add(b)
        # Add owner membership as admin
        m = Membership(
            board_id=board_id,
            user_id=user.id,
            role="admin",
            status="active",
            invited_by=user.id,
            created_at=now,
            updated_at=now,
        )
        s.add(m)
    return BoardSummary(
        id=board_id,
        name=name,
        description=(body.description.strip() if body.description else None),
        owner=user.id,
        createdAt=now,
        updatedAt=now,
        myRole="admin",
        membersCount=1,
    )


@app.get("/v1/boards", response_model=BoardsList)
def list_boards(user: User = Depends(get_current_user), limit: int = 50, cursor: Optional[str] = None):
    limit = max(1, min(limit, 200))
    with session_scope() as s:
        # For simplicity: list boards where user is a member or owner
        q = (
            s.query(Board)
            .join(Membership, Membership.board_id == Board.id)
            .filter(Membership.user_id == user.id)
            .order_by(Board.created_at.desc(), Board.id.desc())
        )
        items = q.all()
        # No real cursor; return all up to limit
        boards = []
        for b in items[:limit]:
            role = (
                s.query(Membership.role)
                .filter(Membership.board_id == b.id, Membership.user_id == user.id)
                .scalar() or "reader"
            )
            count = s.query(Membership).filter(Membership.board_id == b.id).count()
            boards.append(
                BoardSummary(
                    id=b.id,
                    name=b.name,
                    description=b.description,
                    owner=b.owner,
                    createdAt=b.created_at,
                    updatedAt=b.updated_at,
                    myRole=role,
                    membersCount=count,
                )
            )
    return BoardsList(boards=boards, nextCursor=None)


@app.get("/v1/boards/{board_id}", response_model=BoardDetail)
def get_board(board_id: str, user: User = Depends(get_current_user)):
    with session_scope() as s:
        b: Board | None = s.query(Board).filter(Board.id == board_id).first()
        if not b:
            raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": "Board not found"}})
        # Authorization: must be member
        member = s.query(Membership).filter(Membership.board_id == board_id, Membership.user_id == user.id).first()
        if not member:
            raise HTTPException(status_code=403, detail={"error": {"code": "forbidden", "message": "Not a member"}})
        count = s.query(Membership).filter(Membership.board_id == board_id).count()
        board_summary = BoardSummary(
            id=b.id,
            name=b.name,
            description=b.description,
            owner=b.owner,
            createdAt=b.created_at,
            updatedAt=b.updated_at,
            myRole=member.role,
            membersCount=count,
        )
        # Columns sorted
        cols = s.query(Column).filter(Column.board_id == board_id).all()
        cols_sorted = sorted(cols, key=lambda c: (c.sort_key, c.created_at, c.id))
        columns = [
            ColumnOut(
                id=c.id,
                boardId=c.board_id,
                name=c.name,
                sortKey=c.sort_key,
                createdAt=c.created_at,
                updatedAt=c.updated_at,
            )
            for c in cols_sorted
        ]
        # Cards sorted
        cards = s.query(Card).filter(Card.board_id == board_id).all()
        cards_sorted = sorted(cards, key=lambda c: (c.sort_key, c.created_at, c.id))
        cards_out = [
            CardOut(
                id=c.id,
                boardId=c.board_id,
                columnId=c.column_id,
                title=c.title,
                description=c.description,
                sortKey=c.sort_key,
                createdAt=c.created_at,
                updatedAt=c.updated_at,
                version=c.version,
            )
            for c in cards_sorted
        ]
    return BoardDetail(board=board_summary, columns=columns, cards=cards_out)


@app.post("/v1/boards/{board_id}/columns", response_model=ColumnOut, status_code=201)
def create_column(board_id: str, body: ColumnCreate, user: User = Depends(get_current_user)):
    with session_scope() as s:
        # Auth: writer/admin
        member = s.query(Membership).filter(Membership.board_id == board_id, Membership.user_id == user.id).first()
        if not member or member.role not in ("admin", "writer"):
            raise HTTPException(status_code=403, detail={"error": {"code": "forbidden", "message": "Insufficient permissions"}})
        b: Board | None = s.query(Board).filter(Board.id == board_id).first()
        if not b:
            raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": "Board not found"}})

        # Determine anchors
        before = None
        after = None
        if body.beforeColumnId:
            c = s.query(Column).filter(Column.id == body.beforeColumnId, Column.board_id == board_id).first()
            if not c:
                raise HTTPException(status_code=422, detail={"error": {"code": "validation_error", "message": "beforeColumnId invalid"}})
            before = c.sort_key
        if body.afterColumnId:
            c = s.query(Column).filter(Column.id == body.afterColumnId, Column.board_id == board_id).first()
            if not c:
                raise HTTPException(status_code=422, detail={"error": {"code": "validation_error", "message": "afterColumnId invalid"}})
            after = c.sort_key
        sort_key = midpoint(after, before)  # after = left, before = right
        col_id = str(uuid.uuid4())
        now = now_utc()
        c = Column(id=col_id, board_id=board_id, name=body.name.strip(), sort_key=sort_key, created_at=now, updated_at=now)
        s.add(c)
        return ColumnOut(id=col_id, boardId=board_id, name=c.name, sortKey=sort_key, createdAt=now, updatedAt=now)


@app.post("/v1/boards/{board_id}/columns/{column_id}:move", response_model=ColumnOut)
def move_column(board_id: str, column_id: str, body: dict, user: User = Depends(get_current_user)):
    beforeColumnId = body.get("beforeColumnId")
    afterColumnId = body.get("afterColumnId")
    with session_scope() as s:
        member = s.query(Membership).filter(Membership.board_id == board_id, Membership.user_id == user.id).first()
        if not member or member.role not in ("admin", "writer"):
            raise HTTPException(status_code=403, detail={"error": {"code": "forbidden"}})
        c: Column | None = s.query(Column).filter(Column.id == column_id, Column.board_id == board_id).first()
        if not c:
            raise HTTPException(status_code=404, detail={"error": {"code": "not_found"}})
        left = None
        right = None
        if afterColumnId:
            a = s.query(Column).filter(Column.id == afterColumnId, Column.board_id == board_id).first()
            if not a:
                raise HTTPException(status_code=409, detail={"error": {"code": "invalid_move", "message": "Anchor not in board"}})
            left = a.sort_key
        if beforeColumnId:
            b = s.query(Column).filter(Column.id == beforeColumnId, Column.board_id == board_id).first()
            if not b:
                raise HTTPException(status_code=409, detail={"error": {"code": "invalid_move", "message": "Anchor not in board"}})
            right = b.sort_key
        c.sort_key = midpoint(left, right)
        c.updated_at = now_utc()
        s.add(c)
        return ColumnOut(id=c.id, boardId=c.board_id, name=c.name, sortKey=c.sort_key, createdAt=c.created_at, updatedAt=c.updated_at)


@app.post("/v1/boards/{board_id}/columns/{column_id}/cards", response_model=CardOut, status_code=201)
def create_card(board_id: str, column_id: str, body: CardCreate, user: User = Depends(get_current_user)):
    with session_scope() as s:
        member = s.query(Membership).filter(Membership.board_id == board_id, Membership.user_id == user.id).first()
        if not member or member.role not in ("admin", "writer"):
            raise HTTPException(status_code=403, detail={"error": {"code": "forbidden"}})
        col: Column | None = s.query(Column).filter(Column.id == column_id, Column.board_id == board_id).first()
        if not col:
            raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": "Column not found"}})
        before = None
        after = None
        if body.beforeCardId:
            x = s.query(Card).filter(Card.id == body.beforeCardId, Card.column_id == column_id).first()
            if not x:
                raise HTTPException(status_code=422, detail={"error": {"code": "validation_error", "message": "beforeCardId invalid"}})
            before = x.sort_key
        if body.afterCardId:
            x = s.query(Card).filter(Card.id == body.afterCardId, Card.column_id == column_id).first()
            if not x:
                raise HTTPException(status_code=422, detail={"error": {"code": "validation_error", "message": "afterCardId invalid"}})
            after = x.sort_key
        sort_key = midpoint(after, before)
        card_id = str(uuid.uuid4())
        now = now_utc()
        c = Card(
            id=card_id,
            board_id=board_id,
            column_id=column_id,
            title=body.title.strip(),
            description=(body.description.strip() if body.description else None),
            sort_key=sort_key,
            created_at=now,
            updated_at=now,
            version=0,
        )
        s.add(c)
        return CardOut(
            id=c.id,
            boardId=c.board_id,
            columnId=c.column_id,
            title=c.title,
            description=c.description,
            sortKey=c.sort_key,
            createdAt=c.created_at,
            updatedAt=c.updated_at,
            version=c.version,
        )


@app.post("/v1/boards/{board_id}/cards/{card_id}:move", response_model=CardOut)
def move_card(board_id: str, card_id: str, body: CardMove, user: User = Depends(get_current_user)):
    with session_scope() as s:
        member = s.query(Membership).filter(Membership.board_id == board_id, Membership.user_id == user.id).first()
        if not member or member.role not in ("admin", "writer"):
            raise HTTPException(status_code=403, detail={"error": {"code": "forbidden"}})
        card: Card | None = s.query(Card).filter(Card.id == card_id).first()
        if not card:
            raise HTTPException(status_code=404, detail={"error": {"code": "not_found"}})
        if card.board_id != board_id:
            raise HTTPException(status_code=409, detail={"error": {"code": "invalid_move", "message": "Card can be moved only within the same board."}})
        # optimistic lock
        if body.expectedVersion is not None and body.expectedVersion != card.version:
            raise HTTPException(status_code=412, detail={"error": {"code": "precondition_failed", "message": "stale version"}})
        target_column_id = body.toColumnId or card.column_id
        # anchors must belong to target column
        left = None
        right = None
        if body.afterCardId:
            a = s.query(Card).filter(Card.id == body.afterCardId).first()
            if not a or a.column_id != target_column_id or a.board_id != board_id:
                raise HTTPException(status_code=409, detail={"error": {"code": "invalid_move", "message": "afterCardId anchor invalid"}})
            left = a.sort_key
        if body.beforeCardId:
            b = s.query(Card).filter(Card.id == body.beforeCardId).first()
            if not b or b.column_id != target_column_id or b.board_id != board_id:
                raise HTTPException(status_code=409, detail={"error": {"code": "invalid_move", "message": "beforeCardId anchor invalid"}})
            right = b.sort_key
        card.column_id = target_column_id
        card.sort_key = midpoint(left, right)
        card.version = (card.version or 0) + 1
        card.updated_at = now_utc()
        s.add(card)
        return CardOut(
            id=card.id,
            boardId=card.board_id,
            columnId=card.column_id,
            title=card.title,
            description=card.description,
            sortKey=card.sort_key,
            createdAt=card.created_at,
            updatedAt=card.updated_at,
            version=card.version,
        )


@app.post("/v1/boards/{board_id}/members", response_model=InviteResponse, status_code=201)
def invite_member(board_id: str, body: InviteByEmail, user: User = Depends(get_current_user)):
    # Only admin can invite; only email flow implemented
    if not body.email:
        raise HTTPException(status_code=422, detail={"error": {"code": "validation_error", "message": "email required"}})
    if body.role not in ("admin", "writer", "reader"):
        raise HTTPException(status_code=422, detail={"error": {"code": "validation_error", "message": "role invalid"}})
    now = now_utc()
    with session_scope() as s:
        me = s.query(Membership).filter(Membership.board_id == board_id, Membership.user_id == user.id).first()
        if not me or me.role != "admin":
            raise HTTPException(status_code=403, detail={"error": {"code": "forbidden"}})
        # create pending membership keyed by email-as-user placeholder
        pseudo_user_id = body.email  # simplified
        mem = Membership(
            board_id=board_id,
            user_id=pseudo_user_id,
            role=body.role,
            status="pending",
            invited_by=user.id,
            created_at=now,
            updated_at=now,
        )
        s.add(mem)
        inv_id = str(uuid.uuid4())
        token = str(uuid.uuid4())
        inv = Invitation(
            id=inv_id,
            board_id=board_id,
            email=body.email,
            role=body.role,
            status="pending",
            token=token,
            created_at=now,
            updated_at=now,
        )
        s.add(inv)
        return InviteResponse(
            membership=MembershipOut(
                boardId=mem.board_id,
                userId=mem.user_id,
                role=mem.role,
                status=mem.status,
                invitedBy=mem.invited_by,
                createdAt=mem.created_at,
                updatedAt=mem.updated_at,
            ),
            invitation=InvitationOut(
                id=inv.id,
                boardId=inv.board_id,
                email=inv.email,
                role=inv.role,
                status=inv.status,
                token=inv.token,
            ),
        )


# Uvicorn entrypoint convenience when running via `python -m app.main`
def create_app() -> FastAPI:
    return app

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)

