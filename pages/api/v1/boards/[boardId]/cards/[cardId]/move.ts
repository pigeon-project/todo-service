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
  const cardId = req.query.cardId as string;
  const member = db.prepare('SELECT role FROM memberships WHERE board_id = ? AND user_id = ?').get(boardId, user.sub) as any;
  if (!member) return sendJson(res, 403, { error: { code: 'forbidden', message: 'Not a member' } }, req);
  if (!['admin','writer'].includes(member.role)) return sendJson(res, 403, { error: { code: 'forbidden', message: 'Insufficient role' } }, req);
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId) as any;
  if (!card) return sendJson(res, 404, { error: { code: 'not_found', message: 'Card not found' } }, req);
  if (card.board_id !== boardId) return sendJson(res, 409, { error: { code: 'invalid_move', message: 'Card can be moved only within the same board.' } }, req);
  const payload = req.body || {};
  const toColumnId = (payload.toColumnId as string | undefined) || card.column_id;
  const expectedVersion = payload.expectedVersion as number | undefined;
  if (expectedVersion != null && expectedVersion !== card.version) {
    return sendJson(res, 412, { error: { code: 'precondition_failed', message: 'stale version' } }, req);
  }
  // anchors must be in toColumnId
  const beforeCardId = payload.beforeCardId as string | null | undefined;
  const afterCardId = payload.afterCardId as string | null | undefined;
  if (beforeCardId) {
    const b = db.prepare('SELECT column_id FROM cards WHERE id = ?').get(beforeCardId) as any;
    if (!b || b.column_id !== toColumnId) return sendJson(res, 409, { error: { code: 'invalid_move', message: 'anchors must be in target column' } }, req);
  }
  if (afterCardId) {
    const a = db.prepare('SELECT column_id FROM cards WHERE id = ?').get(afterCardId) as any;
    if (!a || a.column_id !== toColumnId) return sendJson(res, 409, { error: { code: 'invalid_move', message: 'anchors must be in target column' } }, req);
  }
  const before = beforeCardId ? (db.prepare('SELECT sort_key FROM cards WHERE id = ?').get(beforeCardId) as any)?.sort_key : null;
  const after = afterCardId ? (db.prepare('SELECT sort_key FROM cards WHERE id = ?').get(afterCardId) as any)?.sort_key : null;
  const newKey = midpoint(after || null, before || null);
  const now = nowIso();
  const exec = () => {
    const newVersion = (card.version as number) + 1;
    db.prepare('UPDATE cards SET column_id = ?, sort_key = ?, version = ?, updated_at = ? WHERE id = ?')
      .run(toColumnId, newKey, newVersion, now, cardId);
    return { status: 200, body: { id: cardId, boardId, columnId: toColumnId, title: card.title, description: card.description ?? null, sortKey: newKey, createdAt: card.created_at, updatedAt: now, version: newVersion } };
  };
  const { status, body } = await withIdempotency(req, res, async () => exec());
  return sendJson(res, status, body, req);
}
