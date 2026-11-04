import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { Prisma, PrismaClient, UserRole } from "@prisma/client";
import { getCodeRequest } from "@/lib/devdiem/fulfillment";
import { reverseCancelledCodePurchase } from "@/services/self-service/post-delivery.service";

const prisma = new PrismaClient();
const VERSION = 1;
const PLATFORM_ROLES = new Set<UserRole>([UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN]);

function values(name: string) {
    const found: string[] = [];
    for (let i = 0; i < process.argv.length; i += 1) {
        if (process.argv[i] === `--${name}` && process.argv[i + 1]) found.push(process.argv[i + 1]);
    }
    return found;
}

function value(name: string) {
    const result = values(name)[0];
    if (!result) throw new Error(`Falta --${name}`);
    return result;
}

const canonical = (input: unknown): string => input instanceof Date
    ? JSON.stringify(input.toISOString())
    : Array.isArray(input)
        ? `[${input.map(canonical).join(",")}]`
        : input && typeof input === "object"
            ? `{${Object.entries(input as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, row]) => `${JSON.stringify(key)}:${canonical(row)}`).join(",")}}`
            : JSON.stringify(input);
const fingerprint = (input: unknown) => createHash("sha256").update(canonical(input)).digest("hex");

function writePrivate(path: string, payload: unknown) {
    const target = resolve(path);
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
    chmodSync(target, 0o600);
}

async function databaseIdentity() {
    const rows = await prisma.$queryRaw<Array<{
        database: string;
        read_replica: boolean;
        read_only: boolean;
    }>>(
        Prisma.sql`
            SELECT
                current_database() AS database,
                pg_is_in_recovery() AS read_replica,
                current_setting('transaction_read_only') = 'on' AS read_only
        `,
    );
    return rows[0];
}

async function snapshot(purchaseIds: string[]) {
    const purchases = await prisma.codePurchase.findMany({
        where: { id: { in: purchaseIds } },
        include: {
            denomination: { select: { amount: true, currency: true } },
        },
        orderBy: { id: "asc" },
    });
    if (purchases.length !== purchaseIds.length) throw new Error("Una o más compras no existen");
    const rows = [];
    for (const purchase of purchases) {
        if (!purchase.diemRequestId) throw new Error(`La compra ${purchase.id} no tiene diemRequestId`);
        const [remote, movements, product] = await Promise.all([
            getCodeRequest(purchase.diemRequestId),
            prisma.walletTransaction.findMany({
                where: {
                    OR: [
                        { codePurchaseId: purchase.id },
                        { reversalOf: { is: { codePurchaseId: purchase.id } } },
                    ],
                },
                select: {
                    id: true,
                    type: true,
                    status: true,
                    amount: true,
                    reversalOfId: true,
                    reversalPresentation: true,
                    accountStatementLine: { select: { accountStatementId: true } },
                },
                orderBy: { createdAt: "asc" },
            }),
            prisma.product.findUnique({ where: { id: purchase.productId }, select: { name: true } }),
        ]);
        rows.push({
            purchase: {
                id: purchase.id,
                companyId: purchase.companyId,
                storeId: purchase.storeId,
                status: purchase.status,
                totalAmount: purchase.totalAmount,
                currency: purchase.currency,
                count: purchase.count,
                diemRequestId: purchase.diemRequestId,
                product: product?.name ?? null,
                denomination: purchase.denomination,
            },
            remote: {
                status: remote.status,
                reasonCode: remote.last_error_code ?? null,
            },
            movements,
        });
    }
    const safe = { version: VERSION, purchaseIds: [...purchaseIds].sort(), rows };
    return { ...safe, fingerprint: fingerprint(safe) };
}

function validate(plan: Awaited<ReturnType<typeof snapshot>>) {
    if (plan.rows.length !== 3) throw new Error("Este procedimiento exige exactamente tres compras");
    for (const row of plan.rows) {
        const denomination = row.purchase.denomination;
        if (
            row.purchase.count !== 1
            || row.purchase.totalAmount !== 78750
            || denomination?.amount !== 25
            || denomination.currency !== "USD"
        ) throw new Error(`La compra ${row.purchase.id} no corresponde al caso US$25 / COP 78.750`);
        if (row.remote.status !== "cancelled" || row.remote.reasonCode !== "partner_return_claim_accepted") {
            throw new Error(`Diem no confirma la devolución aceptada para ${row.purchase.id}`);
        }
        const consumption = row.movements.find((movement) => movement.type === "CONSUMPTION");
        if (!consumption || consumption.status !== "CONFIRMED" || consumption.amount !== 78750) {
            throw new Error(`Consumo inválido para ${row.purchase.id}`);
        }
        if (row.movements.some((movement) => movement.accountStatementLine)) {
            throw new Error(`La compra ${row.purchase.id} ya pertenece a un estado de cuenta emitido`);
        }
    }
}

async function main() {
    const mode = process.argv[2];
    if (mode !== "plan" && mode !== "apply") throw new Error("Uso: returned-codes:reconcile <plan|apply> ...");
    const purchaseIds = values("purchase-id");
    if (new Set(purchaseIds).size !== 3) throw new Error("Envía tres --purchase-id distintos");
    const receiptPath = value("receipt");
    const identity = await databaseIdentity();
    const current = await snapshot(purchaseIds);
    validate(current);
    const receipt = {
        database: identity.database,
        readReplica: identity.read_replica,
        readOnly: identity.read_only,
        ...current,
    };
    if (mode === "plan") {
        writePrivate(receiptPath, receipt);
        console.log(JSON.stringify(receipt, null, 2));
        console.log("PLAN OK: sin códigos y sin cambios en la base.");
        return;
    }
    const expectedDatabase = value("expected-database");
    if (identity.database !== expectedDatabase || identity.read_replica || identity.read_only) {
        throw new Error("La base no coincide, es una réplica o la sesión PostgreSQL es de solo lectura");
    }
    const planned = JSON.parse(readFileSync(resolve(receiptPath), "utf8"));
    if (canonical(planned) !== canonical(receipt)) throw new Error("El estado cambió después del plan; genera uno nuevo");
    if (value("confirmation") !== `RECONCILE-${current.fingerprint}`) throw new Error(`Confirmación inválida; usa RECONCILE-${current.fingerprint}`);
    const actorEmail = value("actor-email").trim().toLowerCase();
    const actor = await prisma.user.findUnique({ where: { email: actorEmail }, select: { id: true, role: true, isActive: true } });
    if (!actor?.isActive || !PLATFORM_ROLES.has(actor.role)) throw new Error("El actor debe ser administrador de plataforma activo");

    const results = [];
    for (const row of current.rows) {
        const result = await reverseCancelledCodePurchase(row.purchase.id);
        const consumption = await prisma.walletTransaction.findUniqueOrThrow({ where: { codePurchaseId: row.purchase.id } });
        await prisma.$transaction([
            prisma.walletTransaction.updateMany({
                where: { reversalOfId: consumption.id, type: "REFUND" },
                data: { reversalPresentation: "OMIT_NEUTRALIZED_PAIR" },
            }),
            prisma.auditLog.create({
                data: {
                    action: "RETURNED_CODE_PURCHASE_RECONCILED",
                    userId: actor.id,
                    companyId: row.purchase.companyId,
                    storeId: row.purchase.storeId,
                    entityType: "CodePurchase",
                    entityId: row.purchase.id,
                    before: { status: row.purchase.status },
                    after: { status: "REVERSED", customerPresentation: "OMIT_NEUTRALIZED_PAIR" },
                    details: { version: VERSION, fingerprint: current.fingerprint, reasonCode: row.remote.reasonCode },
                },
            }),
        ]);
        results.push({ purchaseId: row.purchase.id, ...result });
    }
    const after = await snapshot(purchaseIds);
    const totalRefunded = after.rows.flatMap((row) => row.movements).filter((movement) => movement.type === "REFUND").reduce((sum, movement) => sum + movement.amount, 0);
    if (totalRefunded !== 236250) throw new Error(`Total reembolsado inesperado: ${totalRefunded}`);
    console.log(JSON.stringify({ results, totalRefunded, afterFingerprint: after.fingerprint }, null, 2));
}

main().finally(() => prisma.$disconnect());
