import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '../../../../../../../lib/db';
import { requireAuth } from '../../../../../../../lib/auth';
import { nowIso, sendJson, withIdempotency } from '../../../../../../../lib/util';
import { midpoint } from '../../../../../../../lib/lexo';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: { code: 'method_not_allowed', message: 'POST only' } }, req);
  const user = requireAuth(req, res);
  if (!user) return;
  const db = getDb();
  const boardId = req.query.boardId as string;
  const columnId = req.query.columnId as string;
  const member = db.prepare('SELECT role FROM memberships WHERE board_id = ? AND user_id = ?').get(boardId, user.sub) as any;
  if (!member) return sendJson(res, 403, { error: { code: 'forbidden', message: 'Not a member' } }, req);
  if (!['admin','writer'].includes(member.role)) return sendJson(res, 403, { error: { code: 'forbidden', message: 'Insufficient role' } }, req);
  const col = db.prepare('SELECT * FROM columns WHERE id = ? AND board_id = ?').get(columnId, boardId) as any;
  if (!col) return sendJson(res, 404, { error: { code: 'not_found', message: 'Column not found' } }, req);
  const payload = req.body || {};
  const beforeColumnId = payload.beforeColumnId as string | null | undefined;
  const afterColumnId = payload.afterColumnId as string | null | undefined;
  const before = beforeColumnId ? (db.prepare('SELECT sort_key FROM columns WHERE id = ? AND board_id = ?').get(beforeColumnId, boardId) as any)?.sort_key : null;
  const after = afterColumnId ? (db.prepare('SELECT sort_key FROM columns WHERE id = ? AND board_id = ?').get(afterColumnId, boardId) as any)?.sort_key : null;
  try {
    const newKey = midpoint(after || null, before || null);
    const now = nowIso();
    const exec = () => {
      db.prepare('UPDATE columns SET sort_key = ?, updated_at = ? WHERE id = ?').run(newKey, now, columnId);
      return { status: 200, body: { id: columnId, boardId, name: col.name, sortKey: newKey, createdAt: col.created_at, updatedAt: now } };
    };
    const { status, body } = await withIdempotency(req, res, async () => exec());
    return sendJson(res, status, body, req);
  } catch (e) {
    return sendJson(res, 422, { error: { code: 'validation_error', message: 'invalid anchors' } }, req);
  }
}
