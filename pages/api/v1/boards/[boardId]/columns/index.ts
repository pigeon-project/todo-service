import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '../../../../../../lib/db';
import { requireAuth } from '../../../../../../lib/auth';
import { nowIso, sendJson, uuid, withIdempotency } from '../../../../../../lib/util';
import { midpoint } from '../../../../../../lib/lexo';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') return createColumn(req, res);
  return sendJson(res, 405, { error: { code: 'method_not_allowed', message: 'POST only' } }, req);
}

async function createColumn(req: NextApiRequest, res: NextApiResponse) {
  const user = requireAuth(req, res);
  if (!user) return;
  const db = getDb();
  const boardId = req.query.boardId as string;
  const member = db.prepare('SELECT role FROM memberships WHERE board_id = ? AND user_id = ?').get(boardId, user.sub) as any;
  if (!member) return sendJson(res, 403, { error: { code: 'forbidden', message: 'Not a member' } }, req);
  if (!['admin','writer'].includes(member.role)) return sendJson(res, 403, { error: { code: 'forbidden', message: 'Insufficient role' } }, req);
  const b = db.prepare('SELECT id FROM boards WHERE id = ?').get(boardId);
  if (!b) return sendJson(res, 404, { error: { code: 'not_found', message: 'Board not found' } }, req);
  const payload = req.body || {};
  const name = (payload.name || '').toString().trim();
  if (name.length < 1 || name.length > 80) return sendJson(res, 422, { error: { code: 'validation_error', message: 'name must be 1..80', details: { name: 'required_non_empty' } } }, req);

  const beforeColumnId = payload.beforeColumnId as string | null | undefined;
  const afterColumnId = payload.afterColumnId as string | null | undefined;
  const last = db.prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY sort_key DESC, created_at DESC, id DESC LIMIT 1').get(boardId) as any;
  const first = db.prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY sort_key ASC, created_at ASC, id ASC LIMIT 1').get(boardId) as any;
  const before = beforeColumnId ? (db.prepare('SELECT sort_key FROM columns WHERE id = ? AND board_id = ?').get(beforeColumnId, boardId) as any)?.sort_key : (first ? first.sort_key : null);
  const after = afterColumnId ? (db.prepare('SELECT sort_key FROM columns WHERE id = ? AND board_id = ?').get(afterColumnId, boardId) as any)?.sort_key : (last ? last.sort_key : null);

  let sortKey: string;
  try {
    if (!beforeColumnId && !afterColumnId) {
      // insert at end
      sortKey = midpoint(after || null, null);
    } else {
      sortKey = midpoint(after || null, before || null);
    }
  } catch (e) {
    sortKey = midpoint(after || null, null);
  }
  const id = uuid();
  const now = nowIso();
  const insert = () => {
    db.prepare('INSERT INTO columns (id, board_id, name, sort_key, created_at, updated_at) VALUES (?,?,?,?,?,?)')
      .run(id, boardId, name, sortKey, now, now);
    return { status: 201, body: { id, boardId, name, sortKey, createdAt: now, updatedAt: now } };
  };
  const { status, body } = await withIdempotency(req, res, async () => insert());
  return sendJson(res, status, body, req);
}
