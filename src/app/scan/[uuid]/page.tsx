'use client';

import { useEffect, useState, useRef } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

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

// Componente de raspar el código
const ScratchCard = ({ code }: { code: string }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isScratching, setIsScratching] = useState(false);
    const [scratchPercentage, setScratchPercentage] = useState(0);
    const [revealed, setRevealed] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Configurar tamaño del canvas
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);

        // Dibujar capa de plata con textura
        const gradient = ctx.createLinearGradient(0, 0, rect.width, rect.height);
        gradient.addColorStop(0, '#c0c0c0');
        gradient.addColorStop(0.5, '#e8e8e8');
        gradient.addColorStop(1, '#a8a8a8');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, rect.width, rect.height);

        // Añadir textura
        for (let i = 0; i < 100; i++) {
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.3})`;
            ctx.fillRect(Math.random() * rect.width, Math.random() * rect.height, 2, 2);
        }

        // Texto "RASCA AQUÍ"
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('RASCA AQUÍ', rect.width / 2, rect.height / 2);
    }, []);

    const scratch = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas || revealed) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        let x, y;

        if ('touches' in e) {
            x = (e.touches[0].clientX - rect.left) * 2;
            y = (e.touches[0].clientY - rect.top) * 2;
        } else {
            x = (e.clientX - rect.left) * 2;
            y = (e.clientY - rect.top) * 2;
        }

        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, 40, 0, Math.PI * 2);
        ctx.fill();

        // Calcular porcentaje raspado
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let transparentPixels = 0;
        for (let i = 3; i < imageData.data.length; i += 4) {
            if (imageData.data[i] === 0) transparentPixels++;
        }
        const percentage = (transparentPixels / (imageData.data.length / 4)) * 100;
        setScratchPercentage(percentage);

        if (percentage > 60 && !revealed) {
            setRevealed(true);
        }
    };

    return (
        <div className="relative w-full">
            <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 p-8 rounded-lg relative overflow-hidden">
                {/* Patrón de fondo PlayStation */}
                <div className="absolute inset-0 opacity-10">
                    {[...Array(20)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute text-6xl font-bold text-white"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                                transform: `rotate(${Math.random() * 360}deg)`,
                            }}
                        >
                            {['○', '×', '□', '△'][Math.floor(Math.random() * 4)]}
                        </div>
                    ))}
                </div>

                {/* Código debajo */}
                <div className="relative z-10 text-center">
                    <p className="text-blue-300 text-xs mb-2 font-semibold tracking-wider uppercase">
                        Tu Código de Activación
                    </p>
                    <div className="bg-black/30 backdrop-blur-sm px-6 py-4 rounded-lg border border-blue-400/30">
                        <p className="text-3xl md:text-4xl font-mono font-bold text-white tracking-widest break-all">
                            {code}
                        </p>
                    </div>
                </div>

                {/* Canvas de raspar */}
                <canvas
                    ref={canvasRef}
                    className={`absolute inset-0 w-full h-full cursor-pointer transition-opacity duration-500 rounded-lg ${
                        revealed ? 'opacity-0 pointer-events-none' : 'opacity-100'
                    }`}
                    onMouseDown={() => setIsScratching(true)}
                    onMouseUp={() => setIsScratching(false)}
                    onMouseMove={(e) => isScratching && scratch(e)}
                    onMouseLeave={() => setIsScratching(false)}
                    onTouchStart={() => setIsScratching(true)}
                    onTouchEnd={() => setIsScratching(false)}
                    onTouchMove={(e) => isScratching && scratch(e)}
                />

                {/* Indicador de progreso */}
                {!revealed && scratchPercentage > 10 && (
                    <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-white/90 px-3 py-1 rounded-full text-xs font-bold text-gray-700">
                        {Math.floor(scratchPercentage)}% raspado
                    </div>
                )}
            </div>

            {/* Instrucciones */}
            {!revealed && (
                <p className="text-center text-gray-500 text-sm mt-3 animate-pulse">
                    👆 Rasca con tu dedo o mouse para revelar el código
                </p>
            )}
        </div>
    );
};

export default function ScanPage({ params }: { params: Promise<{ uuid: string }> }) {
    const [uuid, setUuid] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ScanResponse | null>(null);

    useEffect(() => {
        // Simular unwrap del Promise
        Promise.resolve(params).then(p => setUuid(p.uuid));
    }, [params]);

    useEffect(() => {
        if (!uuid) return;

        const fetchKey = async () => {
            try {
                // Simular respuesta para demo
                await new Promise(resolve => setTimeout(resolve, 1500));
                setData({
                    success: true,
                    key: 'XXXX-YYYY-ZZZZ-AAAA',
                    product: 'PlayStation Plus Premium',
                    scansRemaining: 3
                });
            } catch (error) {
                setData({ error: 'Error de conexión' });
            } finally {
                setLoading(false);
            }
        };

        fetchKey();
    }, [uuid]);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-950 via-indigo-950 to-purple-950 p-4 relative overflow-hidden">
                {/* Efectos de fondo animados */}
                <div className="absolute inset-0 overflow-hidden">
                    {[...Array(12)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute text-6xl md:text-9xl font-bold text-white/5 animate-float"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                                animationDelay: `${Math.random() * 5}s`,
                                animationDuration: `${10 + Math.random() * 10}s`,
                            }}
                        >
                            {['○', '×', '□', '△'][Math.floor(Math.random() * 4)]}
                        </div>
                    ))}
                </div>

                <div className="relative z-10 text-center">
                    {/* Logo PlayStation animado */}
                    <div className="mb-8 animate-slide-down">
                        <div className="inline-block bg-white/10 backdrop-blur-md px-8 py-4 rounded-3xl border-2 border-white/20 shadow-2xl mb-6">
                            <div className="text-5xl md:text-7xl font-black text-white mb-2 tracking-tight">
                                Play<span className="text-blue-400">Station</span>
                            </div>
                            <div className="flex justify-center gap-3 text-3xl md:text-4xl">
                                <span className="animate-bounce" style={{ animationDelay: '0s' }}>○</span>
                                <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>×</span>
                                <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>□</span>
                                <span className="animate-bounce" style={{ animationDelay: '0.3s' }}>△</span>
                            </div>
                        </div>
                    </div>

                    {/* Spinner con efecto PS5 */}
                    <div className="relative mb-6">
                        <div className="w-24 h-24 md:w-32 md:h-32 mx-auto relative">
                            {/* Anillo exterior */}
                            <div className="absolute inset-0 rounded-full border-4 border-blue-500/30"></div>
                            {/* Anillo giratorio */}
                            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-400 border-r-blue-500 animate-spin"></div>
                            {/* Centro con ícono */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                                    <Loader2 className="w-8 h-8 md:w-10 md:h-10 text-white animate-spin" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Texto de carga con efectos */}
                    <div className="space-y-4">
                        <p className="text-blue-300 text-xl md:text-2xl font-bold tracking-wide animate-pulse">
                            Verificando código
                        </p>
                        
                        {/* Barra de progreso animada */}
                        <div className="max-w-xs mx-auto">
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
                                <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full animate-loading-bar"></div>
                            </div>
                        </div>

                        {/* Puntos animados */}
                        <div className="flex gap-2 justify-center">
                            {[0, 1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className="w-3 h-3 bg-blue-400 rounded-full animate-bounce shadow-lg shadow-blue-500/50"
                                    style={{ animationDelay: `${i * 0.15}s` }}
                                />
                            ))}
                        </div>

                        {/* Mensaje adicional */}
                        <p className="text-blue-200/60 text-sm md:text-base mt-6 animate-pulse">
                            Por favor espera...
                        </p>
                    </div>
                </div>

                <style jsx>{`
                    @keyframes slide-down {
                        from {
                            opacity: 0;
                            transform: translateY(-30px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                    
                    @keyframes loading-bar {
                        0% {
                            transform: translateX(-100%);
                        }
                        100% {
                            transform: translateX(400%);
                        }
                    }
                    
                    .animate-slide-down {
                        animation: slide-down 0.6s ease-out;
                    }
                    
                    .animate-loading-bar {
                        animation: loading-bar 1.5s ease-in-out infinite;
                    }
                `}</style>
            </div>
        );
    }

    if (data?.error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-red-950 via-red-900 to-rose-950 p-4">
                <div className="bg-white/95 backdrop-blur-sm p-6 md:p-8 rounded-3xl shadow-2xl max-w-md w-full text-center animate-scale-in">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-once">
                        <AlertCircle className="w-8 h-8 md:w-10 md:h-10 text-red-600" />
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{data.error}</h1>
                    {data.message && (
                        <p className="text-gray-600 text-sm md:text-base mb-4">{data.message}</p>
                    )}
                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <p className="text-xs text-gray-500">Código de error: {uuid?.slice(0, 8)}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-950 via-indigo-950 to-purple-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Efectos de fondo animados */}
            <div className="absolute inset-0 overflow-hidden">
                {[...Array(15)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute text-8xl md:text-9xl font-bold text-white/5 animate-float"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 5}s`,
                            animationDuration: `${10 + Math.random() * 10}s`,
                        }}
                    >
                        {['○', '×', '□', '△'][Math.floor(Math.random() * 4)]}
                    </div>
                ))}
            </div>

            <div className="relative z-10 w-full max-w-lg animate-slide-up">
                {/* Header PlayStation */}
                <div className="text-center mb-6">
                    <div className="inline-block bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20 mb-4">
                        <h1 className="text-3xl md:text-4xl font-bold text-white">PlayStation</h1>
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold text-blue-300 mb-2">{data?.product}</h2>
                </div>

                {/* Card principal */}
                <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-4 md:p-6 text-white text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20"></div>
                        <div className="relative z-10">
                            <p className="text-sm md:text-base font-semibold mb-1 tracking-wide uppercase">
                                Código de Activación
                            </p>
                            <div className="flex justify-center gap-2 text-2xl md:text-3xl mb-2">
                                <span>○</span>
                                <span>×</span>
                                <span>□</span>
                                <span>△</span>
                            </div>
                        </div>
                    </div>

                    {/* Scratch Card */}
                    <div className="p-4 md:p-6">
                        <ScratchCard code={data?.key || ''} />
                    </div>

                    {/* Footer */}
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 text-center border-t">
                        <div className="flex items-center justify-center gap-2 text-sm text-gray-600 mb-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <p className="font-semibold">
                                Escaneos restantes: <span className="text-blue-600">{data?.scansRemaining}</span>
                            </p>
                        </div>
                        <p className="text-xs text-gray-500">Guarda este código en un lugar seguro</p>
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes scale-in {
                    from {
                        opacity: 0;
                        transform: scale(0.8);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                
                @keyframes slide-up {
                    from {
                        opacity: 0;
                        transform: translateY(30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                @keyframes float {
                    0%, 100% {
                        transform: translateY(0) rotate(0deg);
                    }
                    50% {
                        transform: translateY(-20px) rotate(10deg);
                    }
                }
                
                @keyframes bounce-once {
                    0%, 100% {
                        transform: scale(1);
                    }
                    50% {
                        transform: scale(1.1);
                    }
                }
                
                .animate-scale-in {
                    animation: scale-in 0.5s ease-out;
                }
                
                .animate-slide-up {
                    animation: slide-up 0.6s ease-out;
                }
                
                .animate-float {
                    animation: float linear infinite;
                }
                
                .animate-bounce-once {
                    animation: bounce-once 0.6s ease-out;
                }
            `}</style>
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
