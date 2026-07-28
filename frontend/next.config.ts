import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Loader propio: normaliza URLs de subidas a same-origin en un solo lugar
    // (ver lib/imageLoader.ts). Con loader propio next/image sirve directo, sin
    // el optimizador integrado, por lo que remotePatterns queda informativo.
    loader: "custom",
    loaderFile: "./lib/imageLoader.ts",
    remotePatterns: [
      { protocol: "https", hostname: "img.freepik.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "via.placeholder.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/uploads/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "8000", pathname: "/uploads/**" },
      { protocol: "http", hostname: "10.0.0.47", port: "8000", pathname: "/uploads/**" },
    ],
  },
  // No dejar que Next elimine el "/" final antes de aplicar el rewrite.
  // El backend (FastAPI) tiene rutas de coleccion con slash (p.ej. /dashboard/)
  // y si Next quita el slash, FastAPI responde un redirect 307 hacia la URL
  // absoluta http:// del backend, que el navegador bloquea al ir la pagina por
  // https (mixed content) -> "Failed to fetch".
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/api/:path(.*)",
        destination: "http://10.0.0.47:8000/:path",
      },
      // Servir los archivos subidos (guardados en local por el backend) a traves
      // del mismo origen, para que funcionen desde el movil y bajo https sin
      // contenido mixto. El backend devuelve rutas relativas "/uploads/...".
      {
        source: "/uploads/:path(.*)",
        destination: "http://10.0.0.47:8000/uploads/:path",
      },
    ];
  },
  allowedDevOrigins: ["10.0.0.47"],
};

export default nextConfig;