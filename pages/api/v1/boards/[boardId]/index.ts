import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '../../../../../lib/db';
import { requireAuth } from '../../../../../lib/auth';
import { sendJson } from '../../../../../lib/util';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: { code: 'method_not_allowed', message: 'GET only' } }, req);
  }
  const user = requireAuth(req, res);
  if (!user) return;
  const db = getDb();
  const boardId = req.query.boardId as string;

  // Authorization: must be member
  const member = db.prepare('SELECT role FROM memberships WHERE board_id = ? AND user_id = ?').get(boardId, user.sub) as any;
  if (!member) {
    return sendJson(res, 403, { error: { code: 'forbidden', message: 'Not a member' } }, req);
  }
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId) as any;
  if (!board) return sendJson(res, 404, { error: { code: 'not_found', message: 'Board not found' } }, req);
  const role = board.owner === user.sub ? 'admin' : (member.role as string);
  const columns = db.prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY sort_key ASC, created_at ASC, id ASC').all(boardId) as any[];
  const cards = db.prepare('SELECT * FROM cards WHERE board_id = ? ORDER BY sort_key ASC, created_at ASC, id ASC').all(boardId) as any[];

  const body = {
    board: {
      id: board.id,
      name: board.name,
      description: board.description,
      owner: board.owner,
      createdAt: board.created_at,
      updatedAt: board.updated_at,
      myRole: role,
      membersCount: (db.prepare('SELECT COUNT(*) AS c FROM memberships WHERE board_id = ?').get(boardId) as any).c
    },
    columns: columns.map(c => ({
      id: c.id, boardId: c.board_id, name: c.name, sortKey: c.sort_key, createdAt: c.created_at, updatedAt: c.updated_at
    })),
    cards: cards.map(c => ({
      id: c.id, boardId: c.board_id, columnId: c.column_id, title: c.title, description: c.description ?? null, sortKey: c.sort_key, createdAt: c.created_at, updatedAt: c.updated_at, version: c.version
    }))
  };
  return sendJson(res, 200, body, req);
}

