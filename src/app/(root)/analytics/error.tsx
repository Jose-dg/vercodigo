"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCcw } from "lucide-react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Analytics Error:", error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 text-center">
            <div className="rounded-full bg-red-100 p-3">
                <AlertCircle className="h-10 w-10 text-red-600" />
            </div>
            <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-gray-900">Algo salió mal</h2>
                <p className="text-gray-500 max-w-md mx-auto">
                    Hubo un error al cargar los datos de analytics. Por favor, intenta de nuevo.
                </p>
            </div>
            <Button onClick={reset} variant="outline" className="mt-4">
                <RotateCcw className="mr-2 h-4 w-4" />
                Reintentar
            </Button>
        </div>
    );
}
