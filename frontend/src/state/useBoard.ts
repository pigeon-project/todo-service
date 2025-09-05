import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BoardViewData, Column, Card } from '../types';
import { createCard, createColumn, getBoard, moveCard, moveColumn } from '../api/boards';

export function useBoard(boardId: string | null) {
  const [data, setData] = useState<BoardViewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!boardId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getBoard(boardId);
      setData(res);
    } catch (e: any) {
      setError(e?.error?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    if (boardId) refetch();
  }, [boardId, refetch]);

  const columns = useMemo(() => data?.columns || [], [data]);
  const cardsByColumn = useMemo(() => {
    const map: Record<string, Card[]> = {};
    (data?.cards || []).forEach((c) => {
      if (!map[c.columnId]) map[c.columnId] = [];
      map[c.columnId].push(c);
    });
    Object.values(map).forEach((list) => list.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : a.id.localeCompare(b.id))));
    return map;
  }, [data]);

  const addColumn = useCallback(async (name: string) => {
    if (!data) return;
    const last = [...columns].sort((a, b) => (a.sortKey < b.sortKey ? -1 : 1)).at(-1) || null;
    const created = await createColumn(data.board.id, name, null, last ? last.id : null);
    setData({ ...data, columns: [...data.columns, created] });
  }, [data, columns]);

  const reorderColumn = useCallback(async (colId: string, targetIndex: number) => {
    if (!data) return;
    const sorted = [...data.columns].sort((a, b) => (a.sortKey < b.sortKey ? -1 : 1));
    const fromIndex = sorted.findIndex((c) => c.id === colId);
    if (fromIndex < 0) return;
    const item = sorted.splice(fromIndex, 1)[0];
    const idx = Math.max(0, Math.min(targetIndex, sorted.length));
    sorted.splice(idx, 0, item);
    // compute anchors
    const before = sorted[idx + 1] || null;
    const after = sorted[idx - 1] || null;
    const updated = await moveColumn(data.board.id, colId, before ? before.id : null, after ? after.id : null);
    const nextCols = data.columns.map((c) => (c.id === colId ? updated : c));
    setData({ ...data, columns: nextCols });
  }, [data]);

  const addCard = useCallback(async (columnId: string, title: string) => {
    if (!data) return;
    const list = cardsByColumn[columnId] || [];
    const last = list.at(-1) || null;
    const created = await createCard(data.board.id, columnId, title, null, last ? last.id : null);
    setData({ ...data, cards: [...data.cards, created] });
  }, [data, cardsByColumn]);

  const moveCardAction = useCallback(async (cardId: string, toColumnId: string, targetIndex: number) => {
    if (!data) return;
    const all = data.cards;
    const card = all.find((c) => c.id === cardId);
    if (!card) return;
    const list = all.filter((c) => (c.columnId === toColumnId)).sort((a, b) => (a.sortKey < b.sortKey ? -1 : 1));
    const without = list.filter((c) => c.id !== cardId);
    const idx = Math.max(0, Math.min(targetIndex, without.length));
    const before = without[idx] || null;
    const after = without[idx - 1] || null;
    const updated = await moveCard(data.board.id, cardId, toColumnId, before ? before.id : null, after ? after.id : null, card.version);
    const next = all.map((c) => (c.id === cardId ? updated : c));
    setData({ ...data, cards: next });
  }, [data]);

  return { data, loading, error, refetch, addColumn, reorderColumn, addCard, moveCard: moveCardAction, columns, cardsByColumn };
}

