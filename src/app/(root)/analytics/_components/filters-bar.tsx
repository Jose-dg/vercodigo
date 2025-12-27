"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Download, RotateCcw } from "lucide-react";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface FiltersBarProps {
    onFiltersChange: (filters: { dateFrom?: Date; dateTo?: Date; storeId?: string }) => void;
    stores: { id: string; name: string }[];
}

export function FiltersBar({ onFiltersChange, stores }: FiltersBarProps) {
    const [date, setDate] = useState<DateRange | undefined>({
        from: subDays(new Date(), 30),
        to: new Date(),
    });
    const [storeId, setStoreId] = useState<string>("all");

    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        onFiltersChange({
            dateFrom: date?.from,
            dateTo: date?.to,
            storeId: storeId === "all" ? undefined : storeId,
        });
    }, [date, storeId, onFiltersChange]);

    const handleReset = () => {
        setDate({
            from: subDays(new Date(), 30),
            to: new Date(),
        });
        setStoreId("all");
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const response = await fetch("/api/analytics/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    filters: {
                        dateFrom: date?.from?.toISOString(),
                        dateTo: date?.to?.toISOString(),
                        storeId: storeId === "all" ? undefined : storeId,
                    },
                }),
            });

            if (!response.ok) throw new Error("Export failed");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `analytics-export-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error("Export error:", error);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white p-4 rounded-lg border shadow-sm">
            <div className="grid gap-2">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            id="date"
                            variant={"outline"}
                            className={cn(
                                "w-[300px] justify-start text-left font-normal",
                                !date && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date?.from ? (
                                date.to ? (
                                    <>
                                        {format(date.from, "LLL dd, y", { locale: es })} -{" "}
                                        {format(date.to, "LLL dd, y", { locale: es })}
                                    </>
                                ) : (
                                    format(date.from, "LLL dd, y", { locale: es })
                                )
                            ) : (
                                <span>Seleccionar fechas</span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={date?.from}
                            selected={date}
                            onSelect={setDate}
                            numberOfMonths={2}
                            locale={es}
                        />
                    </PopoverContent>
                </Popover>
            </div>

            <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Todas las tiendas" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todas las tiendas</SelectItem>
                    {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                            {store.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <div className="flex items-center gap-2 ml-auto">
                <Button variant="ghost" size="icon" onClick={handleReset} title="Restablecer filtros">
                    <RotateCcw className="h-4 w-4 text-gray-500" />
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="hidden sm:flex"
                    onClick={handleExport}
                    disabled={isExporting}
                >
                    {isExporting ? (
                        <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Download className="mr-2 h-4 w-4" />
                    )}
                    {isExporting ? "Exportando..." : "Exportar"}
                </Button>
            </div>
        </div>
    );
}
