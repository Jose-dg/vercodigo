"use client";
import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { APP_THEMES } from "@/lib/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    return <NextThemesProvider attribute="data-theme" themes={[...APP_THEMES]} defaultTheme="system" enableSystem enableColorScheme={false} disableTransitionOnChange storageKey="theme">{children}</NextThemesProvider>;
}
