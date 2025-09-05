import React, { useState } from 'react';
import { Box, Button, TextField } from '@mui/material';
import { createBoard } from '../api/boards';

export default function NewBoardForm(props: { onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const b = await createBoard(name.trim(), description.trim() || null);
      props.onCreated(b.id);
    } catch (e: any) {
      setError(e.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box component="form" onSubmit={onSubmit} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
      <TextField label="Board name" size="small" value={name} onChange={e => setName(e.target.value)} required inputProps={{ maxLength: 140 }} />
      <TextField label="Description" size="small" value={description} onChange={e => setDescription(e.target.value)} inputProps={{ maxLength: 2000 }} />
      <Button type="submit" variant="contained" disabled={loading || !name.trim()}>{loading ? 'Creating...' : 'Create'}</Button>
      {error && <span style={{ color: 'red' }}>{error}</span>}
    </Box>
  );
}

