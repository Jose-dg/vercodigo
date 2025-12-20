"use client";

import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAvailableCardsAction } from "@/lib/actions/invoices";
import type { Product, ProductDenomination, Card } from "@prisma/client";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface CardWithRelations extends Card {
    product: Product;
    denomination: ProductDenomination | null;
}

interface CardSelectorProps {
    products: (Product & { denominations: ProductDenomination[] })[];
    onSelect: (card: CardWithRelations, denominationAmount: number) => void;
    selectedCardId?: string;
}

export function CardSelector({ products, onSelect, selectedCardId }: CardSelectorProps) {
    const [selectedProductId, setSelectedProductId] = useState<string>("");
    const [selectedDenominationId, setSelectedDenominationId] = useState<string>("");
    const [cards, setCards] = useState<CardWithRelations[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const selectedProduct = products.find((p) => p.id === selectedProductId);
    const denominations = selectedProduct?.denominations || [];

    useEffect(() => {
        if (selectedProductId) {
            fetchCards();
        }
    }, [selectedProductId, selectedDenominationId]);

    async function fetchCards() {
        setIsLoading(true);
        const result = await getAvailableCardsAction({
            productId: selectedProductId,
            denominationId: selectedDenominationId === "all" ? "" : selectedDenominationId,
        });

        if (result.success && result.cards) {
            setCards(result.cards as CardWithRelations[]);
        }
        setIsLoading(false);
    }

    const filteredCards = cards.filter((card) =>
        card.uuid.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-3 border p-3 rounded-md bg-slate-50/50">
            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Producto</label>
                    <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                        <SelectTrigger className="h-9">
                            <SelectValue placeholder="Producto" />
                        </SelectTrigger>
                        <SelectContent>
                            {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Denominación</label>
                    <Select
                        value={selectedDenominationId}
                        onValueChange={setSelectedDenominationId}
                        disabled={!selectedProductId}
                    >
                        <SelectTrigger className="h-9">
                            <SelectValue placeholder="Todas" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            {denominations.map((d) => (
                                <SelectItem key={d.id} value={d.id}>
                                    ${d.amount} {d.currency}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por UUID..."
                        className="pl-8 h-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        disabled={!selectedProductId}
                    />
                </div>

                <div className="max-h-40 overflow-y-auto border rounded-md bg-white">
                    {isLoading ? (
                        <div className="p-4 flex justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredCards.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            {selectedProductId ? "No hay cards disponibles" : "Selecciona un producto"}
                        </div>
                    ) : (
                        <div className="divide-y">
                            {filteredCards.map((card) => (
                                <button
                                    key={card.id}
                                    type="button"
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors flex justify-between items-center ${selectedCardId === card.id ? "bg-blue-50 ring-1 ring-blue-200" : ""
                                        }`}
                                    onClick={() => {
                                        const selectedDenom = denominations.find((d) => d.id === selectedDenominationId);
                                        const amount = selectedDenom?.amount || card.denomination?.amount || 0;
                                        onSelect(card, amount);
                                    }}
                                >
                                    <div className="flex flex-col">
                                        <span className="font-mono font-medium">{card.uuid}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {card.product.name} - ${card.denomination?.amount || 0}{" "}
                                            {card.denomination?.currency || "USD"}
                                        </span>
                                    </div>
                                    {selectedCardId === card.id && (
                                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                            Seleccionado
                                        </Badge>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
