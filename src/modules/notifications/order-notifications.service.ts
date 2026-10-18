import "server-only";

import { after } from "next/server";
import { UserRole } from "@prisma/client";

import prisma from "@/lib/prisma";
import { marketingConfig } from "@/lib/marketing/config";
import { formatMoney, orderReference } from "@/components/codes/order-format";
import { writeAuditLog } from "@/services/self-service/audit.service";

import {
    buildOrderNotifications,
    parseTeamEmails,
    type NotificationRecipient,
    type OrderNotification,
} from "./domain";
import { diemAiConfigured, requestEmail, resolveRecipient } from "./diem-ai.client";

/** Correos del equipo Diem que reciben los avisos de pedidos (negocio: en base de datos). */
const TEAM_EMAILS_KEY = "NOTIFY_ORDER_EMAILS";
const COMPANY_ADMIN_ROLES = [UserRole.OWNER, UserRole.GENERAL_ADMIN];

function portalUrl(path: string): string {
    return new URL(path, marketingConfig.brand.canonicalUrl).toString();
}

/**
 * Corre la tarea después de responder (el usuario no espera a diem-ai). Fuera de
 * una solicitud (scripts) se ejecuta en segundo plano sin bloquear.
 */
function runAfterResponse(task: () => Promise<void>) {
    const guarded = () => task().catch((error) => console.error("[notifications] fallo inesperado", error));
    try {
        after(guarded);
    } catch {
        void guarded();
    }
}

async function teamRecipients(): Promise<NotificationRecipient[]> {
    const row = await prisma.systemConfig.findUnique({ where: { key: TEAM_EMAILS_KEY } });
    return parseTeamEmails(row?.value);
}

/**
 * Un intento por aviso: si diem-ai no responde, queda registrado en AuditLog y ese
 * correo no sale. La confirmación de envío llega por /api/webhook/diem-ai.
 */
async function deliver(notification: OrderNotification, context: { companyId: string; aggregateType: string; id: string }) {
    const recipient = notification.recipient;
    const auditBase = {
        userId: recipient.role === "diem_team" ? "system" : recipient.key,
        companyId: context.companyId,
        entityType: context.aggregateType,
        entityId: context.id,
    };
    try {
        const customerIdentityId = await resolveRecipient(recipient);
        const event = await requestEmail({
            customerIdentityId,
            template: notification.template,
            params: notification.params,
            externalRef: notification.externalRef,
            callbackUrl: portalUrl("/api/webhook/diem-ai"),
        });
        await writeAuditLog({
            ...auditBase,
            action: "notification.requested",
            details: { template: notification.template, role: recipient.role, externalRef: notification.externalRef, eventId: event.id },
        });
    } catch (error) {
        console.error("[notifications] diem-ai no aceptó el aviso", notification.externalRef, error);
        await writeAuditLog({
            ...auditBase,
            action: "notification.request_failed",
            success: false,
            errorMessage: (error instanceof Error ? error.message : String(error)).slice(0, 500),
            details: { template: notification.template, role: recipient.role, externalRef: notification.externalRef },
        }).catch(() => undefined);
    }
}

/** Comprador, empresa, sus OWNER/GENERAL_ADMIN activos y el equipo Diem. */
async function orderAudience(companyId: string, buyerId: string | null) {
    const [buyer, company, companyAdmins, team] = await Promise.all([
        buyerId
            ? prisma.user.findUnique({ where: { id: buyerId }, select: { id: true, email: true, name: true, isActive: true } })
            : Promise.resolve(null),
        prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
        prisma.user.findMany({
            where: { companyId, role: { in: COMPANY_ADMIN_ROLES }, isActive: true },
            select: { id: true, email: true, name: true },
        }),
        teamRecipients(),
    ]);
    return {
        companyName: company?.name ?? "",
        buyerName: buyer?.name ?? "",
        buyer: buyer?.isActive
            ? { key: buyer.id, email: buyer.email, name: buyer.name, role: "buyer" as const }
            : null,
        companyAdmins: companyAdmins.map((admin) => ({
            key: admin.id, email: admin.email, name: admin.name, role: "company_admin" as const,
        })),
        team,
    };
}

async function sendCodePurchaseNotifications(purchaseId: string, created: boolean) {
    const purchase = await prisma.codePurchase.findUnique({ where: { id: purchaseId } });
    if (!purchase) return;
    const [audience, product] = await Promise.all([
        orderAudience(purchase.companyId, purchase.userId),
        prisma.product.findUnique({ where: { id: purchase.productId }, select: { name: true } }),
    ]);

    const notifications = buildOrderNotifications({
        facts: {
            aggregateType: "CodePurchase",
            id: purchase.id,
            status: purchase.status,
            created,
            orderNumber: orderReference(purchase.id),
            itemSummary: `${purchase.count} × ${product?.name ?? "Producto"}`,
            total: formatMoney(purchase.totalAmount, purchase.currency),
            companyName: audience.companyName,
            buyerName: audience.buyerName,
            orderUrl: portalUrl(`/codes/purchases/${purchase.id}`),
            internalReason: purchase.lastError,
        },
        buyer: audience.buyer,
        companyAdmins: audience.companyAdmins,
        team: audience.team,
    });

    for (const notification of notifications) {
        await deliver(notification, { companyId: purchase.companyId, aggregateType: "CodePurchase", id: purchase.id });
    }
}

/**
 * Avisos de una compra de códigos según su estado actual. Se llama al crearla
 * (`created: true`) y cada vez que se procesa (checkout, "Consultar Diem",
 * recuperación manual, webhook de DevDiem). Repetir es inofensivo: diem-ai es
 * idempotente por external_ref y nunca reenvía el mismo aviso.
 */
export function notifyCodePurchase(purchaseId: string, options: { created?: boolean } = {}) {
    if (!diemAiConfigured()) return;
    runAfterResponse(() => sendCodePurchaseNotifications(purchaseId, options.created === true));
}

async function sendActivationNotifications(jobId: string, created: boolean) {
    const job = await prisma.activationJob.findUnique({
        where: { id: jobId },
        include: { card: { include: { product: { select: { name: true } }, store: { select: { companyId: true } } } } },
    });
    if (!job) return;
    const audience = await orderAudience(job.card.store.companyId, job.userId);
    const notifications = buildOrderNotifications({
        facts: {
            aggregateType: "ActivationJob",
            id: job.id,
            status: job.status,
            created,
            orderNumber: orderReference(job.id),
            itemSummary: `Activación de tarjeta QR · ${job.card.product.name}`,
            total: job.commercialAmount != null && job.commercialCurrency
                ? formatMoney(job.commercialAmount, job.commercialCurrency)
                : "—",
            companyName: audience.companyName,
            buyerName: audience.buyerName,
            orderUrl: portalUrl(`/codes/activations/${encodeURIComponent(job.card.uuid)}`),
            internalReason: job.lastError,
        },
        buyer: audience.buyer,
        companyAdmins: audience.companyAdmins,
        team: audience.team,
    });
    for (const notification of notifications) {
        await deliver(notification, { companyId: job.card.store.companyId, aggregateType: "ActivationJob", id: job.id });
    }
}

/** Igual que notifyCodePurchase, para una activación de tarjeta QR. */
export function notifyActivationJob(jobId: string, options: { created?: boolean } = {}) {
    if (!diemAiConfigured()) return;
    runAfterResponse(() => sendActivationNotifications(jobId, options.created === true));
}
