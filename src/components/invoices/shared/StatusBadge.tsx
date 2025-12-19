import { Badge } from "@/components/ui/badge";
import { InvoiceStatus } from "@prisma/client";

interface StatusBadgeProps {
    status: InvoiceStatus;
}

const statusConfig = {
    PENDING: {
        label: "Pendiente",
        className: "bg-yellow-100 text-yellow-800 border-yellow-200",
    },
    PAID: {
        label: "Pagado",
        className: "bg-green-100 text-green-800 border-green-200",
    },
    OVERDUE: {
        label: "Vencido",
        className: "bg-red-100 text-red-800 border-red-200",
    },
    CANCELLED: {
        label: "Cancelado",
        className: "bg-gray-100 text-gray-800 border-gray-200",
    },
};

export function StatusBadge({ status }: StatusBadgeProps) {
    const config = statusConfig[status];

    return (
        <Badge variant="outline" className={config.className}>
            {config.label}
        </Badge>
    );
}
