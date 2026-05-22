"use client";

import { useCallback, useMemo, useState } from "react";

export const DEFAULT_INCREMENTAL_LIST_COUNT = 5;
export const DEFAULT_INCREMENTAL_LIST_STEP = 5;

export function useIncrementalList<T>(
  items: readonly T[],
  initialCount = DEFAULT_INCREMENTAL_LIST_COUNT,
  step = DEFAULT_INCREMENTAL_LIST_STEP,
) {
  const [requestedVisibleCount, setRequestedVisibleCount] = useState(initialCount);
  const resolvedVisibleCount = Math.min(Math.max(requestedVisibleCount, initialCount), items.length);
  const remainingCount = Math.max(items.length - resolvedVisibleCount, 0);
  const visibleItems = useMemo(
    () => items.slice(0, resolvedVisibleCount),
    [items, resolvedVisibleCount],
  );
  const revealMore = useCallback(() => {
    setRequestedVisibleCount((currentCount) => Math.min(Math.max(currentCount, initialCount) + step, items.length));
  }, [initialCount, items.length, step]);

  return {
    canRevealMore: remainingCount > 0,
    remainingCount,
    revealMore,
    visibleCount: resolvedVisibleCount,
    visibleItems,
  };
}
