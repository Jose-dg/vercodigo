'use client';

import { useEffect, useState, use } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Copy, Check, CheckCircle } from 'lucide-react';

interface ScanResponse {
    success?: boolean;
    key?: string;
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
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const fetchKey = async () => {
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

        fetchKey();
    }, [uuid]);

    const handleCopy = async () => {
        if (!data?.key) return;
        // limpiar saltos de línea / espacios para copiarlo limpio
        const cleanedKey = data.key.replace(/\s+/g, '');
        try {
            await navigator.clipboard.writeText(cleanedKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Error al copiar el código', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
                <p className="text-gray-600 text-center">Verificando código...</p>
            </div>
        );
    }

    if (data?.error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
                <Card className="w-full max-w-md text-center p-6 sm:p-8">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        {data.error}
                    </h1>
                    {data.message && (
                        <p className="text-gray-600 mb-4">
                            {data.message}
                        </p>
                    )}
                </Card>
            </div>
        );
    }

    // Éxito: vista con scratch + chulito
    // Limpiamos el key para mostrarlo en una sola línea
    const rawKey = data?.key || '';
    const displayKey = rawKey.replace(/\s+/g, '');

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8">
            <Card className="w-full max-w-md sm:max-w-lg rounded-2xl shadow-xl overflow-hidden">
                {/* HEADER */}
                <CardHeader className="bg-blue-600 text-white text-center py-6">
                    <h1 className="text-lg sm:text-xl font-bold mb-1">
                        {data?.product}
                    </h1>
                </CardHeader>

                {/* CONTENIDO */}
                <CardContent className="py-6 space-y-5">
                    {/* CHULITO VERDE ENCIMA DEL RECUADRO */}
                    <div className="flex justify-center mb-1">
                        <CheckCircle className="w-10 h-10 text-green-600 drop-shadow-sm" />
                    </div>

                    {/* RECUADRO SCRATCH CON EL PIN */}
                    <div
                        className="
                            w-full
                            border-2 border-dashed border-gray-400
                            bg-gray-100
                            rounded-xl
                            p-4
                            flex items-center justify-center
                            overflow-x-auto
                        "
                    >
                        <span
                            className="
                                font-mono
                                text-lg sm:text-xl
                                whitespace-nowrap
                                tracking-[0.25em]
                                text-gray-900
                            "
                        >
                            {displayKey}
                        </span>
                    </div>

                    {/* BOTÓN COPIAR */}
                    <div className="flex justify-center">
                        <Button
                            variant="outline"
                            onClick={handleCopy}
                            className="flex items-center gap-2"
                            disabled={!data?.key}
                        >
                            {copied ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    Código copiado
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4" />
                                    Copiar código
                                </>
                            )}
                        </Button>
                    </div>

                    {/* MENSAJE DE SEGURIDAD */}
                    <p className="text-xs sm:text-sm text-gray-500 text-center leading-relaxed">
                        Guarda este código. Solo puedes verlo un número limitado de veces por seguridad.
                    </p>
                </CardContent>

                {/* FOOTER */}
                <CardFooter className="bg-gray-50 border-t py-4 justify-center">
                    <p className="text-xs sm:text-sm text-gray-500 text-center">
                        Escaneos restantes: {data?.scansRemaining}
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}


// 'use client';

// import { useEffect, useState, use } from 'react';
// import { KeyDisplay } from '@/components/scan/KeyDisplay';
// import { Loader2, AlertCircle } from 'lucide-react';

// interface ScanResponse {
//     success?: boolean;
//     key?: string;
//     product?: string;
//     amount?: number;
//     currency?: string;
//     scansRemaining?: number;
//     error?: string;
//     message?: string;
//     store?: {
//         name: string;
//         phone: string;
//     };
// }

// export default function ScanPage({ params }: { params: Promise<{ uuid: string }> }) {
//     const { uuid } = use(params);
//     const [loading, setLoading] = useState(true);
//     const [data, setData] = useState<ScanResponse | null>(null);

//     useEffect(() => {
//         const fetchKey = async () => {
//             try {
//                 const res = await fetch(`/api/qr/${uuid}`);
//                 const json = await res.json();
//                 setData(json);
//             } catch (error) {
//                 setData({ error: 'Error de conexión' });
//             } finally {
//                 setLoading(false);
//             }
//         };

//         fetchKey();
//     }, [uuid]);

//     if (loading) {
//         return (
//             <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
//                 <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
//                 <p className="text-gray-600">Verificando código...</p>
//             </div>
//         );
//     }

//     if (data?.error) {
//         return (
//             <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
//                 <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center">
//                     <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
//                         <AlertCircle className="w-8 h-8 text-red-600" />
//                     </div>
//                     <h1 className="text-2xl font-bold text-gray-900 mb-2">{data.error}</h1>
//                     {data.message && (
//                         <p className="text-gray-600 mb-4">{data.message}</p>
//                     )}
//                     {/* {data.store && (
//                         <div className="bg-gray-50 p-4 rounded-lg mt-4 text-left">
//                             <p className="text-sm text-gray-500 mb-1">Tienda:</p>
//                             <p className="font-semibold">{data.store.name}</p>
//                             <p className="text-sm text-gray-600">{data.store.phone}</p>
//                         </div>
//                     )} */}
//                 </div>
//             </div>
//         );
//     }

//     return (
//         <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
//             <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
//                 <div className="bg-blue-600 p-6 text-white text-center">
//                     <h1 className="text-xl font-bold mb-1">{data?.product}</h1>
//                     {/* <p className="opacity-90">
//                         {new Intl.NumberFormat('en-US', {
//                             style: 'currency',
//                             currency: data?.currency || 'USD',
//                         }).format(data?.amount || 0)}
//                     </p> */}
//                 </div>

//                 <KeyDisplay code={data?.key || ''} />

//                 <div className="bg-gray-50 p-4 text-center border-t">
//                     <p className="text-xs text-gray-500">
//                         Escaneos restantes: {data?.scansRemaining}
//                     </p>
//                 </div>
//             </div>
//         </div>
//     );
// }
