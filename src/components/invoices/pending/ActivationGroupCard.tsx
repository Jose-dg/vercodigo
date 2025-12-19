"use client";

import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CurrencyDisplay } from "../shared/CurrencyDisplay";
import { FileText } from "lucide-react";
import type { CardActivation, Store, Card as CardModel, Product, ProductDenomination } from "@prisma/client";

interface ActivationsByProduct {
    product: Product;
    denomination: ProductDenomination | null;
    activations: CardActivation[];
    amount: number;
    quantity: number;
    total: number;
}

interface GroupedActivations {
    storeId: string;
    storeName: string;
    companyName: string;
    products: ActivationsByProduct[];
    subtotal: number;
    commissionRate: number;
    commissionAmount: number;
    totalAmount: number;
    activationIds: string[];
}

interface ActivationGroupCardProps {
    group: GroupedActivations;
    onGenerateInvoice: (activationIds: string[], companyName: string) => void;
}

export function ActivationGroupCard({
    group,
    onGenerateInvoice,
}: ActivationGroupCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div>
                        <div className="text-lg font-bold">{group.companyName}</div>
                        <div className="text-sm font-normal text-muted-foreground">
                            {group.storeName}
                        </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        {group.activationIds.length} QRs
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {group.products.map((product, idx) => (
                    <div
                        key={idx}
                        className="flex justify-between items-center text-sm"
                    >
                        <div className="flex-1">
                            <span className="font-medium">{product.product.name}</span>
                            {product.denomination && (
                                <span className="text-muted-foreground ml-1">
                                    ${product.denomination.amount}
                                </span>
                            )}
                        </div>
                        <div className="text-muted-foreground">
                            {product.quantity} QRs
                        </div>
                        <div className="font-medium ml-4 w-24 text-right">
                            <CurrencyDisplay amount={product.total} />
                        </div>
                    </div>
                ))}

                <Separator />

                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-medium">
                            <CurrencyDisplay amount={group.subtotal} />
                        </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                        <span>Comisión ({(group.commissionRate * 100).toFixed(0)}%):</span>
                        <span>
                            -<CurrencyDisplay amount={group.commissionAmount} />
                        </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-base">
                        <span>Total:</span>
                        <span>
                            <CurrencyDisplay amount={group.totalAmount} />
                        </span>
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                <Button
                    className="w-full"
                    onClick={() =>
                        onGenerateInvoice(group.activationIds, group.companyName)
                    }
                >
                    <FileText className="h-4 w-4 mr-2" />
                    Generar Factura
                </Button>
            </CardFooter>
        </Card>
    );
}
