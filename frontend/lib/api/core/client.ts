import { ApiError } from "./errors";
import { compressImageFile } from "@/lib/image/compress";

// In the browser we ALWAYS go through the same-origin `/api` proxy (rewritten
// to the backend by next.config). This keeps the auth cookies first-party on
// the frontend domain — a direct cross-site call to the backend makes them
// third-party, which Brave, mobile Chrome and incognito block, silently
// breaking login. NEXT_PUBLIC_API_URL is only used for server-side rendering
// (no window, so no cookie concern).
const API_BASE =
  typeof window !== "undefined"
    ? `${window.location.origin}/api`
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function attemptRefresh(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    return res.ok;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return false;
  }
}

let refreshPromise: Promise<boolean> | null = null;

export const API_BASE_VALUE = API_BASE;

const AUTH_ENDPOINTS = new Set(["/auth/login", "/auth/register", "/auth/refresh"]);

// Methods safe to replay: re-sending them can't create duplicate side effects.
// POST is intentionally excluded — a network error may hide a request that DID
// reach the server, so replaying it could double-create.
const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]);
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [250, 750]; // delay before attempt 2 and 3

function isRetryableNetworkError(error: unknown): boolean {
  // fetch() rejects with a TypeError only on a transport-level failure (e.g. the
  // dev backend restarting under uvicorn --reload, or a momentary drop). An
  // aborted request rejects with an AbortError DOMException — never retry those.
  if (error instanceof DOMException && error.name === "AbortError") return false;
  return error instanceof TypeError;
}

// Wraps fetch with a small retry loop for transient network failures. Only
// idempotent methods are retried; HTTP error statuses are NOT touched here
// (fetch resolves for those) — they flow through to the caller as before.
async function fetchWithRetry(
  input: string,
  init: RequestInit,
  method: string
): Promise<Response> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      const canRetry =
        IDEMPOTENT_METHODS.has(method) &&
        isRetryableNetworkError(error) &&
        attempt < MAX_ATTEMPTS - 1;
      if (!canRetry) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_BACKOFF_MS[attempt] ?? 750)
      );
    }
  }
  // Unreachable: the loop either returns a Response or throws.
  throw new TypeError("Failed to fetch");
}

export async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const init: RequestInit = {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    },
  };
  const doFetch = (): Promise<Response> =>
    fetchWithRetry(`${API_BASE}${path}`, init, method);

  let res = await doFetch();

  if (res.status === 401 && typeof window !== "undefined" && !AUTH_ENDPOINTS.has(path)) {
    refreshPromise = refreshPromise ?? attemptRefresh().finally(() => {
      refreshPromise = null;
    });
    if (await refreshPromise) {
      res = await doFetch();
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    if (res.status === 401 && typeof window !== "undefined" && !AUTH_ENDPOINTS.has(path)) {
      window.location.href = "/login";
    }
    throw new ApiError(res.status, error.detail || "Request failed");
  }

  if (res.status === 204) return null as T;
  return res.json();
}

export async function uploadFile<T>(
  path: string,
  file: File,
  fieldName: string = "file"
): Promise<T> {
  const formData = new FormData();
  formData.append(fieldName, await compressImageFile(file));

  let res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {} as Record<string, string>,
    body: formData,
  });

  if (res.status === 401 && typeof window !== "undefined") {
    refreshPromise = refreshPromise ?? attemptRefresh().finally(() => {
      refreshPromise = null;
    });
    if (await refreshPromise) {
      res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        credentials: "include",
        headers: {} as Record<string, string>,
        body: formData,
      });
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new ApiError(res.status, error.detail || "Upload failed");
  }

  return res.json();
}