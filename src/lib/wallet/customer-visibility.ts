import type { Prisma, WalletTransactionType } from "@prisma/client";

type OrderedMovement = {
    id: string;
    type: WalletTransactionType;
    amount: number;
    balanceAfter: number | null;
    occurredAt: Date;
    occurredSequence: number;
};

/** Hide neutralized pairs only while neither side belongs to an issued statement. */
export const neutralizedPairWhere: Prisma.WalletTransactionWhereInput = {
    OR: [
        {
            type: "REFUND",
            reversalPresentation: "OMIT_NEUTRALIZED_PAIR",
            accountStatementLine: null,
            reversalOf: { is: { accountStatementLine: null } },
        },
        {
            type: "CONSUMPTION",
            accountStatementLine: null,
            reversal: {
                is: {
                    reversalPresentation: "OMIT_NEUTRALIZED_PAIR",
                    accountStatementLine: null,
                },
            },
        },
    ],
};

export function customerVisibleWhere(base: Prisma.WalletTransactionWhereInput) {
    return { AND: [base, { NOT: neutralizedPairWhere }] } satisfies Prisma.WalletTransactionWhereInput;
}

export function customerHiddenWhere(base: Prisma.WalletTransactionWhereInput) {
    return { AND: [base, neutralizedPairWhere] } satisfies Prisma.WalletTransactionWhereInput;
}

function compareMovement(a: OrderedMovement, b: OrderedMovement) {
    const time = a.occurredAt.getTime() - b.occurredAt.getTime();
    if (time) return time;
    const sequence = a.occurredSequence - b.occurredSequence;
    if (sequence) return sequence;
    return a.id.localeCompare(b.id);
}

const ledgerDelta = (movement: OrderedMovement) => (
    movement.type === "CONSUMPTION" ? -movement.amount : movement.amount
);

/** Rebuild customer balances while preserving the internal accounting ledger. */
export function customerRunningBalances<T extends OrderedMovement>(visible: T[], hidden: OrderedMovement[]) {
    const orderedHidden = [...hidden].sort(compareMovement);
    const orderedVisible = [...visible].sort(compareMovement);
    const balances = new Map<string, number | null>();
    let hiddenIndex = 0;
    let hiddenDelta = 0;
    for (const movement of orderedVisible) {
        while (hiddenIndex < orderedHidden.length && compareMovement(orderedHidden[hiddenIndex], movement) <= 0) {
            hiddenDelta += ledgerDelta(orderedHidden[hiddenIndex]);
            hiddenIndex += 1;
        }
        balances.set(
            movement.id,
            movement.balanceAfter == null ? null : movement.balanceAfter - hiddenDelta,
        );
    }
    return balances;
}
