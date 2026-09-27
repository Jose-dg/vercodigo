import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { redactSensitiveCodes } from "./domain";

type LegalSnapshot = {
    brand?: string;
    legalName?: string;
    taxId?: string;
    address?: string | null;
    email?: string;
    name?: string;
    phone?: string;
};

export type PdfStatement = {
    statementNumber: string;
    currency: string;
    periodStart: Date;
    periodEnd: Date;
    issuedAt: Date;
    openingBalance: { toString(): string } | string;
    consumptions: { toString(): string } | string;
    recharges: { toString(): string } | string;
    refunds: { toString(): string } | string;
    adjustments: { toString(): string } | string;
    closingBalance: { toString(): string } | string;
    totalPending: { toString(): string } | string;
    creditBalance: { toString(): string } | string;
    issuerSnapshot: unknown;
    customerSnapshot: unknown;
    lines: Array<{
        id: string;
        occurredAt: Date;
        description: string;
        productDetail: string | null;
        quantity: number | null;
        unitPrice: { toString(): string } | string | null;
        debit: { toString(): string } | string;
        credit: { toString(): string } | string;
        balanceAfter: { toString(): string } | string;
    }>;
};

const styles = StyleSheet.create({
    page: { paddingTop: 44, paddingBottom: 48, paddingHorizontal: 42, fontFamily: "Helvetica", fontSize: 8.5, color: "#172033" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
    brand: { fontSize: 23, fontFamily: "Helvetica-Bold", color: "#123F68" },
    titleBlock: { alignItems: "flex-end" },
    title: { fontSize: 15, fontFamily: "Helvetica-Bold" },
    muted: { color: "#667085", marginTop: 4 },
    parties: { flexDirection: "row", gap: 28, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#D8DEE8", paddingVertical: 14, marginBottom: 20 },
    party: { flex: 1 },
    partyTitle: { fontSize: 7, color: "#667085", marginBottom: 6 },
    partyName: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 },
    detail: { marginBottom: 3, lineHeight: 1.35 },
    summary: { flexDirection: "row", gap: 8, marginBottom: 22 },
    summaryCell: { flex: 1, paddingVertical: 10, paddingHorizontal: 9, backgroundColor: "#F3F6F9" },
    summaryLabel: { color: "#667085", fontSize: 7, marginBottom: 5 },
    summaryValue: { fontFamily: "Helvetica-Bold", fontSize: 10 },
    dueCell: { backgroundColor: "#123F68" },
    dueLabel: { color: "#DDEAF5", fontSize: 7, marginBottom: 5 },
    dueValue: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 10 },
    table: { width: "100%" },
    row: { flexDirection: "row", borderBottomWidth: 0.7, borderColor: "#D8DEE8", minHeight: 29, alignItems: "center" },
    tableHeader: { backgroundColor: "#E8EEF4", minHeight: 24 },
    th: { fontFamily: "Helvetica-Bold", fontSize: 6.8, color: "#39465A" },
    date: { width: "13%", paddingHorizontal: 4 },
    description: { width: "29%", paddingHorizontal: 4 },
    qty: { width: "8%", paddingHorizontal: 4, textAlign: "right" },
    money: { width: "12.5%", paddingHorizontal: 4, textAlign: "right" },
    balance: { width: "12%", paddingHorizontal: 4, textAlign: "right" },
    product: { color: "#667085", fontSize: 7, marginTop: 3 },
    footer: { position: "absolute", bottom: 24, left: 42, right: 42, flexDirection: "row", justifyContent: "space-between", color: "#667085", fontSize: 7 },
    notice: { marginTop: 18, paddingTop: 10, borderTopWidth: 1, borderColor: "#D8DEE8", color: "#667085", lineHeight: 1.4 },
});

const asSnapshot = (value: unknown): LegalSnapshot =>
    value && typeof value === "object" && !Array.isArray(value) ? value as LegalSnapshot : {};

function formatMoney(value: { toString(): string } | string, currency: string, absolute = false) {
    const number = Number(value.toString());
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(absolute ? Math.abs(number) : number);
}

function formatDate(value: Date, includeTime = false) {
    return new Intl.DateTimeFormat("es-CO", {
        timeZone: "America/Bogota",
        day: "2-digit",
        month: "short",
        year: "numeric",
        ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    }).format(value);
}

export function AccountStatementDocument({ statement }: { statement: PdfStatement }) {
    const issuer = asSnapshot(statement.issuerSnapshot);
    const customer = asSnapshot(statement.customerSnapshot);
    const hasDebt = Number(statement.closingBalance.toString()) < 0;
    const hasCredit = Number(statement.closingBalance.toString()) > 0;
    const closingLabel = hasDebt ? "Total pendiente" : hasCredit ? "Saldo a favor" : "Saldo al día";
    const closingValue = hasDebt ? statement.totalPending : hasCredit ? statement.creditBalance : "0";

    return (
        <Document title={`Estado de cuenta ${statement.statementNumber}`} author={issuer.legalName ?? issuer.brand ?? "Vercode"}>
            <Page size="A4" style={styles.page}>
                <View style={styles.header}>
                    <Text style={styles.brand}>{issuer.brand ?? "Vercode"}</Text>
                    <View style={styles.titleBlock}>
                        <Text style={styles.title}>Estado de cuenta</Text>
                        <Text style={styles.muted}>{statement.statementNumber}</Text>
                        <Text style={styles.muted}>Corte: {formatDate(statement.periodEnd, true)}</Text>
                    </View>
                </View>

                <View style={styles.parties}>
                    <View style={styles.party}>
                        <Text style={styles.partyTitle}>EMISOR</Text>
                        <Text style={styles.partyName}>{issuer.legalName ?? issuer.brand}</Text>
                        <Text style={styles.detail}>NIT {issuer.taxId}</Text>
                        <Text style={styles.detail}>{issuer.address}</Text>
                        {issuer.email ? <Text style={styles.detail}>{issuer.email}</Text> : null}
                    </View>
                    <View style={styles.party}>
                        <Text style={styles.partyTitle}>TITULAR DE LA CUENTA</Text>
                        <Text style={styles.partyName}>{customer.name}</Text>
                        <Text style={styles.detail}>NIT {customer.taxId}</Text>
                        {customer.address ? <Text style={styles.detail}>{customer.address}</Text> : null}
                        <Text style={styles.detail}>{customer.email}</Text>
                    </View>
                    <View style={styles.party}>
                        <Text style={styles.partyTitle}>PERIODO</Text>
                        <Text style={styles.partyName}>{formatDate(statement.periodStart)} – {formatDate(statement.periodEnd)}</Text>
                        <Text style={styles.detail}>Emitido {formatDate(statement.issuedAt, true)}</Text>
                        <Text style={styles.detail}>Moneda: {statement.currency}</Text>
                    </View>
                </View>

                <View style={styles.summary}>
                    <View style={styles.summaryCell}>
                        <Text style={styles.summaryLabel}>Saldo anterior</Text>
                        <Text style={styles.summaryValue}>{formatMoney(statement.openingBalance, statement.currency, true)}</Text>
                    </View>
                    <View style={styles.summaryCell}>
                        <Text style={styles.summaryLabel}>Consumos</Text>
                        <Text style={styles.summaryValue}>{formatMoney(statement.consumptions, statement.currency, true)}</Text>
                    </View>
                    <View style={styles.summaryCell}>
                        <Text style={styles.summaryLabel}>Abonos</Text>
                        <Text style={styles.summaryValue}>{formatMoney(statement.recharges, statement.currency, true)}</Text>
                    </View>
                    <View style={[styles.summaryCell, styles.dueCell]}>
                        <Text style={styles.dueLabel}>{closingLabel}</Text>
                        <Text style={styles.dueValue}>{formatMoney(closingValue, statement.currency, true)}</Text>
                    </View>
                </View>

                <View style={styles.table}>
                    <View style={[styles.row, styles.tableHeader]} fixed>
                        <Text style={[styles.date, styles.th]}>Fecha</Text>
                        <Text style={[styles.description, styles.th]}>Descripción</Text>
                        <Text style={[styles.qty, styles.th]}>Cant.</Text>
                        <Text style={[styles.money, styles.th]}>Valor unit.</Text>
                        <Text style={[styles.money, styles.th]}>Débito</Text>
                        <Text style={[styles.money, styles.th]}>Crédito</Text>
                        <Text style={[styles.balance, styles.th]}>Balance</Text>
                    </View>
                    {statement.lines.map((line) => (
                        <View style={styles.row} key={line.id} wrap={false}>
                            <Text style={styles.date}>{formatDate(line.occurredAt, true)}</Text>
                            <View style={styles.description}>
                                <Text>{redactSensitiveCodes(line.description)}</Text>
                                {line.productDetail && line.productDetail !== line.description
                                    ? <Text style={styles.product}>{redactSensitiveCodes(line.productDetail)}</Text>
                                    : null}
                            </View>
                            <Text style={styles.qty}>{line.quantity ?? "—"}</Text>
                            <Text style={styles.money}>{line.unitPrice ? formatMoney(line.unitPrice, statement.currency) : "—"}</Text>
                            <Text style={styles.money}>{Number(line.debit.toString()) ? formatMoney(line.debit, statement.currency) : "—"}</Text>
                            <Text style={styles.money}>{Number(line.credit.toString()) ? formatMoney(line.credit, statement.currency) : "—"}</Text>
                            <Text style={styles.balance}>{formatMoney(line.balanceAfter, statement.currency)}</Text>
                        </View>
                    ))}
                </View>

                <Text style={styles.notice}>
                    Documento informativo generado a partir de los movimientos confirmados de la cuenta. No constituye factura electrónica ni recibo de pago.
                </Text>
                <View style={styles.footer} fixed>
                    <Text>{statement.statementNumber}</Text>
                    <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
                </View>
            </Page>
        </Document>
    );
}
