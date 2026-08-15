"use client";

import type { Product } from "./api/products";
import { productsApi } from "./api/products";

/**
 * Catálogo de elementos de Borgin & Burkes compartido en memoria (una sola
 * carga por sesión). Permite resolver un `!(Nombre)` a su imagen y descripción
 * para renderizar el badge del elemento usado en los mensajes.
 */

let catalogPromise: Promise<Product[]> | null = null;

export function getElementCatalog(): Promise<Product[]> {
  if (!catalogPromise) {
    catalogPromise = productsApi
      .getProducts("borgin", { skip: 0, limit: 100 })
      .then((page) => page.items)
      .catch(() => {
        catalogPromise = null;
        return [];
      });
  }
  return catalogPromise;
}

/** Busca un producto de Borgin por nombre (sin distinguir mayúsculas). */
export async function findElementByName(name: string): Promise<Product | null> {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;
  const items = await getElementCatalog();
  return (
    items.find((p) => p.name.toLowerCase() === normalized) ?? null
  );
}
