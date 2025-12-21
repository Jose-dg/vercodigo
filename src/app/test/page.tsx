'use client';

import { useState } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, CheckCircle } from 'lucide-react';

export default function ScanPageMock() {
    // Datos MOCK
    let key = "ABCD-EFGH-I\nJKL-MNOP"; 
    key = key.replace(/\s+/g, ""); // Limpiar ENTERS y espacios

    const data = {
        product: "PlayStation Store - $20 USD",
        scansRemaining: 5,
    };

    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(key);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Error al copiar', error);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8">
            <Card className="w-full max-w-md sm:max-w-lg rounded-2xl shadow-xl overflow-hidden">

                {/* HEADER */}
                <CardHeader className="bg-blue-600 text-white text-center py-6">
                    <h1 className="text-lg sm:text-xl font-bold mb-1">
                        {data.product}
                    </h1>
                </CardHeader>

                {/* CONTENIDO */}
                <CardContent className="py-6 space-y-5">

                    {/* CHULITO VERDE ENCIMA DEL RECUADRO */}
                    <div className="flex justify-center mb-1">
                        <CheckCircle className="w-10 h-10 text-green-600 drop-shadow-sm" />
                    </div>

                    {/* RECUADRO SCRATCH */}
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
                            {key}
                        </span>
                    </div>

                    {/* BOTÓN COPIAR */}
                    <div className="flex justify-center">
                        <Button
                            variant="outline"
                            onClick={handleCopy}
                            className="flex items-center gap-2"
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
                        Escaneos restantes: {data.scansRemaining}
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
