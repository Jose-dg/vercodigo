import { Skeleton } from '@/components/ui/skeleton';

/** Forma del primer paso del wizard (tarjeta con regiones) mientras llega el catálogo. */
export function PurchaseWizardSkeleton() {
    return (
        <div role="status" aria-live="polite" className="mx-auto max-w-xl overflow-hidden rounded-xl border bg-card shadow-sm">
            <span className="sr-only">Cargando catálogo…</span>
            <div className="space-y-4 border-b p-6 pb-5">
                <Skeleton className="h-7 w-52" />
                <Skeleton className="h-4 w-72 max-w-full" />
                <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 3 }, (_, index) => (
                        <Skeleton key={index} className="h-1.5 rounded-full" />
                    ))}
                </div>
            </div>
            <div className="grid gap-3 p-6">
                {Array.from({ length: 2 }, (_, index) => (
                    <Skeleton key={index} className="h-[5.5rem] rounded-2xl" />
                ))}
            </div>
        </div>
    );
}

/** Encabezado + pestañas + wizard: la página de compra completa antes de tener datos. */
export function PurchasePageSkeleton() {
    return (
        <main className="min-h-full bg-muted/20">
            <div className="container max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
                <div className="mb-6 flex items-start gap-4 sm:mb-8">
                    <Skeleton className="hidden size-12 shrink-0 rounded-xl sm:block" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-60 sm:h-10" />
                        <Skeleton className="h-4 w-72 max-w-full" />
                    </div>
                </div>
                <Skeleton className="mb-6 h-12 w-full max-w-sm rounded-lg" />
                <PurchaseWizardSkeleton />
            </div>
        </main>
    );
}
