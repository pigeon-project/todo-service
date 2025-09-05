import { apiFetch, makeGet, makePost } from './client';
import type { BoardSummary, PaginatedBoards, BoardView, Column, Card, Role } from '../types';

export async function listBoards(limit = 50, cursor?: string): Promise<PaginatedBoards> {
  const q = new URLSearchParams();
  q.set('limit', String(limit));
  if (cursor) q.set('cursor', cursor);
  return makeGet(`/boards?${q.toString()}`);
}

export async function createBoard(name: string, description?: string | null): Promise<BoardSummary> {
  return makePost(`/boards`, { name, description: description ?? null });
}

export async function getBoard(boardId: string): Promise<BoardView> {
  return makeGet(`/boards/${encodeURIComponent(boardId)}`);
}

export async function createColumn(boardId: string, name: string, beforeColumnId?: string | null, afterColumnId?: string | null): Promise<Column> {
  return makePost(`/boards/${encodeURIComponent(boardId)}/columns`, {
    name,
    beforeColumnId: beforeColumnId ?? null,
    afterColumnId: afterColumnId ?? null,
  });
}

export async function moveColumn(boardId: string, columnId: string, beforeColumnId?: string | null, afterColumnId?: string | null): Promise<Column> {
  return makePost(`/boards/${encodeURIComponent(boardId)}/columns/${encodeURIComponent(columnId)}:move`, {
    beforeColumnId: beforeColumnId ?? null,
    afterColumnId: afterColumnId ?? null,
  });
}

export async function createCard(boardId: string, columnId: string, title: string, beforeCardId?: string | null, afterCardId?: string | null): Promise<Card> {
  return makePost(`/boards/${encodeURIComponent(boardId)}/columns/${encodeURIComponent(columnId)}/cards`, {
    title,
    description: null,
    beforeCardId: beforeCardId ?? null,
    afterCardId: afterCardId ?? null,
  });
}

export async function moveCard(
  boardId: string,
  cardId: string,
  toColumnId: string | undefined,
  beforeCardId: string | null,
  afterCardId: string | null,
  expectedVersion: number
): Promise<Card> {
  return makePost(`/boards/${encodeURIComponent(boardId)}/cards/${encodeURIComponent(cardId)}:move`, {
    toColumnId: toColumnId ?? undefined,
    beforeCardId,
    afterCardId,
    expectedVersion,
  });
}

export async function inviteMember(boardId: string, email: string, role: Role): Promise<{ membership: any; invitation: any }> {
  return makePost(`/boards/${encodeURIComponent(boardId)}/members`, { email, role });
}

