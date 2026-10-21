/**
 * Behavioural tests for POST /api/webhook/clerk: real svix signatures and a
 * disposable LOCAL PostgreSQL database. It refuses to run against any non-local
 * database.
 *
 *   TEST_DATABASE_URL=postgresql://<user>@localhost:5432/diemsas_concurrency_test \
 *     npm run test:concurrency
 */
import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL es obligatoria");
if (!["localhost", "127.0.0.1", "::1"].includes(new URL(testDatabaseUrl).hostname)) {
    throw new Error("TEST_DATABASE_URL debe apuntar a una base local desechable");
}
process.env.DATABASE_URL = testDatabaseUrl;

const secretBytes = randomBytes(24);
process.env.CLERK_WEBHOOK_SIGNING_SECRET = `whsec_${secretBytes.toString("base64")}`;

// Loaded after DATABASE_URL points at the disposable database.
let prisma: typeof import("@/lib/prisma").default;
let POST: typeof import("@/app/api/webhook/clerk/route").POST;

const CLERK_ID = `user_test_${randomUUID()}`;
let userId = "";
let otherUserId = "";

function signedRequest(payload: unknown, secret: Buffer = secretBytes) {
    const body = JSON.stringify(payload);
    const id = `msg_${randomUUID()}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", secret).update(`${id}.${timestamp}.${body}`).digest("base64");
    return new Request("http://localhost/api/webhook/clerk", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "svix-id": id,
            "svix-timestamp": timestamp,
            "svix-signature": `v1,${signature}`,
        },
        body,
    }) as unknown as Parameters<typeof POST>[0];
}

function userUpdated(overrides: Record<string, unknown> = {}) {
    return {
        type: "user.updated",
        object: "event",
        data: {
            id: CLERK_ID,
            object: "user",
            first_name: "Ana",
            last_name: "Pérez",
            primary_email_address_id: "idn_1",
            email_addresses: [{ id: "idn_1", object: "email_address", email_address: "ana.webhook@example.com" }],
            password_last_updated_at: null,
            ...overrides,
        },
    };
}

async function current() {
    return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, name: true, passwordAssignedAt: true } });
}

before(async () => {
    prisma = (await import("@/lib/prisma")).default;
    ({ POST } = await import("@/app/api/webhook/clerk/route"));
});

beforeEach(async () => {
    await prisma.auditLog.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    const user = await prisma.user.create({
        data: { email: "ana.webhook@example.com", name: "Ana Pérez", role: "SUPER_ADMIN", clerkUserId: CLERK_ID },
    });
    const other = await prisma.user.create({
        data: { email: "ocupado.webhook@example.com", name: "Otro", role: "SUPER_ADMIN" },
    });
    userId = user.id;
    otherUserId = other.id;
});

after(async () => {
    await prisma.auditLog.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await prisma.$disconnect();
});

test("rechaza una firma inválida sin tocar la base", async () => {
    const response = await POST(signedRequest(userUpdated({ first_name: "Hacker" }), randomBytes(24)));
    assert.equal(response.status, 400);
    assert.equal((await current()).name, "Ana Pérez");
});

test("copia el correo principal normalizado y el nombre, y deja auditoría", async () => {
    const response = await POST(signedRequest(userUpdated({
        first_name: "Ana María",
        email_addresses: [
            { id: "idn_1", object: "email_address", email_address: "ana.webhook@example.com" },
            { id: "idn_2", object: "email_address", email_address: " Ana.Nueva@Example.com " },
        ],
        primary_email_address_id: "idn_2",
    })));
    assert.equal(response.status, 200);
    const user = await current();
    assert.equal(user.email, "ana.nueva@example.com");
    assert.equal(user.name, "Ana María Pérez");
    const audit = await prisma.auditLog.findFirst({ where: { userId, action: "user.profile_synced_from_clerk" } });
    assert.ok(audit?.success);
});

test("sin cambios no escribe nada (idempotente)", async () => {
    const response = await POST(signedRequest(userUpdated()));
    assert.deepEqual(await response.json(), { success: true, unchanged: true });
    assert.equal(await prisma.auditLog.count({ where: { userId } }), 0);
});

test("un correo que ya usa otro usuario no se copia, pero el resto sí", async () => {
    await POST(signedRequest(userUpdated({
        first_name: "Ana Lucía",
        email_addresses: [{ id: "idn_1", object: "email_address", email_address: "ocupado.webhook@example.com" }],
    })));
    const user = await current();
    assert.equal(user.email, "ana.webhook@example.com");
    assert.equal(user.name, "Ana Lucía Pérez");
    const audit = await prisma.auditLog.findFirst({ where: { userId, action: "user.profile_synced_from_clerk" } });
    assert.equal(audit?.success, false);
});

test("apaga el aviso solo si la contraseña cambió después de que el admin la asignara", async () => {
    const assignedAt = new Date("2026-10-21T15:00:00Z");
    await prisma.user.update({ where: { id: userId }, data: { passwordAssignedAt: assignedAt } });

    await POST(signedRequest(userUpdated({ password_last_updated_at: assignedAt.getTime() - 1000 })));
    assert.deepEqual((await current()).passwordAssignedAt, assignedAt);

    await POST(signedRequest(userUpdated({ password_last_updated_at: assignedAt.getTime() + 1000 })));
    assert.equal((await current()).passwordAssignedAt, null);
});

test("ignora usuarios de Clerk que no son del portal y otros eventos", async () => {
    const unknown = await POST(signedRequest(userUpdated({ id: "user_desconocido" })));
    assert.deepEqual(await unknown.json(), { success: true, ignored: true });
    const created = await POST(signedRequest({ ...userUpdated({ first_name: "Otra" }), type: "user.created" }));
    assert.deepEqual(await created.json(), { success: true, ignored: true });
    assert.equal((await current()).name, "Ana Pérez");
});
