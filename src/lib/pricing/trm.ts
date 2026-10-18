/**
 * TRM oficial COP/USD y tasa mayorista derivada. Funciones puras: sin red ni base
 * de datos, para que la regla se pueda probar y compartir entre cotización y cobro.
 */

/** Dataset oficial de Superfinanciera en datos.gov.co (API Socrata, sin API key). */
export const TRM_SOURCE = "datos.gov.co/32sa-8pi3";
export const TRM_API_URL = "https://www.datos.gov.co/resource/32sa-8pi3.json";

/** Región del catálogo de Diem cuyos productos USD se cobran con la TRM. */
export const TRM_PRICED_REGION = "united_states";

/** Una TRM guardada sirve como respaldo si la API falla, hasta este número de días. */
export const TRM_MAX_STALE_DAYS = 7;

/** Rango sensato de la TRM: protege contra respuestas corruptas o de otro dataset. */
const TRM_MIN_COP = 1_000;
const TRM_MAX_COP = 20_000;

export interface TrmPeriod {
    /** TRM oficial, con los decimales que publica Superfinanciera. */
    valueCop: number;
    /** Primer y último día de vigencia (YYYY-MM-DD, hora de Bogotá). */
    validFrom: string;
    validTo: string;
}

/** Fecha de hoy en Bogotá como YYYY-MM-DD, independiente de la zona del servidor. */
export function bogotaDate(now: Date = new Date()): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(now);
}

/** Redondeo hacia abajo a la decena de pesos: 3.174,67 → 3.170. */
export function roundTrmDown(valueCop: number): number {
    return Math.floor(valueCop / 10) * 10;
}

/**
 * Tasa COP/USD a la que compran los mayoristas: TRM redondeada hacia abajo a la
 * decena más el margen de plataforma. Aquí se restará, a futuro, el descuento de
 * cada compañía sobre la TRM.
 */
export function wholesaleRateFromTrm(params: { trmCop: number; spreadCop: number }): number {
    return roundTrmDown(params.trmCop) + params.spreadCop;
}

/** URL de la consulta: la última TRM publicada con vigencia que empiece hoy o antes. */
export function trmQueryUrl(today: string): string {
    const query = new URLSearchParams({
        $where: `vigenciadesde <= '${today}T00:00:00'`,
        $order: "vigenciadesde DESC",
        $limit: "1",
    });
    return `${TRM_API_URL}?${query.toString()}`;
}

/** Interpreta la respuesta del dataset; null si no trae una TRM válida. */
export function parseTrmResponse(body: unknown): TrmPeriod | null {
    if (!Array.isArray(body) || body.length === 0) return null;
    const row = body[0] as { valor?: unknown; vigenciadesde?: unknown; vigenciahasta?: unknown };
    const valueCop = Number(row.valor);
    if (!Number.isFinite(valueCop) || valueCop < TRM_MIN_COP || valueCop > TRM_MAX_COP) return null;
    const validFrom = typeof row.vigenciadesde === "string" ? row.vigenciadesde.slice(0, 10) : "";
    const validTo = typeof row.vigenciahasta === "string" ? row.vigenciahasta.slice(0, 10) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(validFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(validTo)) return null;
    if (validTo < validFrom) return null;
    return { valueCop, validFrom, validTo };
}

/** ¿La TRM rige para `date`? Las fechas YYYY-MM-DD se comparan como texto. */
export function trmCoversDate(period: Pick<TrmPeriod, "validFrom" | "validTo">, date: string): boolean {
    return period.validFrom <= date && date <= period.validTo;
}

/** Días entre el fin de vigencia y `date` (0 si aún rige). */
export function trmStaleDays(period: Pick<TrmPeriod, "validTo">, date: string): number {
    const end = Date.parse(`${period.validTo}T00:00:00Z`);
    const today = Date.parse(`${date}T00:00:00Z`);
    return Math.max(0, Math.round((today - end) / 86_400_000));
}
