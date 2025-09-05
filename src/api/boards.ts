import { apiFetch } from './client';
import type { BoardSummary, BoardsListResponse, BoardViewResponse, ColumnDTO, CardDTO } from '../types';

export async function createBoard(input: { name: string; description?: string | null }): Promise<BoardSummary> {
  return apiFetch<BoardSummary>(`/boards`, { method: 'POST', body: input });
}

export async function listBoards(params?: { limit?: number; cursor?: string }): Promise<BoardsListResponse> {
  const q = new URLSearchParams();
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.cursor) q.set('cursor', params.cursor);
  const query = q.toString();
  return apiFetch<BoardsListResponse>(`/boards${query ? `?${query}` : ''}`);
}

export async function getBoard(boardId: string): Promise<BoardViewResponse> {
  return apiFetch<BoardViewResponse>(`/boards/${boardId}`);
}

export async function createColumn(boardId: string, input: { name: string; beforeColumnId?: string | null; afterColumnId?: string | null }): Promise<ColumnDTO> {
  return apiFetch<ColumnDTO>(`/boards/${boardId}/columns`, { method: 'POST', body: input });
}

export async function moveColumn(boardId: string, columnId: string, input: { beforeColumnId?: string | null; afterColumnId?: string | null }): Promise<ColumnDTO> {
  return apiFetch<ColumnDTO>(`/boards/${boardId}/columns/${columnId}:move`, { method: 'POST', body: input });
}

export async function createCard(boardId: string, columnId: string, input: { title: string; description?: string | null; beforeCardId?: string | null; afterCardId?: string | null }): Promise<CardDTO> {
  return apiFetch<CardDTO>(`/boards/${boardId}/columns/${columnId}/cards`, { method: 'POST', body: input });
}

export async function moveCard(boardId: string, cardId: string, input: { toColumnId?: string; beforeCardId?: string | null; afterCardId?: string | null; expectedVersion?: number }): Promise<CardDTO> {
  return apiFetch<CardDTO>(`/boards/${boardId}/cards/${cardId}:move`, { method: 'POST', body: input });
}

export async function inviteMember(boardId: string, input: { email?: string; userId?: string; role: 'admin' | 'writer' | 'reader' }): Promise<{ membership: unknown; invitation?: unknown }> {
  return apiFetch<{ membership: unknown; invitation?: unknown }>(`/boards/${boardId}/members`, { method: 'POST', body: input });
}

