"use client";
import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ThemePreference } from "@/lib/theme";

const OPTIONS = [
    { value: "light", label: "Claro" },
    { value: "dark", label: "Oscuro gris" },
    { value: "dark-blue", label: "Oscuro azul" },
    { value: "system", label: "Sistema" },
] as const satisfies ReadonlyArray<{ value: ThemePreference; label: string }>;

export function ThemeToggle({ className }: { className?: string }) {
    const [mounted, setMounted] = React.useState(false);
    const { forcedTheme, setTheme, theme } = useTheme();
    React.useEffect(() => setMounted(true), []);
    return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" disabled={Boolean(forcedTheme)} className={className}><Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" /><Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" /><span className="sr-only">Cambiar tema</span></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuRadioGroup value={mounted ? theme : undefined} onValueChange={setTheme}>{OPTIONS.map((option) => <DropdownMenuRadioItem key={option.value} value={option.value}>{option.label}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>;
}
