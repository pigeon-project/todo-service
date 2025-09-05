import React, { useMemo, useState } from 'react';
import { Box, Button, Paper, TextField, Typography } from '@mui/material';
import { useBoard } from '../state/useBoard';
import ColumnView from './Column';
import InviteMemberForm from './InviteMemberForm';

export default function BoardView(props: { boardId: string; onBack: () => void }) {
  const { boardId, onBack } = props;
  const { board, columns, byColumn, addColumn, moveColumn, addCard, moveCard, refetch, loading, error } = useBoard(boardId);
  const [newColumnName, setNewColumnName] = useState('');

  const canWrite = board?.myRole === 'admin' || board?.myRole === 'writer';
  const canAdmin = board?.myRole === 'admin';

  function insertColumnAnchors(targetIndex: number) {
    const sorted = [...columns].sort((a,b)=> a.sortKey.localeCompare(b.sortKey));
    const before = sorted[targetIndex] ?? null;
    const after = sorted[targetIndex - 1] ?? null;
    return { beforeId: before?.id ?? null, afterId: after?.id ?? (sorted[sorted.length - 1]?.id ?? null) };
  }

  async function addColumnSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newColumnName.trim()) return;
    const anchors = insertColumnAnchors(columns.length);
    await addColumn(newColumnName.trim(), anchors.beforeId, anchors.afterId);
    setNewColumnName('');
  }

  async function onMoveCard(cardId: string, toIndex: number, toColumnId: string) {
    const list = byColumn.get(toColumnId) || [];
    const before = list[toIndex]?.id ?? null;
    const after = list[toIndex - 1]?.id ?? (list[list.length - 1]?.id ?? null);
    await moveCard(cardId, toColumnId, before, after);
  }

  return (
    <Box>
      <Button onClick={onBack}>← Back</Button>
      {loading && <Typography>Loading...</Typography>}
      {error && <Typography color="error">{error}</Typography>}
      {board && (
        <>
          <Typography variant="h5" sx={{ mb: 2 }}>{board.name}</Typography>
          <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2 }}>
            {columns.sort((a,b)=> a.sortKey.localeCompare(b.sortKey)).map(col => (
              <ColumnView key={col.id}
                column={col}
                myRole={board.myRole}
                cards={(byColumn.get(col.id) || [])}
                onAddCard={(title, beforeId, afterId) => addCard(col.id, title, beforeId, afterId)}
                onMoveCard={onMoveCard}
              />
            ))}
          </Box>
          {canWrite && (
            <Paper sx={{ p: 1, mb: 2 }}>
              <Box component="form" onSubmit={addColumnSubmit} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField size="small" label="New column" value={newColumnName} onChange={e => setNewColumnName(e.target.value)} inputProps={{ maxLength: 80 }} />
                <Button type="submit" variant="contained">Add Column</Button>
                <Button onClick={refetch}>Refetch</Button>
              </Box>
            </Paper>
          )}
          {canAdmin && (
            <Paper sx={{ p: 1 }}>
              <Typography variant="subtitle1">Invite member</Typography>
              <InviteMemberForm boardId={board.id} />
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}

