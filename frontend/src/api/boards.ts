import type { BoardSummary, BoardViewData, Column, Card, Role } from '../types';
import { apiGet, apiPost } from './client';

export async function createBoard(name: string, description: string | null): Promise<BoardSummary> {
  return apiPost<BoardSummary>('/boards', { name, description });
}

export async function listBoards(): Promise<{ boards: BoardSummary[]; nextCursor: string | null }> {
  return apiGet('/boards');
}

export async function getBoard(boardId: string): Promise<BoardViewData> {
  return apiGet(`/boards/${boardId}`);
}

export async function createColumn(boardId: string, name: string, beforeColumnId: string | null, afterColumnId: string | null): Promise<Column> {
  return apiPost(`/boards/${boardId}/columns`, { name, beforeColumnId, afterColumnId });
}

export async function moveColumn(boardId: string, columnId: string, beforeColumnId: string | null, afterColumnId: string | null): Promise<Column> {
  return apiPost(`/boards/${boardId}/columns/${columnId}:move`, { beforeColumnId, afterColumnId });
}

export async function createCard(boardId: string, columnId: string, title: string, beforeCardId: string | null, afterCardId: string | null): Promise<Card> {
  return apiPost(`/boards/${boardId}/columns/${columnId}/cards`, { title, description: null, beforeCardId, afterCardId });
}

export async function moveCard(boardId: string, cardId: string, toColumnId: string, beforeCardId: string | null, afterCardId: string | null, expectedVersion: number): Promise<Card> {
  return apiPost(`/boards/${boardId}/cards/${cardId}:move`, { toColumnId, beforeCardId, afterCardId, expectedVersion });
}

export async function inviteMember(boardId: string, email: string, role: Role) {
  return apiPost(`/boards/${boardId}/members`, { email, role });
}

