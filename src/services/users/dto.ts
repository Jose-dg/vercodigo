import { z } from "zod";
import { UserRole } from "@prisma/client";

export const CreateUserBody = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    role: z.nativeEnum(UserRole),
    companyId: z.string().optional().nullable(),
    storeId: z.string().optional().nullable(),
});

export const UpdateUserBody = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    role: z.nativeEnum(UserRole).optional(),
    companyId: z.string().optional().nullable(),
    storeId: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
    // Password update usually handled separately or requiring current password
    password: z.string().min(8).optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserBody>;
export type UpdateUserInput = z.infer<typeof UpdateUserBody>;
