import React, { useEffect, useState } from 'react';
import { listBoards } from '../api/boards';
import { Board } from '../types';
import { Box, Button, Card as MUICard, CardContent, Typography } from '@mui/material';

export default function BoardList(props: { onOpen: (id: string) => void }) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    setLoading(true);
    setError(null);
    try {
      const data = await listBoards(50, cursor);
      setBoards(prev => [...prev, ...data.boards]);
      setCursor(data.nextCursor);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadMore(); }, []);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1 }}>Boards</Typography>
      {error && <Typography color="error">{error}</Typography>}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {boards.map(b => (
          <MUICard key={b.id} sx={{ width: 260, cursor: 'pointer' }} onClick={() => props.onOpen(b.id)}>
            <CardContent>
              <Typography variant="h6">{b.name}</Typography>
              <Typography variant="body2" color="text.secondary">Role: {b.myRole}</Typography>
            </CardContent>
          </MUICard>
        ))}
      </Box>
      <Box sx={{ mt: 2 }}>
        {cursor && <Button variant="outlined" onClick={loadMore} disabled={loading}>{loading ? 'Loading...' : 'Load More'}</Button>}
      </Box>
    </Box>
  );
}

