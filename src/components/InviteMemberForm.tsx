import { useState } from 'react';
import { Box, Button, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import type { Role } from '../types';
import { inviteMember } from '../api/boards';

export function InviteMemberForm({ boardId, visible }: { boardId: string; visible: boolean }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('writer');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!visible) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await inviteMember(boardId, email.trim(), role);
      setMessage('Invitation sent.');
      setEmail('');
    } catch (e: any) {
      setMessage(e?.message || 'Failed to invite');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={onSubmit} sx={{ p: 1, mt: 2, borderTop: '1px solid #eee' }}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>Invite member</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
        <TextField size="small" type="email" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Select size="small" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <MenuItem value="admin">admin</MenuItem>
          <MenuItem value="writer">writer</MenuItem>
          <MenuItem value="reader">reader</MenuItem>
        </Select>
        <Button type="submit" variant="outlined" disabled={submitting}>Invite</Button>
      </Stack>
      {message && <Typography variant="body2" sx={{ mt: 1 }}>{message}</Typography>}
    </Box>
  );
}

