import { z } from "zod";
import { UserRole } from "@prisma/client";
import { PASSWORD_MIN_LENGTH } from "@/modules/identity/domain";

// El correo se guarda normalizado (CHECK en la base): sin espacios y en minúsculas.
const Email = z.string().trim().toLowerCase().email("Invalid email");

export const CreateUserBody = z.object({
    name: z.string().min(1, "Name is required"),
    email: Email,
    password: z.string().min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`),
    role: z.nativeEnum(UserRole),
    companyId: z.string().optional().nullable(),
    storeId: z.string().optional().nullable(),
    purchaseOriginPhoneId: z.string().optional().nullable(),
});

export const UpdateUserBody = z.object({
    name: z.string().min(1).optional(),
    email: Email.optional(),
    role: z.nativeEnum(UserRole).optional(),
    companyId: z.string().optional().nullable(),
    storeId: z.string().optional().nullable(),
    purchaseOriginPhoneId: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
    // Password update usually handled separately or requiring current password
    password: z.string().min(PASSWORD_MIN_LENGTH).optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserBody>;
export type UpdateUserInput = z.infer<typeof UpdateUserBody>;
