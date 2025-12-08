import { getDashboardStats } from '@/services/analytics.service';
import { Users, Store, CreditCard, DollarSign } from 'lucide-react';

export default async function SuperAdminDashboard() {
    // Mock data for initial render since we don't have real data yet
    const stats = [
        { label: 'Total Tiendas', value: '12', icon: Store, color: 'text-blue-600', bg: 'bg-blue-100' },
        { label: 'Tarjetas Activas', value: '1,234', icon: CreditCard, color: 'text-green-600', bg: 'bg-green-100' },
        { label: 'Usuarios', value: '45', icon: Users, color: 'text-purple-600', bg: 'bg-purple-100' },
        { label: 'Ventas Hoy', value: '$3,450', icon: DollarSign, color: 'text-yellow-600', bg: 'bg-yellow-100' },
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Actividad Reciente</h3>
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                                    N
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Netflix $10 activado</p>
                                    <p className="text-xs text-gray-500">Tienda Centro • hace 5 min</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Tiendas Top</h3>
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold">
                                        {i}
                                    </div>
                                    <p className="text-sm font-medium text-gray-900">Tienda {i}</p>
                                </div>
                                <p className="text-sm font-bold text-gray-900">$1,200</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
