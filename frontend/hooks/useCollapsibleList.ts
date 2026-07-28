import { useState, useMemo } from "react";

interface CollapsibleListResult<T> {
  visibleItems: T[];
  expanded: boolean;
  hasMore: boolean;
  remaining: number;
  total: number;
  toggle: () => void;
}

export function useCollapsibleList<T>(
  items: T[],
  initialCount = 10,
): CollapsibleListResult<T> {
  const [expanded, setExpanded] = useState(false);

  const hasMore = items.length > initialCount;
  const visibleItems = useMemo(
    () => (expanded ? items : items.slice(0, initialCount)),
    [items, expanded, initialCount],
  );
  const remaining = Math.max(0, items.length - initialCount);

  return {
    visibleItems,
    expanded,
    hasMore,
    remaining,
    total: items.length,
    toggle: () => setExpanded((prev) => !prev),
  };
}
