"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import prisma from "@/lib/prisma";

const storeSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  address: z.string().min(3, "Address must be at least 3 characters"),
});

export async function createStore(
  prevState: {
    message: string;
  },
  formData: FormData,
) {
  const validatedFields = storeSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
  });

  if (!validatedFields.success) {
    return {
      message:
        validatedFields.error.issues.map((e) => e.message).join(", ") ||
        "Invalid form data",
    };
  }

  try {
    // TODO: These values should not be hardcoded.
    // The companyId should come from the authenticated user's session.
    // The phone number might be part of the store data or company data.
    const companyId = "clvya1q5100001y6g26y2k89d";
    const phone = "1234567890";
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    await prisma.store.create({
      data: {
        ...validatedFields.data,
        code: code,
        companyId: companyId,
        phone: phone,
      },
    });

    revalidatePath("/store");
    return { message: "Store created successfully." };
  } catch (e) {
    console.error(e);
    return { message: "Failed to create store." };
  }
}
