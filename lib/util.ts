import { randomUUID } from 'node:crypto';
import { NextApiRequest, NextApiResponse } from 'next';

export function nowIso(): string {
  return new Date().toISOString();
}

export function uuid(): string {
  try {
    return randomUUID();
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

export function sendJson(res: NextApiResponse, status: number, body: any, req?: NextApiRequest) {
  if (req) {
    const reqId = (req.headers['x-request-id'] as string) || uuid();
    res.setHeader('X-Request-Id', reqId);
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).json(body);
}

export function parseLimitCursor(req: NextApiRequest): { limit: number; cursor: string | null } {
  const limitRaw = (req.query.limit as string) || '50';
  const limit = Math.min(Math.max(parseInt(limitRaw, 10) || 50, 1), 200);
  const cursor = (req.query.cursor as string) || null;
  return { limit, cursor };
}

export function encodeCursor(parts: any[]): string {
  return Buffer.from(JSON.stringify(parts)).toString('base64url');
}

export function decodeCursor(cursor: string | null): any[] | null {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
}

// Simple in-memory idempotency cache for demo purposes
type CacheEntry = { status: number; body: any; createdAt: number };
const idemCache = new Map<string, CacheEntry>();
const IDEM_TTL_MS = 24 * 60 * 60 * 1000;

export function withIdempotency(req: NextApiRequest, res: NextApiResponse, handler: () => Promise<{status:number,body:any}>) {
  const key = (req.headers['idempotency-key'] as string) || '';
  if (!key) return handler().then(({status, body}) => ({status, body}));
  const now = Date.now();
  const hit = idemCache.get(key);
  if (hit && now - hit.createdAt < IDEM_TTL_MS) {
    return Promise.resolve({ status: hit.status, body: hit.body });
  }
  return handler().then(({status, body}) => {
    idemCache.set(key, { status, body, createdAt: now });
    return { status, body };
  });
}

