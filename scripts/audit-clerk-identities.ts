/**
 * Compara el correo de cada usuario del portal con su cuenta de Clerk. Sirve para
 * encontrar (y reparar) cuentas que no pueden entrar porque la base y Clerk no
 * coinciden, por ejemplo tras un cambio de correo hecho por un admin.
 *
 * Por defecto solo lee:
 *   CLERK_SECRET_KEY=sk_live_... DATABASE_URL=... npm run clerk:audit
 *
 * Reparar un usuario (la base manda: su correo queda como principal en Clerk y los
 * demás se borran):
 *   ... npm run clerk:audit -- --fix <userId>
 */
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";

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
    const fixUserId = argValue("--fix");
    const clerk = createClerkClient({ secretKey });
    const prisma = new PrismaClient();

    try {
        const users = await prisma.user.findMany({
            where: fixUserId ? { id: fixUserId } : {},
            select: { id: true, email: true, name: true, isActive: true, clerkUserId: true },
            orderBy: { createdAt: "asc" },
        });
        if (fixUserId && users.length === 0) throw new Error(`No existe el usuario ${fixUserId}`);

        let problems = 0;
        for (const user of users) {
            if (!user.clerkUserId) {
                problems += 1;
                console.log(`SIN_CLERK  ${user.id}  ${user.email}  (sin cuenta vinculada: no puede entrar)`);
                continue;
            }
            let account;
            try {
                account = await clerk.users.getUser(user.clerkUserId);
            } catch {
                problems += 1;
                console.log(`CLERK_404  ${user.id}  ${user.email}  (${user.clerkUserId} no existe en Clerk)`);
                continue;
            }
            const emails = account.emailAddresses.map((address) => address.emailAddress.toLowerCase());
            const primary = account.emailAddresses
                .find((address) => address.id === account.primaryEmailAddressId)?.emailAddress.toLowerCase() ?? null;
            if (primary === user.email && emails.length === 1) continue;

            problems += 1;
            const kind = emails.includes(user.email) ? "PRIMARIO " : "FALTA    ";
            console.log(`${kind} ${user.id}  base=${user.email}  clerk.principal=${primary ?? "-"}  clerk.todos=[${emails.join(", ")}]`);

            if (fixUserId) {
                const existing = account.emailAddresses.find((address) => address.emailAddress.toLowerCase() === user.email);
                const target = existing
                    ?? await clerk.emailAddresses.createEmailAddress({
                        userId: user.clerkUserId, emailAddress: user.email, verified: true, primary: true,
                    });
                if (existing) await clerk.users.updateUser(user.clerkUserId, { primaryEmailAddressID: existing.id });
                const after = await clerk.users.getUser(user.clerkUserId);
                for (const address of after.emailAddresses) {
                    if (address.id !== target.id) await clerk.emailAddresses.deleteEmailAddress(address.id);
                }
                console.log(`  reparado: ${user.email} es el único correo de ${user.clerkUserId}`);
            }
        }
        console.log(`${users.length} revisado(s), ${problems} con diferencias${fixUserId ? "" : " (solo lectura; usa --fix <userId> para reparar uno)"}`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
