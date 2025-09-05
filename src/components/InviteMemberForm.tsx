import React, { useState } from 'react';
import { Box, Button, MenuItem, TextField } from '@mui/material';
import { inviteMember } from '../api/boards';

export default function InviteMemberForm(props: { boardId: string }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin'|'writer'|'reader'>('writer');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await inviteMember(props.boardId, email.trim(), role);
      setMessage(`Invitation created. Token: ${res.invitation?.token || 'n/a'}`);
      setEmail('');
    } catch (e: any) {
      setError(e.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box component="form" onSubmit={onSubmit} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mt: 1 }}>
      <TextField label="Email" size="small" value={email} onChange={e => setEmail(e.target.value)} required />
      <TextField label="Role" size="small" select value={role} onChange={e => setRole(e.target.value as any)}>
        <MenuItem value="admin">admin</MenuItem>
        <MenuItem value="writer">writer</MenuItem>
        <MenuItem value="reader">reader</MenuItem>
      </TextField>
      <Button type="submit" variant="outlined" disabled={loading || !email.trim()}>{loading ? 'Sending...' : 'Invite'}</Button>
      {error && <span style={{ color: 'red' }}>{error}</span>}
      {message && <span style={{ color: 'green' }}>{message}</span>}
    </Box>
  );
}

