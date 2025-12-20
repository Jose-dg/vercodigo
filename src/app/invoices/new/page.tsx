import { getAllCompanies, getAllProducts } from "@/lib/queries/invoices";
import { NewInvoicePageClient } from "@/components/invoices/forms/NewInvoicePageClient";

export default async function NewInvoicePage() {
    const [companies, products] = await Promise.all([
        getAllCompanies(),
        getAllProducts(),
    ]);

    return <NewInvoicePageClient companies={companies} products={products} />;
}
