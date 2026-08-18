import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

// Content Security Policy for nex.config.ts. 'unsafe-inline' en script-src es
// necesario porque Next.js inyecta scripts inline; sigue bloqueando scripts
// externos no confiables, inyeccion de objetos, exfiltracion via connect-src
// y clickjacking.
const isDev = process.env.NODE_ENV === "development";
const _appVersion = process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0"; // Used for Capacitor app versioning

// Size budget thresholds (KiB, gzipped). If a chunk exceeds its limit the
// build will emit a warning (non-fatal) so we catch regressions early.
const SIZE_BUDGET_KIB = {
  "first-load-js": 200,
  "first-load-css": 50,
};

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://www.gstatic.com${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' blob: data: https://res.cloudinary.com https://img.freepik.com https://images.unsplash.com https://picsum.photos https://fastly.picsum.photos https://via.placeholder.com http://localhost:8000 http://127.0.0.1:8000 http://10.0.0.47:8000 https://nexus-backend-kkq8.onrender.com;
  font-src 'self' https://fonts.gstatic.com;
  media-src 'self' blob: data: https://res.cloudinary.com http://localhost:8000 http://127.0.0.1:8000 http://10.0.0.47:8000 https://nexus-backend-kkq8.onrender.com;
  connect-src 'self' https://www.gstatic.com http://localhost:8000 http://127.0.0.1:8000 http://10.0.0.47:8000 https://nexus-backend-kkq8.onrender.com ${isDev ? "ws: wss:" : "wss://nexus-backend-kkq8.onrender.com"};
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  ${isDev ? "" : "upgrade-insecure-requests;"}
`;

const nextConfig: NextConfig = {
  // Bundle analyzer reports (run with ANALYZE=true env var)
  // @see https://www.npmjs.com/package/@next/bundle-analyzer
  ...(process.env.ANALYZE === "true"
    ? {
        webpack: (config) => {
          config.performance = {
            ...config.performance,
            maxAssetSize: SIZE_BUDGET_KIB["first-load-js"] * 1024,
            maxEntrypointSize: SIZE_BUDGET_KIB["first-load-js"] * 1024,
            // Only warn — don't fail the build — so we can monitor over time
            hints: "warning",
          };
          return config;
        },
      }
    : {}),

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
      { protocol: "https", hostname: "fastly.picsum.photos" },
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
    const target = process.env.API_PROXY_TARGET || "http://localhost:8000";
    return [
      {
        source: "/api/:path(.*)",
        destination: `${target}/:path`,
      },
      {
        source: "/messages/:path(.*)",
        destination: `${target}/messages/:path`,
      },
      {
        source: "/uploads/:path(.*)",
        destination: `${target}/uploads/:path`,
      },
    ];
  },
  allowedDevOrigins: ["10.0.0.47", "10-0-0-47.nip.io"],
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
            value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()",
          },
        ],
      },
      // Headers especificos del Service Worker (recomendacion oficial PWA):
      // https://nextjs.org/docs/app/guides/progressive-web-apps
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' https://www.gstatic.com; script-src-elem 'self' https://www.gstatic.com; worker-src 'self' blob:",
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);