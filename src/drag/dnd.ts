// Minimal helpers to compute anchors based on index. UI uses native DnD.
export function computeAnchors<T extends { id: string }>(items: T[], targetIndex: number) {
  const before = items[targetIndex] ?? null;
  const after = targetIndex > 0 ? items[targetIndex - 1] : null;
  return { beforeId: before?.id ?? null, afterId: after?.id ?? null };
}

