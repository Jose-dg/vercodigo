import { redirect } from "next/navigation";

import { QRGeneratorForm } from "@/components/qr/QRGeneratorForm";
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
import { requireSessionUser } from "@/lib/auth/session";
import { canCreateQr } from "@/lib/auth/tenant-scope";

export default async function CreateQRPage() {
    const user = await requireSessionUser();
    if (!canCreateQr(user)) {
        redirect("/qr");
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
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbLink href="/qr">Códigos QR</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem>
                                <BreadcrumbPage>Generar</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
            </header>
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                <div className="space-y-6">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Generar códigos QR</h1>
                    <p className="text-sm text-gray-500">
                        Solo administradores de plataforma pueden crear lotes de tarjetas físicas.
                    </p>
                    <QRGeneratorForm />
                </div>
            </div>
        </>
    );
}
