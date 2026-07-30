import { NextRequest, NextResponse } from 'next/server';
import { defineAbilitiesFor, AppAbility, Actions, Subjects } from './abilities';
import { verifyAuth } from '@/lib/auth'; // Ensure this exists from previous impl

type RouteHandler = (
    req: NextRequest,
    context: any,
    ability: AppAbility,
    user: any // Typed as User from Prisma
) => Promise<NextResponse>;

/**
 * Wraps an API Route handler with Authorization checks.
 * @param action The action to check (e.g. 'read', 'create')
 * @param subject The subject to check (e.g. 'Card', 'all')
 * @param handler The actual route handler
 */
export function withAuth(
    action: Actions,
    subject: Subjects,
    handler: RouteHandler
) {
    return async (req: NextRequest, context: any) => {
        try {
            const user = await verifyAuth(req);

            if (!user) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            const ability = defineAbilitiesFor(user as any);

            if (ability.cannot(action, subject)) {
                return NextResponse.json({
                    error: 'Forbidden',
                    message: `You are not allowed to ${action} ${subject}`
                }, { status: 403 });
            }

            return handler(req, context, ability, user);

        } catch (error) {
            console.error('Auth Guard Error:', error);
            return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
        }
    };
}
