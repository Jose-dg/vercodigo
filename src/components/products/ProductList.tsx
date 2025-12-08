'use client';

import { Package, MoreVertical } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface ProductData {
    id: string;
    name: string;
    sku: string;
    brand: string;
    isActive: boolean;
    denominations: { amount: number; currency: string }[];
}

export function ProductList({ products }: { products: ProductData[] }) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="grid grid-cols-1 divide-y">
                {products.map((product) => (
                    <div key={product.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                <Package className="w-6 h-6 text-gray-500" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">{product.name}</h3>
                                <p className="text-sm text-gray-500">{product.brand} • SKU: {product.sku}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-8">
                            <div className="text-right">
                                <p className="text-sm font-medium text-gray-900">Denominaciones</p>
                                <p className="text-sm text-gray-500">
                                    {product.denominations.map(d => formatCurrency(d.amount, d.currency)).join(', ')}
                                </p>
                            </div>

                            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                                <MoreVertical className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
