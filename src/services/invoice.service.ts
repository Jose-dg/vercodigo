import prisma from '@/lib/prisma';

export async function generateDailyInvoices() {
    const companies = await prisma.company.findMany({
        where: {
            isActive: true,
            billingFrequency: 'DAILY',
        },
        include: { stores: true },
    });

    const results = [];

    for (const company of companies) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Obtener activaciones del día anterior
        const activations = await prisma.cardActivation.findMany({
            where: {
                storeId: { in: company.stores.map((s: { id: string }) => s.id) },
                activatedAt: {
                    gte: yesterday,
                    lt: today,
                },
            },
            include: {
                card: {
                    include: {
                        product: true,
                        denomination: true,
                    },
                },
            },
        });

        if (activations.length === 0) continue;

        // Agrupar por producto y denominación
        const grouped = activations.reduce((acc: any, act: any) => {
            const key = `${act.card.productId}-${act.card.denominationId}`;
            if (!acc[key]) {
                acc[key] = {
                    product: act.card.product,
                    denomination: act.card.denomination,
                    count: 0,
                    total: 0,
                };
            }
            acc[key].count++;
            acc[key].total += act.card.denomination?.amount || act.card.customAmount || 0;
            return acc;
        }, {} as any);

        // Crear factura
        const totalSales = Object.values(grouped).reduce((sum: number, item: any) => sum + item.total, 0);
        const commissionAmount = totalSales * company.commissionRate;

        const invoice = await prisma.invoice.create({
            data: {
                invoiceNumber: `INV-${company.id.slice(0, 4)}-${Date.now()}`,
                companyId: company.id,
                periodStart: yesterday,
                periodEnd: today,
                totalSales,
                commissionRate: company.commissionRate,
                commissionAmount,
                totalAmount: commissionAmount,
                status: 'PENDING',
            },
        });

        // Crear items
        for (const [key, item] of Object.entries(grouped) as any) {
            await prisma.invoiceItem.create({
                data: {
                    invoiceId: invoice.id,
                    description: `${item.product.name} $${item.denomination?.amount || 'Custom'} - ${item.count} unidades`,
                    quantity: item.count,
                    unitPrice: item.denomination?.amount || 0,
                    totalPrice: item.total,
                },
            });
        }

        results.push(invoice);
    }

    return results;
}
