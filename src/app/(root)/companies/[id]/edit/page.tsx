import { getCompanyById } from '@/services/company.service';
import { notFound } from 'next/navigation';
import { CompanyForm } from '@/components/companies/CompanyForm';
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

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function EditCompanyPage({ params }: PageProps) {
    const { id } = await params;
    const company = await getCompanyById(id);

    if (!company) {
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
                                <BreadcrumbLink href="/">Inicio</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbLink href="/companies">Compañías</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbLink href={`/companies/${id}`}>{company.name}</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem>
                                <BreadcrumbPage>Editar</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
            </header>
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                <div className="space-y-6">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                        Editar Compañía
                    </h1>
                    <CompanyForm
                        initialData={{
                            id: company.id,
                            name: company.name,
                            taxId: company.taxId,
                            email: company.email,
                            phone: company.phone,
                            address: company.address || undefined,
                            billingFrequency: company.billingFrequency,
                            commissionRate: company.commissionRate,
                            isActive: company.isActive,
                        }}
                    />
                </div>
            </div>
        </>
    );
}

