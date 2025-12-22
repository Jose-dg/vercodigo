import prisma from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, QrCode } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { QRStatusToggle } from "@/components/qr/QRStatusToggle";
import { QRDeleteButton } from "@/components/qr/QRDeleteButton";
import { QRUpdateKeyButton } from "@/components/qr/QRUpdateKeyButton";
import { QRDownloadSVGButton } from "@/components/qr/QRDownloadSVGButton";

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
    SidebarTrigger,
} from "@/components/ui/sidebar";

export const dynamic = "force-dynamic";

import { Prisma } from "@prisma/client";
import { QREditButton } from "@/components/qr/QREditButton";


import { QRTable } from "@/components/qr/QRTable";

export default async function QRPage() {
    let qrs: Prisma.CardGetPayload<{
        include: {
            product: true;
            store: true;
            denomination: true;
            key: true;
        };
    }>[] = [];

    let stores: { id: string; name: string }[] = [];
    let products: { id: string; name: string }[] = [];

    let error = null;

    try {
        const [qrsData, storesData, productsData] = await Promise.all([
            prisma.card.findMany({
                include: {
                    product: true,
                    store: true,
                    denomination: true,
                    key: true,
                },
                orderBy: {
                    createdAt: "desc",
                },
            }),
            prisma.store.findMany({
                where: { isActive: true },
                select: { id: true, name: true },
                orderBy: { name: "asc" },
            }),
            prisma.product.findMany({
                where: { isActive: true },
                select: { id: true, name: true },
                orderBy: { name: "asc" },
            }),
        ]);
        qrs = qrsData;
        stores = storesData;
        products = productsData;
    } catch (e) {
        console.error("Error fetching data:", e);
        error = "No se pudieron cargar los datos. Por favor, intenta de nuevo más tarde.";
    }

    if (error) {
        return (
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                <div className="rounded-md bg-red-50 p-4">
                    <div className="flex">
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">Error</h3>
                            <div className="mt-2 text-sm text-red-700">
                                <p>{error}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

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
                                <BreadcrumbLink href="/">
                                    Inicio
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem>
                                <BreadcrumbPage>Códigos QR</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
            </header>
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                <div className="space-y-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Códigos QR</h1>
                            <p className="text-gray-500 mt-2">Gestiona y monitorea los códigos QR generados.</p>
                        </div>
                        <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                            <Link href="/qr/create">
                                <Plus className="mr-2 h-4 w-4" />
                                Generar Nuevos QR
                            </Link>
                        </Button>
                    </div>

                    <Card className="bg-white shadow-sm border-gray-200">
                        <CardHeader>
                            <CardTitle>Listado de Códigos</CardTitle>
                            <CardDescription>
                                Total de códigos generados: {qrs.length}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <QRTable qrs={qrs} stores={stores} products={products} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}