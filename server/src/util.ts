import { randomUUID } from 'node:crypto';

export function uuid(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function errorEnvelope(code: string, message: string, requestId: string, details?: Record<string, unknown>) {
  return { error: { code, message, details: details ?? {}, requestId } };
}

