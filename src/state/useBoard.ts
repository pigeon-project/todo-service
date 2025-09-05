import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BoardSummary, BoardViewResponse, CardDTO, ColumnDTO } from '../types';
import { createBoard, getBoard, listBoards, createColumn, moveColumn, createCard, moveCard, inviteMember } from '../api/boards';

export function useBoardsList() {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await listBoards({ limit: 50 });
      setBoards(res.boards);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const addBoard = useCallback(async (name: string, description?: string | null) => {
    const b = await createBoard({ name, description: description ?? null });
    setBoards(prev => [b, ...prev]);
    return b;
  }, []);

  return { boards, loading, error, refresh, addBoard };
}

export function useBoard(boardId: string | null) {
  const [board, setBoard] = useState<BoardSummary | null>(null);
  const [columns, setColumns] = useState<ColumnDTO[]>([]);
  const [cards, setCards] = useState<CardDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!boardId) return;
    setLoading(true); setError(null);
    try {
      const res: BoardViewResponse = await getBoard(boardId);
      setBoard(res.board);
      setColumns(res.columns.slice().sort((a,b)=> a.sortKey.localeCompare(b.sortKey)));
      setCards(res.cards.slice().sort((a,b)=> a.sortKey.localeCompare(b.sortKey)));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load board');
    } finally { setLoading(false); }
  }, [boardId]);

  useEffect(() => { if (boardId) void refresh(); }, [boardId, refresh]);

  const role = board?.myRole ?? 'reader';
  const isReadOnly = role === 'reader';

  const columnCards = useMemo(() => {
    const map = new Map<string, CardDTO[]>();
    for (const c of columns) map.set(c.id, []);
    for (const card of cards) {
      if (!map.has(card.columnId)) map.set(card.columnId, []);
      map.get(card.columnId)!.push(card);
    }
    for (const [k, arr] of map) arr.sort((a,b)=> a.sortKey.localeCompare(b.sortKey));
    return map;
  }, [columns, cards]);

  const addColumn = useCallback(async (name: string) => {
    if (!boardId) return null;
    const last = columns[columns.length - 1];
    const col = await createColumn(boardId, { name, beforeColumnId: null, afterColumnId: last?.id ?? null });
    setColumns(prev => [...prev, col]);
    return col;
  }, [boardId, columns]);

  const reorderColumn = useCallback(async (columnId: string, targetIndex: number) => {
    if (!boardId) return;
    const current = columns.findIndex(c => c.id === columnId);
    if (current < 0 || current === targetIndex) return;
    const arr = columns.slice();
    const [moved] = arr.splice(current, 1);
    arr.splice(targetIndex, 0, moved);
    // optimistic
    setColumns(arr);
    const before = arr[targetIndex] ? arr[targetIndex] : null;
    const after = targetIndex > 0 ? arr[targetIndex - 1] : null;
    const payload = { beforeColumnId: before?.id ?? null, afterColumnId: after?.id ?? null };
    try {
      const updated = await moveColumn(boardId, columnId, payload);
      setColumns(prev => prev.map(c => c.id === updated.id ? updated : c));
    } catch {
      // revert
      setColumns(columns);
    }
  }, [boardId, columns]);

  const addCard = useCallback(async (columnId: string, title: string) => {
    if (!boardId) return null;
    const currentCards = columnCards.get(columnId) ?? [];
    const last = currentCards[currentCards.length - 1];
    const card = await createCard(boardId, columnId, { title, description: null, beforeCardId: null, afterCardId: last?.id ?? null });
    setCards(prev => [...prev, card]);
    return card;
  }, [boardId, columnCards]);

  const moveCardWithinBoard = useCallback(async (cardId: string, toColumnId: string, targetIndex: number) => {
    if (!boardId) return;
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    const tempCards = cards.slice();
    const fromIdx = tempCards.findIndex(c => c.id === cardId);
    tempCards.splice(fromIdx, 1);
    // assemble destination array
    const dest = tempCards.filter(c => c.columnId === toColumnId);
    const before = dest[targetIndex] ?? null;
    const after = targetIndex > 0 ? dest[targetIndex - 1] : null;
    const optimistic: CardDTO = { ...card, columnId: toColumnId, version: card.version + 1 };
    // optimistic move in cards list
    const newCards = tempCards.concat([optimistic]);
    setCards(newCards);
    try {
      const updated = await moveCard(boardId, cardId, { toColumnId, beforeCardId: before?.id ?? null, afterCardId: after?.id ?? null, expectedVersion: card.version });
      setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
    } catch {
      // revert
      setCards(cards);
    }
  }, [boardId, cards]);

  const invite = useCallback(async (email: string, role: 'admin' | 'writer' | 'reader') => {
    if (!boardId) return;
    await inviteMember(boardId, { email, role });
  }, [boardId]);

  return { board, columns, cards, columnCards, loading, error, refresh, isReadOnly, addColumn, reorderColumn, addCard, moveCard: moveCardWithinBoard, invite };
}

