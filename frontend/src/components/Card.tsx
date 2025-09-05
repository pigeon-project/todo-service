import { Button, Card as MUICard, CardContent, Stack, Typography } from '@mui/material';
import type { Card } from '../types';

export function CardItem({ card, onMoveUp, onMoveDown }: { card: Card; onMoveUp: () => void; onMoveDown: () => void }) {
  return (
    <MUICard variant="outlined" sx={{ mb: 1 }}>
      <CardContent sx={{ p: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Typography variant="body2">{card.title}</Typography>
          <span>
            <Button size="small" onClick={onMoveUp}>Up</Button>
            <Button size="small" onClick={onMoveDown}>Down</Button>
          </span>
        </Stack>
      </CardContent>
    </MUICard>
  );
}

