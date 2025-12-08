import { getStoreStats } from '@/services/store.service';
import { CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';

export default async function StoreDashboard() {
    // Mock data
    const stats = [
        { label: 'Tarjetas Disponibles', value: '150', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-100' },
        { label: 'Activadas Hoy', value: '12', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
        { label: 'Por Reponer', value: '5', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100' },
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                {stats.map((stat) => (
                    <div key={stat.label} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                            </div>
                            <div className={`p-3 rounded-lg ${stat.bg}`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventario Crítico</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b text-gray-500">
                                <th className="pb-3 font-medium">Producto</th>
                                <th className="pb-3 font-medium">Denominación</th>
                                <th className="pb-3 font-medium">Stock</th>
                                <th className="pb-3 font-medium">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {[1, 2].map((i) => (
                                <tr key={i}>
                                    <td className="py-3 font-medium text-gray-900">Netflix</td>
                                    <td className="py-3 text-gray-600">$20,000 COP</td>
                                    <td className="py-3 text-gray-600">3</td>
                                    <td className="py-3">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                            Bajo Stock
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
