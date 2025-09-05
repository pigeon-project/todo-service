import { useCallback, useEffect, useState } from 'react';
import type { Board, Column, Card } from '../types';
import { getBoard, createColumn, moveColumn, createCard, moveCard } from '../api/boards';

interface BoardState { board: Board | null; columns: Column[]; cards: Card[]; }

export function useBoard(boardId: string) {
  const [state, setState] = useState<BoardState>({ board: null, columns: [], cards: [] });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { const data = await getBoard(boardId); setState(data); }
    catch (e: any) { setError(e?.message ?? 'Failed to load'); }
    finally { setLoading(false); }
  }, [boardId]);

  useEffect(() => { void refetch(); }, [refetch]);

  const addColumn = useCallback(async (name: string) => {
    const last = state.columns[state.columns.length-1];
    const col = await createColumn(boardId, name, { beforeColumnId: null, afterColumnId: last ? last.id : null });
    setState(s => ({ ...s, columns: [...s.columns, col] }));
  }, [boardId, state.columns]);

  const reorderColumn = useCallback(async (columnId: string, before: string | null, after: string | null) => {
    await moveColumn(boardId, columnId, { beforeColumnId: before, afterColumnId: after });
  }, [boardId]);

  const addCard = useCallback(async (columnId: string, title: string) => {
    const cards = state.cards.filter(c => c.columnId === columnId);
    const last = cards[cards.length-1];
    const card = await createCard(boardId, columnId, title, { beforeCardId: null, afterCardId: last ? last.id : null });
    setState(s => ({ ...s, cards: [...s.cards, card] }));
  }, [boardId, state.cards]);

  const moveCardTo = useCallback(async (cardId: string, toColumnId: string, before: string | null, after: string | null, expectedVersion: number) => {
    await moveCard(boardId, cardId, toColumnId, { beforeCardId: before, afterCardId: after }, expectedVersion);
  }, [boardId]);

  return { state, loading, error, refetch, addColumn, reorderColumn, addCard, moveCardTo };
}

