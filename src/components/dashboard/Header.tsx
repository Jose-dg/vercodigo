'use client';

import { Bell, User } from 'lucide-react';

interface HeaderProps {
    user?: {
        name: string;
        role: string;
        email: string;
    };
}

export function Header({ user }: HeaderProps) {
    return (
        <header className="flex h-16 items-center justify-between border-b bg-white px-6">
            <h1 className="text-xl font-semibold text-gray-800">
                Bienvenido, {user?.name || 'Usuario'}
            </h1>

            <div className="flex items-center gap-4">
                <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>

                <div className="flex items-center gap-3 pl-4 border-l">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                        <p className="text-xs text-gray-500">{user?.role}</p>
                    </div>
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                        <User className="w-5 h-5" />
                    </div>
                </div>
            </div>
        </header>
    );
}
