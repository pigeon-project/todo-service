// Lightweight helpers for computing anchors and positions
// Given an array length and a target index, returns {beforeId, afterId}
export function anchorsForInsert<T extends { id: string }>(items: T[], targetIndex: number): { beforeId: string | null; afterId: string | null } {
  const before = targetIndex - 1 >= 0 ? items[targetIndex - 1]?.id ?? null : null;
  const after = targetIndex < items.length ? items[targetIndex]?.id ?? null : null;
  return { beforeId: before, afterId: after };
}

