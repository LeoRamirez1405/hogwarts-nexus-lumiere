"use client";

import { List } from "react-window";
import { HTMLAttributes, useCallback, type Ref } from "react";

interface VirtualizedListProps<T> extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  items: T[];
  itemHeight: number | ((index: number) => number);
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  loadingMore?: boolean;
  loadMoreSentinel?: React.ReactNode;
  sentinelRef?: Ref<HTMLDivElement>;
  overscanCount?: number;
}

export function VirtualizedList<T>({
  items,
  itemHeight,
  renderItem,
  loadingMore = false,
  loadMoreSentinel,
  sentinelRef,
  overscanCount = 5,
  className = "",
  ...props
}: VirtualizedListProps<T>) {
  const itemHeightValue = typeof itemHeight === "function" ? itemHeight(0) : itemHeight;

  const RowComponent = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      if (index >= items.length) return null;
      return renderItem(items[index], index, style) as React.ReactElement;
    },
    [items, renderItem]
  );

  return (
    <div className={className} {...props}>
      <List
        rowCount={items.length}
        rowHeight={itemHeightValue}
        overscanCount={overscanCount}
        rowComponent={RowComponent}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rowProps={{} as any}
        defaultHeight={Math.min(items.length * itemHeightValue, 600)}
        style={{ width: "100%", height: Math.min(items.length * itemHeightValue, 600) }}
      />
      {loadingMore && loadMoreSentinel && (
        <div className="flex justify-center py-4">
          {loadMoreSentinel}
        </div>
      )}
      {sentinelRef && <div ref={sentinelRef} aria-hidden className="h-1 w-full" />}
    </div>
  );
}