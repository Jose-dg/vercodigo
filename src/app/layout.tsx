import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";


const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ver código",
  description: "Ver código de activación",
  manifest: "/manifest.json", 
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-192x192.png", 
  },
  appleWebApp: {
    capable: true, 
    statusBarStyle: "default", 
    title: "Finance App",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

import { Toaster } from "@/components/ui/sonner"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.className} style={{ backgroundColor: "#ffffff" }}>
        <Providers>
            {children}
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
