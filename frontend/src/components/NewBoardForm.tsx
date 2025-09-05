import { useState } from 'react';
import { Box, Button, Stack, TextField } from '@mui/material';
import { createBoard } from '../api/boards';
import type { BoardSummary } from '../types';

export function NewBoardForm({ onCreated }: { onCreated: (b: BoardSummary) => void }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const b = await createBoard(name.trim(), desc.trim() || null);
      onCreated(b);
      setName('');
      setDesc('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box component="form" onSubmit={submit} sx={{ p: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField size="small" label="Board name" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField size="small" label="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <Button type="submit" variant="contained" disabled={loading || !name.trim()}>Create</Button>
      </Stack>
    </Box>
  );
}

