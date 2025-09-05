import { v4 as uuidv4 } from './uuid';

export const API_BASE = '/v1';
export const TOKEN = 'demo-user';

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json; charset=utf-8',
    'X-Request-Id': `ts-${Math.random().toString(16).slice(2)}`,
    ...(init.headers as Record<string, string> || {}),
  };
  if ((init.method || 'GET').toUpperCase() === 'POST' && !headers['Idempotency-Key']) {
    headers['Idempotency-Key'] = uuidv4();
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw (body?.error || { message: 'Request failed' });
  return body as T;
}

