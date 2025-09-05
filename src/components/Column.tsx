import { useMemo, useRef, useState } from 'react';
import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import type { Card as TCard, Column } from '../types';
import { Card } from './Card';

export function ColumnView({
  column,
  cards,
  canWrite,
  onAddCard,
  onReorderCard,
  onMoveCardLeft,
  onMoveCardRight,
}: {
  column: Column;
  cards: TCard[];
  canWrite: boolean;
  onAddCard: (title: string) => void;
  onReorderCard: (cardId: string, targetIndex: number) => void;
  onMoveCardLeft?: (cardId: string) => void;
  onMoveCardRight?: (cardId: string) => void;
}) {
  const [title, setTitle] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Simple drag handlers for cards within this column
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const handleMouseDown = (e: any) => {
    const el = (e.target as HTMLElement).closest('[data-card-id]') as HTMLElement | null;
    if (!el || !canWrite) return;
    const id = el.getAttribute('data-card-id');
    if (!id) return;
    setDraggingId(id);
    const onMove = (ev: MouseEvent) => {
      ev.preventDefault();
    };
    const onUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!containerRef.current) {
        setDraggingId(null);
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      const y = ev.clientY - rect.top;
      // Compute target index by comparing centers
      let targetIndex = cards.length; // default insert at end
      const cardEls = Array.from(containerRef.current!.querySelectorAll('[data-card-id]')) as HTMLElement[];
      for (let i = 0; i < cardEls.length; i++) {
        const r = cardEls[i]!.getBoundingClientRect();
        const center = r.top - rect.top + r.height / 2;
        if (y < center) {
          targetIndex = i;
          break;
        }
      }
      // Drop
      if (id) onReorderCard(id, targetIndex);
      setDraggingId(null);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const sortedCards = useMemo(() => cards, [cards]);

  return (
    <Paper variant="outlined" sx={{ p: 1, minWidth: 280, maxWidth: 320, mr: 2 }}>
      <Typography variant="subtitle1" sx={{ px: 1, py: 0.5 }}>{column.name}</Typography>
      <Box ref={containerRef} onMouseDown={handleMouseDown} sx={{ minHeight: 40 }}>
        {sortedCards.map((c, idx) => (
          <Card
            key={c.id}
            card={c}
            canWrite={canWrite}
            onMoveUp={() => onReorderCard(c.id, Math.max(0, idx - 1))}
            onMoveDown={() => onReorderCard(c.id, Math.min(sortedCards.length - 1, idx + 1))}
            onMoveLeft={onMoveCardLeft ? () => onMoveCardLeft(c.id) : undefined}
            onMoveRight={onMoveCardRight ? () => onMoveCardRight(c.id) : undefined}
          />
        ))}
      </Box>
      {canWrite && (
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <TextField
            size="small"
            placeholder="Add a card"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            inputProps={{ maxLength: 200 }}
          />
          <Button
            onClick={() => {
              const t = title.trim();
              if (!t) return;
              onAddCard(t);
              setTitle('');
            }}
            variant="contained"
          >
            Add
          </Button>
        </Stack>
      )}
    </Paper>
  );
}
