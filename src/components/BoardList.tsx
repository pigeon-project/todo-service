import { Box, Button, CircularProgress, List, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';
import { useBoardsList } from '../state/useBoard';
import NewBoardForm from './NewBoardForm';

interface Props {
  onOpenBoard: (boardId: string) => void;
}

export default function BoardList({ onOpenBoard }: Props) {
  const { boards, loading, error, refresh, addBoard } = useBoardsList();

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Boards</Typography>
      <NewBoardForm onCreate={async (name, description) => { await addBoard(name, description); }} />
      <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button onClick={() => refresh()} disabled={loading}>Refetch</Button>
        {loading && <CircularProgress size={20} />}
        {error && <Typography color="error">{error}</Typography>}
      </Box>
      <List>
        {boards.map(b => (
          <ListItem key={b.id} disablePadding>
            <ListItemButton onClick={() => onOpenBoard(b.id)}>
              <ListItemText primary={b.name} secondary={`Role: ${b.myRole}`} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

