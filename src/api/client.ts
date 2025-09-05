import { v4 as uuidv4 } from 'uuid';

const BASE = '/v1';
const TOKEN = 'demo-placeholder-token';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface FetchOptions {
  method?: HttpMethod;
  body?: unknown;
  idempotency?: boolean;
  signal?: AbortSignal;
}

export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as any).randomUUID();
  }
  return uuidv4();
}

export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json; charset=utf-8',
    'Authorization': `Bearer ${TOKEN}`,
  };
  if (opts.method === 'POST' && opts.idempotency !== false) {
    headers['Idempotency-Key'] = generateIdempotencyKey();
  }

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const error = (data && data.error) ? data.error : { code: 'http_error', message: res.statusText };
    throw Object.assign(new Error(error.message), { status: res.status, code: error.code, details: error.details, requestId: error.requestId });
  }
  return data as T;
}

