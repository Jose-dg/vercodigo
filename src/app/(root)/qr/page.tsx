import prisma from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";
import { QRTable } from "@/components/qr/QRTable";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { redirect } from "next/navigation";

import { requireSessionUser } from "@/lib/auth/session";
import {
    canAccessQrList,
    canCreateQr,
    cardVisibilityFilter,
    storeVisibilityFilter,
} from "@/lib/auth/tenant-scope";

export const dynamic = "force-dynamic";

export default async function QRPage() {
    const user = await requireSessionUser();
    if (!canAccessQrList(user)) {
        redirect("/");
    }

    const cardWhere = cardVisibilityFilter(user);
    const storeWhere = storeVisibilityFilter(user);

    let error: string | null = null;
    let qrs: Awaited<ReturnType<typeof prisma.card.findMany>> = [];
    let stores: { id: string; name: string }[] = [];
    let products: { id: string; name: string }[] = [];

    try {
        const [qrsData, storesData, productsData] = await Promise.all([
            prisma.card.findMany({
                where: cardWhere,
                include: {
                    product: true,
                    store: true,
                    denomination: true,
                    key: true,
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma.store.findMany({
                where: storeWhere,
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
        console.error("Error fetching QR data:", e);
        error = "No se pudieron cargar los datos. Por favor, intenta de nuevo más tarde.";
    }

    const showCreate = canCreateQr(user);

    if (error) {
        return (
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
            </div>
        );
    }

    return (
        <>
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                <div className="flex items-center gap-2 px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbLink href="/">Inicio</BreadcrumbLink>
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
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Códigos QR</h1>
                            <p className="mt-2 text-gray-500">
                                {showCreate
                                    ? "Gestiona y monitorea los códigos QR generados."
                                    : "Consulta los códigos QR de tu ámbito."}
                            </p>
                        </div>
                        {showCreate && (
                            <Button asChild className="bg-blue-600 text-white shadow-sm hover:bg-blue-700">
                                <Link href="/qr/create">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Generar nuevos QR
                                </Link>
                            </Button>
                        )}
                    </div>

                    <Card className="border-gray-200 bg-white shadow-sm">
                        <CardHeader>
                            <CardTitle>Listado de códigos</CardTitle>
                            <CardDescription>Total: {qrs.length}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <QRTable
                                qrs={qrs}
                                stores={stores}
                                products={products}
                                readOnly={!showCreate}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
