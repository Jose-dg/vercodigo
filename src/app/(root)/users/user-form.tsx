"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CreateUserBody, UpdateUserBody } from "@/services/users/dto";
import { UserRole } from "@prisma/client";
import { useCurrentUser } from "@/components/auth/ability-context";
import { getAssignableRoles } from "@/lib/auth/abilities";
import { toast } from "sonner";
import { useEffect, useState } from "react";

const PLATFORM_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN];
const COMPANY_WIDE_ROLES: UserRole[] = [UserRole.OWNER, UserRole.GENERAL_ADMIN];
const STORE_SCOPED_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.OPERATOR];

interface CompanyOption {
    id: string;
    name: string;
}

interface StoreOption {
    id: string;
    name: string;
    companyId: string;
}

// Combine create and update for the form, making password optional for edit
const UserFormSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email(),
    password: z.string().optional(),
    role: z.nativeEnum(UserRole),
    companyId: z.string().optional(),
    storeId: z.string().optional(),
    isActive: z.boolean(),
});

type FormData = z.infer<typeof UserFormSchema>;

interface UserFormProps {
    user?: any; // ToDo: Typed User
    onSuccess: () => void;
    onCancel: () => void;
}

export function UserForm({ user, onSuccess, onCancel }: UserFormProps) {
    const currentUser = useCurrentUser();
    const [loading, setLoading] = useState(false);
    const isEditing = !!user;

    // El actor de plataforma elige compañía/tienda; el de compañía queda fijado
    // a la suya (y el ADMIN también a su tienda).
    const actorIsPlatform = currentUser ? PLATFORM_ROLES.includes(currentUser.role) : false;
    const [companies, setCompanies] = useState<CompanyOption[]>([]);
    const [stores, setStores] = useState<StoreOption[]>([]);

    useEffect(() => {
        if (actorIsPlatform) {
            fetch("/api/companies")
                .then((r) => r.json())
                .then((d) => Array.isArray(d) && setCompanies(d.map((c: any) => ({ id: c.id, name: c.name }))))
                .catch(() => { });
        }
        fetch("/api/stores")
            .then((r) => r.json())
            .then((d) => Array.isArray(d) && setStores(d.map((s: any) => ({ id: s.id, name: s.name, companyId: s.companyId }))))
            .catch(() => { });
    }, [actorIsPlatform]);

    const form = useForm<FormData>({
        resolver: zodResolver(UserFormSchema),
        defaultValues: {
            name: user?.name || "",
            email: user?.email || "",
            role: (user?.role as UserRole) || UserRole.OPERATOR,
            companyId: user?.companyId || undefined,
            storeId: user?.storeId || undefined,
            isActive: user?.isActive ?? true,
            password: "",
        },
    });

    const onSubmit = async (data: FormData) => {
        setLoading(true);
        try {
            // La contraseña es obligatoria al crear y opcional al editar. En
            // edición, dejarla vacía conserva la contraseña actual.
            if (!isEditing && (!data.password || data.password.length < 8)) {
                form.setError("password", { message: "Password required (min 8 chars)" });
                setLoading(false);
                return;
            }
            if (isEditing && data.password && data.password.length < 8) {
                form.setError("password", { message: "La nueva contraseña debe tener mínimo 8 caracteres" });
                setLoading(false);
                return;
            }

            // Scope según el rol elegido: plataforma sin compañía/tienda; roles
            // de compañía sin tienda. El actor de compañía siempre crea dentro
            // de la suya (el backend lo re-valida).
            const targetIsPlatform = PLATFORM_ROLES.includes(data.role);
            const targetIsCompanyWide = COMPANY_WIDE_ROLES.includes(data.role);
            const effectiveCompanyId = actorIsPlatform ? data.companyId : currentUser?.companyId;

            const { password, ...dataWithoutPassword } = data;
            const payload = {
                ...dataWithoutPassword,
                // No enviar una cadena vacía durante la edición: el backend
                // interpreta la ausencia del campo como "no cambiarla".
                ...(password ? { password } : {}),
                companyId: targetIsPlatform ? null : effectiveCompanyId || null,
                storeId: targetIsPlatform || targetIsCompanyWide ? null : data.storeId || null,
            };

            const url = isEditing ? `/api/users/${user.id}` : "/api/users";
            const method = isEditing ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Failed to save user");
            }

            toast.success(isEditing ? "Usuario actualizado" : "Usuario creado");
            onSuccess();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    // Only roles the acting user is allowed to assign, per the role hierarchy.
    const availableRoles = currentUser ? getAssignableRoles(currentUser.role) : [];

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nombre</FormLabel>
                            <FormControl>
                                <Input placeholder="John Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                                <Input placeholder="john@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{isEditing ? "Nueva contraseña" : "Contraseña"}</FormLabel>
                            <FormControl>
                                <Input
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder={isEditing ? "Dejar vacío para conservar la actual" : "Mínimo 8 caracteres"}
                                    {...field}
                                />
                            </FormControl>
                            {isEditing && (
                                <FormDescription>
                                    Completa este campo únicamente para restablecer la contraseña del usuario.
                                </FormDescription>
                            )}
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Rol</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar rol" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {availableRoles.map(role => (
                                        <SelectItem key={role} value={role}>
                                            {role}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Compañía: solo la elige la plataforma y solo para roles de
                    compañía. Los actores de compañía crean dentro de la suya. */}
                {actorIsPlatform && !PLATFORM_ROLES.includes(form.watch("role")) && (
                    <FormField
                        control={form.control}
                        name="companyId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Compañía</FormLabel>
                                <Select
                                    onValueChange={(v) => {
                                        field.onChange(v);
                                        form.setValue("storeId", undefined);
                                    }}
                                    value={field.value ?? ""}
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar compañía..." />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {companies.map((c) => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                {/* Tienda: requerida solo para ADMIN/OPERATOR, filtrada por la
                    compañía elegida (o la del actor). */}
                {STORE_SCOPED_ROLES.includes(form.watch("role")) && (
                    <FormField
                        control={form.control}
                        name="storeId"
                        render={({ field }) => {
                            const scopeCompanyId = actorIsPlatform
                                ? form.watch("companyId")
                                : currentUser?.companyId;
                            // Un ADMIN solo gestiona personal de su propio local.
                            const availableStores = stores.filter((s) =>
                                currentUser?.role === UserRole.ADMIN
                                    ? s.id === currentUser.storeId
                                    : s.companyId === scopeCompanyId
                            );
                            return (
                                <FormItem>
                                    <FormLabel>Tienda</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue
                                                    placeholder={
                                                        scopeCompanyId
                                                            ? "Seleccionar tienda..."
                                                            : "Primero selecciona la compañía"
                                                    }
                                                />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {availableStores.map((s) => (
                                                <SelectItem key={s.id} value={s.id}>
                                                    {s.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>Requerido para Admin/Operador de un local</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            );
                        }}
                    />
                )}

                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={onCancel}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? "Guardando..." : "Guardar"}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
