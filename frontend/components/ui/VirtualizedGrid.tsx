"use client";

import { Grid, List } from "react-window";
import { HTMLAttributes, useCallback, type Ref } from "react";

interface VirtualizedGridProps<T> extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  items: T[];
  itemWidth: number;
  itemHeight: number;
  columns: number;
  gap?: number;
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  loadingMore?: boolean;
  loadMoreSentinel?: React.ReactNode;
  sentinelRef?: Ref<HTMLDivElement>;
  overscanCount?: number;
}

export function VirtualizedGrid<T>({
  items,
  itemWidth,
  itemHeight,
  columns,
  gap = 24,
  renderItem,
  loadingMore = false,
  loadMoreSentinel,
  sentinelRef,
  overscanCount = 1,
  className = "",
  ...props
}: VirtualizedGridProps<T>) {
  const rowCount = Math.ceil(items.length / columns);

  const CellComponent = useCallback(
    ({ columnIndex, rowIndex, style }: {
      columnIndex: number;
      rowIndex: number;
      style: React.CSSProperties;
    }) => {
      const index = rowIndex * columns + columnIndex;
      if (index >= items.length) return null;
      const cellStyle: React.CSSProperties = {
        ...style,
        padding: index % columns !== columns - 1 ? `0 ${gap}px 0 0` : "0",
        paddingBottom: rowCount > 1 && rowIndex !== rowCount - 1 ? `${gap}px` : "0",
      };
      return renderItem(items[index], index, cellStyle) as React.ReactElement;
    },
    [items, columns, gap, rowCount, renderItem]
  );

  const gridWidth = columns * itemWidth + (columns - 1) * gap;
  const gridHeight = rowCount * itemHeight + (rowCount - 1) * gap;

  return (
    <div className={className} {...props}>
      <Grid
        columnCount={columns}
        rowCount={rowCount}
        columnWidth={itemWidth + (columns > 1 ? gap : 0)}
        rowHeight={itemHeight + (rowCount > 1 ? gap : 0)}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cellProps={{} as any}
        cellComponent={CellComponent}
        defaultWidth={gridWidth}
        defaultHeight={gridHeight}
        overscanCount={overscanCount}
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