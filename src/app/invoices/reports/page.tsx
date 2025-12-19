import { RevenueChart } from "@/components/invoices/reports/RevenueChart";
import { CommissionChart } from "@/components/invoices/reports/CommissionChart";
import { ReportsSummaryTable } from "@/components/invoices/reports/ReportsSummaryTable";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

// Mock data - in real implementation, fetch from database
const revenueData = [
    { month: "Ene", revenue: 12000 },
    { month: "Feb", revenue: 19000 },
    { month: "Mar", revenue: 15000 },
    { month: "Abr", revenue: 22000 },
    { month: "May", revenue: 18000 },
    { month: "Jun", revenue: 25000 },
];

const commissionData = [
    { company: "Tienda Matrix", commission: 1200 },
    { company: "Super Store", commission: 950 },
    { company: "Mega Shop", commission: 800 },
    { company: "Local Express", commission: 600 },
];

const summaryData = [
    {
        company: "Tienda Matrix",
        totalInvoiced: 45000,
        totalPaid: 32000,
        pending: 13000,
    },
    {
        company: "Super Store",
        totalInvoiced: 38000,
        totalPaid: 28000,
        pending: 10000,
    },
    {
        company: "Mega Shop",
        totalInvoiced: 29000,
        totalPaid: 29000,
        pending: 0,
    },
];

export default function ReportsPage() {
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
                    <h1 className="text-3xl font-bold">Reportes Financieros</h1>
                    <p className="text-muted-foreground">
                        Análisis de ingresos, comisiones y estados de facturación
                    </p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <RevenueChart data={revenueData} />
                <CommissionChart data={commissionData} />
            </div>

            <ReportsSummaryTable data={summaryData} />
        </div>
    );
}
