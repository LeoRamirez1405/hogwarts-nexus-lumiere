"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Auto-crecimiento del textarea estilo WhatsApp: el campo empieza en una línea,
 * crece verticalmente a medida que el texto salta de línea y, al llegar a
 * `maxHeightPx`, se detiene y activa el scroll interno.
 *
 * Devuelve un ref para asignar al <textarea>. Recalcula la altura cada vez que
 * cambia `value` (incluye cambios programáticos: insertar mención, limpiar tras
 * enviar), no solo al teclear.
 */
export function useAutoResizeTextarea(value: string, maxHeightPx = 128) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const resize = useCallback(
    (el: HTMLTextAreaElement | null) => {
      if (!el) return;
      // Colapsar a "auto" para medir la altura real del contenido...
      el.style.height = "auto";
      const next = Math.min(el.scrollHeight, maxHeightPx);
      el.style.height = `${next}px`;
      // ...y solo permitir scroll cuando se alcanza el tope.
      el.style.overflowY = el.scrollHeight > maxHeightPx ? "auto" : "hidden";
    },
    [maxHeightPx]
  );

  useLayoutEffect(() => {
    resize(ref.current);
  }, [value, resize]);

  return { ref, resize };
}
