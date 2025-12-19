interface CurrencyDisplayProps {
    amount: number;
    currency?: string;
    className?: string;
}

export function CurrencyDisplay({
    amount,
    currency = "USD",
    className,
}: CurrencyDisplayProps) {
    const formatted = new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency,
    }).format(amount);

    return <span className={className}>{formatted}</span>;
}
