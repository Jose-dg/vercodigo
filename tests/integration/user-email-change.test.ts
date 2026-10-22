/**
 * An admin changes a user's email: Clerk and the database must never end up
 * disagreeing in a way that locks the person out. Real services and database,
 * in-memory Clerk.
 *
 *   TEST_DATABASE_URL=postgresql://<user>@localhost:5432/diemsas_concurrency_test \
 *     npm run test:concurrency
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL es obligatoria");
if (!["localhost", "127.0.0.1", "::1"].includes(new URL(testDatabaseUrl).hostname)) {
    throw new Error("TEST_DATABASE_URL debe apuntar a una base local desechable");
}
process.env.DATABASE_URL = testDatabaseUrl;

type Address = { id: string; emailAddress: string };
const clerkUser = { id: "", emailAddresses: [] as Address[], primaryEmailAddressId: null as string | null, firstName: "Ana", lastName: null };
const calls: string[] = [];
let failCreate = false;
let failDelete = false;
let onDelete: (() => Promise<void>) | null = null;

const fakeClerk = {
    users: {
        getUser: async () => structuredClone(clerkUser),
        updateUser: async (_id: string, params: { primaryEmailAddressID?: string; firstName?: string }) => {
            calls.push(`updateUser:${Object.keys(params).join(",")}`);
            if (params.primaryEmailAddressID) clerkUser.primaryEmailAddressId = params.primaryEmailAddressID;
        },
        updateUserMetadata: async () => { calls.push("updateUserMetadata"); },
        banUser: async () => { calls.push("banUser"); },
        unbanUser: async () => { calls.push("unbanUser"); },
    },
    emailAddresses: {
        createEmailAddress: async (params: { emailAddress: string; primary?: boolean }) => {
            calls.push("createEmailAddress");
            if (failCreate) throw { errors: [{ code: "form_param_format_invalid", message: "Clerk rejected it" }] };
            const address = { id: `idn_${randomUUID()}`, emailAddress: params.emailAddress };
            clerkUser.emailAddresses.push(address);
            if (params.primary) clerkUser.primaryEmailAddressId = address.id;
            return address;
        },
        deleteEmailAddress: async (id: string) => {
            calls.push("deleteEmailAddress");
            if (onDelete) await onDelete();
            if (failDelete) throw new Error("Clerk delete failed");
            clerkUser.emailAddresses = clerkUser.emailAddresses.filter((address) => address.id !== id);
        },
    },
    sessions: {
        getSessionList: async () => ({ data: [] }),
        revokeSession: async () => undefined,
    },
};

let prisma: typeof import("@/lib/prisma").default;
let updateUser: typeof import("@/services/users/users.service").updateUser;
const actor = { id: "", email: "root@test.local", name: "Root", role: "SUPER_ADMIN" as const, companyId: null, storeId: null };
let userId = "";
let otherId = "";

before(async () => {
    prisma = (await import("@/lib/prisma")).default;
    ({ updateUser } = await import("@/services/users/users.service"));
    const { setClerkClientForTests } = await import("@/modules/identity/clerk-users");
    setClerkClientForTests(fakeClerk as never);
});

beforeEach(async () => {
    calls.length = 0;
    failCreate = false;
    failDelete = false;
    onDelete = null;
    await prisma.auditLog.deleteMany({ where: { entityId: { in: [userId, otherId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherId, actor.id] } } });
    const clerkId = `user_${randomUUID()}`;
    const root = await prisma.user.create({ data: { email: `root-${randomUUID()}@test.local`, name: "Root", role: "SUPER_ADMIN" } });
    const user = await prisma.user.create({
        data: { email: "ana.vieja@example.com", name: "Ana", role: "SUPER_ADMIN", clerkUserId: clerkId },
    });
    const other = await prisma.user.create({ data: { email: "ocupado@example.com", name: "Otro", role: "SUPER_ADMIN" } });
    actor.id = root.id;
    userId = user.id;
    otherId = other.id;
    clerkUser.id = clerkId;
    clerkUser.emailAddresses = [{ id: "idn_old", emailAddress: "ana.vieja@example.com" }];
    clerkUser.primaryEmailAddressId = "idn_old";
});

after(async () => {
    await prisma.auditLog.deleteMany({ where: { entityId: { in: [userId, otherId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherId, actor.id] } } });
    await prisma.$disconnect();
});

const clerkPrimary = () => clerkUser.emailAddresses.find((address) => address.id === clerkUser.primaryEmailAddressId)?.emailAddress;
const dbEmail = async () => (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).email;

test("the new email is primary in Clerk before the database changes, and old ones go only after", async () => {
    onDelete = async () => assert.equal(await dbEmail(), "ana.nueva@example.com");

    // The admin form resends unchanged fields: only the email must reach Clerk.
    await updateUser(userId, { email: "ana.nueva@example.com", name: "Ana", role: "SUPER_ADMIN" }, actor);

    assert.equal(await dbEmail(), "ana.nueva@example.com");
    assert.equal(clerkPrimary(), "ana.nueva@example.com");
    assert.deepEqual(clerkUser.emailAddresses.map((address) => address.emailAddress), ["ana.nueva@example.com"]);
    assert.deepEqual(calls, ["createEmailAddress", "deleteEmailAddress"]);
    assert.equal(await prisma.auditLog.count({ where: { entityId: userId, action: "USER_EMAIL_CHANGED" } }), 1);
});

test("if Clerk rejects the new email, nothing changes anywhere", async () => {
    failCreate = true;
    await assert.rejects(() => updateUser(userId, { email: "ana.nueva@example.com" }, actor));
    assert.equal(await dbEmail(), "ana.vieja@example.com");
    assert.equal(clerkPrimary(), "ana.vieja@example.com");
});

test("if the database rejects the email, Clerk's previous primary is restored", async () => {
    await assert.rejects(() => updateUser(userId, { email: "ocupado@example.com" }, actor));
    assert.equal(await dbEmail(), "ana.vieja@example.com");
    assert.equal(clerkPrimary(), "ana.vieja@example.com");
    assert.ok(!calls.includes("deleteEmailAddress"));
});

test("if old addresses cannot be removed, the change stands and the leftover is audited", async () => {
    failDelete = true;
    await updateUser(userId, { email: "ana.nueva@example.com" }, actor);
    assert.equal(await dbEmail(), "ana.nueva@example.com");
    assert.equal(clerkPrimary(), "ana.nueva@example.com");
    const audit = await prisma.auditLog.findFirst({ where: { entityId: userId, action: "USER_EMAIL_OLD_ADDRESS_NOT_REMOVED" } });
    assert.equal(audit?.success, false);
});
