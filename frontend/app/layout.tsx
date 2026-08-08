import type { Metadata } from "next";
import { EB_Garamond, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { PWAProvider } from "@/components/providers/PWAProvider";
import { ToastViewport } from "@/components/ui/ToastViewport";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import "./globals.css";

const ebGaramond = EB_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hogwarts Nexus Lumière  ",
  description: "Plataforma social mágica con economia de Zerines",
  icons: {
    icon: "/icons/icon-192-owl-outline.svg",
    shortcut: "/icons/icon-192-owl-outline.svg",
    apple: "/icons/icon-192-owl-outline.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      data-scroll-behavior="smooth"
      className={`${ebGaramond.variable} ${hankenGrotesk.variable} ${jetbrainsMono.variable} h-full`}
    >
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content"
        />
        <meta name="theme-color" content="#0e3b60" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,300,0,0;24,400,1,0&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col antialiased">
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-on-primary focus:font-medium"
    >
      Saltar al contenido principal
    </a>
        <QueryProvider>
          <PWAProvider>
            {children}
          </PWAProvider>
        </QueryProvider>
        <ToastViewport />
        <ConfirmDialog />
      </body>
    </html>
  );
}
