'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gift, Sparkles, CheckCircle2 } from 'lucide-react';

export default function TestPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isScratching, setIsScratching] = useState(false);
  const [scratchPercentage, setScratchPercentage] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; vx: number; vy: number }[]
  >([]);

  // Pintar la capa plateada dentro del rectángulo (como en la tarjeta física)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
    ctx.scale(2, 2);

    // Fondo plateado con textura
    const gradient = ctx.createLinearGradient(0, 0, rect.width, rect.height);
    gradient.addColorStop(0, '#e0e0e0');
    gradient.addColorStop(0.25, '#f5f5f5');
    gradient.addColorStop(0.5, '#d0d0d0');
    gradient.addColorStop(0.75, '#f5f5f5');
    gradient.addColorStop(1, '#e0e0e0');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Punticos de textura
    ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
    for (let i = 0; i < rect.width; i += 4) {
      for (let j = 0; j < rect.height; j += 4) {
        if (Math.random() > 0.5) {
          ctx.fillRect(i, j, 1, 1);
        }
      }
    }

    // Texto tipo “SCRATCH OFF / PIN NUMBER”
    ctx.fillStyle = 'rgba(60, 60, 60, 0.7)';
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('SCRATCH OFF', rect.width / 2, rect.height / 2 - 4);
    ctx.font = 'bold 14px Arial';
    ctx.fillText('PIN NUMBER', rect.width / 2, rect.height / 2 + 14);
  }, []);

  const createParticles = (x: number, y: number) => {
    const newParticles: Array<{
      id: number;
      x: number;
      y: number;
      vx: number;
      vy: number;
    }> = [];
    for (let i = 0; i < 5; i++) {
      newParticles.push({
        id: Date.now() + i,
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles(prev =>
        prev.filter(p => !newParticles.find(np => np.id === p.id)),
      );
    }, 600);
  };

  const scratch = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || isRevealed) return;

    const rect = canvas.getBoundingClientRect();
    const clientX =
      'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY =
      'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x * 2, y * 2, 40, 0, Math.PI * 2);
    ctx.fill();

    createParticles(clientX, clientY);

    // Calcular porcentaje raspado
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let transparent = 0;
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] < 128) transparent++;
    }
    const percentage = (transparent / (imageData.data.length / 4)) * 100;
    setScratchPercentage(percentage);

    if (percentage > 60 && !isRevealed) {
      setIsRevealed(true);
      setTimeout(() => {
        if (canvas) canvas.style.opacity = '0';
      }, 300);
    }
  };

  const handleStart = () => setIsScratching(true);
  const handleEnd = () => setIsScratching(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col items-center justify-center p-4">
      <div className="mb-6 text-center opacity-0 animate-[fadeIn_0.7s_ease-in-out_forwards]">
        <Badge variant="secondary" className="mb-2 px-4 py-1">
          <Sparkles className="w-3 h-3 mr-1 inline" />
          Promoción Especial
        </Badge>
        <h2 className="text-3xl font-bold text-gray-800">¡Raspa y Gana!</h2>
        <p className="text-gray-600 mt-2">Descubre tu código secreto</p>
      </div>

      <Card className="max-w-md w-full overflow-hidden shadow-2xl opacity-0 animate-[fadeIn_0.7s_ease-in-out_0.15s_forwards]">
        {/* “Tarjeta” superior tipo gift card */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-white/10 animate-pulse" />
          <h1 className="text-xl font-bold mb-1 relative z-10">Producto de Prueba</h1>
          <p className="text-xs text-white/80 relative z-10">
            Raspa la franja para ver tu PIN
          </p>
          <div className="flex items-center justify-center gap-2 mt-2 relative z-10">
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:100ms]" />
            <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:200ms]" />
          </div>
        </div>

        <CardContent className="p-6 relative bg-slate-100">
          {/* Partículas tipo “raspadura” */}
          {particles.map(particle => (
            <div
              key={particle.id}
              className="absolute w-2 h-2 bg-gray-400 rounded-full pointer-events-none animate-ping"
              style={{
                left: particle.x,
                top: particle.y,
                transform: `translate(${particle.vx * 10}px, ${particle.vy * 10}px)`,
              }}
            />
          ))}

          {/* Cuerpo que imita la tarjeta física */}
          <div className="w-full bg-white rounded-lg border border-gray-300 shadow-sm px-4 pt-4 pb-3">
            {/* Texto pequeño tipo instrucción */}
            <p className="text-[10px] tracking-wide text-gray-500 text-center mb-2">
              SCRATCH OFF TO REVEAL YOUR PIN NUMBER
            </p>

            {/* Área del código + franja de raspado como la foto */}
            <div className="flex flex-col items-center gap-3">
              {/* Código (debajo de la capa plateada) */}
              <div className="relative w-full max-w-xs">
                <div className="bg-slate-900 text-white rounded-md py-3 px-4 text-center">
                  <p className="text-xs uppercase tracking-widest text-slate-300 mb-1">
                    PIN NUMBER
                  </p>
                  <p className="text-2xl font-bold tracking-widest font-mono">
                    AAAA-AAAA-AAAA
                  </p>
                </div>

                {/* Capa de scratch del tamaño del recuadro, con borde verde */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-full h-full rounded-md overflow-hidden">
                    {/* Borde verde tipo sticker */}
                    <div className="pointer-events-none absolute inset-0 rounded-md border-[3px] border-emerald-400 bg-emerald-100/20" />
                    <canvas
                      ref={canvasRef}
                      className={`relative z-10 w-full h-full block transition-opacity duration-500 ${isScratching ? 'cursor-grabbing' : 'cursor-grab'
                        }`}
                      onMouseDown={handleStart}
                      onMouseUp={handleEnd}
                      onMouseLeave={handleEnd}
                      onMouseMove={isScratching ? scratch : undefined}
                      onTouchStart={handleStart}
                      onTouchEnd={handleEnd}
                      onTouchCancel={handleEnd}
                      onTouchMove={scratch}
                      style={{ touchAction: 'none' }}
                    />
                  </div>
                </div>
              </div>

              {/* “Código revelado” + mensaje cuando se destapa */}
              {isRevealed && (
                <div className="w-full max-w-xs opacity-0 animate-[fadeIn_0.5s_ease-in-out_forwards]">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <p className="text-xs text-green-800 font-medium">
                      ¡Código revelado exitosamente!
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* “Barra de código de barras” decorativa debajo, como en la foto */}
            <div className="mt-4 flex flex-col items-center gap-1">
              <div className="w-[92%] h-8 bg-[repeating-linear-gradient(to_right,#000_0,#000_2px,#fff_2px,#fff_4px)] opacity-70" />
              <div className="w-[70%] h-[2px] bg-gray-300 mt-1" />
            </div>
          </div>

          {/* Indicador de progreso cerca de la franja */}
          {scratchPercentage > 0 && scratchPercentage < 60 && (
            <div className="absolute top-5 right-5 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 shadow-lg opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]">
              <p className="text-xs font-semibold text-gray-700">
                {Math.round(scratchPercentage)}%
              </p>
            </div>
          )}
        </CardContent>

        <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 text-center border-t">
          <p className="text-xs text-gray-500 flex items-center justify-center gap-2">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Escaneos restantes: <span className="font-bold text-gray-700">3</span>
          </p>
        </div>
      </Card>

      <div className="mt-6 text-center text-sm text-gray-500 opacity-0 animate-[fadeIn_1s_ease-in-out_0.3s_forwards]">
        <p>💡 Raspa sobre la franja plateada para revelar tu PIN</p>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
