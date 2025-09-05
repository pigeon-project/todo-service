const BASE_URL = '/v1';

function getToken(): string {
  // Placeholder token per SPEC; in real use, integrate OAuth2/JWT.
  return 'demo-placeholder-token';
}

function maybeUUID(): string {
  const g = (n = 16) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  // Simple fallback UUIDv4-ish if crypto.randomUUID not available
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      // @ts-ignore
      return crypto.randomUUID();
    }
  } catch {}
  return (
    g(8) + '-' + g(4) + '-4' + g(3) + '-' + ((8 + Math.random() * 4) | 0).toString(16) + g(3) + '-' + g(12)
  );
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { idempotent?: boolean } = {}
): Promise<T> {
  const url = path.startsWith('http') ? path : BASE_URL + path;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    Authorization: `Bearer ${getToken()}`,
    'X-Request-Id': maybeUUID(),
    ...(options.headers as Record<string, string> | undefined),
  };
  if ((options.method || 'GET').toUpperCase() === 'POST') {
    headers['Idempotency-Key'] = maybeUUID();
  }
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const err: any = new Error(body?.error?.message || res.statusText);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body as T;
}

export function makePost<TReq, TResp>(path: string, body: TReq): Promise<TResp> {
  return apiFetch<TResp>(path, { method: 'POST', body: JSON.stringify(body) });
}

export function makeGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'GET' });
}

