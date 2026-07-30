"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="text-center">
        <span className="material-symbols-outlined text-primary text-6xl mb-4 block">
          auto_stories
        </span>
        <h1 className="font-display text-headline-lg text-primary">
          Nexus Lumière  
        </h1>
        <p className="text-on-surface-variant font-body text-body-md mt-2">
          Cargando...
        </p>
      </div>
    </div>
  );
}
