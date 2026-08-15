"use client";

import { useEffect, useRef, useState } from "react";
import BottomSheet from "./BottomSheet";
import Avatar from "./Avatar";
import { FloatingPopover } from "@/app/(main)/messages/components/FloatingPopover";
import { findElementByName } from "@/lib/elementCatalog";
import type { Product } from "@/lib/api/products";
import { hapticLight } from "@/lib/haptics";
import { useIsDesktopMdUp } from "@/hooks/useMediaQuery";

interface ElementBadgeProps {
  name: string;
  isOwn?: boolean;
}

/**
 * Badge de elemento de Borgin & Burkes usado en un mensaje: círculo con la
 * imagen del artefacto (centrado) y el nombre debajo, en negrita y completo.
 * Mobile first: en móvil la descripción se abre en un bottom sheet; en
 * desktop en un popover anclado al badge (FloatingPopover, que recalcula
 * posición con scroll/resize y evita colisiones con el viewport).
 *
 * Si el nombre no corresponde a un elemento del catálogo (escrito a mano sin
 * poseerlo), se muestra el texto literal `!(Nombre)` sin badge.
 */
export default function ElementBadge({ name, isOwn = false }: ElementBadgeProps) {
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const isDesktop = useIsDesktopMdUp(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    findElementByName(name).then((p) => {
      if (!cancelled) setProduct(p ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [name]);

  if (product === undefined) return null;
  if (product === null) return <span>!({name})</span>;

  const initial = name.charAt(0).toUpperCase() || "?";
  const ringClass = isOwn
    ? "ring-2 ring-white/40"
    : "ring-2 ring-secondary/30";

  const badgeButton = (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => {
        hapticLight();
        setOpen(true);
      }}
      className="group inline-flex flex-col items-center gap-1 align-middle px-1 py-0.5 rounded-xl hover:bg-secondary/10 transition-colors cursor-pointer"
      aria-label={`Elemento de Borgin & Burkes: ${name}`}
    >
      <span
        className={`w-10 h-10 rounded-full overflow-hidden shrink-0 ${ringClass} bg-secondary/15 group-hover:scale-105 transition-transform`}
      >
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="w-full h-full inline-flex items-center justify-center text-base font-bold text-secondary">
            {initial}
          </span>
        )}
      </span>
      <span
        className={`text-xs leading-tight font-bold text-center text-balance ${
          isOwn ? "text-white/90" : "text-secondary"
        }`}
      >
        {name}
      </span>
    </button>
  );

  const detailContent = (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar
          src={product.image_url}
          alt={name}
          size="md"
          initials={initial}
          className="shrink-0 ring-2 ring-secondary/30"
        />
        <div className="min-w-0">
          <p className="font-bold text-on-surface truncate">{name}</p>
          <p className="text-label-xs text-on-surface-variant">
            Elemento de Borgin &amp; Burkes
          </p>
        </div>
      </div>
      <p className="text-body-sm text-on-surface-variant leading-relaxed">
        {product.description || "Artefacto de Borgin & Burkes."}
      </p>
      {typeof product.price === "number" && (
        <p className="text-label-sm text-secondary font-semibold">
          {product.price} Zerines
        </p>
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <>
        {badgeButton}
        <FloatingPopover
          anchorRef={buttonRef}
          open={open}
          onRequestClose={setOpen}
          placement="top"
          align="center"
          gap={8}
          maxWidth={320}
          className="p-4"
        >
          <div className="w-64">{detailContent}</div>
        </FloatingPopover>
      </>
    );
  }

  return (
    <>
      {badgeButton}
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={name}
        ariaLabel={`Detalles del elemento ${name}`}
      >
        {detailContent}
      </BottomSheet>
    </>
  );
}