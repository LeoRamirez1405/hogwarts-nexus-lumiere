import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hogwarts Nexus Lumière",
    short_name: "Nexus",
    description: "Plataforma social mágica con economía de Zerines",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0e3b60",
    theme_color: "#0e3b60",
    orientation: "portrait-primary",
    scope: "/",
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [
          {
            name: "files",
            accept: ["image/*", "video/*"],
          },
        ],
      },
    },
    shortcuts: [
      {
        name: "Tesoro",
        short_name: "Tesoro",
        description: "Ver tu saldo y transferir Zerines",
        url: "/treasury",
        icons: [{ src: "/icons/icon-192.svg", sizes: "192x192" }],
      },
      {
        name: "Mensajes",
        short_name: "Mensajes",
        description: "Abrir bandeja de entrada",
        url: "/messages",
        icons: [{ src: "/icons/icon-192.svg", sizes: "192x192" }],
      },
      {
        name: "Mercado",
        short_name: "Mercado",
        description: "Explorar Borgin & Burkes y Flourish & Blotts",
        url: "/marketplace/borgin-burkes",
        icons: [{ src: "/icons/icon-192.svg", sizes: "192x192" }],
      },
    ],
  };
}