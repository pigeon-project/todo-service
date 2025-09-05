const ALPH = '0123456789abcdefghijklmnopqrstuvwxyz';
const MIN = 0;
const MAX = 35;
const A2I: Record<string, number> = Object.fromEntries(
  Array.from(ALPH).map((ch, i) => [ch, i])
);
const I2A: Record<number, string> = Object.fromEntries(
  Array.from(ALPH).map((ch, i) => [i, ch])
);

export function midpoint(left?: string | null, right?: string | null): string {
  const L = left ?? '';
  const R = right ?? '';
  let i = 0;
  const out: string[] = [];
  // Validate inputs if provided
  if (L && !/^[0-9a-z]+$/.test(L)) throw new Error('invalid_left_sort_key');
  if (R && !/^[0-9a-z]+$/.test(R)) throw new Error('invalid_right_sort_key');

  // Pseudocode mirrored from spec
  while (true) {
    const l = i < L.length ? A2I[L[i]] : MIN;
    const r = i < R.length ? A2I[R[i]] : MAX;
    if (l + 1 < r) {
      const mid = Math.floor((l + r) / 2);
      out.push(I2A[mid]);
      return out.join('');
    }
    out.push(I2A[l]);
    i += 1;
  }
}

