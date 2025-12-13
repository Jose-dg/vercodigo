import InvoiceDetail from "@/components/invoices/InvoiceDetail";

export default function Page({ params }: { params: { id: string } }) {
  return (
    <div className="flex flex-col gap-4">
      <InvoiceDetail id={params.id} />
    </div>
  );
}