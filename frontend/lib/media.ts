// Normaliza la URL de un archivo subido al backend para que sea cargable desde
// cualquier cliente (PC, movil) y sin contenido mixto.
//
// Problema: el backend, al guardar en local, historicamente devolvia una URL
// absoluta tipo "http://localhost:8000/uploads/xyz.jpg". Eso rompe:
//   - En el movil "localhost" es el propio telefono, no el servidor.
//   - Es http dentro de una pagina https -> el navegador lo bloquea.
//
// Solucion: reenrutar toda URL de subida del backend a una ruta same-origin
// servida por el proxy ("/api/uploads/..."), que hereda host y https de la
// pagina. Las URLs externas (Cloudinary, Unsplash, etc.) se dejan intactas.
//
// Las imagenes se almacenan ya optimizadas (WebP de 1600px max, comprimidas
// en el ingreso por el frontend y el backend), por lo que se sirven TAL CUAL,
// sin transformaciones on-the-fly de Cloudinary: una sola compresion en el
// ingreso y cero re-encode al mostrar.
export function mediaSrc(url?: string | null): string {
  if (!url) return "";

  // Ya apunta al proxy.
  if (url.startsWith("/api/uploads/")) return url;

  // Relativa del backend -> proxy.
  if (url.startsWith("/uploads/")) return `/api${url}`;

  // Absoluta: solo reenrutar si es el backend local (localhost o IP privada).
  // Las URLs externas (Cloudinary, etc.) quedan intactas.
  const m = url.match(/^https?:\/\/([^/]+)(\/uploads\/.+)$/i);
  if (m) {
    const host = m[1].split(":")[0];
    const isLocalBackend =
      host === "localhost" ||
      host === "127.0.0.1" ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (isLocalBackend) return `/api${m[2]}`;
  }

  return url;
}

// Indica si la URL termina sirviendose por el proxy de subidas. Se usa para
// pasar `unoptimized` a next/image y evitar el optimizador sobre el proxy.
export function isProxiedUpload(url?: string | null): boolean {
  if (!url) return false;
  return (
    url.startsWith("/api/uploads/") ||
    url.startsWith("/uploads/") ||
    /^https?:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)[^/]*\/uploads\//i.test(
      url
    )
  );
}

// Indica si la URL corresponde a un archivo ALMACENADO tal cual (subidas del
// backend por proxy o Cloudinary, o fallbacks locales). Para esos, next/image
// debe usar `unoptimized` y servir el archivo sin re-encodearlo: ya viene
// optimizado de fabrica (WebP/JPEG comprimido en el ingreso).
export function isStoredUpload(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith("/fallbacks/")) return true;
  if (isProxiedUpload(url)) return true;
  return url.includes("res.cloudinary.com");
}
