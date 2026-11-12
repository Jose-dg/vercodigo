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

const round = (value: number) => Math.round(value * 100) / 100;

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
