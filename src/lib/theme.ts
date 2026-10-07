export const APP_THEMES = ["light", "dark", "dark-blue"] as const;
export type AppTheme = (typeof APP_THEMES)[number];
export type ThemePreference = AppTheme | "system";
export const DARK_THEMES = ["dark", "dark-blue"] as const;
export function isDarkTheme(theme?: string): theme is (typeof DARK_THEMES)[number] {
    return DARK_THEMES.some((candidate) => candidate === theme);
}
