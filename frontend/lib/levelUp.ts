let lastRefreshAt = 0;

export function refreshUserLevelThrottled(intervalMs = 10_000) {
  const now = Date.now();
  if (now - lastRefreshAt < intervalMs) return;
  lastRefreshAt = now;
  void import("./api")
    .then(({ api }) => api.getMe())
    .then((me) =>
      import("./authStore").then(({ useAuthStore }) =>
        useAuthStore.getState().setUser(me)
      )
    )
    .catch(() => {});
}
