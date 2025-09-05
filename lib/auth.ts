import jwt from 'jsonwebtoken';
import { NextApiRequest, NextApiResponse } from 'next';

export interface AuthUser {
  sub: string;
  roles?: Record<string, 'admin'|'writer'|'reader'>;
}

// Demo secret and validation parameters
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-please-change';
const JWT_ISS = process.env.JWT_ISS || 'todo.service';
const JWT_AUD = process.env.JWT_AUD || 'todo.clients';

export function requireAuth(req: NextApiRequest, res: NextApiResponse): AuthUser | null {
  const hdr = req.headers['authorization'];
  if (!hdr || !hdr.toString().startsWith('Bearer ')) {
    res.status(401).json(errorEnvelope('unauthorized', 'Missing/invalid Authorization header', req));
    return null;
  }
  const token = hdr.toString().slice('Bearer '.length).trim();
  try {
    const payload = jwt.verify(token, JWT_SECRET, { audience: JWT_AUD, issuer: JWT_ISS }) as any;
    if (typeof payload.sub !== 'string') throw new Error('invalid_sub');
    return { sub: payload.sub };
  } catch (e: any) {
    res.status(401).json(errorEnvelope('unauthorized', 'Invalid token', req));
    return null;
  }
}

export function errorEnvelope(code: string, message: string, req: NextApiRequest, details?: any) {
  const requestId = (req.headers['x-request-id'] as string) || cryptoRandomId();
  resSetCorrelationHeaders(req, requestId);
  return { error: { code, message, details: details || {}, requestId } };
}

export function resSetCorrelationHeaders(req: NextApiRequest, requestId: string) {
  // Next.js will set headers via res.setHeader in handlers; we just ensure we echo back X-Request-Id
}

export function cryptoRandomId(): string {
  // Simple UUID-ish random id for request correlation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

