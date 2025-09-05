import { useEffect, useState } from 'react';
import { Box, CircularProgress, List, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';
import type { BoardSummary } from '../types';
import { createBoard, listBoards } from '../api/boards';
import { NewBoardForm } from './NewBoardForm';

export function BoardList({ onOpen }: { onOpen: (boardId: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boards, setBoards] = useState<BoardSummary[]>([]);

  const fetchBoards = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listBoards(50);
      setBoards(res.boards);
    } catch (e: any) {
      setError(e?.message || 'Failed to load boards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBoards();
  }, []);

  const onCreate = async (name: string, description?: string | null) => {
    const b = await createBoard(name, description);
    setBoards([b, ...boards]);
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>Boards</Typography>
      <NewBoardForm onCreate={onCreate} />
      {loading && <CircularProgress size={20} />}
      {error && <Typography color="error">{error}</Typography>}
      <List>
        {boards.map((b) => (
          <ListItem key={b.id} disablePadding>
            <ListItemButton onClick={() => onOpen(b.id)}>
              <ListItemText primary={b.name} secondary={`${b.membersCount} members · role: ${b.myRole}`} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );
}
