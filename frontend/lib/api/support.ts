import { attemptRefresh, API_BASE_VALUE } from "./core/client";

interface SupportResponse {
  ok: boolean;
}

let refreshPromise: Promise<boolean> | null = null;

const API_BASE = API_BASE_VALUE;

export const supportApi = {
  sendSupportReport: (
    type: string,
    description: string,
    screenshot?: File
  ) => {
    const formData = new FormData();
    formData.append("report_type", type);
    formData.append("description", description);
    if (screenshot) formData.append("screenshot", screenshot);

    const doFetch = () =>
      fetch(`${API_BASE}/support`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

    return (async () => {
      let res = await doFetch();
      if (res.status === 401 && typeof window !== "undefined") {
        refreshPromise =
          refreshPromise ??
          attemptRefresh().finally(() => {
            refreshPromise = null;
          });
        if (await refreshPromise) res = await doFetch();
      }
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 && typeof window !== "undefined") {
          window.location.href = "/login";
        }
        throw new Error(data.detail || "Error al enviar");
      }
      return data as SupportResponse;
    })();
  },
};