"use client";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Company } from "@prisma/client";

interface CompanySelectProps {
    companies: Company[];
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export function CompanySelect({
    companies,
    value,
    onChange,
    placeholder = "Seleccionar empresa",
}: CompanySelectProps) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-[280px]">
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                        {company.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
