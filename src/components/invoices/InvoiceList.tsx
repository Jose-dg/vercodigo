'use client';

import { FileText, Download } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

interface InvoiceData {
    id: string;
    invoiceNumber: string;
    periodStart: string;
    periodEnd: string;
    totalAmount: number;
    status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    company: { name: string };
}

export function InvoiceList({ invoices }: { invoices: InvoiceData[] }) {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PAID': return 'bg-green-100 text-green-800';
            case 'PENDING': return 'bg-yellow-100 text-yellow-800';
            case 'OVERDUE': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="px-6 py-4 font-medium text-gray-500">Factura #</th>
                        <th className="px-6 py-4 font-medium text-gray-500">Compañía</th>
                        <th className="px-6 py-4 font-medium text-gray-500">Periodo</th>
                        <th className="px-6 py-4 font-medium text-gray-500">Monto</th>
                        <th className="px-6 py-4 font-medium text-gray-500">Estado</th>
                        <th className="px-6 py-4 font-medium text-gray-500">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {invoices.map((invoice) => (
                        <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-gray-400" />
                                {invoice.invoiceNumber}
                            </td>
                            <td className="px-6 py-4 text-gray-600">{invoice.company.name}</td>
                            <td className="px-6 py-4 text-gray-500">
                                {new Date(invoice.periodStart).toLocaleDateString()} - {new Date(invoice.periodEnd).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 font-medium text-gray-900">
                                {formatCurrency(invoice.totalAmount)}
                            </td>
                            <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                                    {invoice.status}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <button className="text-gray-400 hover:text-gray-600">
                                    <Download className="w-5 h-5" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
