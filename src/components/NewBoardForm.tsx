import { useState } from 'react';
import { Box, Button, TextField } from '@mui/material';

interface Props {
  onCreate: (name: string, description?: string | null) => Promise<void> | void;
}

export default function NewBoardForm({ onCreate }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      await onCreate(trimmed, description.trim() || null);
      setName('');
      setDescription('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={submit} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
      <TextField size="small" label="Board name" value={name} onChange={e=>setName(e.target.value)} required inputProps={{ maxLength: 140 }} />
      <TextField size="small" label="Description" value={description} onChange={e=>setDescription(e.target.value)} inputProps={{ maxLength: 2000 }} />
      <Button type="submit" variant="contained" disabled={loading}>Create</Button>
    </Box>
  );
}

