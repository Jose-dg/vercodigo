import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getInitialMetrics } from '@/lib/analytics/queries';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const data = await getInitialMetrics(body.filters || {});

        const workbook = new ExcelJS.Workbook();

        // Products Sheet
        const productsSheet = workbook.addWorksheet('Productos');
        productsSheet.columns = [
            { header: 'Producto', key: 'productName', width: 30 },
            { header: 'Marca', key: 'brand', width: 20 },
            { header: 'Total Tarjetas', key: 'totalCards', width: 15 },
            { header: 'Activadas', key: 'activatedCards', width: 15 },
            { header: 'Tasa Activación', key: 'activationRate', width: 15 },
            { header: 'Ingresos', key: 'revenue', width: 15 },
        ];
        productsSheet.addRows(data.products);

        // Stores Sheet
        const storesSheet = workbook.addWorksheet('Tiendas');
        storesSheet.columns = [
            { header: 'Tienda', key: 'storeName', width: 30 },
            { header: 'Activaciones', key: 'activations', width: 15 },
            { header: 'Ingresos', key: 'revenue', width: 15 },
            { header: 'Utilidad Bruta', key: 'grossProfit', width: 15 },
        ];
        storesSheet.addRows(data.stores);

        // Financial Sheet
        const financialSheet = workbook.addWorksheet('Financiero');
        financialSheet.columns = [
            { header: 'Fecha', key: 'date', width: 15 },
            { header: 'Ingresos', key: 'revenue', width: 15 },
            { header: 'Utilidad Bruta', key: 'grossProfit', width: 15 },
            { header: 'Comisiones', key: 'commissions', width: 15 },
        ];
        financialSheet.addRows(data.financial);

        const buffer = await workbook.xlsx.writeBuffer();

        return new Response(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename=analytics-export-${new Date().getTime()}.xlsx`,
            },
        });
    } catch (error) {
        console.error('Export Error:', error);
        return NextResponse.json({ error: 'Internal error during export' }, { status: 500 });
    }
}
