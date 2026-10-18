import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { badRequest } from "@/lib/errors";
import {
    TRM_MAX_STALE_DAYS,
    TRM_PRICED_REGION,
    TRM_SOURCE,
    bogotaDate,
    parseTrmResponse,
    roundTrmDown,
    trmCoversDate,
    trmQueryUrl,
    trmStaleDays,
    wholesaleRateFromTrm,
    type TrmPeriod,
} from "@/lib/pricing/trm";
import { calculateCompanyRateAmount } from "@/lib/pricing/company-rate";

type Db = Prisma.TransactionClient | typeof prisma;

/** Margen en pesos sobre la TRM redondeada; vive en base de datos, editable sin deploy. */
const SPREAD_CONFIG_KEY = "TRM_SPREAD_COP";
const MAX_SPREAD_COP = 2_000;
const FETCH_TIMEOUT_MS = 4_000;
/** Tras un fallo de la API no se reintenta en cada cotización: un minuto de espera. */
const RETRY_AFTER_FAILURE_MS = 60_000;
let lastFetchFailureAt = 0;

export interface CurrentTrm extends TrmPeriod {
    source: string;
    /** true si la API no respondió y se usa la última TRM guardada (máximo 7 días). */
    stale: boolean;
}

export interface UsdWholesaleRate {
    trm: CurrentTrm;
    roundedTrmCop: number;
    spreadCop: number;
    /** Tasa COP/USD que se cobra: TRM redondeada + margen. */
    rateCopPerUsd: number;
}

function dateOnly(value: string): Date {
    return new Date(`${value}T00:00:00Z`);
}

function isoDate(value: Date): string {
    return value.toISOString().slice(0, 10);
}

async function latestStoredTrm(db: Db, today: string): Promise<CurrentTrm | null> {
    const row = await db.trmRate.findFirst({
        where: { validFrom: { lte: dateOnly(today) } },
        orderBy: { validFrom: "desc" },
    });
    if (!row) return null;
    const period = { valueCop: row.valueCop, validFrom: isoDate(row.validFrom), validTo: isoDate(row.validTo) };
    return { ...period, source: row.source, stale: !trmCoversDate(period, today) };
}

async function fetchOfficialTrm(today: string): Promise<TrmPeriod | null> {
    const response = await fetch(trmQueryUrl(today), {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`datos.gov.co respondió ${response.status}`);
    return parseTrmResponse(await response.json());
}

async function storeTrm(period: TrmPeriod): Promise<void> {
    const data = {
        valueCop: period.valueCop,
        validTo: dateOnly(period.validTo),
        source: TRM_SOURCE,
        fetchedAt: new Date(),
    };
    try {
        await prisma.trmRate.upsert({
            where: { validFrom: dateOnly(period.validFrom) },
            create: { validFrom: dateOnly(period.validFrom), ...data },
            update: data,
        });
    } catch (error) {
        // Dos cotizaciones simultáneas guardando la misma TRM: la otra ya la escribió.
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
}

/**
 * TRM vigente hoy (Bogotá). Sin cron: si la base no la tiene, la consulta a la API
 * oficial y la guarda. Con `fetchIfMissing: false` solo lee la base — obligatorio
 * dentro de una transacción, donde una llamada HTTP la dejaría abierta.
 * null si no hay TRM utilizable: el precio vuelve al costo configurado.
 */
export async function getCurrentTrm(options: { db?: Db; fetchIfMissing?: boolean } = {}): Promise<CurrentTrm | null> {
    const db = options.db ?? prisma;
    const today = bogotaDate();
    let stored = await latestStoredTrm(db, today);
    if (stored && !stored.stale) return stored;

    const mayFetch = options.fetchIfMissing !== false && Date.now() - lastFetchFailureAt > RETRY_AFTER_FAILURE_MS;
    if (mayFetch) {
        try {
            const fetched = await fetchOfficialTrm(today);
            if (fetched) {
                await storeTrm(fetched);
                stored = { ...fetched, source: TRM_SOURCE, stale: !trmCoversDate(fetched, today) };
                if (!stored.stale) return stored;
            }
        } catch (error) {
            lastFetchFailureAt = Date.now();
            console.error("[trm] No se pudo consultar la TRM oficial", error);
        }
    }

    if (stored && trmStaleDays(stored, today) <= TRM_MAX_STALE_DAYS) return stored;
    return null;
}

export async function getTrmSpreadCop(db: Db = prisma): Promise<number> {
    const row = await db.systemConfig.findUnique({ where: { key: SPREAD_CONFIG_KEY } });
    const value = Number(row?.value);
    return Number.isFinite(value) ? value : 0;
}

export async function setTrmSpreadCop(spreadCop: number): Promise<number> {
    if (!Number.isInteger(spreadCop) || spreadCop < 0 || spreadCop > MAX_SPREAD_COP) {
        throw badRequest(`El margen debe ser un entero entre 0 y ${MAX_SPREAD_COP} pesos`);
    }
    await prisma.systemConfig.upsert({
        where: { key: SPREAD_CONFIG_KEY },
        create: { key: SPREAD_CONFIG_KEY, value: String(spreadCop) },
        update: { value: String(spreadCop) },
    });
    return spreadCop;
}

/** Tasa mayorista COP/USD del día, o null si no hay TRM utilizable. */
export async function getUsdWholesaleRate(options: { db?: Db; fetchIfMissing?: boolean } = {}): Promise<UsdWholesaleRate | null> {
    const [trm, spreadCop] = await Promise.all([getCurrentTrm(options), getTrmSpreadCop(options.db)]);
    if (!trm) return null;
    return {
        trm,
        roundedTrmCop: roundTrmDown(trm.valueCop),
        spreadCop,
        rateCopPerUsd: wholesaleRateFromTrm({ trmCop: trm.valueCop, spreadCop }),
    };
}

/**
 * Lista de precios del día para productos de región USA: lo que antes se revisaba a
 * mano cada día. `configuredCost` (solo plataforma) es el costo que aplicaría sin TRM.
 */
export async function getTrmPriceList(options: { includeConfiguredCost: boolean }) {
    const [rate, denominations] = await Promise.all([
        getUsdWholesaleRate(),
        prisma.productDenomination.findMany({
            where: { currency: "USD", countryRegion: TRM_PRICED_REGION, product: { isActive: true } },
            orderBy: [{ product: { name: "asc" } }, { amount: "asc" }],
            select: {
                id: true,
                amount: true,
                product: { select: { id: true, name: true, brand: true } },
                costs: options.includeConfiguredCost
                    ? { where: { isActive: true, companyId: null }, select: { cost: true, currency: true } }
                    : false,
            },
        }),
    ]);
    return {
        rate,
        products: denominations.map((denomination) => ({
            denominationId: denomination.id,
            productId: denomination.product.id,
            productName: denomination.product.name,
            brand: denomination.product.brand,
            amountUsd: denomination.amount,
            priceCop: rate
                ? calculateCompanyRateAmount({ denominationUsd: denomination.amount, rateCopPerUsd: rate.rateCopPerUsd }).unitAmountCop
                : null,
            configuredCost: options.includeConfiguredCost ? denomination.costs?.[0] ?? null : undefined,
        })),
    };
}
