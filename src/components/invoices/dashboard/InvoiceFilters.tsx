"use client";

import { useState } from "react";
import { InvoiceStatus } from "@prisma/client";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "../shared/DateRangePicker";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";

interface InvoiceFiltersProps {
    onFilterChange: (filters: {
        status?: InvoiceStatus;
        dateRange?: DateRange;
    }) => void;
}

export function InvoiceFilters({ onFilterChange }: InvoiceFiltersProps) {
    const [status, setStatus] = useState<InvoiceStatus | "ALL">("ALL");
    const [dateRange, setDateRange] = useState<DateRange | undefined>();

    const handleStatusChange = (value: string) => {
        const newStatus = value === "ALL" ? "ALL" : (value as InvoiceStatus);
        setStatus(newStatus);
        onFilterChange({
            status: newStatus === "ALL" ? undefined : newStatus,
            dateRange,
        });
    };

    const handleDateRangeChange = (range: DateRange | undefined) => {
        setDateRange(range);
        onFilterChange({
            status: status === "ALL" ? undefined : status,
            dateRange: range,
        });
    };

    const handleClearFilters = () => {
        setStatus("ALL");
        setDateRange(undefined);
        onFilterChange({});
    };

    return (
        <div className="flex flex-wrap gap-4 items-center">
            <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    <SelectItem value="PENDING">Pendiente</SelectItem>
                    <SelectItem value="PAID">Pagado</SelectItem>
                    <SelectItem value="OVERDUE">Vencido</SelectItem>
                    <SelectItem value="CANCELLED">Cancelado</SelectItem>
                </SelectContent>
            </Select>

            <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />

            {(status !== "ALL" || dateRange) && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    className="h-10"
                >
                    <X className="h-4 w-4 mr-2" />
                    Limpiar filtros
                </Button>
            )}
        </div>
    );
}
