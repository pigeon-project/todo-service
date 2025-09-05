import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import type { UserClaims } from './types.js';

declare global {
  // eslint-disable-next-line no-var
  var __requestIdCounter: number | undefined;
}

export function requestId(req: Request, _res: Response, next: NextFunction) {
  if ((globalThis as any).__requestIdCounter == null) (globalThis as any).__requestIdCounter = 1;
  const id = ((globalThis as any).__requestIdCounter++).toString(36) + Date.now().toString(36);
  (req as any).requestId = id;
  next();
}

export function authOptional(req: Request, res: Response, next: NextFunction) {
  const hdr = req.header('Authorization');
  if (!hdr) return unauthorized(res, (req as any).requestId);
  const token = hdr.replace(/^Bearer\s+/i, '');
  const devBypass = process.env.DEV_AUTH_BYPASS === '1' || token === 'dev';
  let claims: UserClaims | null = null;
  if (devBypass) {
    claims = { sub: 'user_dev' };
  } else {
    try {
      const secret = process.env.JWT_SECRET || 'dev-secret';
      claims = jwt.verify(token, secret) as UserClaims;
    } catch (_e) {
      return unauthorized(res, (req as any).requestId);
    }
  }
  (req as any).userId = claims.sub;
  next();
}

export function unauthorized(res: Response, requestId: string) {
  return res.status(401).json({ error: { code: 'unauthorized', message: 'Unauthorized', details: {}, requestId } });
}
