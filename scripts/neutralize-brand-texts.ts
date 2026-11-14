/**
 * White label: rewrites stored texts the buyer can see that still name the
 * provider ("Diem exige revisión manual…", "Reembolso: Diem anuló la compra X").
 *
 *   npx tsx scripts/neutralize-brand-texts.ts plan  --expected-database <db>
 *   npx tsx scripts/neutralize-brand-texts.ts apply --expected-database <db>
 *
 * plan only reads and prints. apply writes a backup of every row it touches to
 * .backups/ first, then updates each row only if its text is still the one it
 * read (compare-and-set), so it is idempotent and safe to rerun. Texts with
 * "Diem" that no rule covers are listed, never guessed.
 */
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { PrismaClient } from "@prisma/client";
import { PRODUCT_NOT_MAPPED, REQUIRES_APPROVAL } from "../src/lib/codes/customer-messages";

const prisma = new PrismaClient();
const LOCK_KEY = "neutralize-brand-texts-2026-11-v1";

type Rule = { match: RegExp; to: string | ((...groups: string[]) => string) };

/** Old text (as written by earlier code) → current neutral text. */
const RULES: Rule[] = [
    { match: /^Diem exige revisión manual de esta solicitud\. No se debitó la wallet\.$/, to: REQUIRES_APPROVAL },
    { match: /^Diem no tiene una ruta automática de abastecimiento aprobada para este producto\.$/, to: "Este producto no tiene una ruta automática de abastecimiento aprobada. Requiere aprobación." },
    { match: /^Diem requiere una acción operativa antes de completar la activación\.$/, to: "La activación requiere confirmación antes de completarse." },
    { match: /^Diem no tiene stock de este producto\. (.*)$/, to: (rest) => `Sin stock por ahora. ${rest}` },
    { match: /^Sin stock en Diem; se entrega al llegar inventario$/, to: "Sin stock por ahora; se entrega al llegar inventario" },
    { match: /^El producto no está mapeado al catálogo de Diem$/, to: PRODUCT_NOT_MAPPED },
    { match: /^Diem entregó el código pero la activación (.*)$/, to: (rest) => `El código se entregó pero la activación ${rest}` },
    { match: /^Diem entregó un código para una tarjeta (.*)$/, to: (rest) => `Se entregó un código para una tarjeta ${rest}` },
    { match: /^Diem reveló (.*)$/, to: (rest) => `Se revelaron ${rest}` },
    { match: /^Diem reemplazó (un|el) código (.*)$/, to: (art, rest) => `Se reemplazó ${art} código ${rest}` },
    { match: /^Diem anuló la entrega después de completada\.([\s\S]*)$/, to: (rest) => `La entrega se anuló después de completada.${rest}` },
    { match: /^([\s\S]*)El código fue devuelto a Diem ([\s\S]*)$/, to: (a, b) => `${a}El código fue devuelto al proveedor ${b}` },
    { match: /^Reembolso: Diem anuló la (compra|activación) (\S+)$/, to: (kind, id) => `Reembolso: ${kind} ${id} anulada` },
    { match: /^Contrato Diem$/, to: "Contrato del proveedor" },
    // Messages from the provider client and other services.
    { match: /^Diem (respondió|está limitando|rechazó|devolvió|no respondió|no pudo|no canceló|detectó)([\s\S]*)$/, to: (verb, rest) => `El proveedor ${verb}${rest}` },
];

/** Mid-sentence mentions keep their preposition: "en Diem" → "en el proveedor". */
const INLINE: Array<[RegExp, string]> = [
    [/\bde Diem\b/g, "del proveedor"],
    [/\b(en|con|por) Diem\b/g, "$1 el proveedor"],
    [/\ba Diem\b/g, "al proveedor"],
    [/\b(inventario|referencia|catálogo|equipo) Diem\b/g, "$1 del proveedor"],
];

function neutralizeInline(text: string): string | null {
    const next = INLINE.reduce((acc, [pattern, to]) => acc.replace(pattern, to), text);
    return next !== text && !next.includes("Diem") ? next : null;
}

function neutralize(text: string): string | null {
    for (const rule of RULES) {
        const found = text.match(rule.match);
        if (!found) continue;
        const next = typeof rule.to === "string" ? rule.to : rule.to(...found.slice(1));
        return next.includes("Diem") ? neutralizeInline(next) : next;
    }
    return neutralizeInline(text);
}

type Target = "codePurchase" | "activationJob" | "salePriceCorrection" | "walletTransaction";
type Change = { target: Target; id: string; field: "lastError" | "description"; before: string; after: string };

async function readCandidates() {
    const contains = { contains: "Diem" };
    const [purchases, jobs, corrections, transactions] = await Promise.all([
        prisma.codePurchase.findMany({ where: { lastError: contains }, select: { id: true, lastError: true } }),
        prisma.activationJob.findMany({ where: { lastError: contains }, select: { id: true, lastError: true } }),
        prisma.salePriceCorrection.findMany({ where: { lastError: contains }, select: { id: true, lastError: true } }),
        prisma.walletTransaction.findMany({ where: { description: contains }, select: { id: true, description: true } }),
    ]);
    const rows: Array<{ target: Target; id: string; field: Change["field"]; text: string }> = [
        ...purchases.map((r) => ({ target: "codePurchase" as const, id: r.id, field: "lastError" as const, text: r.lastError! })),
        ...jobs.map((r) => ({ target: "activationJob" as const, id: r.id, field: "lastError" as const, text: r.lastError! })),
        ...corrections.map((r) => ({ target: "salePriceCorrection" as const, id: r.id, field: "lastError" as const, text: r.lastError! })),
        ...transactions.map((r) => ({ target: "walletTransaction" as const, id: r.id, field: "description" as const, text: r.description! })),
    ];
    const changes: Change[] = [];
    const unmapped: typeof rows = [];
    for (const row of rows) {
        const after = neutralize(row.text);
        if (after) changes.push({ target: row.target, id: row.id, field: row.field, before: row.text, after });
        else unmapped.push(row);
    }
    return { changes, unmapped };
}

async function applyChanges(changes: Change[]) {
    let updated = 0;
    await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${LOCK_KEY}))`;
        for (const change of changes) {
            const where = { id: change.id, [change.field]: change.before };
            const data = { [change.field]: change.after };
            const result = change.target === "codePurchase" ? await tx.codePurchase.updateMany({ where, data })
                : change.target === "activationJob" ? await tx.activationJob.updateMany({ where, data })
                    : change.target === "salePriceCorrection" ? await tx.salePriceCorrection.updateMany({ where, data })
                        : await tx.walletTransaction.updateMany({ where, data });
            updated += result.count;
        }
    }, { timeout: 120_000 });
    return updated;
}

async function main() {
    const [mode, flag, expectedDatabase] = process.argv.slice(2);
    if ((mode !== "plan" && mode !== "apply") || flag !== "--expected-database" || !expectedDatabase) {
        throw new Error("Uso: neutralize-brand-texts.ts <plan|apply> --expected-database <db>");
    }
    const [{ current_database: database }] = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
    if (database !== expectedDatabase) throw new Error(`Base inesperada: ${database}`);

    const { changes, unmapped } = await readCandidates();
    const byTarget = changes.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.target]: (acc[c.target] ?? 0) + 1 }), {});
    console.log(`Base ${database}: ${changes.length} texto(s) a neutralizar`, byTarget);
    for (const sample of changes.slice(0, 10)) console.log(`  ${sample.target}.${sample.field}: "${sample.before}" → "${sample.after}"`);
    if (unmapped.length) {
        console.log(`${unmapped.length} texto(s) con "Diem" sin regla (no se tocan):`);
        for (const row of unmapped) console.log(`  ${row.target} ${row.id}: ${row.text.slice(0, 160)}`);
    }
    if (mode === "plan" || changes.length === 0) return;

    const backup = resolve(".backups", `neutralize-brand-texts-${database}-${Date.now()}.json`);
    mkdirSync(resolve(".backups"), { recursive: true, mode: 0o700 });
    writeFileSync(backup, `${JSON.stringify({ database, changes }, null, 2)}\n`, { mode: 0o600 });
    chmodSync(backup, 0o600);
    console.log(`Respaldo: ${backup}`);
    const updated = await applyChanges(changes);
    console.log(`Actualizados ${updated} de ${changes.length} (los que cambiaron desde la lectura se omiten).`);
}

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
