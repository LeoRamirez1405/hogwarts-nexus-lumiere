"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { queryClient, queryPersister } from "@/lib/queryClient";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // On SSR the persister is null (localStorage is unavailable), so we render
  // a plain QueryClientProvider until the client-side mount.
  const [persister] = useState<typeof queryPersister>(() => queryPersister);

  if (!persister) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24, // 24h
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
