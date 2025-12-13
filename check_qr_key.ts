import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const card = await prisma.card.findUnique({
        where: { uuid: '8XZNXQDT' },
        include: { key: true },
    });

    if (card) {
        console.log(`QR Found: ${card.uuid}`);
        console.log(`Key Associated: ${card.key ? 'YES' : 'NO'}`);
        if (card.key) {
            console.log(`Key Code: ${card.key.code}`);
            console.log(`Key ID: ${card.key.id}`);
        }
    } else {
        console.log('QR Not Found');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
