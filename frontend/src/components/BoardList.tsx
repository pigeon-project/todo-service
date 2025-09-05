import { useEffect, useState } from 'react';
import { Box, Card, CardActionArea, CardContent, Grid, Stack, Typography } from '@mui/material';
import { listBoards } from '../api/boards';
import type { BoardSummary } from '../types';
import { NewBoardForm } from './NewBoardForm';

export function BoardList({ onOpen }: { onOpen: (id: string) => void }) {
  const [boards, setBoards] = useState<BoardSummary[]>([]);

  async function load() {
    const res = await listBoards();
    setBoards(res.boards);
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h5">Boards</Typography>
      </Stack>
      <NewBoardForm onCreated={(b) => setBoards([b, ...boards])} />
      <Grid container spacing={2} sx={{ mt: 1 }}>
        {boards.map((b) => (
          <Grid item key={b.id} xs={12} md={4} lg={3}>
            <Card variant="outlined">
              <CardActionArea onClick={() => onOpen(b.id)}>
                <CardContent>
                  <Typography variant="h6">{b.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{b.description || '\u00A0'}</Typography>
                  <Typography variant="caption">Role: {b.myRole}</Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

