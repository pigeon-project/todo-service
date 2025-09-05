import { useState } from 'react';
import { Box, Button, Stack, TextField } from '@mui/material';

export function NewBoardForm({ onCreate }: { onCreate: (name: string, description?: string | null) => Promise<void> | void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 140) return;
    setSubmitting(true);
    await onCreate(trimmed, description ? description : null);
    setName('');
    setDescription('');
    setSubmitting(false);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ p: 1 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
        <TextField size="small" label="Board name" value={name} onChange={(e) => setName(e.target.value)} required inputProps={{ maxLength: 140 }} />
        <TextField size="small" label="Description" value={description} onChange={(e) => setDescription(e.target.value)} inputProps={{ maxLength: 2000 }} />
        <Button type="submit" variant="contained" disabled={submitting}>Create</Button>
      </Stack>
    </Box>
  );
}

