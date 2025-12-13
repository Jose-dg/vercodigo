'use client';

import { useState } from 'react';
import { CheckCircle2, Copy, Check } from 'lucide-react';

export function KeyDisplay({ code: keyCode }: { code: string }) {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(keyCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col items-center gap-6 p-8">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
            <h2 className="text-2xl font-bold text-gray-900">¡Código Activado!</h2>

            <div className="bg-gray-100 p-6 rounded-xl w-full text-center border-2 border-dashed border-gray-300">
                <p className="text-3xl font-mono font-bold tracking-wider text-gray-800 break-all">
                    {keyCode}
                </p>
            </div>

            <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium transition-colors w-full justify-center"
            >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                {copied ? '¡Copiado!' : 'Copiar código'}
            </button>

            <p className="text-sm text-gray-500 text-center max-w-xs">
                Guarda este código. Solo puedes verlo un número limitado de veces por seguridad.
            </p>
        </div>
    );
}
