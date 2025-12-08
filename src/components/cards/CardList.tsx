'use client';

import { useState } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CheckCircle2, XCircle, QrCode } from 'lucide-react';

interface Card {
    id: string;
    uuid: string;
    isActivated: boolean;
    isRedeemed: boolean;
    product: { name: string };
    store: { name: string };
    createdAt: string;
}

export function CardList({ initialCards }: { initialCards: Card[] }) {
    const [cards] = useState(initialCards);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-4 font-medium text-gray-500">UUID</th>
                            <th className="px-6 py-4 font-medium text-gray-500">Producto</th>
                            <th className="px-6 py-4 font-medium text-gray-500">Tienda</th>
                            <th className="px-6 py-4 font-medium text-gray-500">Estado</th>
                            <th className="px-6 py-4 font-medium text-gray-500">Fecha</th>
                            <th className="px-6 py-4 font-medium text-gray-500">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {cards.map((card) => (
                            <tr key={card.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 font-mono text-gray-600">{card.uuid}</td>
                                <td className="px-6 py-4 font-medium text-gray-900">{card.product.name}</td>
                                <td className="px-6 py-4 text-gray-600">{card.store.name}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        {card.isActivated ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                Activada
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                Inactiva
                                            </span>
                                        )}
                                        {card.isRedeemed && (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                Canjeada
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-gray-500">{formatDate(card.createdAt)}</td>
                                <td className="px-6 py-4">
                                    <button className="text-blue-600 hover:text-blue-800">
                                        <QrCode className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
