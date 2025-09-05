import { v4 as uuidv4 } from './uuidv4';

const BASE = '/v1';
const TOKEN = 'dev'; // placeholder token

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
  if (!res.ok) throw await res.json();
  return res.json();
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json; charset=utf-8',
      'Idempotency-Key': uuidv4()
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw await res.json();
  return res.json();
}

