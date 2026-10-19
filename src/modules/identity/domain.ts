/**
 * Reglas puras de identidad y acceso: sin Prisma, sin red y sin APIs exclusivas de
 * Node o del navegador (lo aleatorio y el hash se inyectan), para usarlas en el
 * servidor, en el formulario y en los tests.
 */

/** El correo se guarda y se compara sin espacios y en minúsculas (CHECK en la base). */
export function normalizeEmail(raw: string): string {
    return raw.trim().toLowerCase();
}

/**
 * Destino seguro después de iniciar sesión: solo rutas internas del portal. Acepta la
 * URL absoluta del mismo origen que agrega NextAuth (`callbackUrl=https://…/ruta`) y
 * rechaza otros dominios, `//host` y esquemas (redirección abierta). null si no sirve.
 */
export function safeCallbackPath(raw: string | null | undefined, origin: string): string | null {
    const value = raw?.trim();
    if (!value) return null;
    let url: URL;
    try {
        url = new URL(value, origin);
    } catch {
        return null;
    }
    if (url.origin !== new URL(origin).origin) return null;
    if (value.startsWith("//")) return null;
    const path = `${url.pathname}${url.search}${url.hash}`;
    // Volver a la pantalla de login no es un destino.
    if (path === "/login" || path.startsWith("/login?")) return null;
    return path;
}

const WORDS = [
    "Mango", "Rio", "Sol", "Luna", "Cafe", "Cielo", "Nube", "Monte", "Lago", "Faro",
    "Brisa", "Coral", "Trigo", "Arena", "Bosque", "Fuego", "Hielo", "Perla", "Roble", "Valle",
    "Cometa", "Delta", "Ambar", "Canela", "Jade", "Lince", "Puma", "Tigre", "Zorro", "Halcon",
];

/**
 * Contraseña inicial que asigna el admin: segura y fácil de dictar
 * (p. ej. "Mango-Rio-4827"). `randomInt(max)` debe devolver un entero uniforme en
 * [0, max): `crypto.randomInt` en el servidor o Web Crypto en el navegador.
 */
export function generateReadablePassword(randomInt: (max: number) => number): string {
    const word = () => WORDS[randomInt(WORDS.length)];
    const digits = String(randomInt(10_000)).padStart(4, "0");
    return `${word()}-${word()}-${word()}-${digits}`;
}

export type PasswordIssue = "too_short" | "contains_email";

export const PASSWORD_MIN_LENGTH = 10;

/** Requisitos visibles en el formulario; vacío = cumple. */
export function passwordIssues(password: string, email?: string | null): PasswordIssue[] {
    const issues: PasswordIssue[] = [];
    if (password.length < PASSWORD_MIN_LENGTH) issues.push("too_short");
    const localPart = email ? normalizeEmail(email).split("@")[0] : "";
    if (localPart.length >= 4 && password.toLowerCase().includes(localPart)) issues.push("contains_email");
    return issues;
}

export const PASSWORD_ISSUE_LABELS: Record<PasswordIssue, string> = {
    too_short: `Al menos ${PASSWORD_MIN_LENGTH} caracteres`,
    contains_email: "No puede contener tu correo",
};
