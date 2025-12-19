"use client";

import { useState } from "react";
import { InvoiceForm } from "@/components/invoices/forms/InvoiceForm";
import { createInvoice } from "@/lib/actions/invoices";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Company } from "@prisma/client";
import type { CreateInvoiceInput } from "@/lib/validations/invoice-schema";

interface NewInvoicePageProps {
    companies: Company[];
}

export function NewInvoicePageClient({ companies }: NewInvoicePageProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();

    const handleSubmit = async (data: CreateInvoiceInput) => {
        setIsSubmitting(true);
        try {
            const result = await createInvoice(data);

            if (result.success) {
                toast.success("Factura creada exitosamente");
                router.push(`/invoices/${result.invoiceId}`);
                router.refresh();
            } else {
                toast.error(result.error || "Error al crear factura");
            }
        } catch (error) {
            toast.error("Error inesperado al crear factura");
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="container mx-auto py-8 space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/invoices">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Volver
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold">Nueva Factura</h1>
                    <p className="text-muted-foreground">
                        Crear una factura manualmente
                    </p>
                </div>
            </div>

            <InvoiceForm
                companies={companies}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
            />
        </div>
    );
}
