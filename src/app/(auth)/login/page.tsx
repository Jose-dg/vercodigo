"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const result = await signIn("credentials", {
                email,
                password,
                callbackUrl: "/store",
            });

            if (result?.error) {
                toast({
                    variant: "destructive",
                    title: "Error de inicio de sesión",
                    description: "Credenciales inválidas. Por favor intenta de nuevo.",
                });
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Ocurrió un error inesperado.",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
            <Card className="w-full max-w-md bg-white shadow-2xl border-0">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-xl">D</span>
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">
                        Bienvenido a Maverick
                    </CardTitle>
                    <CardDescription className="text-gray-500">
                        Ingresa tus credenciales para acceder al sistema
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-gray-700 font-medium">Correo Electrónico</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="usuario@ejemplo.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-gray-700 font-medium">Contraseña</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5"
                            disabled={loading}
                        >
                            {loading ? "Iniciando sesión..." : "Ingresar"}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}


// 1. Database Seeded: I created a seed script and ran it. Your database now has:

// Company: Diem SAS
// Store: Tienda Principal (STORE-001)
// Product: Netflix Gift Card (NFLX-USD)
// User: admin@diemsas.com / admin123
// Authorized Phone: +573001234567 (for activation)