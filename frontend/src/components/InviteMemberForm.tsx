import { useState } from 'react';
import { Box, Button, MenuItem, Stack, TextField } from '@mui/material';
import { inviteMember } from '../api/boards';
import type { Role } from '../types';

export function InviteMemberForm({ boardId }: { boardId: string }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('writer');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      await inviteMember(boardId, email.trim(), role);
      setMsg('Invitation sent');
      setEmail('');
    } catch (e: any) {
      setMsg(e?.error?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box component="form" onSubmit={submit} sx={{ p: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField size="small" label="Invite email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField select size="small" label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)} sx={{ width: 140 }}>
          <MenuItem value="writer">Writer</MenuItem>
          <MenuItem value="reader">Reader</MenuItem>
          <MenuItem value="admin">Admin</MenuItem>
        </TextField>
        <Button type="submit" variant="outlined" disabled={loading || !email.trim()}>Invite</Button>
        {msg && <span>{msg}</span>}
      </Stack>
    </Box>
  );
}

