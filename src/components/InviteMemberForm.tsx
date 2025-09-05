import { useState } from 'react';
import { Box, Button, MenuItem, Select, SelectChangeEvent, TextField, Typography } from '@mui/material';

interface Props {
  onInvite: (email: string, role: 'admin' | 'writer' | 'reader') => Promise<void> | void;
}

export default function InviteMemberForm({ onInvite }: Props) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'writer' | 'reader'>('writer');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true); setStatus(null);
    try {
      await onInvite(email.trim(), role);
      setStatus('Invitation sent');
      setEmail('');
    } catch (err: any) {
      setStatus(err?.message || 'Failed to send invite');
    } finally { setLoading(false); }
  };

  return (
    <Box component="form" onSubmit={submit} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
      <TextField size="small" type="email" label="Invite email" value={email} onChange={e=>setEmail(e.target.value)} />
      <Select size="small" value={role} onChange={(e: SelectChangeEvent) => setRole(e.target.value as any)}>
        <MenuItem value="admin">admin</MenuItem>
        <MenuItem value="writer">writer</MenuItem>
        <MenuItem value="reader">reader</MenuItem>
      </Select>
      <Button type="submit" variant="outlined" disabled={loading}>Invite</Button>
      {status && <Typography variant="body2">{status}</Typography>}
    </Box>
  );
}

