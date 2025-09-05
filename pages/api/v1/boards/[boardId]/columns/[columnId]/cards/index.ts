import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '../../../../../../../../lib/db';
import { requireAuth } from '../../../../../../../../lib/auth';
import { nowIso, sendJson, uuid, withIdempotency } from '../../../../../../../../lib/util';
import { midpoint } from '../../../../../../../../lib/lexo';

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
  const col = db.prepare('SELECT id FROM columns WHERE id = ? AND board_id = ?').get(columnId, boardId) as any;
  if (!col) return sendJson(res, 404, { error: { code: 'not_found', message: 'Column not found' } }, req);
  const payload = req.body || {};
  const title = (payload.title || '').toString().trim();
  const description = payload.description == null ? null : String(payload.description);
  if (title.length < 1 || title.length > 200) return sendJson(res, 422, { error: { code: 'validation_error', message: 'title must be 1..200', details: { title: 'required_non_empty' } } }, req);
  const beforeCardId = payload.beforeCardId as string | null | undefined;
  const afterCardId = payload.afterCardId as string | null | undefined;
  const before = beforeCardId ? (db.prepare('SELECT sort_key FROM cards WHERE id = ? AND column_id = ?').get(beforeCardId, columnId) as any)?.sort_key : null;
  const after = afterCardId ? (db.prepare('SELECT sort_key FROM cards WHERE id = ? AND column_id = ?').get(afterCardId, columnId) as any)?.sort_key : null;
  const sortKey = midpoint(after || null, before || null);
  const id = uuid();
  const now = nowIso();
  const insert = () => {
    db.prepare('INSERT INTO cards (id, board_id, column_id, title, description, sort_key, version, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, boardId, columnId, title, description, sortKey, 0, now, now);
    return { status: 201, body: { id, boardId, columnId, title, description, sortKey, createdAt: now, updatedAt: now, version: 0 } };
  };
  const { status, body } = await withIdempotency(req, res, async () => insert());
  return sendJson(res, status, body, req);
}
