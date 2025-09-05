import { useMemo, useState } from 'react';
import { Box, Button, Paper, TextField, Typography } from '@mui/material';
import type { CardDTO, ColumnDTO } from '../types';
import Card from './Card';

interface Props {
  column: ColumnDTO;
  cards: CardDTO[];
  readOnly?: boolean;
  onAddCard: (title: string) => void;
  onMoveCard: (cardId: string, targetIndex: number, toColumnId: string) => void;
  onMoveWithinColumn: (fromIndex: number, toIndex: number) => void;
  onDragStartColumn?: (e: React.DragEvent, columnId: string) => void;
  onDragOverColumn?: (e: React.DragEvent, overIndex: number) => void;
  onDropColumn?: (e: React.DragEvent, dropIndex: number) => void;
  columnIndex: number;
  onMoveColumnToIndex?: (toIndex: number) => void;
}

export default function Column({ column, cards, readOnly, onAddCard, onMoveCard, onMoveWithinColumn, onDragStartColumn, onDragOverColumn, onDropColumn, columnIndex, onMoveColumnToIndex }: Props) {
  const [title, setTitle] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onAddCard(t);
    setTitle('');
  };

  const onDragStartCard = (e: React.DragEvent, cardId: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'card', cardId, fromColumnId: column.id }));
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOverCard = (e: React.DragEvent, overIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const onDropCard = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    const payload = JSON.parse(raw);
    if (payload.type === 'card') {
      onMoveCard(payload.cardId, dropIndex, column.id);
    }
  };

  return (
    <Paper sx={{ width: 300, p: 1.5, mr: 2 }} draggable={!readOnly} onDragStart={e => onDragStartColumn?.(e, column.id)} onDragOver={e => onDragOverColumn?.(e, columnIndex)} onDrop={e => onDropColumn?.(e, columnIndex)}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="h6">{column.name}</Typography>
        {!readOnly && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" onClick={() => onMoveColumnToIndex?.(Math.max(0, columnIndex - 1))}>Left</Button>
            <Button size="small" onClick={() => onMoveColumnToIndex?.(columnIndex + 1)}>Right</Button>
          </Box>
        )}
      </Box>
      <Box>
        {cards.map((c, i) => (
          <Card key={c.id} card={c} index={i} readOnly={readOnly} onMoveUp={() => onMoveWithinColumn(i, Math.max(0, i-1))} onMoveDown={() => onMoveWithinColumn(i, Math.min(cards.length-1, i+1))} draggable={!readOnly} onDragStart={onDragStartCard} onDragOver={onDragOverCard} onDrop={onDropCard} />
        ))}
      </Box>
      {!readOnly && (
        <Box component="form" onSubmit={submit} sx={{ mt: 1, display: 'flex', gap: 1 }}>
          <TextField size="small" label="New card" value={title} onChange={e=>setTitle(e.target.value)} inputProps={{ maxLength: 200 }} />
          <Button type="submit" variant="contained">Add</Button>
        </Box>
      )}
    </Paper>
  );
}
