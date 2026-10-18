import { Skeleton } from "@/components/ui/skeleton";

// Se muestra al instante al navegar dentro del portal mientras llega la página.
// Mismo contenedor que Mi empresa / Mi billetera para que el cambio no salte.
export default function PortalLoading() {
    return (
        <div role="status" aria-live="polite" className="mx-auto w-full max-w-[1440px] space-y-6 p-4 sm:p-6 lg:p-8">
            <span className="sr-only">Cargando…</span>
            <div className="space-y-2">
                <Skeleton className="h-9 w-56" />
                <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="h-36 rounded-xl" />
                ))}
            </div>
            <Skeleton className="h-72 rounded-xl" />
        </div>
    );
}
