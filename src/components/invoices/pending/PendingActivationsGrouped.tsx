"use client";

import { useState } from "react";
import { ActivationGroupCard } from "./ActivationGroupCard";
import { GenerateInvoiceDialog } from "./GenerateInvoiceDialog";
import type {
    CardActivation,
    Store,
    Card as CardModel,
    Product,
    ProductDenomination,
    Company,
} from "@prisma/client";

type ActivationWithRelations = CardActivation & {
    store: Store & { company: Company };
    card: CardModel & {
        product: Product;
        denomination: ProductDenomination | null;
    };
};

interface PendingActivationsGroupedProps {
    activations: ActivationWithRelations[];
}

export function PendingActivationsGrouped({
    activations,
}: PendingActivationsGroupedProps) {
    const [dialogState, setDialogState] = useState<{
        open: boolean;
        activationIds: string[];
        companyName: string;
        totalAmount: number;
        periodStart: Date;
        periodEnd: Date;
        companyId: string;
    }>({
        open: false,
        activationIds: [],
        companyName: "",
        totalAmount: 0,
        periodStart: new Date(),
        periodEnd: new Date(),
        companyId: "",
    });

    // Group by company > store
    const grouped = new Map<
        string,
        {
            storeId: string;
            storeName: string;
            companyId: string;
            companyName: string;
            commissionRate: number;
            activations: ActivationWithRelations[];
        }
    >();

    for (const activation of activations) {
        const key = `${activation.store.companyId}-${activation.storeId}`;
        const existing = grouped.get(key);

        if (existing) {
            existing.activations.push(activation);
        } else {
            grouped.set(key, {
                storeId: activation.storeId,
                storeName: activation.store.name,
                companyId: activation.store.companyId,
                companyName: activation.store.company.name,
                commissionRate: activation.store.company.commissionRate,
                activations: [activation],
            });
        }
    }

    // Transform to format expected by card
    const groupedData = Array.from(grouped.values()).map((group) => {
        // Group by product
        const productMap = new Map<
            string,
            {
                product: Product;
                denomination: ProductDenomination | null;
                activations: CardActivation[];
                amount: number;
                quantity: number;
            }
        >();

        for (const activation of group.activations) {
            const productKey = `${activation.card.productId}-${activation.card.denominationId}`;
            const existing = productMap.get(productKey);

            if (existing) {
                existing.quantity += 1;
                existing.activations.push(activation);
            } else {
                productMap.set(productKey, {
                    product: activation.card.product,
                    denomination: activation.card.denomination,
                    activations: [activation],
                    amount: activation.activationAmount,
                    quantity: 1,
                });
            }
        }

        const products = Array.from(productMap.values()).map((p) => ({
            ...p,
            total: p.amount * p.quantity,
        }));

        const subtotal = products.reduce((sum, p) => sum + p.total, 0);
        const commissionAmount = subtotal * group.commissionRate;
        const totalAmount = subtotal - commissionAmount;

        return {
            storeId: group.storeId,
            storeName: group.storeName,
            companyName: group.companyName,
            companyId: group.companyId,
            products,
            subtotal,
            commissionRate: group.commissionRate,
            commissionAmount,
            totalAmount,
            activationIds: group.activations.map((a) => a.id),
        };
    });

    const handleGenerateInvoice = (
        activationIds: string[],
        companyName: string
    ) => {
        const group = groupedData.find((g) => g.companyName === companyName)!;

        // Calculate period from activations
        const dates = group.activationIds
            .map((id) => activations.find((a) => a.id === id)?.activatedAt)
            .filter(Boolean) as Date[];

        const periodStart = new Date(Math.min(...dates.map((d) => d.getTime())));
        const periodEnd = new Date(Math.max(...dates.map((d) => d.getTime())));

        setDialogState({
            open: true,
            activationIds,
            companyName,
            totalAmount: group.totalAmount,
            periodStart,
            periodEnd,
            companyId: group.companyId,
        });
    };

    if (groupedData.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                No hay activaciones pendientes de facturar
            </div>
        );
    }

    return (
        <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {groupedData.map((group) => (
                    <ActivationGroupCard
                        key={`${group.companyName}-${group.storeName}`}
                        group={group}
                        onGenerateInvoice={handleGenerateInvoice}
                    />
                ))}
            </div>

            <GenerateInvoiceDialog
                open={dialogState.open}
                onOpenChange={(open) => setDialogState({ ...dialogState, open })}
                activationIds={dialogState.activationIds}
                companyName={dialogState.companyName}
                totalAmount={dialogState.totalAmount}
                periodStart={dialogState.periodStart}
                periodEnd={dialogState.periodEnd}
                companyId={dialogState.companyId}
            />
        </>
    );
}
