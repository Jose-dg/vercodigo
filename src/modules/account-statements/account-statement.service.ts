import { Prisma, UserRole, WalletTransactionType } from "@prisma/client";

import prisma from "@/lib/prisma";
import { isPrismaWriteConflict, runSerializableTransaction } from "@/lib/prisma-transaction";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { marketingConfig } from "@/lib/marketing/config";
import {
    buildFinancialSnapshot,
    canIssueAccountStatement,
    canReadAccountStatement,
    hasProvisionalTaxId,
    statementFingerprint,
    type StatementMovement,
} from "./domain";

type Db = Prisma.TransactionClient | typeof prisma;

export type StatementActor = {
    id: string;
    role: UserRole | string;
    companyId: string | null;
};

type SourceTransaction = Prisma.WalletTransactionGetPayload<Record<string, never>>;

function assertCanRead(actor: StatementActor, companyId: string) {
    if (canReadAccountStatement(actor.role, actor.companyId, companyId)) return;
    throw forbidden("No tienes acceso a este estado de cuenta");
}

function assertCanIssue(actor: StatementActor) {
    if (!canIssueAccountStatement(actor.role)) {
        throw forbidden("Solo la plataforma puede emitir estados de cuenta");
    }
}

function isStatementSequenceConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
    const target = JSON.stringify(error.meta?.target ?? "");
    return target.includes("sequenceYear")
        || target.includes("sequenceNumber")
        || target.includes("statementNumber");
}

function issuerSnapshot() {
    return {
        brand: marketingConfig.brand.name,
        legalName: marketingConfig.company.legalName,
        taxId: marketingConfig.company.taxId,
        address: marketingConfig.company.address,
        email: marketingConfig.contact.email,
    };
}

function emissionBlockers(company: { taxId: string }, issuer: ReturnType<typeof issuerSnapshot>) {
    const blockers: string[] = [];
    if (!issuer.legalName || !issuer.taxId || !issuer.address) {
        blockers.push("Completa la identidad legal de Vercode antes de emitir.");
    }
    if (hasProvisionalTaxId(company.taxId)) {
        blockers.push("Verifica el NIT real de la empresa antes de emitir.");
    }
    return blockers;
}

function afterCursor(
    occurredAt: Date,
    occurredSequence: number,
    id: string,
): Prisma.WalletTransactionWhereInput {
    return {
        OR: [
            { occurredAt: { gt: occurredAt } },
            { occurredAt, occurredSequence: { gt: occurredSequence } },
            { occurredAt, occurredSequence, id: { gt: id } },
        ],
    };
}

async function enrichMovements(db: Db, transactions: SourceTransaction[]): Promise<StatementMovement[]> {
    const purchaseIds = transactions.flatMap((tx) => tx.codePurchaseId ? [tx.codePurchaseId] : []);
    const activationIds = transactions.flatMap((tx) => tx.cardActivationId ? [tx.cardActivationId] : []);

    const [purchases, activations] = await Promise.all([
        purchaseIds.length
            ? db.codePurchase.findMany({
                where: { id: { in: purchaseIds } },
                select: {
                    id: true,
                    count: true,
                    productId: true,
                    denomination: { select: { amount: true, currency: true } },
                },
            })
            : [],
        activationIds.length
            ? db.cardActivation.findMany({
                where: { id: { in: activationIds } },
                select: {
                    id: true,
                    card: {
                        select: {
                            product: { select: { name: true } },
                            denomination: { select: { amount: true, currency: true } },
                        },
                    },
                },
            })
            : [],
    ]);

    const productIds = [...new Set(purchases.map((purchase) => purchase.productId))];
    const products = productIds.length
        ? await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
        : [];
    const productNames = new Map(products.map((product) => [product.id, product.name]));
    const purchaseMap = new Map(purchases.map((purchase) => [purchase.id, purchase]));
    const activationMap = new Map(activations.map((activation) => [activation.id, activation]));

    return transactions.map((transaction) => {
        const purchase = transaction.codePurchaseId ? purchaseMap.get(transaction.codePurchaseId) : undefined;
        const activation = transaction.cardActivationId ? activationMap.get(transaction.cardActivationId) : undefined;
        const quantity = purchase?.count ?? (activation ? 1 : null);
        const productName = purchase
            ? productNames.get(purchase.productId)
            : activation?.card.product.name;
        const denomination = purchase?.denomination ?? activation?.card.denomination;
        const productDetail = productName
            ? `${productName}${denomination ? ` ${denomination.amount} ${denomination.currency}` : ""}`
            : null;
        const amount = Number(transaction.amount);

        return {
            id: transaction.id,
            type: transaction.type,
            amount,
            balanceAfter: transaction.balanceAfter as number,
            occurredAt: transaction.occurredAt.toISOString(),
            description:
                transaction.type === "OPENING_BALANCE" ? "Saldo anterior"
                    : transaction.type === "CONSUMPTION" ? (productDetail ?? "Consumo")
                    : transaction.type === "RECHARGE" ? "Abono"
                        : transaction.type === "REFUND" ? "Reembolso"
                            : "Ajuste",
            productDetail,
            quantity,
            unitPrice: quantity && quantity > 0 ? amount / quantity : null,
        };
    });
}

async function buildPreview(db: Db, companyId: string, cutoffAt: Date) {
    if (Number.isNaN(cutoffAt.getTime())) throw badRequest("Fecha de corte inválida");
    if (cutoffAt.getTime() > Date.now() + 60_000) throw badRequest("La fecha de corte no puede estar en el futuro");

    const company = await db.company.findUnique({
        where: { id: companyId },
        select: {
            id: true,
            name: true,
            taxId: true,
            email: true,
            phone: true,
            address: true,
            wallet: true,
        },
    });
    if (!company) throw notFound("Empresa no encontrada");
    if (!company.wallet) throw badRequest("La empresa todavía no tiene wallet");

    const previous = await db.accountStatement.findFirst({
        where: { walletId: company.wallet.id },
        orderBy: [{ periodEnd: "desc" }, { issuedAt: "desc" }],
        include: {
            lines: {
                orderBy: { position: "desc" },
                take: 1,
                include: { walletTransaction: { select: { occurredSequence: true } } },
            },
        },
    });

    let openingBalance = 0;
    let periodStart = company.wallet.createdAt;
    let cursor: { occurredAt: Date; occurredSequence: number; id: string } | null = null;

    if (previous) {
        if (cutoffAt <= previous.periodEnd) {
            throw conflict("La fecha de corte debe ser posterior al último estado emitido");
        }
        const lastLine = previous.lines[0];
        if (!lastLine) throw conflict("El último estado no tiene una línea de cierre válida");
        openingBalance = Number(previous.closingBalance);
        periodStart = lastLine.occurredAt;
        cursor = {
            occurredAt: lastLine.occurredAt,
            occurredSequence: lastLine.walletTransaction.occurredSequence,
            id: lastLine.walletTransactionId,
        };
    } else {
        const explicitOpening = await db.walletTransaction.findFirst({
            where: {
                walletId: company.wallet.id,
                type: "OPENING_BALANCE",
                status: "CONFIRMED",
                occurredAt: { lte: cutoffAt },
            },
            orderBy: [{ occurredAt: "desc" }, { occurredSequence: "desc" }, { id: "desc" }],
        });
        const anchor = explicitOpening ?? await db.walletTransaction.findFirst({
            where: {
                walletId: company.wallet.id,
                type: "RECHARGE",
                status: "CONFIRMED",
                occurredAt: { lte: cutoffAt },
            },
            orderBy: [{ occurredAt: "desc" }, { occurredSequence: "desc" }, { id: "desc" }],
        });
        if (anchor) {
            if (anchor.balanceAfter == null) throw conflict("El último abono confirmado no tiene balance calculado");
            openingBalance = anchor.balanceAfter;
            periodStart = anchor.occurredAt;
            cursor = {
                occurredAt: anchor.occurredAt,
                occurredSequence: anchor.occurredSequence,
                id: anchor.id,
            };
        }
    }

    const transactions = await db.walletTransaction.findMany({
        where: {
            walletId: company.wallet.id,
            status: "CONFIRMED",
            occurredAt: { lte: cutoffAt },
            ...(cursor ? afterCursor(cursor.occurredAt, cursor.occurredSequence, cursor.id) : {}),
        },
        orderBy: [{ occurredAt: "asc" }, { occurredSequence: "asc" }, { id: "asc" }],
    });
    if (transactions.some((transaction) => transaction.balanceAfter == null)) {
        throw conflict("Hay movimientos confirmados sin balance calculado");
    }

    const movements = await enrichMovements(db, transactions);
    const financial = buildFinancialSnapshot(openingBalance, movements);
    const issuer = issuerSnapshot();
    const customer = {
        name: company.name,
        taxId: company.taxId,
        email: company.email,
        phone: company.phone,
        address: company.address,
    };
    const blockers = emissionBlockers(company, issuer);
    const fingerprint = statementFingerprint({
        companyId,
        walletId: company.wallet.id,
        currency: company.wallet.currency,
        periodStart: periodStart.toISOString(),
        cutoffAt: cutoffAt.toISOString(),
        issuer,
        customer,
        financial,
    });

    return {
        companyId,
        walletId: company.wallet.id,
        companyName: company.name,
        currency: company.wallet.currency,
        periodStart: periodStart.toISOString(),
        periodEnd: cutoffAt.toISOString(),
        issuer,
        customer,
        ...financial,
        fingerprint,
        canIssue: blockers.length === 0 && financial.lines.length > 0,
        blockers: financial.lines.length === 0 ? [...blockers, "No hay movimientos confirmados para este corte."] : blockers,
    };
}

export async function previewAccountStatement(params: {
    companyId: string;
    cutoffAt: Date;
    actor: StatementActor;
}) {
    assertCanIssue(params.actor);
    return buildPreview(prisma, params.companyId, params.cutoffAt);
}

export async function issueAccountStatement(params: {
    companyId: string;
    cutoffAt: Date;
    fingerprint: string;
    actor: StatementActor;
}) {
    assertCanIssue(params.actor);
    try {
        return await runSerializableTransaction(prisma, async (tx) => {
            const wallet = await tx.wallet.findUnique({ where: { companyId: params.companyId }, select: { id: true } });
            if (!wallet) throw badRequest("La empresa todavía no tiene wallet");

            const preview = await buildPreview(tx, params.companyId, params.cutoffAt);
            if (preview.fingerprint !== params.fingerprint) {
                throw conflict("El ledger cambió después del preview. Actualiza el estado antes de emitir.");
            }
            if (!preview.canIssue) {
                throw badRequest("El estado no se puede emitir", { blockers: preview.blockers });
            }

            const year = params.cutoffAt.getUTCFullYear();
            const latest = await tx.accountStatement.findFirst({
                where: { sequenceYear: year },
                orderBy: { sequenceNumber: "desc" },
                select: { sequenceNumber: true },
            });
            const sequenceNumber = (latest?.sequenceNumber ?? 0) + 1;
            const statementNumber = `EC-${year}-${String(sequenceNumber).padStart(6, "0")}`;

            const statement = await tx.accountStatement.create({
                data: {
                    statementNumber,
                    sequenceYear: year,
                    sequenceNumber,
                    companyId: preview.companyId,
                    walletId: preview.walletId,
                    issuedById: params.actor.id,
                    currency: preview.currency,
                    periodStart: new Date(preview.periodStart),
                    periodEnd: new Date(preview.periodEnd),
                    openingBalance: preview.openingBalance,
                    consumptions: preview.consumptions,
                    recharges: preview.recharges,
                    refunds: preview.refunds,
                    adjustments: preview.adjustments,
                    closingBalance: preview.closingBalance,
                    totalPending: preview.totalPending,
                    creditBalance: preview.creditBalance,
                    issuerSnapshot: preview.issuer,
                    customerSnapshot: preview.customer,
                    previewFingerprint: preview.fingerprint,
                    lines: {
                        create: preview.lines.map((line) => ({
                            walletTransactionId: line.id,
                            position: line.position,
                            occurredAt: new Date(line.occurredAt),
                            type: line.type as WalletTransactionType,
                            description: line.description,
                            productDetail: line.productDetail,
                            quantity: line.quantity,
                            unitPrice: line.unitPrice,
                            debit: line.debit,
                            credit: line.credit,
                            balanceAfter: line.balanceAfter,
                        })),
                    },
                },
                include: { lines: { orderBy: { position: "asc" } } },
            });

            await tx.auditLog.create({
                data: {
                    action: "ACCOUNT_STATEMENT_ISSUED",
                    userId: params.actor.id,
                    companyId: params.companyId,
                    entityType: "AccountStatement",
                    entityId: statement.id,
                    details: {
                        statementNumber,
                        periodEnd: preview.periodEnd,
                        movementCount: preview.lines.length,
                        totalPending: preview.totalPending,
                    },
                },
            });

            return statement;
        }, {
            timeoutMs: 10_000,
            retryOn: (error) => isPrismaWriteConflict(error) || isStatementSequenceConflict(error),
        });
    } catch (error) {
        if (isStatementSequenceConflict(error)) {
            throw conflict("El consecutivo cambió durante la emisión. Vuelve a intentarlo.");
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw conflict("Uno de los movimientos ya pertenece a otro estado de cuenta");
        }
        throw error;
    }
}

const statementInclude = {
    lines: { orderBy: { position: "asc" as const } },
} satisfies Prisma.AccountStatementInclude;

export async function listAccountStatements(actor: StatementActor) {
    const isPlatform = canIssueAccountStatement(actor.role);
    const canReadOwn = actor.companyId !== null && canReadAccountStatement(actor.role, actor.companyId, actor.companyId);
    if (!isPlatform && !canReadOwn) {
        throw forbidden("No tienes acceso a estados de cuenta");
    }
    return prisma.accountStatement.findMany({
        where: isPlatform ? {} : { companyId: actor.companyId! },
        orderBy: { issuedAt: "desc" },
        select: {
            id: true,
            statementNumber: true,
            companyId: true,
            currency: true,
            periodStart: true,
            periodEnd: true,
            totalPending: true,
            creditBalance: true,
            issuedAt: true,
            company: { select: { name: true } },
        },
    });
}

export async function getAccountStatement(id: string, actor: StatementActor) {
    const statement = await prisma.accountStatement.findUnique({ where: { id }, include: statementInclude });
    if (!statement) throw notFound("Estado de cuenta no encontrado");
    assertCanRead(actor, statement.companyId);
    return statement;
}
