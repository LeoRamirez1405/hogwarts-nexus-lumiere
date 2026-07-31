import type { NextConfig } from "next";

// Content Security Policy (patron sin nonce recomendado por la documentacion de
// Next.js). 'unsafe-inline' en script-src es necesario porque Next.js inyecta
// scripts inline; sigue bloqueando scripts externos no confiables, inyeccion de
// objetos, exfiltracion via connect-src y clickjacking.
const isDev = process.env.NODE_ENV === "development";

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' blob: data: https://res.cloudinary.com https://img.freepik.com https://images.unsplash.com https://picsum.photos https://via.placeholder.com http://localhost:8000 http://127.0.0.1:8000 http://10.0.0.47:8000 https://nexus-backend-kkq8.onrender.com;
  font-src 'self' https://fonts.gstatic.com;
  media-src 'self' blob: data: https://res.cloudinary.com http://localhost:8000 http://127.0.0.1:8000 http://10.0.0.47:8000 https://nexus-backend-kkq8.onrender.com;
  connect-src 'self' http://localhost:8000 http://127.0.0.1:8000 http://10.0.0.47:8000 https://nexus-backend-kkq8.onrender.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  ${isDev ? "" : "upgrade-insecure-requests;"}
`;

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
      { protocol: "https", hostname: "nexus-backend-kkq8.onrender.com", pathname: "/uploads/**" },
    ],
  },
  // No dejar que Next elimine el "/" final antes de aplicar el rewrite.
  // El backend (FastAPI) tiene rutas de coleccion con slash (p.ej. /dashboard/)
  // y si Next quita el slash, FastAPI responde un redirect 307 hacia la URL
  // absoluta http:// del backend, que el navegador bloquea al ir la pagina por
  // https (mixed content) -> "Failed to fetch".
  skipTrailingSlashRedirect: true,
  async rewrites() {
    const target = process.env.API_PROXY_TARGET || "http://10.0.0.47:8000";
    return [
      {
        source: "/api/:path(.*)",
        destination: `${target}/:path`,
      },
      {
        source: "/uploads/:path(.*)",
        destination: `${target}/uploads/:path`,
      },
    ];
  },
  allowedDevOrigins: ["10.0.0.47"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader.replace(/\s{2,}/g, " ").trim(),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;