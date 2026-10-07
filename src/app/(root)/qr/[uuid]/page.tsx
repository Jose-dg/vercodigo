import prisma from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { notFound, redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { QRDownloadButton } from "@/components/qr/QRDownloadButton";
import { QRDownloadSVGButton } from "@/components/qr/QRDownloadSVGButton";
import { QRCodeDisplay } from "@/components/qr/QRCodeDisplay";
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
import { isPlatformRole } from "@/lib/auth/abilities";
import { requireSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ uuid: string }>;
}

export default async function QRDetailPage({ params }: PageProps) {
    const user = await requireSessionUser();
    if (!isPlatformRole(user.role as UserRole)) redirect("/");
    const { uuid } = await params;

    const qr = await prisma.card.findUnique({
        where: { uuid },
        include: {
            product: true,
            store: true,
            denomination: true,
        },
    });

    if (!qr) {
        notFound();
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
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbLink href="/qr">
                                    Códigos QR
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem>
                                <BreadcrumbPage>Detalle</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
            </header>
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                <div className="space-y-8 max-w-4xl mx-auto">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" asChild>
                            <Link href="/qr">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Volver
                            </Link>
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-foreground">Detalle del QR</h1>
                            <p className="text-muted-foreground mt-2">Información completa del código QR</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* QR Code Display */}
                        <Card className="bg-card shadow-sm border-border">
                            <CardHeader>
                                <CardTitle>Código QR</CardTitle>
                                <CardDescription>Escanea este código con tu teléfono</CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col items-center space-y-4">
                                <QRCodeDisplay uuid={qr.uuid} qrData={qr.qrData} />
                                <div className="text-center space-y-2">
                                    <p className="text-sm font-mono text-muted-foreground bg-muted/40 px-4 py-2 rounded-full">
                                        {qr.uuid}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 w-full">
                                        <QRDownloadButton uuid={qr.uuid} />
                                        <QRDownloadSVGButton uuid={qr.uuid} qrData={qr.qrData} showText={true} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* QR Information */}
                        <Card className="bg-card shadow-sm border-border">
                            <CardHeader>
                                <CardTitle>Información</CardTitle>
                                <CardDescription>Detalles del código QR</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Producto</label>
                                    <p className="text-lg font-semibold text-foreground">{qr.product.name}</p>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Tienda</label>
                                    <p className="text-lg font-semibold text-foreground">{qr.store.name}</p>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Monto</label>
                                    <p className="text-lg font-semibold text-foreground">
                                        ${(qr.customAmount ?? qr.denomination?.amount ?? 0).toFixed(2)}
                                    </p>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-muted-foreground block mb-2">Estado</label>
                                    <div className="flex gap-2">
                                        {qr.isActivated ? (
                                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                                                Activado
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-muted-foreground border-border">
                                                Inactivo
                                            </Badge>
                                        )}
                                        {qr.isRedeemed && (
                                            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">
                                                Canjeado
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Escaneos</label>
                                    <p className="text-lg font-semibold text-foreground">
                                        {qr.scanCount} / {qr.maxScans}
                                    </p>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Fecha de creación</label>
                                    <p className="text-foreground">
                                        {format(new Date(qr.createdAt), "PPP 'a las' p", { locale: es })}
                                    </p>
                                </div>

                                {qr.activatedAt && (
                                    <div>
                                        <label className="text-sm font-medium text-muted-foreground">Fecha de activación</label>
                                        <p className="text-foreground">
                                            {format(new Date(qr.activatedAt), "PPP 'a las' p", { locale: es })}
                                        </p>
                                    </div>
                                )}

                                {qr.redeemedAt && (
                                    <div>
                                        <label className="text-sm font-medium text-muted-foreground">Fecha de canje</label>
                                        <p className="text-foreground">
                                            {format(new Date(qr.redeemedAt), "PPP 'a las' p", { locale: es })}
                                        </p>
                                    </div>
                                )}

                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">URL de escaneo</label>
                                    <p className="text-sm text-blue-600 break-all font-mono bg-blue-50 p-2 rounded">
                                        {qr.qrData}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
}
