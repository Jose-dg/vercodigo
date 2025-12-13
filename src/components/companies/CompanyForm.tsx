'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface CompanyFormProps {
    initialData?: {
        id?: string;
        name?: string;
        taxId?: string;
        email?: string;
        phone?: string;
        address?: string;
        billingFrequency?: string;
        commissionRate?: number;
        isActive?: boolean;
    };
}

export function CompanyForm({ initialData }: CompanyFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        taxId: initialData?.taxId || '',
        email: initialData?.email || '',
        phone: initialData?.phone || '',
        address: initialData?.address || '',
        billingFrequency: initialData?.billingFrequency || 'DAILY',
        commissionRate: initialData?.commissionRate?.toString() || '0.05',
        isActive: initialData?.isActive ?? true,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const url = initialData?.id ? `/api/companies/${initialData.id}` : '/api/companies';
            const method = initialData?.id ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    commissionRate: parseFloat(formData.commissionRate),
                }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Error al guardar');
            }

            toast({
                title: initialData?.id ? 'Compañía actualizada' : 'Compañía creada',
                description: `La compañía se ha ${initialData?.id ? 'actualizado' : 'creado'} exitosamente.`,
            });

            router.push('/companies');
            router.refresh();
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message || 'No se pudo guardar la compañía.',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl mx-auto">
            <Card className="bg-white shadow-sm border-gray-200">
                <CardHeader>
                    <CardTitle className="text-xl font-semibold text-gray-900">
                        {initialData?.id ? 'Editar Compañía' : 'Nueva Compañía'}
                    </CardTitle>
                    <CardDescription>
                        {initialData?.id
                            ? 'Actualiza la información de la compañía.'
                            : 'Ingresa la información de la nueva compañía.'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-gray-700 font-medium">
                                Nombre de la Compañía *
                            </Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                className="bg-gray-50 border-gray-300 focus:ring-blue-500 focus:bg-white transition-colors"
                                placeholder="Ej: Acme Corporation"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="taxId" className="text-gray-700 font-medium">
                                Tax ID (RUC/NIT) *
                            </Label>
                            <Input
                                id="taxId"
                                value={formData.taxId}
                                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                                required
                                disabled={!!initialData?.id}
                                className="bg-gray-50 border-gray-300 focus:ring-blue-500 focus:bg-white transition-colors font-mono"
                                placeholder="Ej: 123456789-1"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-gray-700 font-medium">
                                Email *
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                                className="bg-gray-50 border-gray-300 focus:ring-blue-500 focus:bg-white transition-colors"
                                placeholder="contacto@empresa.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone" className="text-gray-700 font-medium">
                                Teléfono *
                            </Label>
                            <Input
                                id="phone"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                required
                                className="bg-gray-50 border-gray-300 focus:ring-blue-500 focus:bg-white transition-colors"
                                placeholder="+57 300 123 4567"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="address" className="text-gray-700 font-medium">
                            Dirección
                        </Label>
                        <Input
                            id="address"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className="bg-gray-50 border-gray-300 focus:ring-blue-500 focus:bg-white transition-colors"
                            placeholder="Calle 123 #45-67, Ciudad"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="billingFrequency" className="text-gray-700 font-medium">
                                Frecuencia de Facturación *
                            </Label>
                            <Select
                                value={formData.billingFrequency}
                                onValueChange={(value) =>
                                    setFormData({ ...formData, billingFrequency: value })
                                }
                            >
                                <SelectTrigger className="bg-gray-50 border-gray-300 focus:ring-blue-500">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DAILY">Diario</SelectItem>
                                    <SelectItem value="THREE_DAYS">Cada 3 días</SelectItem>
                                    <SelectItem value="WEEKLY">Semanal</SelectItem>
                                    <SelectItem value="BIWEEKLY">Quincenal</SelectItem>
                                    <SelectItem value="MONTHLY">Mensual</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="commissionRate" className="text-gray-700 font-medium">
                                Tasa de Comisión (%) *
                            </Label>
                            <div className="relative">
                                <Input
                                    id="commissionRate"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="1"
                                    value={formData.commissionRate}
                                    onChange={(e) =>
                                        setFormData({ ...formData, commissionRate: e.target.value })
                                    }
                                    required
                                    className="bg-gray-50 border-gray-300 focus:ring-blue-500 focus:bg-white transition-colors"
                                    placeholder="0.05"
                                />
                                <span className="absolute right-3 top-2.5 text-gray-500">%</span>
                            </div>
                            <p className="text-xs text-gray-500">
                                Ej: 0.05 = 5%, 0.10 = 10%
                            </p>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="bg-gray-50/50 border-t border-gray-100 p-6">
                    <div className="flex gap-4 w-full">
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={() => router.back()}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                        >
                            {loading
                                ? initialData?.id
                                    ? 'Actualizando...'
                                    : 'Creando...'
                                : initialData?.id
                                  ? 'Actualizar Compañía'
                                  : 'Crear Compañía'}
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </form>
    );
}

