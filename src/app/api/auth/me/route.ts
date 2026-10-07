import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedActor } from '@/lib/auth/actor';

export async function GET(req: NextRequest) {
    try {
        void req;
        const user = await getAuthenticatedActor();

        if (!user) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        return NextResponse.json({ user });

    } catch (error) {
        console.error('Me error:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
