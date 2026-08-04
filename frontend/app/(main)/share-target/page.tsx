"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ShareTargetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const title = searchParams.get("title") || "";
    const text = searchParams.get("text") || "";
    const url = searchParams.get("url") || "";

    if (title || text || url) {
      const params = new URLSearchParams();
      if (title) params.set("title", title);
      if (text) params.set("text", text);
      if (url) params.set("url", url);
      
      router.push(`/profile/me?compose=1&${params.toString()}`);
    } else {
      router.push("/profile/me");
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="text-center">
        <div className="material-symbols-outlined text-primary text-6xl mb-4 animate-pulse">
          auto_stories
        </div>
        <p className="text-on-surface-variant font-body text-body-md">
          Procesando contenido compartido...
        </p>
      </div>
    </div>
  );
}