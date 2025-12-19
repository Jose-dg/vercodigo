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
    // Get the first available company or create a default one
    let company = await prisma.company.findFirst({
      where: { isActive: true },
    });

    if (!company) {
      // Create a default company if none exists
      company = await prisma.company.create({
        data: {
          name: "Empresa Principal",
          taxId: "000000000-0",
          email: "contacto@empresa.com",
          phone: "0000000000",
          isActive: true,
        },
      });
    }

    const phone = "1234567890";
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    await prisma.store.create({
      data: {
        ...validatedFields.data,
        code: code,
        companyId: company.id,
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
