"use client";

import { useEffect } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="text-center max-w-md">
        <MaterialIcon
          name="auto_fix_off"
          className="text-6xl text-error mb-4 block mx-auto"
        />
        <h1 className="font-display text-headline-lg text-on-surface mb-2">
          Algo salió muy mal
        </h1>
        <p className="text-body-md text-on-surface-variant mb-6">
          Se produjo un error inesperado. Puedes intentar recuperar la
          aplicacion o volver al inicio.
        </p>
        {error?.digest && (
          <p className="text-label-sm text-on-surface-variant/70 mb-6">
            Codigo de error: {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-2.5 rounded-full font-medium text-label-sm hover:opacity-90 transition-all active:scale-95"
          >
            <MaterialIcon name="refresh" className="text-base" />
            Reintentar
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-surface-container-high text-on-surface px-6 py-2.5 rounded-full font-medium text-label-sm hover:opacity-90 transition-all"
          >
            <MaterialIcon name="home" className="text-base" />
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}
