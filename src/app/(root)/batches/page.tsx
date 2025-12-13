import { getAllBatches } from '@/services/batch.service';
import { BatchList } from '@/components/batches/BatchList';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';

export const dynamic = 'force-dynamic';

export default async function BatchesPage() {
    const batches = await getAllBatches();

    return (
        <>
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                <div className="flex items-center gap-2 px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator
                        orientation="vertical"
                        className="mr-2 data-[orientation=vertical]:h-4"
                    />
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbLink href="/">Inicio</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem>
                                <BreadcrumbPage>Lotes de Fabricación</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
            </header>
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                <div className="space-y-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                                Lotes de Fabricación
                            </h1>
                            <p className="text-gray-500 mt-2">
                                Gestiona los lotes de fabricación de tarjetas.
                            </p>
                        </div>
                        <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                            <Link href="/batches/create">
                                <Plus className="mr-2 h-4 w-4" />
                                Crear Nuevo Lote
                            </Link>
                        </Button>
                    </div>

                    <BatchList batches={batches} />
                </div>
            </div>
        </>
    );
}

