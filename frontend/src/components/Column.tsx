import { useMemo, useState } from 'react';
import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import type { Card, Column } from '../types';
import { CardItem } from './Card';

export function ColumnView({
  column,
  cards,
  addCard,
  moveCard,
  moveLeft,
  moveRight
}: {
  column: Column;
  cards: Card[];
  addCard: (columnId: string, title: string) => void | Promise<void>;
  moveCard: (cardId: string, toColumnId: string, targetIndex: number) => void | Promise<void>;
  moveLeft: () => void;
  moveRight: () => void;
}) {
  const [title, setTitle] = useState('');
  const sorted = useMemo(() => [...(cards || [])].sort((a, b) => (a.sortKey < b.sortKey ? -1 : 1)), [cards]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await addCard(column.id, title.trim());
    setTitle('');
  }

  return (
    <Paper elevation={2} sx={{ p: 1, minWidth: 280, mr: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Typography variant="h6">{column.name}</Typography>
        <span>
          <Button size="small" onClick={moveLeft}>Left</Button>
          <Button size="small" onClick={moveRight}>Right</Button>
        </span>
      </Stack>
      <Box sx={{ mt: 1 }}>
        {sorted.map((c, idx) => (
          <CardItem key={c.id} card={c} onMoveUp={() => moveCard(c.id, column.id, Math.max(0, idx - 1))} onMoveDown={() => moveCard(c.id, column.id, Math.min(sorted.length - 1, idx + 1))} />
        ))}
      </Box>
      <Box component="form" onSubmit={submit} sx={{ mt: 1 }}>
        <Stack direction="row" spacing={1}>
          <TextField size="small" fullWidth placeholder="New card title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Button type="submit" variant="contained">Add</Button>
        </Stack>
      </Box>
    </Paper>
  );
}

