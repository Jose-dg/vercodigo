"use client";

import { useEffect, useState } from "react";
import { useAbility } from "@/components/auth/ability-context";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Plus, Edit } from "lucide-react";
import { toast } from "sonner";
import { UserRole } from "@prisma/client";
import { UserForm } from "./user-form";

interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    companyId: string | null;
    storeId: string | null;
    isActive: boolean;
    company?: { name: string };
    store?: { name: string };
}

export default function UsersPage() {
    const ability = useAbility();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | undefined>(undefined);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/users");
            if (!res.ok) throw new Error("Failed to fetch users");
            const data = await res.json();
            setUsers(data);
        } catch (error) {
            toast.error("Error cargando usuarios");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (ability.can("read", "User")) {
            fetchUsers();
        }
    }, [ability]);

    const handleCreate = () => {
        setSelectedUser(undefined);
        setIsSheetOpen(true);
    };

    const handleEdit = (user: User) => {
        setSelectedUser(user);
        setIsSheetOpen(true);
    };

    const handleSuccess = () => {
        setIsSheetOpen(false);
        fetchUsers();
    };

    if (!ability.can("read", "User")) {
        return <div className="p-8">No tienes permisos para ver esta página.</div>;
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Usuarios</h1>
                {ability.can("create", "User") && (
                    <Button onClick={handleCreate}>
                        <Plus className="mr-2 h-4 w-4" /> Crear Usuario
                    </Button>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Listado de Usuarios</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Rol</TableHead>
                                <TableHead>Compañía / Tienda</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24">
                                        Cargando...
                                    </TableCell>
                                </TableRow>
                            ) : users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24">
                                        No hay usuarios encontrados.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">{user.name}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>{user.role}</TableCell>
                                        <TableCell>
                                            {user.company?.name || user.store?.name || "-"}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded text-xs ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {user.isActive ? "Activo" : "Inactivo"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {ability.can("update", "User") && (
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(user)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent side="right" className="sm:max-w-xl overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle>{selectedUser ? "Editar Usuario" : "Crear Usuario"}</SheetTitle>
                        <SheetDescription>
                            {selectedUser ? "Modifica los datos del usuario." : "Completa el formulario para registrar un nuevo usuario."}
                        </SheetDescription>
                    </SheetHeader>
                    <div className="mt-2 px-4 pb-6">
                        <UserForm
                            user={selectedUser}
                            onSuccess={handleSuccess}
                            onCancel={() => setIsSheetOpen(false)}
                        />
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}

