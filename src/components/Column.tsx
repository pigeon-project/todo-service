import React, { useMemo, useRef, useState } from 'react';
import { Column, Card as CardType } from '../types';
import { Box, Button, Paper, TextField, Typography } from '@mui/material';
import CardItem from './Card';

export default function ColumnView(props: {
  column: Column;
  cards: CardType[];
  myRole: 'admin'|'writer'|'reader';
  onAddCard: (title: string, beforeId?: string | null, afterId?: string | null) => void;
  onMoveCard: (cardId: string, toIndex: number, toColumnId: string) => void;
}) {
  const { column, cards, myRole, onAddCard, onMoveCard } = props;
  const [newTitle, setNewTitle] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  function insertAnchors(targetIndex: number) {
    const before = cards[targetIndex] ?? null;
    const after = cards[targetIndex - 1] ?? null;
    return { beforeId: before?.id ?? null, afterId: after?.id ?? (cards[cards.length - 1]?.id ?? null) };
  }

  function moveUp(cardId: string) {
    const idx = cards.findIndex(c => c.id === cardId);
    if (idx <= 0) return;
    const anchors = insertAnchors(idx - 1);
    onMoveCard(cardId, idx - 1, column.id);
  }
  function moveDown(cardId: string) {
    const idx = cards.findIndex(c => c.id === cardId);
    if (idx < 0 || idx >= cards.length - 1) return;
    onMoveCard(cardId, idx + 1, column.id);
  }

  return (
    <Paper sx={{ p: 1, minWidth: 280, maxWidth: 320 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>{column.name}</Typography>
      <Box ref={containerRef}>
        {cards.map((card, idx) => (
          <CardItem key={card.id} card={card} index={idx} onMoveUp={() => moveUp(card.id)} onMoveDown={() => moveDown(card.id)} />
        ))}
      </Box>
      {myRole !== 'reader' && (
        <Box component="form" onSubmit={(e) => { e.preventDefault(); if (!newTitle.trim()) return; const anchors = insertAnchors(cards.length); onAddCard(newTitle.trim(), anchors.beforeId, anchors.afterId); setNewTitle(''); }} sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <TextField size="small" label="New card" value={newTitle} onChange={e => setNewTitle(e.target.value)} inputProps={{ maxLength: 200 }} />
          <Button type="submit" variant="contained">Add</Button>
        </Box>
      )}
    </Paper>
  );
}

