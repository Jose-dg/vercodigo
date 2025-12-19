"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createInvoiceSchema, type CreateInvoiceInput } from "@/lib/validations/invoice-schema";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { CurrencyDisplay } from "../shared/CurrencyDisplay";
import { CompanySelect } from "../shared/CompanySelect";
import type { Company } from "@prisma/client";

interface InvoiceFormProps {
    companies: Company[];
    onSubmit: (data: CreateInvoiceInput) => Promise<void>;
    isSubmitting: boolean;
}

export function InvoiceForm({ companies, onSubmit, isSubmitting }: InvoiceFormProps) {
    const form = useForm<Omit<CreateInvoiceInput, 'commissionRate'> & { commissionRate: number }>({
        resolver: zodResolver(createInvoiceSchema) as any,
        defaultValues: {
            companyId: "",
            periodStart: new Date(),
            periodEnd: new Date(),
            items: [
                {
                    description: "",
                    quantity: 1,
                    unitPrice: 0,
                },
            ],
            commissionRate: 0.05,
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items",
    });

    const watchItems = form.watch("items");
    const watchCommissionRate = form.watch("commissionRate");

    const totalSales = watchItems?.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
        0
    ) || 0;

    const commissionAmount = totalSales * (Number(watchCommissionRate) || 0);
    const totalAmount = totalSales - commissionAmount;

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Company and Period */}
                <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                        control={form.control}
                        name="companyId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Empresa *</FormLabel>
                                <FormControl>
                                    <CompanySelect
                                        companies={companies}
                                        value={field.value}
                                        onChange={field.onChange}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="periodStart"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Fecha Inicio *</FormLabel>
                                <FormControl>
                                    <Input
                                        type="date"
                                        value={field.value?.toISOString().split("T")[0]}
                                        onChange={(e) => field.onChange(new Date(e.target.value))}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="periodEnd"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Fecha Fin *</FormLabel>
                                <FormControl>
                                    <Input
                                        type="date"
                                        value={field.value?.toISOString().split("T")[0]}
                                        onChange={(e) => field.onChange(new Date(e.target.value))}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <Separator />

                {/* Invoice Items */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold">Items de Factura</h3>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                append({
                                    description: "",
                                    quantity: 1,
                                    unitPrice: 0,
                                })
                            }
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Agregar Item
                        </Button>
                    </div>

                    {fields.map((field, index) => (
                        <div
                            key={field.id}
                            className="grid gap-4 md:grid-cols-12 items-start border p-4 rounded-lg"
                        >
                            <div className="md:col-span-5">
                                <FormField
                                    control={form.control}
                                    name={`items.${index}.description`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Descripción</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Ej: Netflix $10 - Tienda X" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <FormField
                                    control={form.control}
                                    name={`items.${index}.quantity`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cantidad</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    {...field}
                                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <FormField
                                    control={form.control}
                                    name={`items.${index}.unitPrice`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Precio Unit.</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    {...field}
                                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="md:col-span-2 flex items-end">
                                <div className="text-sm">
                                    <div className="text-muted-foreground mb-1">Total</div>
                                    <div className="font-semibold">
                                        <CurrencyDisplay
                                            amount={
                                                (Number(watchItems?.[index]?.quantity) || 0) *
                                                (Number(watchItems?.[index]?.unitPrice) || 0)
                                            }
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-1 flex items-end justify-end">
                                {fields.length > 1 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => remove(index)}
                                    >
                                        <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <Separator />

                {/* Commission Rate */}
                <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                        control={form.control}
                        name="commissionRate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tasa de Comisión</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        {...field}
                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                {/* Summary */}
                <div className="bg-muted p-4 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span className="font-medium">
                            <CurrencyDisplay amount={totalSales} />
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span>Comisión ({(watchCommissionRate * 100).toFixed(0)}%):</span>
                        <span className="text-red-600">
                            -<CurrencyDisplay amount={commissionAmount} />
                        </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                        <span>Total Factura:</span>
                        <span className="text-primary">
                            <CurrencyDisplay amount={totalAmount} />
                        </span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline">
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Crear Factura
                    </Button>
                </div>
            </form>
        </Form>
    );
}
