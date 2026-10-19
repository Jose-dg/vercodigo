"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { KeyRound, Link2 } from "lucide-react";

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import { LinkedAccountsSection } from "./linked-accounts-section";
import { LINKED_RETURN_PARAM, SETTINGS_PARAM } from "./params";
import { PasswordSection } from "./password-section";

/**
 * Configuración de la cuenta como modal con menú lateral (patrón del bloque
 * shadcn sidebar-13): se abre desde el menú del usuario o el aviso de cambiar la
 * clave, sin sacar a la persona de lo que estaba haciendo.
 */

const SECTIONS = [
    { id: "password", label: "Contraseña", icon: KeyRound, Content: PasswordSection },
    { id: "accounts", label: "Cuentas vinculadas", icon: Link2, Content: LinkedAccountsSection },
] as const;

export type SettingsSection = (typeof SECTIONS)[number]["id"];

type SettingsDialogContextValue = { openSettings: (section?: SettingsSection) => void };

const SettingsDialogContext = createContext<SettingsDialogContextValue | null>(null);

export function useSettingsDialog() {
    const context = useContext(SettingsDialogContext);
    if (!context) throw new Error("useSettingsDialog debe usarse dentro de SettingsDialogProvider");
    return context;
}

const noop = () => {};

function isSection(value: string | null): value is SettingsSection {
    return SECTIONS.some((item) => item.id === value);
}

/**
 * Sección con la que el modal arranca abierto según la URL, o null si arranca cerrado.
 * El modal va en un portal que solo existe en el cliente, así que leer la URL aquí no
 * cambia el HTML del servidor.
 */
function sectionFromUrl(): SettingsSection | null {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    // Al volver de vincular Google/Apple: Cuentas vinculadas avisa el resultado.
    if (params.has(LINKED_RETURN_PARAM)) return "accounts";
    if (!params.has(SETTINGS_PARAM)) return null;
    const requested = params.get(SETTINGS_PARAM);
    return isSection(requested) ? requested : "password";
}

/** Quita el parámetro de apertura al cerrar, para que recargar no reabra el modal. */
function clearSettingsParam() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(SETTINGS_PARAM)) return;
    url.searchParams.delete(SETTINGS_PARAM);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}

export function SettingsDialogProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(() => sectionFromUrl() !== null);
    const [section, setSection] = useState<SettingsSection>(() => sectionFromUrl() ?? "password");

    const onOpenChange = useCallback((next: boolean) => {
        setOpen(next);
        if (!next) clearSettingsParam();
    }, []);

    const openSettings = useCallback((next: SettingsSection = "password") => {
        setSection(next);
        setOpen(true);
    }, []);

    const value = useMemo(() => ({ openSettings }), [openSettings]);
    const active = SECTIONS.find((item) => item.id === section) ?? SECTIONS[0];

    return (
        <SettingsDialogContext.Provider value={value}>
            {children}
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="flex h-[min(34rem,calc(100svh-2rem))] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 md:max-w-[46rem]">
                    <DialogTitle className="sr-only">Configuración</DialogTitle>
                    <DialogDescription className="sr-only">Contraseña y cuentas vinculadas para entrar al portal.</DialogDescription>
                    {/* Proveedor propio y controlado: no toca la cookie ni el estado del menú principal. */}
                    <SidebarProvider
                        open
                        onOpenChange={noop}
                        className="min-h-0 items-stretch"
                        style={{ "--sidebar-width": "13rem" } as React.CSSProperties}
                    >
                        <Sidebar collapsible="none" className="hidden border-r md:flex">
                            <SidebarContent>
                                <SidebarGroup>
                                    <SidebarGroupContent>
                                        <p className="px-2 pb-2 pt-1 text-sm font-semibold">Configuración</p>
                                        <SidebarMenu>
                                            {SECTIONS.map((item) => (
                                                <SidebarMenuItem key={item.id}>
                                                    <SidebarMenuButton
                                                        isActive={item.id === section}
                                                        onClick={() => setSection(item.id)}
                                                    >
                                                        <item.icon />
                                                        <span>{item.label}</span>
                                                    </SidebarMenuButton>
                                                </SidebarMenuItem>
                                            ))}
                                        </SidebarMenu>
                                    </SidebarGroupContent>
                                </SidebarGroup>
                            </SidebarContent>
                        </Sidebar>
                        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
                            <header className="flex h-14 shrink-0 items-center px-4 pr-12">
                                <Breadcrumb>
                                    <BreadcrumbList>
                                        <BreadcrumbItem className="hidden md:block">Configuración</BreadcrumbItem>
                                        <BreadcrumbSeparator className="hidden md:block" />
                                        <BreadcrumbItem>
                                            <BreadcrumbPage>{active.label}</BreadcrumbPage>
                                        </BreadcrumbItem>
                                    </BreadcrumbList>
                                </Breadcrumb>
                            </header>
                            {/* En pantallas pequeñas el menú lateral se vuelve pestañas. */}
                            <nav className="flex gap-1 px-4 pb-2 md:hidden" aria-label="Secciones">
                                {SECTIONS.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setSection(item.id)}
                                        aria-current={item.id === section ? "page" : undefined}
                                        className={cn(
                                            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                                            item.id === section
                                                ? "bg-accent text-accent-foreground"
                                                : "text-muted-foreground hover:bg-accent/50",
                                        )}
                                    >
                                        <item.icon className="size-3.5" aria-hidden="true" />
                                        {item.label}
                                    </button>
                                ))}
                            </nav>
                            <div className="flex-1 overflow-y-auto px-4 pb-6 pt-2 md:px-6">
                                <active.Content />
                            </div>
                        </main>
                    </SidebarProvider>
                </DialogContent>
            </Dialog>
        </SettingsDialogContext.Provider>
    );
}
