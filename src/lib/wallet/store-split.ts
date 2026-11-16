import { rebuildBalances, type LedgerRow } from "./ledger.ts";

/**
 * Moving a store to its own company moves its commercial history with it:
 * the store's purchases, its card activations and every wallet movement they
 * produced (including their reversals) leave the source wallet. Nothing is
 * compensated: no adjustment, credit note or opening balance is written.
 */

/** Purchase states whose wallet movements can still change; they block a split. */
export const IN_FLIGHT_PURCHASE_STATUSES = ["PENDING", "AWAITING_STOCK", "FINALIZING", "ACTION_REQUIRED"];

export type SplitPurchase = { id: string; status: string };

export type StoreMergePurchase = SplitPurchase & {
    count: number;
    totalAmount: number;
    currency: string;
    deliveredCodeCount: number;
    diemRequestId: string | null;
};

export type SplitMovement = LedgerRow & {
    balanceAfter: number | null;
    codePurchaseId: string | null;
    cardActivationId: string | null;
    reversalOfId: string | null;
    inStatement: boolean;
};

export type StoreSplitPlan = {
    purchaseIds: string[];
    activationIds: string[];
    movementIds: string[];
    movedAmount: { consumptions: number; refunds: number };
    source: { balanceBefore: number; balanceAfter: number };
    target: { balanceAfter: number };
};

export type StoreMergePlan = Omit<StoreSplitPlan, "target"> & {
    target: { balanceBefore: number; balanceAfter: number };
};

export type LedgerCursor = {
    occurredAt: Date;
    occurredSequence: number;
    id: string;
};

export type ClosedStatementPeriod = {
    statementNumber: string;
    periodStart: Date;
    periodEnd: Date;
};

export type StoreMergeBillingAudit = {
    purchases: Array<{
        id: string;
        status: "COMPLETED" | "REVERSED";
        deliveredCodeCount: number;
        billedCount: number;
        consumptionId: string;
        consumptionAmount: number;
        refundId: string | null;
    }>;
    grossConsumptions: number;
    refunds: number;
    netCharge: number;
    statementChargeMovementIds: string[];
};

const round = (value: number) => Math.round(value * 100) / 100;

const afterCursor = (row: Pick<LedgerRow, "occurredAt" | "occurredSequence" | "id">, cursor: LedgerCursor) => (
    row.occurredAt > cursor.occurredAt
    || (row.occurredAt.getTime() === cursor.occurredAt.getTime() && row.occurredSequence > cursor.occurredSequence)
    || (
        row.occurredAt.getTime() === cursor.occurredAt.getTime()
        && row.occurredSequence === cursor.occurredSequence
        && row.id > cursor.id
    )
);

/**
 * Proves that each delivered purchase has a real, confirmed charge before any
 * company or wallet ownership changes. No PIN values are accepted or returned;
 * only their count participates in the audit receipt.
 */
export function auditStoreMergeBilling(params: {
    purchases: StoreMergePurchase[];
    sourceRows: SplitMovement[];
    walletCurrency: string;
}): StoreMergeBillingAudit {
    const audited: StoreMergeBillingAudit["purchases"] = [];
    const statementChargeMovementIds: string[] = [];
    for (const purchase of params.purchases) {
        if (purchase.status !== "COMPLETED" && purchase.status !== "REVERSED") {
            throw new Error(`La compra ${purchase.id} está en ${purchase.status}; solo se reúnen entregas COMPLETED o REVERSED`);
        }
        if (!purchase.diemRequestId) throw new Error(`La compra ${purchase.id} no tiene diemRequestId`);
        if (purchase.count < 1 || purchase.deliveredCodeCount !== purchase.count) {
            throw new Error(`La compra ${purchase.id} registra ${purchase.deliveredCodeCount} códigos entregados para ${purchase.count} unidades cobradas`);
        }
        if (purchase.currency !== params.walletCurrency) {
            throw new Error(`La compra ${purchase.id} está en ${purchase.currency} y la wallet en ${params.walletCurrency}; requiere conciliación individual`);
        }
        const direct = params.sourceRows.filter((row) => row.codePurchaseId === purchase.id);
        if (direct.length !== 1) {
            throw new Error(`La compra ${purchase.id} debe tener exactamente un consumo; tiene ${direct.length}`);
        }
        const consumption = direct[0];
        if (consumption.type !== "CONSUMPTION") {
            throw new Error(`El movimiento ${consumption.id} de la compra ${purchase.id} no es un consumo`);
        }
        if (consumption.status !== "CONFIRMED" || consumption.balanceAfter == null || !(consumption.amount > 0)) {
            throw new Error(`La entrega ${purchase.id} no tiene un consumo confirmado que haya afectado el saldo`);
        }
        if (Math.abs(consumption.amount - purchase.totalAmount) > 0.005) {
            throw new Error(`El consumo de ${purchase.id} es ${consumption.amount} y la compra registra ${purchase.totalAmount}`);
        }
        const refunds = params.sourceRows.filter((row) => row.reversalOfId === consumption.id);
        let refundId: string | null = null;
        if (purchase.status === "COMPLETED") {
            if (refunds.length) throw new Error(`La compra COMPLETED ${purchase.id} tiene ${refunds.length} reembolso(s)`);
            statementChargeMovementIds.push(consumption.id);
        } else {
            if (refunds.length !== 1) throw new Error(`La compra REVERSED ${purchase.id} debe tener exactamente un reembolso`);
            const refund = refunds[0];
            if (refund.type !== "REFUND" || refund.status !== "CONFIRMED" || refund.balanceAfter == null) {
                throw new Error(`El reembolso ${refund.id} de ${purchase.id} no está confirmado`);
            }
            if (Math.abs(refund.amount - consumption.amount) > 0.005) {
                throw new Error(`El reembolso ${refund.id} no neutraliza completamente el consumo de ${purchase.id}`);
            }
            refundId = refund.id;
        }
        audited.push({
            id: purchase.id,
            status: purchase.status,
            deliveredCodeCount: purchase.deliveredCodeCount,
            billedCount: purchase.count,
            consumptionId: consumption.id,
            consumptionAmount: consumption.amount,
            refundId,
        });
    }
    const grossConsumptions = round(audited.reduce((total, row) => total + row.consumptionAmount, 0));
    const refunds = round(audited.reduce((total, row) => total + (row.refundId ? row.consumptionAmount : 0), 0));
    return {
        purchases: audited,
        grossConsumptions,
        refunds,
        netCharge: round(grossConsumptions - refunds),
        statementChargeMovementIds: statementChargeMovementIds.sort(),
    };
}

export function planStoreSplit(params: {
    purchases: SplitPurchase[];
    activationIds: string[];
    /** Every movement of the source wallet, not only the moved ones. */
    sourceRows: SplitMovement[];
    sourceBalance: number;
}): StoreSplitPlan {
    const inFlight = params.purchases.filter((purchase) => IN_FLIGHT_PURCHASE_STATUSES.includes(purchase.status));
    if (inFlight.length) {
        throw new Error(`Hay compras de la sede sin cerrar: ${inFlight.map((p) => `${p.id} (${p.status})`).join(", ")}`);
    }

    const purchaseIds = new Set(params.purchases.map((purchase) => purchase.id));
    const activationIds = new Set(params.activationIds);
    const direct = params.sourceRows.filter((row) =>
        (row.codePurchaseId !== null && purchaseIds.has(row.codePurchaseId))
        || (row.cardActivationId !== null && activationIds.has(row.cardActivationId)));
    const directIds = new Set(direct.map((row) => row.id));
    const reversals = params.sourceRows.filter((row) => row.reversalOfId !== null && directIds.has(row.reversalOfId));
    const moved = [...direct, ...reversals];
    const movedIds = new Set(moved.map((row) => row.id));

    // A reversal can only travel with the movement it reverses.
    const orphan = moved.find((row) => row.reversalOfId !== null && !movedIds.has(row.reversalOfId));
    if (orphan) throw new Error(`El reverso ${orphan.id} y su consumo quedarían en wallets distintas`);

    const inStatement = moved.filter((row) => row.inStatement);
    if (inStatement.length) {
        throw new Error(`Movimientos ya reportados en un estado de cuenta: ${inStatement.map((row) => row.id).join(", ")}`);
    }
    // Rows before the source's active opening are outside its balance; moving
    // them would make them count in the target, changing what was owed.
    const sourceLedger = rebuildBalances(params.sourceRows);
    const inactive = moved.filter((row) => row.status === "CONFIRMED" && !sourceLedger.balances.has(row.id));
    if (inactive.length) {
        throw new Error(`Movimientos anteriores al saldo inicial vigente: ${inactive.map((row) => row.id).join(", ")}`);
    }
    if (moved.some((row) => row.type === "OPENING_BALANCE")) {
        throw new Error("Un saldo inicial no pertenece a una sede y no se mueve");
    }

    const before = sourceLedger.balance;
    if (Math.abs(before - params.sourceBalance) > 0.005) {
        throw new Error(`La wallet origen tiene drift (guardado ${params.sourceBalance}, movimientos ${before}); concílialo primero`);
    }
    const confirmed = moved.filter((row) => row.status === "CONFIRMED");
    const sum = (type: LedgerRow["type"]) => round(confirmed.filter((row) => row.type === type).reduce((total, row) => total + row.amount, 0));
    return {
        purchaseIds: [...purchaseIds].sort(),
        activationIds: [...activationIds].sort(),
        movementIds: [...movedIds].sort(),
        movedAmount: { consumptions: sum("CONSUMPTION"), refunds: sum("REFUND") },
        source: { balanceBefore: before, balanceAfter: rebuildBalances(params.sourceRows.filter((row) => !movedIds.has(row.id))).balance },
        target: { balanceAfter: rebuildBalances(moved).balance },
    };
}

/**
 * Rejoins a previously split store to an existing company wallet. The source
 * safety rules are identical to a split; the target additionally must have a
 * consistent ledger and no closed period that would hide the imported rows.
 */
export function planStoreMerge(params: {
    purchases: SplitPurchase[];
    activationIds: string[];
    sourceRows: SplitMovement[];
    sourceBalance: number;
    targetRows: LedgerRow[];
    targetBalance: number;
    targetClosedThrough?: Date | null;
    sourceClosedPeriods?: ClosedStatementPeriod[];
    /** Cursor the next target statement starts after; null means no anchor. */
    targetStatementCursor?: LedgerCursor | null;
    /** Confirmed charges that must appear as individual lines, not only in opening balance. */
    requiredTargetStatementMovementIds?: string[];
}): StoreMergePlan {
    const split = planStoreSplit({
        purchases: params.purchases,
        activationIds: params.activationIds,
        sourceRows: params.sourceRows,
        sourceBalance: params.sourceBalance,
    });
    const movedIds = new Set(split.movementIds);
    const movedRows = params.sourceRows.filter((row) => movedIds.has(row.id));
    const hiddenInSourceClosedPeriod = movedRows.filter((row) => (
        row.status === "CONFIRMED"
        && !row.inStatement
        && (params.sourceClosedPeriods ?? []).some((period) => (
            row.occurredAt > period.periodStart && row.occurredAt <= period.periodEnd
        ))
    ));
    if (hiddenInSourceClosedPeriod.length) {
        throw new Error(`Movimientos sin línea dentro de un estado cerrado de la wallet origen: ${hiddenInSourceClosedPeriod.map((row) => row.id).join(", ")}`);
    }
    const targetBefore = rebuildBalances(params.targetRows);
    if (Math.abs(targetBefore.balance - params.targetBalance) > 0.005) {
        throw new Error(`La wallet destino tiene drift (guardado ${params.targetBalance}, movimientos ${targetBefore.balance}); concílialo primero`);
    }
    if (params.targetClosedThrough) {
        const closed = movedRows.filter((row) => row.status === "CONFIRMED" && row.occurredAt <= params.targetClosedThrough!);
        if (closed.length) {
            throw new Error(`Movimientos caerían en un periodo ya cerrado de la wallet destino: ${closed.map((row) => row.id).join(", ")}`);
        }
    }
    const targetAfter = rebuildBalances([...params.targetRows, ...movedRows]);
    const inactive = movedRows.filter((row) => row.status === "CONFIRMED" && !targetAfter.balances.has(row.id));
    if (inactive.length) {
        throw new Error(`Movimientos quedarían antes del saldo inicial vigente de la wallet destino: ${inactive.map((row) => row.id).join(", ")}`);
    }
    if (params.targetStatementCursor) {
        const required = new Set(params.requiredTargetStatementMovementIds ?? []);
        const absorbed = movedRows.filter((row) => required.has(row.id) && !afterCursor(row, params.targetStatementCursor!));
        if (absorbed.length) {
            throw new Error(`Entregas quedarían absorbidas en el saldo inicial sin línea de cobro: ${absorbed.map((row) => row.id).join(", ")}`);
        }
    }
    return {
        ...split,
        target: { balanceBefore: targetBefore.balance, balanceAfter: targetAfter.balance },
    };
}
