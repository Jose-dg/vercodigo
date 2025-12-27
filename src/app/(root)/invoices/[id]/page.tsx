import { getInvoiceById } from "@/lib/queries/invoices";
import { InvoiceDetailHeader } from "@/components/invoices/detail/InvoiceDetailHeader";
import { InvoiceInfoCard } from "@/components/invoices/detail/InvoiceInfoCard";
import { InvoiceItemsDetail } from "@/components/invoices/detail/InvoiceItemsDetail";
import { InvoiceActivationsList } from "@/components/invoices/detail/InvoiceActivationsList";
import { InvoiceFinancialSummary } from "@/components/invoices/detail/InvoiceFinancialSummary";
import { notFound } from "next/navigation";

export default async function InvoiceDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const invoice = await getInvoiceById(id);

    if (!invoice) {
        notFound();
    }

    return (
        <div className="container mx-auto py-8 space-y-6">
            <InvoiceDetailHeader
                invoiceId={invoice.id}
                invoiceNumber={invoice.invoiceNumber}
                status={invoice.status}
            />

            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 space-y-6">
                    <InvoiceInfoCard invoice={invoice} />
                    <InvoiceItemsDetail items={invoice.items} />
                    <InvoiceActivationsList activations={invoice.CardActivation} />
                </div>

                <div>
                    <InvoiceFinancialSummary
                        totalSales={invoice.totalSales}
                        commissionRate={invoice.commissionRate}
                        commissionAmount={invoice.commissionAmount}
                        totalAmount={invoice.totalAmount}
                    />
                </div>
            </div>
        </div>
    );
}
