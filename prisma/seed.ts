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
                    phone: '+573001234567', // Authorized only for this store
                    companyId: company.id,
                },
            },
        },
    });
    console.log(`Created store: ${store.name}`);

    // Company-wide authorized phone (storeId: null) — authorized for every store.
    // Not a valid `upsert` target: Prisma's compound-unique lookup on (phone,
    // companyId, storeId) doesn't accept storeId: null, so guard manually.
    const companyWidePhone = await prisma.authorizedPhone.findFirst({
        where: { phone: '+573009999999', companyId: company.id, storeId: null },
    });
    if (!companyWidePhone) {
        await prisma.authorizedPhone.create({
            data: { phone: '+573009999999', companyId: company.id },
        });
    }

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

    // 5. Create one user per client-side role for manual testing
    const clientRoleUsers = [
        { email: 'owner@testcorp.com', name: 'Owner Test', role: 'OWNER' as const, companyId: company.id, storeId: null },
        { email: 'general-admin@testcorp.com', name: 'General Admin Test', role: 'GENERAL_ADMIN' as const, companyId: company.id, storeId: null },
        { email: 'admin@testcorp.com', name: 'Admin Test', role: 'ADMIN' as const, companyId: company.id, storeId: store.id },
        { email: 'operator@testcorp.com', name: 'Operator Test', role: 'OPERATOR' as const, companyId: company.id, storeId: store.id },
    ];

    for (const data of clientRoleUsers) {
        const created = await prisma.user.upsert({
            where: { email: data.email },
            update: {},
            create: { ...data, passwordHash },
        });
        console.log(`Created user: ${created.email} (${created.role})`);
    }

    // 6. Wallet (COP) + tasa FX + movimientos de ejemplo (solo dev)
    await prisma.systemConfig.upsert({
        where: { key: 'FX_USD_COP' },
        update: {},
        create: { key: 'FX_USD_COP', value: '4000' },
    });

    const wallet = await prisma.wallet.upsert({
        where: { companyId: company.id },
        update: {},
        create: { companyId: company.id, currency: 'COP' },
    });

    const hasTransactions = await prisma.walletTransaction.count({ where: { walletId: wallet.id } });
    if (hasTransactions === 0) {
        const afterRecharge = wallet.balance + 200000;
        await prisma.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: 200000 } } });
        await prisma.walletTransaction.create({
            data: {
                walletId: wallet.id,
                type: 'RECHARGE',
                method: 'MANUAL',
                amount: 200000,
                balanceAfter: afterRecharge,
                externalReference: 'TRF-DEMO-001',
                description: 'Abono inicial de ejemplo',
                createdById: user.id,
            },
        });

        const consumption = 10 * 4000; // Netflix $10 a tasa demo
        await prisma.wallet.update({ where: { id: wallet.id }, data: { balance: { decrement: consumption } } });
        await prisma.walletTransaction.create({
            data: {
                walletId: wallet.id,
                type: 'CONSUMPTION',
                amount: consumption,
                balanceAfter: afterRecharge - consumption,
                originalAmount: 10,
                originalCurrency: 'USD',
                exchangeRate: 4000,
                description: 'Consumo de ejemplo (Netflix $10)',
            },
        });
        console.log('Created wallet with demo transactions');
    }

    // 7. Precios de venta de ejemplo (Netflix por denominación, COP a tasa demo + margen)
    const netflixDenoms = await prisma.productDenomination.findMany({ where: { productId: product.id } });
    for (const d of netflixDenoms) {
        const existing = await prisma.companyProductPrice.findFirst({
            where: { companyId: company.id, productId: product.id, denominationId: d.id },
        });
        if (!existing) {
            await prisma.companyProductPrice.create({
                data: {
                    companyId: company.id,
                    productId: product.id,
                    denominationId: d.id,
                    salePrice: d.amount * 4000 * 1.15, // costo a tasa demo + 15% de margen
                    currency: 'COP',
                },
            });
        }
    }
    console.log('Created sample company prices');

    // 8. Costo global de ejemplo (lo que la plataforma cobra; 10% bajo el nominal a tasa demo)
    for (const d of netflixDenoms) {
        const existingCost = await prisma.productCost.findFirst({
            where: { companyId: null, productId: product.id, denominationId: d.id },
        });
        if (!existingCost) {
            await prisma.productCost.create({
                data: {
                    companyId: null,
                    productId: product.id,
                    denominationId: d.id,
                    cost: d.amount * 4000 * 0.9,
                    currency: 'COP',
                },
            });
        }
    }
    console.log('Created sample global product costs');

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
