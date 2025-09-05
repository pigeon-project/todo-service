import { useMemo, useState } from 'react';
import { Box, Button, CircularProgress, Paper, TextField, Typography } from '@mui/material';
import { useBoard } from '../state/useBoard';
import Column from './Column';
import InviteMemberForm from './InviteMemberForm';

interface Props {
  boardId: string;
  onBack: () => void;
}

export default function BoardView({ boardId, onBack }: Props) {
  const { board, columns, columnCards, loading, error, refresh, isReadOnly, addColumn, reorderColumn, addCard, moveCard, invite } = useBoard(boardId);
  const [newColName, setNewColName] = useState('');

  const onAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    await addColumn(newColName.trim());
    setNewColName('');
  };

  // Column DnD using native drag
  const onDragStartColumn = (e: React.DragEvent, columnId: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'column', columnId }));
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOverColumn = (e: React.DragEvent, _overIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const onDropColumn = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    const payload = JSON.parse(raw);
    if (payload.type === 'column') {
      const current = columns.findIndex(c => c.id === payload.columnId);
      if (current >= 0) {
        reorderColumn(payload.columnId, dropIndex);
      }
    }
  };

  const onMoveWithinColumn = (columnId: string, fromIndex: number, toIndex: number) => {
    const list = (columnCards.get(columnId) ?? []).slice();
    if (fromIndex === toIndex) return;
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    moveCard(moved.id, columnId, toIndex);
  };

  const columnsWithCards = useMemo(() => columns.map((col, idx) => ({ col, cards: columnCards.get(col.id) ?? [], idx })), [columns, columnCards]);

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Button onClick={onBack}>Back</Button>
        <Typography variant="h5">{board?.name ?? 'Board'}</Typography>
        <Button onClick={() => refresh()} disabled={loading}>Refetch</Button>
        {loading && <CircularProgress size={20} />}
        {error && <Typography color="error">{error}</Typography>}
      </Box>

      {!isReadOnly && (
        <Paper sx={{ p: 1.5, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Add Column</Typography>
          <Box component="form" onSubmit={onAddColumn} sx={{ display: 'flex', gap: 1 }}>
            <TextField size="small" label="Column name" value={newColName} onChange={e=>setNewColName(e.target.value)} inputProps={{ maxLength: 80 }} />
            <Button type="submit" variant="contained">Add</Button>
          </Box>
        </Paper>
      )}

      {board?.myRole === 'admin' && (
        <Paper sx={{ p: 1.5, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Invite Member</Typography>
          <InviteMemberForm onInvite={invite} />
        </Paper>
      )}

      <Box sx={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto' }}>
        {columnsWithCards.map(({ col, cards, idx }) => (
          <Column
            key={col.id}
            column={col}
            cards={cards}
            readOnly={isReadOnly}
            onAddCard={(t) => addCard(col.id, t)}
            onMoveCard={(cardId, targetIndex, toColumnId) => moveCard(cardId, toColumnId, targetIndex)}
            onMoveWithinColumn={(from, to) => onMoveWithinColumn(col.id, from, to)}
            onDragStartColumn={isReadOnly ? undefined : onDragStartColumn}
            onDragOverColumn={isReadOnly ? undefined : onDragOverColumn}
            onDropColumn={isReadOnly ? undefined : onDropColumn}
            columnIndex={idx}
            onMoveColumnToIndex={(toIdx) => reorderColumn(col.id, Math.max(0, Math.min(columns.length - 1, toIdx)))}
          />
        ))}
      </Box>
    </Box>
  );
}
