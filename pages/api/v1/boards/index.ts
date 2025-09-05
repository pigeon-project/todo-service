import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '../../../../lib/db';
import { requireAuth } from '../../../../lib/auth';
import { decodeCursor, encodeCursor, nowIso, parseLimitCursor, sendJson, uuid, withIdempotency } from '../../../../lib/util';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') return listBoards(req, res);
  if (req.method === 'POST') return createBoard(req, res);
  return sendJson(res, 405, { error: { code: 'method_not_allowed', message: 'GET, POST only' } }, req);
}

async function listBoards(req: NextApiRequest, res: NextApiResponse) {
  const user = requireAuth(req, res);
  if (!user) return;
  const db = getDb();
  const { limit, cursor } = parseLimitCursor(req);
  let afterCreatedAt = '';
  let afterId = '';
  const parts = decodeCursor(cursor);
  if (parts && parts.length === 2) {
    afterCreatedAt = parts[0];
    afterId = parts[1];
  }
  const stmt = db.prepare(`
    SELECT b.id, b.name, b.description, b.owner, b.created_at, b.updated_at,
      (
        SELECT role FROM memberships m WHERE m.board_id = b.id AND m.user_id = ?
      ) AS myRole,
      (
        SELECT COUNT(*) FROM memberships m2 WHERE m2.board_id = b.id
      ) AS membersCount
    FROM boards b
    WHERE EXISTS (SELECT 1 FROM memberships m WHERE m.board_id = b.id AND m.user_id = ?)
      AND (b.created_at > ? OR (b.created_at = ? AND b.id > ?))
    ORDER BY b.created_at ASC, b.id ASC
    LIMIT ?
  `);
  const rows = stmt.all(user.sub, user.sub, afterCreatedAt, afterCreatedAt, afterId, limit + 1) as any[];
  let nextCursor: string | null = null;
  let items = rows as any[];
  if (rows.length > limit) {
    const last = rows[limit - 1];
    nextCursor = encodeCursor([last.created_at, last.id]);
    items = rows.slice(0, limit);
  }
  const boards = items.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    owner: r.owner,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    myRole: r.myRole || (r.owner === user.sub ? 'admin' : 'reader'),
    membersCount: Number(r.membersCount || 1)
  }));
  return sendJson(res, 200, { boards, nextCursor }, req);
}

async function createBoard(req: NextApiRequest, res: NextApiResponse) {
  const user = requireAuth(req, res);
  if (!user) return;
  const db = getDb();
  const payload = req.body || {};
  const name = (payload.name || '').toString().trim();
  const description = payload.description == null ? null : String(payload.description);
  if (name.length < 1 || name.length > 140) {
    return sendJson(res, 422, { error: { code: 'validation_error', message: 'name must be 1..140', details: { name: 'required_non_empty' } } }, req);
  }
  const id = uuid();
  const now = nowIso();
  const owner = user.sub;
  const insert = () => {
    const tx = db.transaction(() => {
      db.prepare('INSERT INTO boards (id, name, description, owner, created_at, updated_at) VALUES (?,?,?,?,?,?)')
        .run(id, name, description, owner, now, now);
      db.prepare('INSERT INTO memberships (board_id, user_id, role, status, invited_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
        .run(id, owner, 'admin', 'active', owner, now, now);
    });
    tx();
    const board = { id, name, description, owner, createdAt: now, updatedAt: now, myRole: 'admin', membersCount: 1 };
    return { status: 201, body: board };
  };
  const { status, body } = await withIdempotency(req, res, async () => insert());
  return sendJson(res, status, body, req);
}
