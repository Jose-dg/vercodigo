import InvoiceForm from "@/components/invoices/InvoiceForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Page() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Invoice</CardTitle>
      </CardHeader>
      <CardContent>
        <InvoiceForm />
      </CardContent>
    </Card>
  );
}
