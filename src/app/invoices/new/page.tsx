import { getAllCompanies } from "@/lib/queries/invoices";
import { NewInvoicePageClient } from "@/components/invoices/forms/NewInvoicePageClient";

export default async function NewInvoicePage() {
    const companies = await getAllCompanies();

    return <NewInvoicePageClient companies={companies} />;
}
