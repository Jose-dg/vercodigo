"use client";

import { useState } from "react";
import { InvoiceStatsCards } from "@/components/invoices/dashboard/InvoiceStatsCards";
import { InvoiceFilters } from "@/components/invoices/dashboard/InvoiceFilters";
import { InvoiceTable } from "@/components/invoices/dashboard/InvoiceTable";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { getInvoiceStats, getInvoices } from "@/lib/queries/invoices";
import { InvoiceStatus } from "@prisma/client";
import { DateRange } from "react-day-picker";

export default async function InvoicesPage() {
    const stats = await getInvoiceStats();
    const { invoices } = await getInvoices({});

    return (
        <div className="container mx-auto py-8 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Facturas</h1>
                    <p className="text-muted-foreground">
                        Gestiona las facturas de QRs activados
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href="/invoices/pending-activations">
                        <Button variant="outline">Ver Activaciones Pendientes</Button>
                    </Link>
                    <Link href="/invoices/new">
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Nueva Factura
                        </Button>
                    </Link>
                </div>
            </div>

            <InvoiceStatsCards stats={stats} />

            <div className="space-y-4">
                <InvoiceTableWrapper initialInvoices={invoices} />
            </div>
        </div>
    );
}

function InvoiceTableWrapper({
    initialInvoices,
}: {
    initialInvoices: Awaited<ReturnType<typeof getInvoices>>["invoices"];
}) {
    const [invoices, setInvoices] = useState(initialInvoices);

    const handleFilterChange = async (filters: {
        status?: InvoiceStatus;
        dateRange?: DateRange;
    }) => {
        const { invoices: newInvoices } = await getInvoices({
            status: filters.status,
            dateRange: filters.dateRange
                ? { from: filters.dateRange.from!, to: filters.dateRange.to! }
                : undefined,
        });
        setInvoices(newInvoices);
    };

    return (
        <>
            <InvoiceFilters onFilterChange={handleFilterChange} />
            <InvoiceTable invoices={invoices} />
        </>
    );
}
