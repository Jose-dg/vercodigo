'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Store,
    Package,
    CreditCard,
    Settings,
    LogOut,
    Users
} from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
    {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'STORE_OPERATOR'],
    },
    {
        title: 'Tiendas',
        href: '/dashboard/stores',
        icon: Store,
        roles: ['SUPER_ADMIN', 'COMPANY_ADMIN'],
    },
    {
        title: 'Productos',
        href: '/dashboard/products',
        icon: Package,
        roles: ['SUPER_ADMIN'],
    },
    {
        title: 'Tarjetas',
        href: '/dashboard/cards',
        icon: CreditCard,
        roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'STORE_OPERATOR'],
    },
    {
        title: 'Usuarios',
        href: '/dashboard/users',
        icon: Users,
        roles: ['SUPER_ADMIN', 'COMPANY_ADMIN'],
    },
    {
        title: 'Configuración',
        href: '/dashboard/settings',
        icon: Settings,
        roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'STORE_OPERATOR'],
    },
];

export function Sidebar({ user }: { user?: { role: string } }) {
    const userRole = user?.role || 'SUPER_ADMIN';
    const pathname = usePathname();

    return (
        <aside className="hidden w-64 flex-col border-r bg-white md:flex">
            <div className="flex h-16 items-center justify-center border-b px-6">
                <span className="text-xl font-bold text-blue-600 tracking-tight">Diem SAS</span>
            </div>

            <nav className="flex-1 space-y-1 p-4">
                {menuItems.map((item) => {
                    if (!item.roles.includes(userRole)) return null;

                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                                isActive
                                    ? "bg-blue-50 text-blue-600"
                                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                            )}
                        >
                            <item.icon className={cn("w-5 h-5", isActive ? "text-blue-600" : "text-gray-500")} />
                            {item.title}
                        </Link>
                    );
                })}
            </nav>

            <div className="border-t p-4">
                <button
                    onClick={async () => {
                        await fetch('/api/auth/logout', { method: 'POST' });
                        window.location.href = '/login';
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    Cerrar Sesión
                </button>
            </div>
        </aside>
    );
}
