import { Box, Button, Card as MUICard, CardContent, Typography } from '@mui/material';
import type { CardDTO } from '../types';

interface Props {
  card: CardDTO;
  index: number;
  readOnly?: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, cardId: string) => void;
  onDragOver?: (e: React.DragEvent, overIndex: number) => void;
  onDrop?: (e: React.DragEvent, dropIndex: number) => void;
}

export default function Card({ card, index, readOnly, onMoveUp, onMoveDown, draggable, onDragStart, onDragOver, onDrop }: Props) {
  return (
    <MUICard sx={{ mb: 1 }} draggable={draggable} onDragStart={e => onDragStart?.(e, card.id)} onDragOver={e => onDragOver?.(e, index)} onDrop={e => onDrop?.(e, index)}>
      <CardContent sx={{ py: 1.5 }}>
        <Typography variant="body1">{card.title}</Typography>
        {!readOnly && (
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button size="small" onClick={onMoveUp}>Up</Button>
            <Button size="small" onClick={onMoveDown}>Down</Button>
          </Box>
        )}
      </CardContent>
    </MUICard>
  );
}

