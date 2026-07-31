"use client";

import { MaterialIcon } from "./MaterialIcon";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function range(start: number, end: number): number[] {
  const result: number[] = [];
  for (let i = start; i <= end; i++) result.push(i);
  return result;
}

function getVisiblePages(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return range(1, total);

  const pages: (number | "ellipsis")[] = [];
  if (current <= 4) {
    pages.push(...range(1, 5), "ellipsis", total);
  } else if (current >= total - 3) {
    pages.push(1, "ellipsis", ...range(total - 4, total));
  } else {
    pages.push(
      1,
      "ellipsis",
      ...range(current - 1, current + 1),
      "ellipsis",
      total
    );
  }
  return pages;
}

export default function Pagination({
  page,
  totalPages,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getVisiblePages(page, totalPages);

  const btnBase =
    "w-9 h-9 inline-flex items-center justify-center rounded-full text-label-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

  return (
    <nav
      role="navigation"
      aria-label="Paginación"
      className="flex items-center justify-center gap-1 pt-4"
    >
      <button
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Página anterior"
        className={`${btnBase} text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30 disabled:pointer-events-none`}
      >
        <MaterialIcon name="chevron_left" className="text-lg" />
      </button>

      {pages.map((p, i) =>
        p === "ellipsis" ? (
          <span
            key={`ellipsis-${i}`}
            className="w-9 h-9 inline-flex items-center justify-center text-label-sm text-outline-variant"
          >
            ...
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            aria-current={p === page ? "page" : undefined}
            aria-label={`Ir a página ${p}`}
            className={`${btnBase} ${
              p === page
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Página siguiente"
        className={`${btnBase} text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30 disabled:pointer-events-none`}
      >
        <MaterialIcon name="chevron_right" className="text-lg" />
      </button>
    </nav>
  );
}