const ALPH = '0123456789abcdefghijklmnopqrstuvwxyz';
const A2I = new Map<string, number>(Array.from(ALPH).map((ch, i) => [ch, i]));
const I2A = new Map<number, string>(Array.from(ALPH).map((ch, i) => [i, ch]));
const MIN = 0;
const MAX = 35;

export function midpoint(left?: string | null, right?: string | null): string {
  const L = left ?? '';
  const R = right ?? '';
  let i = 0;
  const out: string[] = [];
  while (true) {
    const l = i < L.length ? (A2I.get(L[i]) ?? MIN) : MIN;
    const r = i < R.length ? (A2I.get(R[i]) ?? MAX) : MAX;
    if (l + 1 < r) {
      const mid = Math.floor((l + r) / 2);
      out.push(I2A.get(mid)!);
      return out.join('');
    }
    out.push(I2A.get(l)!);
    i += 1;
  }
}

