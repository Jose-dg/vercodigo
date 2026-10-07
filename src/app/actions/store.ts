"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAuthenticatedActor } from "@/lib/auth/actor";
import { createStoreForActor } from "@/services/store.service";

const storeSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  address: z.string().min(3, "Address must be at least 3 characters"),
  phone: z.string().min(7, "Phone must be at least 7 characters"),
  companyId: z.string().optional(),
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
    phone: formData.get("phone"),
    companyId: formData.get("companyId") || undefined,
  });

  if (!validatedFields.success) {
    return {
      message:
        validatedFields.error.issues.map((e) => e.message).join(", ") ||
        "Invalid form data",
    };
  }

  try {
    const actor = await requireAuthenticatedActor();
    await createStoreForActor(actor, validatedFields.data);

    revalidatePath("/store");
    return { message: "Store created successfully." };
  } catch (e) {
    console.error("[store/create]", e);
    return { message: e instanceof Error ? e.message : "No se pudo crear la sede." };
  }
}
