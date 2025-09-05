import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useBoard } from '../state/useBoard';
import { ColumnView } from './Column';
import { InviteMemberForm } from './InviteMemberForm';

export function BoardView({ boardId, onBack }: { boardId: string; onBack: () => void }) {
  const { data, loading, error, cardsByColumn, addColumn, reorderColumn, addCard, moveCardWithin, moveCardToColumnEnd, refetch } = useBoard(boardId);

  if (loading || !data) {
    return (
      <Box>
        <Button variant="text" onClick={onBack}>Back</Button>
        {loading && <CircularProgress size={20} />}
        {error && <Typography color="error">{error}</Typography>}
      </Box>
    );
  }

  const canWrite = data.board.myRole === 'admin' || data.board.myRole === 'writer';
  const isAdmin = data.board.myRole === 'admin';

  const handleReorderColumn = (columnId: string, targetIndex: number) => {
    void reorderColumn(columnId, targetIndex);
  };

  const handleReorderCard = (columnId: string, cardId: string, targetIndex: number) => {
    void moveCardWithin(cardId, columnId, targetIndex);
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Button variant="text" onClick={onBack}>Back</Button>
        <Typography variant="h5">{data.board.name}</Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={() => refetch()}>Refetch</Button>
        {canWrite && <Button size="small" variant="outlined" onClick={() => void addColumn(prompt('Column name') || '')}>Add Column</Button>}
      </Stack>

      <Box sx={{ display: 'flex', overflowX: 'auto', pb: 2 }}>
        {data.columns.map((col, idx) => (
          <Box key={col.id} onMouseDown={(e) => {
            if (!canWrite) return;
            // Simple drag for columns: start drag when header is clicked
            const startX = e.clientX;
            const el = (e.currentTarget as HTMLElement);
            const onMove = (ev: MouseEvent) => { ev.preventDefault(); };
            const onUp = (ev: MouseEvent) => {
              document.removeEventListener('mousemove', onMove);
              document.removeEventListener('mouseup', onUp);
              // Compute target index comparing center X positions
              const container = el.parentElement!;
              const children = Array.from(container.children) as HTMLElement[];
              const rect = container.getBoundingClientRect();
              const x = ev.clientX - rect.left;
              let target = data.columns.length - 1;
              for (let i = 0; i < children.length; i++) {
                const r = children[i]!.getBoundingClientRect();
                const cx = r.left - rect.left + r.width / 2;
                if (x < cx) { target = i; break; }
              }
              void handleReorderColumn(col.id, target);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }}>
            <ColumnView
              column={col}
              cards={cardsByColumn.get(col.id) || []}
              canWrite={canWrite}
              onAddCard={(title) => void addCard(col.id, title)}
              onReorderCard={(cardId, targetIndex) => handleReorderCard(col.id, cardId, targetIndex)}
              onMoveCardLeft={idx > 0 ? (cardId) => void moveCardToColumnEnd(cardId, data.columns[idx - 1]!.id) : undefined}
              onMoveCardRight={idx < data.columns.length - 1 ? (cardId) => void moveCardToColumnEnd(cardId, data.columns[idx + 1]!.id) : undefined}
            />
          </Box>
        ))}
      </Box>

      <InviteMemberForm boardId={data.board.id} visible={isAdmin} />
    </Box>
  );
}
