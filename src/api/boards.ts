import { apiFetch } from './client';
import type { Board, Column, Card } from '../types';

export async function createBoard(name: string, description: string | null) {
  return apiFetch('/boards', { method: 'POST', body: JSON.stringify({ name, description }) }) as Promise<Board>;
}

export async function listBoards(limit = 50, cursor?: string | null) {
  const qs = new URLSearchParams();
  qs.set('limit', String(limit));
  if (cursor) qs.set('cursor', cursor);
  return apiFetch(`/boards?${qs.toString()}`) as Promise<{ boards: Board[]; nextCursor: string | null }>;
}

export async function getBoard(id: string) {
  return apiFetch(`/boards/${id}`) as Promise<{ board: Board; columns: Column[]; cards: Card[] }>;
}

export async function createColumn(boardId: string, name: string, beforeColumnId?: string | null, afterColumnId?: string | null) {
  return apiFetch(`/boards/${boardId}/columns`, {
    method: 'POST',
    body: JSON.stringify({ name, beforeColumnId: beforeColumnId ?? null, afterColumnId: afterColumnId ?? null })
  }) as Promise<Column>;
}

export async function moveColumn(boardId: string, columnId: string, beforeColumnId?: string | null, afterColumnId?: string | null) {
  return apiFetch(`/boards/${boardId}/columns/${columnId}:move`, {
    method: 'POST',
    body: JSON.stringify({ beforeColumnId: beforeColumnId ?? null, afterColumnId: afterColumnId ?? null })
  }) as Promise<Column>;
}

export async function createCard(boardId: string, columnId: string, title: string, description?: string | null, beforeCardId?: string | null, afterCardId?: string | null) {
  return apiFetch(`/boards/${boardId}/columns/${columnId}/cards`, {
    method: 'POST',
    body: JSON.stringify({ title, description: description ?? null, beforeCardId: beforeCardId ?? null, afterCardId: afterCardId ?? null })
  }) as Promise<Card>;
}

export async function moveCard(boardId: string, cardId: string, toColumnId?: string, beforeCardId?: string | null, afterCardId?: string | null, expectedVersion?: number) {
  return apiFetch(`/boards/${boardId}/cards/${cardId}:move`, {
    method: 'POST',
    body: JSON.stringify({ toColumnId, beforeCardId: beforeCardId ?? null, afterCardId: afterCardId ?? null, expectedVersion })
  }) as Promise<Card>;
}

export async function inviteMember(boardId: string, email: string, role: 'admin'|'writer'|'reader') {
  return apiFetch(`/boards/${boardId}/members`, { method: 'POST', body: JSON.stringify({ email, role }) }) as Promise<{ membership: any; invitation: any }>;
}

