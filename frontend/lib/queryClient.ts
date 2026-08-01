"use client";

import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

// QueryClient used across the app. The persister is only initialised in the
// browser (the component check is at the Provider level).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
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
