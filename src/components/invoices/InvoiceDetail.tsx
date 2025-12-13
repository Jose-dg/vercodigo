"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface InvoiceDetailProps {
  id: string;
}

export default function InvoiceDetail({ id }: InvoiceDetailProps) {
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInvoice() {
      try {
        const response = await fetch(`/api/invoices/${id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch invoice");
        }
        const data = await response.json();
        setInvoice(data);
      } catch (error: any) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    fetchInvoice();
  }, [id]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
            Pagada
          </Badge>
        );
      case "PENDING":
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-200">
            Pendiente
          </Badge>
        );
      case "OVERDUE":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">
            Vencida
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="outline" className="text-gray-500 border-gray-200">
            Cancelada
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (!invoice) {
    return <div>Invoice not found</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-2xl">Invoice {invoice.invoiceNumber}</CardTitle>
          <p className="text-sm text-gray-500">
            {format(new Date(invoice.createdAt), "PPP", { locale: es })}
          </p>
        </div>
        {getStatusBadge(invoice.status)}
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Company</p>
            <p>{invoice.company.name}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Period</p>
            <p>
              {format(new Date(invoice.periodStart), "P", { locale: es })} -{" "}
              {format(new Date(invoice.periodEnd), "P", { locale: es })}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 border-t pt-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Sales</p>
            <p className="font-semibold">{formatCurrency(invoice.totalSales, "USD")}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Commission</p>
            <p className="font-semibold">{formatCurrency(invoice.commissionAmount, "USD")}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Amount</p>
            <p className="font-semibold">{formatCurrency(invoice.totalAmount, "USD")}</p>
          </div>
        </div>
        {invoice.paidAt && (
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-500">Paid At</p>
            <p>{format(new Date(invoice.paidAt), "PPP p", { locale: es })}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
