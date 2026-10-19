/**
 * Importa los usuarios existentes a Clerk conservando su contraseña (hash bcrypt de
 * NextAuth) y guarda `clerkUserId`. Idempotente: salta a quien ya tiene clerkUserId
 * y vincula (sin duplicar) si el correo ya existe en Clerk.
 *
 * Uso (por defecto solo muestra lo que haría):
 *   CLERK_SECRET_KEY=sk_... DATABASE_URL=... npm run clerk:import-users
 *   CLERK_SECRET_KEY=sk_... DATABASE_URL=... npm run clerk:import-users -- --apply
 *
 * Correrlo primero con la instancia de desarrollo de Clerk y una base de ensayo.
 */
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");

async function main() {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) throw new Error("Falta CLERK_SECRET_KEY");
    const clerk = createClerkClient({ secretKey });
    const prisma = new PrismaClient();

    try {
        const users = await prisma.user.findMany({
            where: { clerkUserId: null },
            select: { id: true, email: true, name: true, role: true, isActive: true, passwordHash: true },
            orderBy: { createdAt: "asc" },
        });
        console.log(`${users.length} usuario(s) sin clerkUserId${apply ? "" : " (simulación: agrega --apply para escribir)"}`);

        for (const user of users) {
            const existing = await clerk.users.getUserList({ emailAddress: [user.email] });
            if (existing.data.length > 0) {
                console.log(`  vincular  ${user.email} → ${existing.data[0].id} (ya existía en Clerk)`);
                if (apply) {
                    await prisma.user.update({ where: { id: user.id }, data: { clerkUserId: existing.data[0].id } });
                }
                continue;
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
    console.error(error);
    process.exit(1);
});
