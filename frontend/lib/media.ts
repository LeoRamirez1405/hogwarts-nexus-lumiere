// Aplica la transformacion on-the-fly de Cloudinary (f_auto + q_auto + ancho
// maximo) a URLs ya subidas. El CDN genera y cachea la version optimizada
// (WebP/AVIF) sin re-subir ni tocar el original. Idempotente: si la URL ya
// tiene transformacion, se deja intacta.
const CLOUDINARY_TRANSFORM = "f_auto,q_auto,w_2000";

export function cloudinaryOptimized(url: string): string {
  if (
    !url.startsWith("https://res.cloudinary.com/") &&
    !url.startsWith("http://res.cloudinary.com/")
  ) {
    return url;
  }
  const marker = "/image/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const rest = url.slice(idx + marker.length);
  if (!rest || rest.startsWith("f_auto")) return url;
  return `${url.slice(0, idx + marker.length)}${CLOUDINARY_TRANSFORM}/${rest}`;
}

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
// pagina. Las URLs externas (Cloudinary, Unsplash, etc.) se dejan intactas, por
// lo que en produccion (que usa Cloudinary) el comportamiento no cambia.
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

  // Cloudinary: servir la version optimizada al vuelo.
  return cloudinaryOptimized(url);
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
