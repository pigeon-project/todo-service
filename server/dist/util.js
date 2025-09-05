import { randomUUID } from 'node:crypto';
export function uuid() {
    return randomUUID();
}
export function nowIso() {
    return new Date().toISOString();
}
export function errorEnvelope(code, message, requestId, details) {
    return { error: { code, message, details: details ?? {}, requestId } };
}
