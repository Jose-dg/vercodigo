import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/guard";
import { UpdateUserBody, UpdateUserInput } from "@/services/users/dto";
import { updateUser, deleteUser } from "@/services/users/users.service";
import { AppError } from "@/lib/errors";

/**
 * PATCH /api/users/[id]
 * Updates a user.
 */
async function updateUserHandler(
    req: NextRequest,
    ctx: { params: Promise<{ id: string }> },
    ability: any,
    user: any,
) {
    try {
        const { id } = await ctx.params;
        const body = await req.json();
        const parseResult = UpdateUserBody.safeParse(body);

        if (!parseResult.success) {
            return NextResponse.json(
                { error: "BAD_REQUEST", details: parseResult.error.issues },
                { status: 400 }
            );
        }

        const updatedUser = await updateUser(id, parseResult.data as UpdateUserInput, user);
        return NextResponse.json(updatedUser);

    } catch (e: any) {
        if (e instanceof AppError) {
            return NextResponse.json(
                { error: e.code, message: e.message },
                { status: e.status }
            );
        }
        console.error("[users/update] Error:", e);
        return NextResponse.json(
            { error: "INTERNAL_ERROR" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/users/[id]
 * Deletes a user.
 */
async function deleteUserHandler(
    req: NextRequest,
    ctx: { params: Promise<{ id: string }> },
    ability: any,
    user: any,
) {
    try {
        const { id } = await ctx.params;
        await deleteUser(id, user);
        return NextResponse.json({ success: true });

    } catch (e: any) {
        if (e instanceof AppError) {
            return NextResponse.json(
                { error: e.code, message: e.message },
                { status: e.status }
            );
        }
        console.error("[users/delete] Error:", e);
        return NextResponse.json(
            { error: "INTERNAL_ERROR" },
            { status: 500 }
        );
    }
}

export const PATCH = withAuth('update', 'User', updateUserHandler);
export const DELETE = withAuth('delete', 'User', deleteUserHandler);
