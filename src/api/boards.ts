import { api } from './client';
import type { Board, Column, Card } from '../types';

export async function createBoard(name: string, description: string | null): Promise<Board> {
  return api<Board>('/boards', { method: 'POST', body: JSON.stringify({ name, description }) });
}

export async function listBoards(): Promise<{ boards: Board[]; nextCursor: string | null }>{
  return api('/boards');
}

export async function getBoard(id: string): Promise<{ board: Board; columns: Column[]; cards: Card[] }>{
  return api(`/boards/${id}`);
}

export async function createColumn(boardId: string, name: string, anchors: { beforeColumnId: string | null; afterColumnId: string | null }): Promise<Column> {
  return api(`/boards/${boardId}/columns`, { method: 'POST', body: JSON.stringify({ name, ...anchors }) });
}

export async function moveColumn(boardId: string, columnId: string, anchors: { beforeColumnId: string | null; afterColumnId: string | null }): Promise<void> {
  await api(`/boards/${boardId}/columns/${columnId}:move`, { method: 'POST', body: JSON.stringify(anchors) });
}

export async function createCard(boardId: string, columnId: string, title: string, anchors: { beforeCardId: string | null; afterCardId: string | null }): Promise<Card> {
  return api(`/boards/${boardId}/columns/${columnId}/cards`, { method: 'POST', body: JSON.stringify({ title, description: null, ...anchors }) });
}

export async function moveCard(boardId: string, cardId: string, toColumnId: string, anchors: { beforeCardId: string | null; afterCardId: string | null }, expectedVersion: number): Promise<void> {
  await api(`/boards/${boardId}/cards/${cardId}:move`, { method: 'POST', body: JSON.stringify({ toColumnId, ...anchors, expectedVersion }) });
}

export async function inviteMember(boardId: string, email: string, role: 'admin'|'writer'|'reader') {
  return api(`/boards/${boardId}/members`, { method: 'POST', body: JSON.stringify({ email, role }) });
}

