import { ApiError } from "./errors";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined"
    ? `${window.location.origin}/api`
    : "http://localhost:8000");

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

export async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const doFetch = (): Promise<Response> =>
    fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...((options.headers as Record<string, string>) || {}),
      },
    });

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
  formData.append(fieldName, file);

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