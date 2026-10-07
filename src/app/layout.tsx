import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeColorSync } from "@/components/theme-color-sync";


const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://vercode.me",
  ),
  title: "Vercode",
  description: "Códigos digitales y tarjetas con QR para empresas.",
  manifest: "/manifest.json", 
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-192x192.png", 
  },
  appleWebApp: {
    capable: true, 
    statusBarStyle: "default", 
    title: "Vercode",
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
};

import { Toaster } from "@/components/ui/sonner"
import { Providers } from "@/providers/providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Manifest y configuración de la PWA */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#ffffff" data-app-theme="true" />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <ThemeColorSync />
          <Providers>{children}</Providers>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
