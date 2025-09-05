import React from 'react';
import { Card as CardType } from '../types';
import { Box, IconButton, Paper, Typography } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

export default function CardItem(props: { card: CardType; index: number; onMoveUp: () => void; onMoveDown: () => void; onMouseDown?: (e: React.MouseEvent) => void }) {
  const { card, onMoveUp, onMoveDown, onMouseDown } = props;
  return (
    <Paper sx={{ p: 1, mb: 1, cursor: 'grab' }} onMouseDown={onMouseDown}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="body1">{card.title}</Typography>
        <Box>
          <IconButton size="small" onClick={onMoveUp}><ArrowUpwardIcon fontSize="inherit" /></IconButton>
          <IconButton size="small" onClick={onMoveDown}><ArrowDownwardIcon fontSize="inherit" /></IconButton>
        </Box>
      </Box>
    </Paper>
  );
}

