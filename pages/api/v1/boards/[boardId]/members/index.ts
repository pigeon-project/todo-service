import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '../../../../../../lib/db';
import { requireAuth } from '../../../../../../lib/auth';
import { nowIso, sendJson, uuid, withIdempotency } from '../../../../../../lib/util';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: { code: 'method_not_allowed', message: 'POST only' } }, req);
  const user = requireAuth(req, res);
  if (!user) return;
  const db = getDb();
  const boardId = req.query.boardId as string;
  const me = db.prepare('SELECT role FROM memberships WHERE board_id = ? AND user_id = ?').get(boardId, user.sub) as any;
  if (!me) return sendJson(res, 403, { error: { code: 'forbidden', message: 'Not a member' } }, req);
  if (me.role !== 'admin') return sendJson(res, 403, { error: { code: 'forbidden', message: 'Admin only' } }, req);
  const payload = req.body || {};
  const role = payload.role as 'admin'|'writer'|'reader';
  if (!['admin','writer','reader'].includes(role)) return sendJson(res, 422, { error: { code: 'validation_error', message: 'invalid role' } }, req);
  const now = nowIso();
  const email = payload.email as string | undefined;
  const userId = payload.userId as string | undefined;
  const run = () => {
    if (userId) {
      // direct membership by userId
      db.prepare('INSERT OR IGNORE INTO memberships (board_id, user_id, role, status, invited_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
        .run(boardId, userId, role, 'active', user.sub, now, now);
      const membership = { boardId, userId, role, status: 'active', invitedBy: user.sub, createdAt: now, updatedAt: now, user: { id: userId, displayName: userId, avatarUrl: null } };
      return { status: 201, body: { membership } };
    }
    if (email) {
      const invId = uuid();
      const token = uuid();
      db.prepare('INSERT INTO invitations (id, board_id, email, role, status, token, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(invId, boardId, email, role, 'pending', token, now, now);
      // pending membership placeholder
      db.prepare('INSERT OR IGNORE INTO memberships (board_id, user_id, role, status, invited_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
        .run(boardId, email, role, 'pending', user.sub, now, now);
      const membership = { boardId, userId: email, role, status: 'pending', invitedBy: user.sub, createdAt: now, updatedAt: now, user: { id: email, displayName: email, avatarUrl: null } };
      const invitation = { id: invId, boardId, email, role, status: 'pending', token };
      return { status: 201, body: { membership, invitation } };
    }
    return { status: 422, body: { error: { code: 'validation_error', message: 'email or userId required' } } };
  };
  const { status, body } = await withIdempotency(req, res, async () => run());
  return sendJson(res, status, body, req);
}
