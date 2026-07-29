"use client";

import { MaterialIcon } from "./MaterialIcon";

/**
 * ZerinesWidget — NOT CURRENTLY UNUSED but ready for future use.
 * Mobile widget showing daily Zerines reward info (md:hidden).
 * To use: import and place in mobile layout (e.g., Dashboard mobile view).
 */
export default function ZerinesWidget() {
  return (
    <div className="md:hidden">
      <div className="glass-card magical-float rounded-2xl p-6 inner-glow-gold border border-secondary/10">
        <div className="flex items-center gap-3">
          <MaterialIcon
            name="diamond"
            className="text-3xl text-secondary"
            filled
          />
          <div>
            <p className="text-title-md font-display text-on-surface">
              Zerines del Día
            </p>
            <p className="text-label-sm text-on-surface-variant">
              Gana 5 Zerines por cada comentario en el foro
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}