import { useCallback, useEffect, useMemo, useState } from 'react';
import { Board, Column, Card } from '../types';
import * as api from '../api/boards';

export function useBoard(boardId: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [cards, setCards] = useState<Card[]>([]);

  const refetch = useCallback(async () => {
    if (!boardId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getBoard(boardId);
      setBoard(data.board);
      setColumns(data.columns);
      setCards(data.cards);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    if (boardId) refetch();
  }, [boardId, refetch]);

  const byColumn = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const c of columns) map.set(c.id, []);
    for (const card of cards) {
      if (!map.has(card.columnId)) map.set(card.columnId, []);
      map.get(card.columnId)!.push(card);
    }
    for (const list of map.values()) list.sort((a,b) => a.sortKey.localeCompare(b.sortKey) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    return map;
  }, [columns, cards]);

  const addColumn = useCallback(async (name: string, beforeId?: string | null, afterId?: string | null) => {
    if (!board) return;
    const col = await api.createColumn(board.id, name, beforeId ?? null, afterId ?? null);
    setColumns(prev => [...prev, col].sort((a,b) => a.sortKey.localeCompare(b.sortKey)));
  }, [board]);

  const moveColumn = useCallback(async (columnId: string, beforeId?: string | null, afterId?: string | null) => {
    if (!board) return;
    const updated = await api.moveColumn(board.id, columnId, beforeId ?? null, afterId ?? null);
    setColumns(prev => prev.map(c => c.id === columnId ? updated : c).sort((a,b)=> a.sortKey.localeCompare(b.sortKey)));
  }, [board]);

  const addCard = useCallback(async (columnId: string, title: string, beforeId?: string | null, afterId?: string | null) => {
    if (!board) return;
    const card = await api.createCard(board.id, columnId, title, null, beforeId ?? null, afterId ?? null);
    setCards(prev => [...prev, card]);
  }, [board]);

  const moveCard = useCallback(async (cardId: string, toColumnId: string, beforeId?: string | null, afterId?: string | null) => {
    if (!board) return;
    const current = cards.find(c => c.id === cardId);
    const expectedVersion = current?.version;
    const updated = await api.moveCard(board.id, cardId, toColumnId, beforeId ?? null, afterId ?? null, expectedVersion);
    setCards(prev => prev.map(c => c.id === cardId ? updated : c));
  }, [board, cards]);

  return { loading, error, board, columns, cards, byColumn, refetch, addColumn, moveColumn, addCard, moveCard };
}

