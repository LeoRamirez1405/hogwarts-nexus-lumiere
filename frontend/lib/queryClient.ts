"use client";

import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

// QueryClient used across the app. The persister is only initialised in the
// browser (the component check is at the Provider level).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 60s freshness: within it React Query serves memory/localStorage data
      // without refetching; beyond it, data refreshes in the background. The
      // persisted cache (24h) + SW stale-while-revalidate make repeat visits
      // paint instantly even when the backend is cold.
      staleTime: 60_000,
      gcTime: 15 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

export const queryPersister = typeof window !== "undefined"
  ? createSyncStoragePersister({
      key: "nexus-query-cache",
      storage: window.localStorage,
      throttleTime: 1000,
    })
  : null;
