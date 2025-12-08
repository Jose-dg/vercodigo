'use client';

import { useEffect, useState, use } from 'react';
import { PinDisplay } from '@/components/scan/PinDisplay';
import { Loader2, AlertCircle } from 'lucide-react';

interface ScanResponse {
    success?: boolean;
    pin?: string;
    product?: string;
    amount?: number;
    currency?: string;
    scansRemaining?: number;
    error?: string;
    message?: string;
    store?: {
        name: string;
        phone: string;
    };
}

export default function ScanPage({ params }: { params: Promise<{ uuid: string }> }) {
    const { uuid } = use(params);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ScanResponse | null>(null);

    useEffect(() => {
        const fetchPin = async () => {
            try {
                const res = await fetch(`/api/qr/${uuid}`);
                const json = await res.json();
                setData(json);
            } catch (error) {
                setData({ error: 'Error de conexión' });
            } finally {
                setLoading(false);
            }
        };

        fetchPin();
    }, [uuid]);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
                <p className="text-gray-600">Verificando código...</p>
            </div>
        );
    }

    if (data?.error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">{data.error}</h1>
                    {data.message && (
                        <p className="text-gray-600 mb-4">{data.message}</p>
                    )}
                    {data.store && (
                        <div className="bg-gray-50 p-4 rounded-lg mt-4 text-left">
                            <p className="text-sm text-gray-500 mb-1">Tienda:</p>
                            <p className="font-semibold">{data.store.name}</p>
                            <p className="text-sm text-gray-600">{data.store.phone}</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
                <div className="bg-blue-600 p-6 text-white text-center">
                    <h1 className="text-xl font-bold mb-1">{data?.product}</h1>
                    <p className="opacity-90">
                        {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: data?.currency || 'USD',
                        }).format(data?.amount || 0)}
                    </p>
                </div>

                <PinDisplay pin={data?.pin || ''} />

                <div className="bg-gray-50 p-4 text-center border-t">
                    <p className="text-xs text-gray-500">
                        Escaneos restantes: {data?.scansRemaining}
                    </p>
                </div>
            </div>
        </div>
    );
}
