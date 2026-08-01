export interface PaginationParams {
  skip?: number;
  limit?: number;
  [key: string]: string | number | undefined | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
  has_more: boolean;
}

export function buildQuery(
  params: Record<string, string | number | undefined | null>
): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}