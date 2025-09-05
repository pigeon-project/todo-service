import { Box, Button, Stack, Typography } from '@mui/material';
import { useBoard } from '../state/useBoard';
import { ColumnView } from './Column';
import { InviteMemberForm } from './InviteMemberForm';

export function BoardView({ boardId, onBack }: { boardId: string; onBack: () => void }) {
  const { data, loading, error, refetch, addColumn, reorderColumn, addCard, moveCard, columns, cardsByColumn } = useBoard(boardId);
  if (loading || !data) return <div style={{ padding: 16 }}>Loading...</div>;
  if (error) return <div style={{ padding: 16 }}>Error: {error}</div>;
  const myRole = data.board.myRole;
  const canWrite = myRole === 'admin' || myRole === 'writer';

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
        <Stack direction="row" spacing={2} alignItems="center">
          <Button onClick={onBack}>Back</Button>
          <Typography variant="h5">{data.board.name}</Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button onClick={refetch}>Refetch</Button>
        </Stack>
      </Stack>

      {data.board.myRole === 'admin' && <InviteMemberForm boardId={data.board.id} />}

      <Stack direction="row" sx={{ mt: 2, overflowX: 'auto' }}>
        {columns.map((col, idx) => (
          <ColumnView
            key={col.id}
            column={col}
            cards={cardsByColumn[col.id] || []}
            addCard={canWrite ? addCard : () => {}}
            moveCard={canWrite ? moveCard : () => {}}
            moveLeft={() => canWrite && reorderColumn(col.id, Math.max(0, idx - 1))}
            moveRight={() => canWrite && reorderColumn(col.id, Math.min(columns.length - 1, idx + 1))}
          />
        ))}
        {canWrite && <Button variant="outlined" onClick={() => addColumn(prompt('Column name?') || 'New Column')}>+ Add Column</Button>}
      </Stack>
    </Box>
  );
}

