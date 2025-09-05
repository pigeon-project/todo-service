import { Button, Card as MUICard, CardContent, Stack, Typography } from '@mui/material';
import type { Card as TCard } from '../types';

export function Card({ card, canWrite, onMoveUp, onMoveDown, onMoveLeft, onMoveRight }: { card: TCard; canWrite: boolean; onMoveUp: () => void; onMoveDown: () => void; onMoveLeft?: () => void; onMoveRight?: () => void }) {
  return (
    <MUICard variant="outlined" sx={{ mb: 1, cursor: canWrite ? 'grab' : 'default' }} data-card-id={card.id}>
      <CardContent sx={{ p: 1.5 }}>
        <Typography variant="body2">{card.title}</Typography>
        {canWrite && (
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button size="small" onClick={onMoveUp}>Up</Button>
            <Button size="small" onClick={onMoveDown}>Down</Button>
            {onMoveLeft && <Button size="small" onClick={onMoveLeft}>Left</Button>}
            {onMoveRight && <Button size="small" onClick={onMoveRight}>Right</Button>}
          </Stack>
        )}
      </CardContent>
    </MUICard>
  );
}
