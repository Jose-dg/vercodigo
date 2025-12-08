'use client';

import { Store } from 'lucide-react';

interface StoreData {
    id: string;
    name: string;
    code: string;
    address: string;
    phone: string;
    isActive: boolean;
}

export function StoreList({ stores }: { stores: StoreData[] }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store) => (
                <div key={store.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-blue-50 rounded-lg">
                            <Store className="w-6 h-6 text-blue-600" />
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${store.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                            {store.isActive ? 'Activa' : 'Inactiva'}
                        </span>
                    </div>

                    <h3 className="text-lg font-bold text-gray-900 mb-1">{store.name}</h3>
                    <p className="text-sm text-gray-500 mb-4">Código: {store.code}</p>

                    <div className="space-y-2 text-sm text-gray-600">
                        <p className="flex items-center gap-2">
                            <span className="font-medium">Dirección:</span> {store.address}
                        </p>
                        <p className="flex items-center gap-2">
                            <span className="font-medium">Teléfono:</span> {store.phone}
                        </p>
                    </div>

                    <div className="mt-6 pt-4 border-t flex justify-end gap-2">
                        <button className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2">
                            Editar
                        </button>
                        <button className="text-sm font-medium text-blue-600 hover:text-blue-700 px-3 py-2 bg-blue-50 rounded-lg">
                            Ver Detalles
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
