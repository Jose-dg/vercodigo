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
import { CardSelector } from "./CardSelector";
import type { Company, Product, ProductDenomination } from "@prisma/client";

interface InvoiceFormProps {
    companies: Company[];
    products: (Product & { denominations: ProductDenomination[] })[];
    onSubmit: (data: CreateInvoiceInput) => Promise<void>;
    isSubmitting: boolean;
}

const CARD_PHYSICAL_COST = 1000; // 1,000 COP fixed cost

export function InvoiceForm({ companies, products, onSubmit, isSubmitting }: InvoiceFormProps) {
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
                    cardId: "",
                },
            ],
            commissionRate: 0.05,
            exchangeRate: 3600, // Default exchange rate
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items",
    });

    const watchItems = form.watch("items");
    const watchCommissionRate = form.watch("commissionRate");
    const watchExchangeRate = form.watch("exchangeRate") || 3600;

    const totalSales = watchItems?.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
        0
    ) || 0;

    const commissionAmount = totalSales * (Number(watchCommissionRate) || 0);
    const totalAmount = totalSales - commissionAmount;

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Company, Period and Exchange Rate */}
                <div className="grid gap-4 md:grid-cols-4">
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

                    <FormField
                        control={form.control}
                        name="exchangeRate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tasa de Cambio (COP/USD) *</FormLabel>
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
                                    cardId: "",
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
                            className="grid gap-4 md:grid-cols-12 items-start border p-4 rounded-lg bg-white"
                        >
                            <div className="md:col-span-5 space-y-4">
                                <FormField
                                    control={form.control}
                                    name={`items.${index}.cardId`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Seleccionar QR/Card *</FormLabel>
                                            <FormControl>
                                                <CardSelector
                                                    products={products}
                                                    selectedCardId={field.value}
                                                    onSelect={(card, denominationAmount) => {
                                                        const exchangeRate = form.getValues("exchangeRate") || 3600;
                                                        const unitPrice = (denominationAmount * exchangeRate) + CARD_PHYSICAL_COST;

                                                        form.setValue(`items.${index}.cardId`, card.id);
                                                        form.setValue(`items.${index}.unitPrice`, unitPrice);
                                                        form.setValue(`items.${index}.description`, `${card.product.name} - $${denominationAmount} - QR: ${card.uuid}`);
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name={`items.${index}.description`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Descripción</FormLabel>
                                            <FormControl>
                                                <Input readOnly placeholder="Se generará al seleccionar un QR" {...field} className="bg-slate-50" />
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
                                            <FormLabel>Precio Unit. (COP)</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    {...field}
                                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                                />
                                            </FormControl>
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                Auto-calculado: (Denom × Tasa) + 1,000
                                            </p>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="md:col-span-2 flex items-end">
                                <div className="text-sm pb-2">
                                    <div className="text-muted-foreground mb-1">Total Item</div>
                                    <div className="font-semibold text-lg">
                                        <CurrencyDisplay
                                            amount={
                                                (Number(watchItems?.[index]?.quantity) || 0) *
                                                (Number(watchItems?.[index]?.unitPrice) || 0)
                                            }
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-1 flex items-start justify-end pt-8">
                                {fields.length > 1 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => remove(index)}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    >
                                        <Trash2 className="h-4 w-4" />
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
