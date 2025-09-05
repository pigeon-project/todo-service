import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BoardView, Card, Column } from '../types';
import { createCard, createColumn, getBoard, moveCard, moveColumn } from '../api/boards';

export function useBoard(boardId?: string) {
  const [data, setData] = useState<BoardView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!boardId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getBoard(boardId);
      // Sort columns/cards defensively
      res.columns.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : a.id.localeCompare(b.id)));
      res.cards.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : a.id.localeCompare(b.id)));
      setData(res);
    } catch (e: any) {
      setError(e?.message || 'Failed to load board');
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const columnsById = useMemo(() => {
    const m = new Map<string, Column>();
    if (data) for (const c of data.columns) m.set(c.id, c);
    return m;
  }, [data]);

  const cardsByColumn = useMemo(() => {
    const m = new Map<string, Card[]>();
    if (!data) return m;
    for (const col of data.columns) {
      m.set(
        col.id,
        data.cards.filter((c) => c.columnId === col.id).sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : a.id.localeCompare(b.id)))
      );
    }
    return m;
  }, [data]);

  const addColumn = useCallback(
    async (name: string) => {
      if (!data) return;
      const cols = [...data.columns];
      const last = cols[cols.length - 1];
      const created = await createColumn(data.board.id, name, null, last ? last.id : null);
      setData({ ...data, columns: [...cols, created] });
    },
    [data]
  );

  const reorderColumn = useCallback(
    async (columnId: string, targetIndex: number) => {
      if (!data) return;
      const cols = [...data.columns];
      const fromIndex = cols.findIndex((c) => c.id === columnId);
      if (fromIndex === -1) return;
      const [moved] = cols.splice(fromIndex, 1);
      cols.splice(targetIndex, 0, moved!);
      // Compute anchors
      const before = cols[targetIndex]?.id ?? null; // item now at targetIndex
      const after = targetIndex - 1 >= 0 ? cols[targetIndex - 1]?.id ?? null : null;
      setData({ ...data, columns: cols }); // optimistic
      try {
        const updated = await moveColumn(data.board.id, columnId, before, after);
        // Replace moved with updated
        setData({ ...data, columns: data.columns.map((c) => (c.id === columnId ? updated : c)) });
      } catch (e) {
        // On failure, refetch to restore server order
        await refetch();
      }
    },
    [data, refetch]
  );

  const addCard = useCallback(
    async (columnId: string, title: string) => {
      if (!data) return;
      const cards = cardsByColumn.get(columnId) ?? [];
      const last = cards[cards.length - 1];
      const created = await createCard(data.board.id, columnId, title, null, last ? last.id : null);
      setData({ ...data, cards: [...data.cards, created] });
    },
    [data, cardsByColumn]
  );

  const moveCardWithin = useCallback(
    async (cardId: string, toColumnId: string, targetIndex: number) => {
      if (!data) return;
      const cardsInTo = cardsByColumn.get(toColumnId) ?? [];
      const before = cardsInTo[targetIndex]?.id ?? null; // item currently at target index
      const after = targetIndex - 1 >= 0 ? cardsInTo[targetIndex - 1]?.id ?? null : null;
      const card = data.cards.find((c) => c.id === cardId);
      if (!card) return;
      // optimistic local move
      const updatedCards = data.cards.map((c) => (c.id === cardId ? { ...c, columnId: toColumnId } : c));
      setData({ ...data, cards: updatedCards });
      try {
        const updated = await moveCard(data.board.id, cardId, toColumnId, before, after, card.version);
        setData({ ...data, cards: data.cards.map((c) => (c.id === cardId ? updated : c)) });
      } catch (e) {
        await refetch();
      }
    },
    [data, cardsByColumn, refetch]
  );

  const moveCardToColumnEnd = useCallback(
    async (cardId: string, toColumnId: string) => {
      if (!data) return;
      const cardsInTo = cardsByColumn.get(toColumnId) ?? [];
      const targetIndex = cardsInTo.length; // insert at end
      await moveCardWithin(cardId, toColumnId, targetIndex);
    },
    [data, cardsByColumn, moveCardWithin]
  );

  return {
    data,
    loading,
    error,
    columnsById,
    cardsByColumn,
    refetch,
    addColumn,
    reorderColumn,
    addCard,
    moveCardWithin,
    moveCardToColumnEnd,
  } as const;
}
