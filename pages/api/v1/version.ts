import type { NextApiRequest, NextApiResponse } from 'next';
import { sendJson } from '../../../lib/util';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: { code: 'method_not_allowed', message: 'Only GET' } }, req);
  }
  return sendJson(res, 200, { version: '1.0.0' }, req);
}
