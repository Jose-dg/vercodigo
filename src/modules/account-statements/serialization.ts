import type { AccountStatement, AccountStatementLine } from "@prisma/client";

type StatementWithLines = AccountStatement & { lines: AccountStatementLine[] };

export function serializeAccountStatement(statement: StatementWithLines) {
    return {
        ...statement,
        openingBalance: statement.openingBalance.toFixed(2),
        consumptions: statement.consumptions.toFixed(2),
        recharges: statement.recharges.toFixed(2),
        refunds: statement.refunds.toFixed(2),
        adjustments: statement.adjustments.toFixed(2),
        closingBalance: statement.closingBalance.toFixed(2),
        totalPending: statement.totalPending.toFixed(2),
        creditBalance: statement.creditBalance.toFixed(2),
        lines: statement.lines.map((line) => ({
            ...line,
            unitPrice: line.unitPrice?.toFixed(2) ?? null,
            debit: line.debit.toFixed(2),
            credit: line.credit.toFixed(2),
            balanceAfter: line.balanceAfter.toFixed(2),
        })),
    };
}
