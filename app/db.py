from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Iterator

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    create_engine,
    UniqueConstraint,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker, Session

SQLALCHEMY_DATABASE_URL = "sqlite:///./todo.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class Board(Base):
    __tablename__ = "boards"
    id = Column(String, primary_key=True)
    name = Column(String(140), nullable=False)
    description = Column(Text, nullable=True)
    owner = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now_utc)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=now_utc)

    columns = relationship("Column", back_populates="board", cascade="all, delete-orphan")
    cards = relationship("Card", back_populates="board", cascade="all, delete-orphan")
    memberships = relationship("Membership", back_populates="board", cascade="all, delete-orphan")


class Column(Base):
    __tablename__ = "columns"
    id = Column(String, primary_key=True)
    board_id = Column(String, ForeignKey("boards.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(80), nullable=False)
    sort_key = Column(String, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now_utc)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=now_utc)

    board = relationship("Board", back_populates="columns")
    cards = relationship("Card", back_populates="column", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("board_id", "sort_key", name="uq_column_sort_per_board"),
    )


class Card(Base):
    __tablename__ = "cards"
    id = Column(String, primary_key=True)
    board_id = Column(String, ForeignKey("boards.id", ondelete="CASCADE"), nullable=False)
    column_id = Column(String, ForeignKey("columns.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    sort_key = Column(String, nullable=False, index=True)
    version = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now_utc)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=now_utc)

    board = relationship("Board", back_populates="cards")
    column = relationship("Column", back_populates="cards")

    __table_args__ = (
        UniqueConstraint("column_id", "sort_key", name="uq_card_sort_per_column"),
    )


class Membership(Base):
    __tablename__ = "memberships"
    board_id = Column(String, ForeignKey("boards.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(String, primary_key=True)
    role = Column(String, nullable=False)  # admin|writer|reader
    status = Column(String, nullable=False)  # active|pending
    invited_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now_utc)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=now_utc)

    board = relationship("Board", back_populates="memberships")


class Invitation(Base):
    __tablename__ = "invitations"
    id = Column(String, primary_key=True)
    board_id = Column(String, ForeignKey("boards.id", ondelete="CASCADE"), nullable=False)
    email = Column(String, nullable=True)
    role = Column(String, nullable=False)
    status = Column(String, nullable=False)  # pending|accepted|expired|revoked
    token = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now_utc)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=now_utc)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


@contextmanager
def session_scope() -> Iterator[Session]:
    session: Session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

