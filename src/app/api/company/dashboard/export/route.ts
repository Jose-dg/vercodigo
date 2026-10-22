import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { withAuth } from "@/lib/auth/guard";
import type { AppAbility } from "@/lib/auth/abilities";
import type { AuthenticatedActor } from "@/lib/auth/actor";
import { getCompanyDashboard, listDashboardOrders } from "@/services/company/dashboard.service";
import { orderReference } from "@/components/codes/order-format";
import { dashboardScope } from "../scope";

const CHANNEL = { portal: "Portal", api: "API", qr: "QR" } as const;
const STATUS: Record<string, string> = {
    processing: "En proceso",
    awaiting_stock: "Esperando stock",
    completed: "Completada",
    action_required: "Requiere acción",
    failed: "Fallida",
};

/** GET /api/company/dashboard/export — the same range as Excel (Resumen + Órdenes). */
export const GET = withAuth("read", "Company", async (
    req: NextRequest,
    _ctx: unknown,
    _ability: AppAbility,
    user: AuthenticatedActor,
) => {
    try {
        const { companyId, range } = dashboardScope(req, user);
        const [dashboard, stores, company] = await Promise.all([
            getCompanyDashboard(companyId, range),
            prisma.store.findMany({ where: { companyId }, select: { id: true } }),
            prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
        ]);
        const orders = await listDashboardOrders({
            companyId,
            storeIds: stores.map((store) => store.id),
            currency: dashboard.currency,
            from: range.from,
            to: range.to,
        });

        const book = new ExcelJS.Workbook();
        const summary = book.addWorksheet("Resumen");
        summary.columns = [{ header: "Concepto", key: "label", width: 32 }, { header: "Valor", key: "value", width: 22 }];
        summary.addRows([
            { label: "Compañía", value: company?.name ?? "" },
            { label: "Período", value: `${dashboard.stats.firstDay} a ${dashboard.stats.lastDay}` },
            { label: `Gastado en el período (${dashboard.currency})`, value: dashboard.stats.spent },
            { label: "Órdenes en el período", value: dashboard.stats.orders },
            { label: "Órdenes completadas en el período", value: dashboard.stats.completedOrders },
            { label: `Saldo actual (${dashboard.currency})`, value: dashboard.kpis.balance },
            { label: `Total gastado histórico (${dashboard.currency})`, value: dashboard.kpis.totalSpent },
            { label: `Depositado histórico (${dashboard.currency})`, value: dashboard.kpis.deposited },
        ]);
        summary.addRow({});
        summary.addRow({ label: "Por servicio", value: "" }).font = { bold: true };
        for (const row of dashboard.stats.byService) summary.addRow({ label: row.label, value: row.amount });
        summary.addRow({});
        summary.addRow({ label: "Top por gasto", value: "" }).font = { bold: true };
        for (const row of dashboard.stats.topProducts) {
            const denomination = row.denomination ? ` · ${row.denomination.amount} ${row.denomination.currency}` : "";
            summary.addRow({ label: `${row.name}${denomination}`, value: row.amount });
        }
        summary.getRow(1).font = { bold: true };

        const sheet = book.addWorksheet("Órdenes");
        sheet.columns = [
            { header: "Fecha", key: "date", width: 20 },
            { header: "Referencia", key: "reference", width: 14 },
            { header: "Tipo", key: "kind", width: 12 },
            { header: "Producto", key: "product", width: 32 },
            { header: "Valor nominal", key: "denomination", width: 16 },
            { header: "Canal", key: "channel", width: 10 },
            { header: "Estado", key: "status", width: 18 },
            { header: "Monto", key: "amount", width: 14 },
            { header: "Moneda", key: "currency", width: 9 },
            { header: "Destinatario", key: "recipient", width: 30 },
        ];
        for (const order of orders) {
            sheet.addRow({
                // Excel shows the Colombian time of the order.
                date: new Date(new Date(order.date).getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 16).replace("T", " "),
                reference: orderReference(order.id),
                kind: order.kind === "purchase" ? "Compra" : "Activación",
                product: order.productName,
                denomination: order.denomination ? `${order.denomination.amount} ${order.denomination.currency}` : "",
                channel: CHANNEL[order.channel],
                status: STATUS[order.status] ?? order.status,
                amount: order.amount,
                currency: order.currency,
                recipient: order.recipientEmail ?? "",
            });
        }
        sheet.getRow(1).font = { bold: true };
        sheet.views = [{ state: "frozen", ySplit: 1 }];

        const buffer = await book.xlsx.writeBuffer();
        return new NextResponse(buffer as ArrayBuffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="estadisticas-${dashboard.stats.firstDay}-a-${dashboard.stats.lastDay}.xlsx"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
        }
        console.error("[company/dashboard/export]", error);
        return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
    }
});
