import { mediaSrc } from "./media";

// Loader global de next/image. Se aplica a TODAS las <Image> de la app en un
// unico lugar, evitando tener que envolver src={...} archivo por archivo.
//
// Normaliza cualquier URL de archivo subido al backend a una ruta same-origin
// ("/api/uploads/...") para que cargue desde cualquier dispositivo (movil
// incluido) y bajo https sin contenido mixto. Las URLs externas (Cloudinary,
// Unsplash, etc.) y las locales de /public se devuelven sin cambios.
//
// Nota: con un loader propio, next/image sirve las imagenes directamente en vez
// de pasar por el optimizador integrado. Para esta app es aceptable: en
// produccion las subidas van a Cloudinary, que ya entrega URLs optimizadas.
export default function imageLoader({ src }: { src: string; width: number; quality?: number }): string {
  return mediaSrc(src) || src;
}
