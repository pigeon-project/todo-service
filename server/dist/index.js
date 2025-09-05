import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { authOptional, requestId } from './auth.js';
import { errorEnvelope, nowIso, uuid } from './util.js';
import { midpoint } from './lexorank.js';
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors());
app.use(requestId);
app.use(morgan('dev'));
function requireAuth(req, res, next) {
    return authOptional(req, res, next);
}
function roleFor(boardId, userId) {
    const owner = db.prepare('SELECT owner FROM boards WHERE id = ?').get(boardId);
    if (!owner)
        return null;
    if (owner.owner === userId)
        return 'admin';
    const mem = db
        .prepare('SELECT role, status FROM memberships WHERE board_id = ? AND user_id = ?')
        .get(boardId, userId);
    if (!mem)
        return null;
    if (mem.status !== 'active' && mem.role !== 'admin')
        return null; // only active non-admins count
    return mem.role;
}
function ensureRole(boardId, userId, allowed, reqId, res) {
    const r = roleFor(boardId, userId);
    if (!r) {
        res.status(403).json(errorEnvelope('forbidden', 'Access denied', reqId));
        return null;
    }
    const ok = allowed.includes(r) || (r === 'admin' && allowed.length > 0);
    if (!ok) {
        res.status(403).json(errorEnvelope('forbidden', 'Access denied', reqId));
        return null;
    }
    return r;
}
// Health & Version
app.get('/v1/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/v1/version', (_req, res) => res.json({ version: '1.0.0' }));
// Boards
app.post('/v1/boards', requireAuth, (req, res) => {
    const requestId = req.requestId;
    const userId = req.userId;
    const { name, description } = req.body || {};
    const trimmed = (name || '').trim();
    if (!trimmed || trimmed.length < 1 || trimmed.length > 140) {
        return res.status(422).json(errorEnvelope('validation_error', 'name must be 1..140 characters', requestId, { name: 'required_non_empty' }));
    }
    const id = uuid();
    const now = nowIso();
    const desc = description == null ? null : String(description);
    const tx = db.transaction(() => {
        db.prepare('INSERT INTO boards (id, name, description, owner, created_at, updated_at) VALUES (?,?,?,?,?,?)').run(id, trimmed, desc, userId, now, now);
        db.prepare('INSERT OR REPLACE INTO memberships (board_id, user_id, role, status, invited_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?)').run(id, userId, 'admin', 'active', userId, now, now);
    });
    tx();
    return res.status(201).json({ id, name: trimmed, description: desc, owner: userId, createdAt: now, updatedAt: now, myRole: 'admin', membersCount: 1 });
});
app.get('/v1/boards', requireAuth, (req, res) => {
    const requestId = req.requestId;
    const userId = req.userId;
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 200);
    // simple list of boards where user is owner or member
    const rows = db
        .prepare(`SELECT b.*, 
              (SELECT COUNT(*) FROM memberships m WHERE m.board_id = b.id AND m.status = 'active') AS members_count,
              CASE WHEN b.owner = ? THEN 'admin' 
                   WHEN EXISTS(SELECT 1 FROM memberships m2 WHERE m2.board_id=b.id AND m2.user_id=? AND m2.status='active' AND m2.role='admin') THEN 'admin' 
                   WHEN EXISTS(SELECT 1 FROM memberships m3 WHERE m3.board_id=b.id AND m3.user_id=? AND m3.status='active' AND m3.role='writer') THEN 'writer'
                   WHEN EXISTS(SELECT 1 FROM memberships m4 WHERE m4.board_id=b.id AND m4.user_id=? AND m4.status='active' AND m4.role='reader') THEN 'reader'
              END AS my_role
       FROM boards b
       WHERE b.owner = ? OR EXISTS(SELECT 1 FROM memberships m WHERE m.board_id = b.id AND m.user_id = ? AND m.status='active')
       ORDER BY b.created_at DESC
       LIMIT ?`)
        .all(userId, userId, userId, userId, userId, userId, limit);
    const boards = rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        owner: r.owner,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        myRole: (r.my_role ?? 'reader'),
        membersCount: Number(r.members_count || 1)
    }));
    return res.json({ boards, nextCursor: null });
});
app.get('/v1/boards/:boardId', requireAuth, (req, res) => {
    const requestId = req.requestId;
    const userId = req.userId;
    const boardId = req.params.boardId;
    const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId);
    if (!board)
        return res.status(404).json(errorEnvelope('not_found', 'Board not found', requestId));
    const role = roleFor(boardId, userId);
    if (!role)
        return res.status(403).json(errorEnvelope('forbidden', 'Access denied', requestId));
    const membersCount = db.prepare("SELECT COUNT(*) AS c FROM memberships WHERE board_id = ? AND status='active'").get(boardId);
    const columns = db.prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY sort_key ASC, created_at ASC, id ASC').all(boardId);
    const cards = db
        .prepare('SELECT * FROM cards WHERE board_id = ? ORDER BY column_id ASC, sort_key ASC, created_at ASC, id ASC')
        .all(boardId);
    return res.json({
        board: { id: board.id, name: board.name, description: board.description, owner: board.owner, createdAt: board.created_at, updatedAt: board.updated_at, myRole: role, membersCount: Number(membersCount?.c || 1) },
        columns: columns.map((c) => ({ id: c.id, boardId: c.board_id, name: c.name, sortKey: c.sort_key, createdAt: c.created_at, updatedAt: c.updated_at })),
        cards: cards.map((c) => ({ id: c.id, boardId: c.board_id, columnId: c.column_id, title: c.title, description: c.description, sortKey: c.sort_key, createdAt: c.created_at, updatedAt: c.updated_at, version: c.version }))
    });
});
// Columns
app.post('/v1/boards/:boardId/columns', requireAuth, (req, res) => {
    const requestId = req.requestId;
    const userId = req.userId;
    const { name, beforeColumnId, afterColumnId } = req.body || {};
    const boardId = req.params.boardId;
    const role = ensureRole(boardId, userId, ['writer'], requestId, res);
    if (!role)
        return;
    const trimmed = (name || '').trim();
    if (!trimmed)
        return res.status(422).json(errorEnvelope('validation_error', 'name must not be empty', requestId, { name: 'required_non_empty' }));
    const cols = db.prepare('SELECT id, sort_key FROM columns WHERE board_id = ? ORDER BY sort_key ASC, id ASC').all(boardId);
    const byId = new Map(cols.map((c) => [c.id, c]));
    let left = null;
    let right = null;
    if (beforeColumnId) {
        const r = byId.get(beforeColumnId);
        if (!r)
            return res.status(422).json(errorEnvelope('validation_error', 'Invalid beforeColumnId', requestId));
        right = r.sort_key;
    }
    if (afterColumnId) {
        const l = byId.get(afterColumnId);
        if (!l)
            return res.status(422).json(errorEnvelope('validation_error', 'Invalid afterColumnId', requestId));
        left = l.sort_key;
    }
    if (!beforeColumnId && !afterColumnId && cols.length > 0) {
        left = cols[cols.length - 1].sort_key;
    }
    const sortKey = midpoint(left, right);
    const id = uuid();
    const now = nowIso();
    db.prepare('INSERT INTO columns (id, board_id, name, sort_key, created_at, updated_at) VALUES (?,?,?,?,?,?)').run(id, boardId, trimmed, sortKey, now, now);
    return res.status(201).json({ id, boardId, name: trimmed, sortKey, createdAt: now, updatedAt: now });
});
app.post('/v1/boards/:boardId/columns/:columnId:move', requireAuth, (req, res) => {
    const requestId = req.requestId;
    const userId = req.userId;
    const { beforeColumnId, afterColumnId } = req.body || {};
    const boardId = req.params.boardId;
    const columnId = req.params.columnId;
    const role = ensureRole(boardId, userId, ['writer'], requestId, res);
    if (!role)
        return;
    const cols = db.prepare('SELECT id, sort_key FROM columns WHERE board_id = ? ORDER BY sort_key ASC, id ASC').all(boardId);
    const byId = new Map(cols.map((c) => [c.id, c]));
    if (!byId.has(columnId))
        return res.status(404).json(errorEnvelope('not_found', 'Column not found', requestId));
    let left = null;
    let right = null;
    if (beforeColumnId) {
        const r = byId.get(beforeColumnId);
        if (!r)
            return res.status(422).json(errorEnvelope('validation_error', 'Invalid beforeColumnId', requestId));
        right = r.sort_key;
    }
    if (afterColumnId) {
        const l = byId.get(afterColumnId);
        if (!l)
            return res.status(422).json(errorEnvelope('validation_error', 'Invalid afterColumnId', requestId));
        left = l.sort_key;
    }
    if (!beforeColumnId && !afterColumnId && cols.length > 0) {
        left = cols[cols.length - 1].sort_key;
    }
    const sortKey = midpoint(left, right);
    db.prepare('UPDATE columns SET sort_key = ?, updated_at = ? WHERE id = ?').run(sortKey, nowIso(), columnId);
    const c = db.prepare('SELECT * FROM columns WHERE id = ?').get(columnId);
    return res.json({ id: c.id, boardId: c.board_id, name: c.name, sortKey: c.sort_key, createdAt: c.created_at, updatedAt: c.updated_at });
});
// Cards
app.post('/v1/boards/:boardId/columns/:columnId/cards', requireAuth, (req, res) => {
    const requestId = req.requestId;
    const userId = req.userId;
    const { title, description, beforeCardId, afterCardId } = req.body || {};
    const boardId = req.params.boardId;
    const columnId = req.params.columnId;
    const role = ensureRole(boardId, userId, ['writer'], requestId, res);
    if (!role)
        return;
    const trimmed = (title || '').trim();
    if (!trimmed)
        return res.status(422).json(errorEnvelope('validation_error', 'title must not be empty', requestId, { title: 'required_non_empty' }));
    const cards = db.prepare('SELECT id, sort_key FROM cards WHERE board_id = ? AND column_id = ? ORDER BY sort_key ASC, id ASC').all(boardId, columnId);
    const byId = new Map(cards.map((c) => [c.id, c]));
    let left = null;
    let right = null;
    if (beforeCardId) {
        const r = byId.get(beforeCardId);
        if (!r)
            return res.status(422).json(errorEnvelope('validation_error', 'Invalid beforeCardId', requestId));
        right = r.sort_key;
    }
    if (afterCardId) {
        const l = byId.get(afterCardId);
        if (!l)
            return res.status(422).json(errorEnvelope('validation_error', 'Invalid afterCardId', requestId));
        left = l.sort_key;
    }
    if (!beforeCardId && !afterCardId && cards.length > 0) {
        left = cards[cards.length - 1].sort_key;
    }
    const sortKey = midpoint(left, right);
    const id = uuid();
    const now = nowIso();
    const desc = description == null ? null : String(description);
    db.prepare('INSERT INTO cards (id, board_id, column_id, title, description, sort_key, version, created_at, updated_at) VALUES (?,?,?,?,?,?,0,?,?)').run(id, boardId, columnId, trimmed, desc, sortKey, now, now);
    return res.status(201).json({ id, boardId, columnId, title: trimmed, description: desc, sortKey, createdAt: now, updatedAt: now, version: 0 });
});
app.post('/v1/boards/:boardId/cards/:cardId:move', requireAuth, (req, res) => {
    const requestId = req.requestId;
    const userId = req.userId;
    const { toColumnId, beforeCardId, afterCardId, expectedVersion } = req.body || {};
    const boardId = req.params.boardId;
    const cardId = req.params.cardId;
    const role = ensureRole(boardId, userId, ['writer'], requestId, res);
    if (!role)
        return;
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId);
    if (!card)
        return res.status(404).json(errorEnvelope('not_found', 'Card not found', requestId));
    if (card.board_id !== boardId)
        return res.status(409).json(errorEnvelope('invalid_move', 'Card can be moved only within the same board.', requestId));
    if (expectedVersion != null && Number(expectedVersion) !== Number(card.version))
        return res.status(412).json(errorEnvelope('precondition_failed', 'Version mismatch', requestId));
    const targetColumnId = toColumnId || card.column_id;
    const cards = db
        .prepare('SELECT id, sort_key FROM cards WHERE board_id = ? AND column_id = ? ORDER BY sort_key ASC, id ASC')
        .all(boardId, targetColumnId);
    const byId = new Map(cards.map((c) => [c.id, c]));
    let left = null;
    let right = null;
    if (beforeCardId) {
        const r = byId.get(beforeCardId);
        if (!r)
            return res.status(422).json(errorEnvelope('validation_error', 'Invalid beforeCardId', requestId));
        right = r.sort_key;
    }
    if (afterCardId) {
        const l = byId.get(afterCardId);
        if (!l)
            return res.status(422).json(errorEnvelope('validation_error', 'Invalid afterCardId', requestId));
        left = l.sort_key;
    }
    if (!beforeCardId && !afterCardId && cards.length > 0) {
        left = cards[cards.length - 1].sort_key;
    }
    const sortKey = midpoint(left, right);
    const now = nowIso();
    const newVersion = Number(card.version) + 1;
    db.prepare('UPDATE cards SET column_id = ?, sort_key = ?, version = ?, updated_at = ? WHERE id = ?').run(targetColumnId, sortKey, newVersion, now, cardId);
    const c = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId);
    return res.json({ id: c.id, boardId: c.board_id, columnId: c.column_id, title: c.title, description: c.description, sortKey: c.sort_key, createdAt: c.created_at, updatedAt: c.updated_at, version: c.version });
});
// Members
app.post('/v1/boards/:boardId/members', requireAuth, (req, res) => {
    const requestId = req.requestId;
    const userId = req.userId;
    const boardId = req.params.boardId;
    const role = ensureRole(boardId, userId, ['admin'], requestId, res);
    if (!role || role !== 'admin')
        return;
    const { email, userId: newUserId, role: memberRole } = req.body || {};
    const r = memberRole || 'reader';
    const now = nowIso();
    const invId = uuid();
    const token = uuid().replace(/-/g, '');
    db.transaction(() => {
        db.prepare('INSERT OR REPLACE INTO memberships (board_id, user_id, role, status, invited_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?)').run(boardId, newUserId || (email || '').toLowerCase(), r, 'pending', userId, now, now);
        db.prepare('INSERT INTO invitations (id, board_id, email, role, status, token, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)').run(invId, boardId, email || null, r, 'pending', token, now, now);
    })();
    return res.status(201).json({
        membership: {
            boardId,
            userId: newUserId || (email || '').toLowerCase(),
            role: r,
            status: 'pending',
            invitedBy: userId,
            createdAt: now,
            updatedAt: now,
            user: { id: newUserId || (email || '').toLowerCase(), displayName: newUserId || email || 'pending', avatarUrl: null }
        },
        invitation: { id: invId, boardId, email: email || null, role: r, status: 'pending', token }
    });
});
// Serve frontend
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDir));
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/v1/'))
        return next();
    res.sendFile(path.join(frontendDir, 'index.html'));
});
const PORT = parseInt(process.env.PORT || '8000', 10);
app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
