import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/guard";
import { CreateUserBody, CreateUserInput } from "@/services/users/dto";
import { createUser, getUsers } from "@/services/users/users.service";
import { AppError } from "@/lib/errors";

/**
 * GET /api/users
 * Lists users.
 */
async function listUsersHandler(req: NextRequest, ctx: any, ability: any, user: any) {
    try {
        const users = await getUsers(user);
        return NextResponse.json(users);
    } catch (e) {
        console.error("[users/list] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}

/**
 * POST /api/users
 * Creates a new user.
 */
async function createUserHandler(req: NextRequest, ctx: any, ability: any, user: any) {
    try {
        const body = await req.json();
        const parseResult = CreateUserBody.safeParse(body);

        if (!parseResult.success) {
            return NextResponse.json(
                { error: "BAD_REQUEST", details: parseResult.error.issues },
                { status: 400 }
            );
        }

        const newUser = await createUser(parseResult.data as CreateUserInput, user);
        return NextResponse.json(newUser, { status: 201 });

    } catch (e: any) {
        if (e instanceof AppError) {
            return NextResponse.json(
                { error: e.code, message: e.message },
                { status: e.status }
            );
        }
        console.error("[users/create] Error:", e);
        return NextResponse.json(
            { error: "INTERNAL_ERROR" },
            { status: 500 }
        );
    }
}

export const GET = withAuth('read', 'User', listUsersHandler);
export const POST = withAuth('create', 'User', createUserHandler);
