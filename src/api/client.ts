import { v4 as uuidv4 } from 'uuid';

const BASE = '/v1';

// Pre-generated demo token signed with default server secret and iss/aud.
// For real deployments, integrate proper OAuth2/JWT flow.
// Token payload: { sub: "demo-user", iss:"todo.service", aud:"todo.clients", iat: 0, exp: 4102444800 }
export const DEMO_JWT = typeof window !== 'undefined'
  ? (window.localStorage.getItem('demo.jwt') || generateDemoJwt())
  : generateDemoJwt();

function generateDemoJwt() {
  // This is a static token value that corresponds to dev secret 'dev-secret-please-change'
  // and iss/aud configured in lib/auth.ts. It expires in year 2100.
  const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJkZW1vLXVzZXIiLCJpc3MiOiJ0b2RvLnNlcnZpY2UiLCJhdWQiOiJ0b2RvLmNsaWVudHMiLCJpYXQiOjAsImV4cCI6NDEwMjQ0NDgwMH0.qUe1JxQW8V9v51Sxgoc2Gm2m3K56MKeOt-XfRQpD4mA';
  try { if (typeof window !== 'undefined') window.localStorage.setItem('demo.jwt', token); } catch {}
  return token;
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const headers: any = {
    'Content-Type': 'application/json; charset=utf-8',
    'Authorization': `Bearer ${DEMO_JWT}`,
    ...options.headers,
  };
  if (options.method && options.method.toUpperCase() === 'POST') {
    headers['Idempotency-Key'] = uuidv4();
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.error?.message || `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

