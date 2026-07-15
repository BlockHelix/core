'use client';

import { useEffect, useState } from 'react';

// Returns a timestamp that resets to now() whenever `dep` changes identity —
// e.g. SWR's `data` object after any successful revalidation (stream-triggered
// mutate, manual refresh, or focus revalidation all produce a fresh object).
// Callers render "Updated Xs ago" from it: near 0s while the stream pushes,
// growing if the connection stalls.
export function useUpdatedAt(dep: unknown): number {
  const [ts, setTs] = useState(() => Date.now());
  useEffect(() => {
    setTs(Date.now());
  }, [dep]);
  return ts;
}
