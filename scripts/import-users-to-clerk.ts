/**
 * Importa los usuarios existentes a Clerk conservando su contraseña (hash bcrypt de
 * NextAuth) y guarda `clerkUserId`. Idempotente: salta a quien ya tiene clerkUserId
 * y vincula (sin duplicar) si el correo ya existe en Clerk.
 *
 * Uso (por defecto solo muestra lo que haría):
 *   CLERK_SECRET_KEY=sk_... DATABASE_URL=... npm run clerk:import-users
 *   CLERK_SECRET_KEY=sk_... DATABASE_URL=... npm run clerk:import-users -- --apply
 *
 * Un solo usuario, exigiendo que su cuenta de Clerk sea la esperada:
 *   ... npm run clerk:import-users -- --email ana@empresa.com --expect-clerk-id user_... [--apply]
 *
 * Correrlo primero con la instancia de desarrollo de Clerk y una base de ensayo.
 */
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");

function argValue(name: string): string | undefined {
    const index = process.argv.indexOf(name);
    if (index === -1) return undefined;
    const value = process.argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Falta el valor de ${name}`);
    return value;
}

async function main() {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) throw new Error("Falta CLERK_SECRET_KEY");
    const email = argValue("--email")?.trim().toLowerCase();
    const expectedClerkId = argValue("--expect-clerk-id");
    if (expectedClerkId && !email) throw new Error("--expect-clerk-id requiere --email");

    const clerk = createClerkClient({ secretKey });
    const prisma = new PrismaClient();

    try {
        const users = await prisma.user.findMany({
            where: { clerkUserId: null, ...(email ? { email } : {}) },
            select: { id: true, email: true, name: true, role: true, isActive: true, passwordHash: true },
            orderBy: { createdAt: "asc" },
        });
        console.log(`${users.length} usuario(s) sin clerkUserId${apply ? "" : " (simulación: agrega --apply para escribir)"}`);

        if (email && users.length === 0) {
            const linked = await prisma.user.findUnique({ where: { email }, select: { clerkUserId: true } });
            throw new Error(linked
                ? `${email} ya está vinculado a ${linked.clerkUserId}`
                : `${email} no existe en la base: hay que crearlo con su empresa, sede y rol`);
        }

        for (const user of users) {
            const existing = await clerk.users.getUserList({ emailAddress: [user.email] });
            if (existing.data.length > 0) {
                const clerkUser = existing.data[0];
                if (expectedClerkId && clerkUser.id !== expectedClerkId) {
                    throw new Error(`${user.email} es ${clerkUser.id} en Clerk, no ${expectedClerkId}; nada se escribió`);
                }
                console.log(`  vincular  ${user.email} → ${clerkUser.id} (ya existía en Clerk, rol ${user.role})`);
                if (apply) {
                    // El rol viaja en la sesión para el filtro del proxy, como en createClerkUser.
                    await clerk.users.updateUserMetadata(clerkUser.id, { publicMetadata: { role: user.role } });
                    await prisma.user.update({ where: { id: user.id }, data: { clerkUserId: clerkUser.id } });
                }
                continue;
            }

            if (expectedClerkId) {
                throw new Error(`${user.email} no tiene cuenta en Clerk (se esperaba ${expectedClerkId}); nada se escribió`);
            }

            const hasBcrypt = Boolean(user.passwordHash?.startsWith("$2"));
            console.log(`  crear     ${user.email} (${user.role}${user.isActive ? "" : ", inactivo"}${hasBcrypt ? ", conserva su clave" : ", sin clave"})`);
            if (!apply) continue;

            const created = await clerk.users.createUser({
                emailAddress: [user.email],
                firstName: user.name,
                publicMetadata: { role: user.role },
                ...(hasBcrypt
                    ? { passwordDigest: user.passwordHash!, passwordHasher: "bcrypt" as const }
                    : { skipPasswordRequirement: true }),
            });
            await prisma.user.update({ where: { id: user.id }, data: { clerkUserId: created.id } });
            if (!user.isActive) await clerk.users.banUser(created.id);
        }
        console.log(apply ? "Listo." : "Simulación terminada; nada se escribió.");
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
