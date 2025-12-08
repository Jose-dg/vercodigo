import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding ...');

    // 1. Create Company
    const company = await prisma.company.upsert({
        where: { taxId: '900123456' },
        update: {},
        create: {
            name: 'Diem SAS',
            taxId: '900123456',
            email: 'admin@diemsas.com',
            phone: '+573000000000',
            billingFrequency: 'DAILY',
            commissionRate: 0.05,
        },
    });
    console.log(`Created company: ${company.name}`);

    // 2. Create Store
    const store = await prisma.store.upsert({
        where: { code: 'STORE-001' },
        update: {},
        create: {
            name: 'Tienda Principal',
            code: 'STORE-001',
            address: 'Calle 123 # 45-67',
            phone: '+573111111111',
            companyId: company.id,
            authorizedPhones: {
                create: {
                    phone: '+573001234567', // Authorized phone for activation
                },
            },
        },
    });
    console.log(`Created store: ${store.name}`);

    // 3. Create Product (Netflix)
    const product = await prisma.product.upsert({
        where: { sku: 'NFLX-USD' },
        update: {},
        create: {
            name: 'Netflix Gift Card',
            sku: 'NFLX-USD',
            brand: 'Netflix',
            category: 'Entertainment',
            denominations: {
                create: [
                    { amount: 10, currency: 'USD' },
                    { amount: 20, currency: 'USD' },
                    { amount: 50, currency: 'USD' },
                ],
            },
        },
    });
    console.log(`Created product: ${product.name}`);

    // 4. Create User (Super Admin)
    const passwordHash = await hash('admin123', 10);
    const user = await prisma.user.upsert({
        where: { email: 'admin@diemsas.com' },
        update: {},
        create: {
            email: 'admin@diemsas.com',
            name: 'Super Admin',
            passwordHash,
            role: 'SUPER_ADMIN',
            companyId: company.id,
        },
    });
    console.log(`Created user: ${user.email}`);

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
