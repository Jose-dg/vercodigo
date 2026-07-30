/**
 * Test end-to-end del login y el scope por rol, vía HTTP contra un servidor
 * corriendo (dev o producción). Solo operaciones de lectura — seguro contra
 * cualquier base.
 *
 * Uso:
 *   BASE_URL=http://localhost:3000 TEST_EMAIL=... TEST_PASSWORD=... npx tsx scripts/test-login.ts
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

let failures = 0;

function check(label: string, ok: boolean, detail = "") {
    console.log(`${ok ? "✅" : "❌"} ${label}${detail ? `: ${detail}` : ""}`);
    if (!ok) failures++;
}

/** Login con el flujo real de NextAuth (csrf → callback/credentials → cookie de sesión). */
async function login(email: string, password: string): Promise<string | null> {
    const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
    const { csrfToken } = await csrfRes.json();
    const csrfCookie = csrfRes.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

    const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: csrfCookie,
        },
        body: new URLSearchParams({ csrfToken, email, password, json: "true" }),
        redirect: "manual",
    });

    const sessionCookie = loginRes
        .headers.getSetCookie()
        .map((c) => c.split(";")[0])
        .find((c) => c.includes("session-token"));

    return sessionCookie ? `${csrfCookie}; ${sessionCookie}` : null;
}

async function getJson(path: string, cookie: string | null) {
    const res = await fetch(`${BASE_URL}${path}`, { headers: cookie ? { Cookie: cookie } : {} });
    let body: any = null;
    try { body = await res.json(); } catch { /* no-json */ }
    return { status: res.status, body };
}

async function main() {
    if (!EMAIL || !PASSWORD) {
        console.error("Faltan TEST_EMAIL y TEST_PASSWORD en el entorno.");
        process.exit(1);
    }

    console.log(`Probando contra ${BASE_URL} con ${EMAIL}\n`);

    // 1. Password incorrecto NO debe dar sesión
    const badCookie = await login(EMAIL, "password-incorrecto-123");
    check("[1] Password incorrecto rechazado", badCookie === null);

    // 2. Login correcto entrega cookie de sesión
    const cookie = await login(EMAIL, PASSWORD);
    check("[2] Login correcto entrega sesión", cookie !== null);
    if (!cookie) process.exit(1);

    // 3. La sesión trae rol y companyId
    const session = await getJson("/api/auth/session", cookie);
    const su = session.body?.user;
    check("[3] Sesión con rol y compañía", !!su?.role && !!su?.companyId, `role=${su?.role}, companyId=${su?.companyId?.slice(0, 8)}…`);

    // 4. Sin sesión, /api/users responde 401
    const anon = await getJson("/api/users", null);
    check("[4] /api/users sin sesión → 401", anon.status === 401, `status=${anon.status}`);

    // 5. Con sesión, /api/users responde solo usuarios de SU compañía
    const users = await getJson("/api/users", cookie);
    const allSameCompany =
        Array.isArray(users.body) &&
        users.body.every((u: any) => u.companyId === su.companyId || u.role === "SUPER_ADMIN" || u.role === "SYSTEM_ADMIN");
    // Nota: getUsers filtra por companyId para roles de compañía, así que no
    // deberían aparecer usuarios de otras compañías en absoluto:
    const strictScope = Array.isArray(users.body) && users.body.every((u: any) => u.companyId === su.companyId);
    check("[5] /api/users scoped a su compañía", users.status === 200 && strictScope, `status=${users.status}, usuarios=${Array.isArray(users.body) ? users.body.length : "?"}, allSame=${allSameCompany}`);

    // 6. Wallet: ve la suya (scope company), no el listado de plataforma
    const wallets = await getJson("/api/wallets", cookie);
    check("[6] /api/wallets scope de compañía", wallets.status === 200 && wallets.body?.scope === "company", `scope=${wallets.body?.scope}, balance=${wallets.body?.wallet?.balance}`);

    // 7. Costos: solo plataforma → 403 para usuario de compañía
    const costs = await getJson("/api/costs", cookie);
    check("[7] /api/costs prohibido para compañía", costs.status === 403, `status=${costs.status}`);

    // 8. Precios: permitido (lectura de su catálogo)
    const prices = await getJson("/api/prices", cookie);
    check("[8] /api/prices permitido", prices.status === 200 && Array.isArray(prices.body?.rows), `status=${prices.status}, filas=${prices.body?.rows?.length}`);

    // 9. Overview de su empresa
    const overview = await getJson("/api/company/overview", cookie);
    check("[9] /api/company/overview permitido", overview.status === 200 && overview.body?.stats != null, `status=${overview.status}, locales=${overview.body?.byStore?.length}`);

    console.log(`\n${failures === 0 ? "✅ Todos los tests pasaron" : `❌ ${failures} test(s) fallaron`}`);
    process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
    console.error("❌ Error inesperado:", e.message);
    process.exit(1);
});
