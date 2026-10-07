"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

const THEME_COLORS: Record<string, string> = {
    light: "#ffffff",
    dark: "#18181b",
    "dark-blue": "#020817",
};

export function ThemeColorSync() {
    const { resolvedTheme } = useTheme();

    useEffect(() => {
        const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-app-theme]');
        if (meta) meta.content = THEME_COLORS[resolvedTheme ?? "light"] ?? THEME_COLORS.light;
    }, [resolvedTheme]);

    return null;
}
