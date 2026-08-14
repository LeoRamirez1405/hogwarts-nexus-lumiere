"use client";

import dynamic from "next/dynamic";

const AdminAlbumsConsolidatedPage = dynamic(
  () => import("./ConsolidatedAdminPage").then((mod) => mod.default),
  {
    loading: () => (
      <div className="mx-auto w-full max-w-4xl space-y-4 pb-24">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-surface-container-high rounded w-3/4" />
          <div className="h-4 bg-surface-container-high rounded w-1/2" />
          <div className="h-64 bg-surface-container-high rounded" />
        </div>
      </div>
    ),
    ssr: false,
  }
);

export default function AdminAlbumsPage() {
  return <AdminAlbumsConsolidatedPage />;
}