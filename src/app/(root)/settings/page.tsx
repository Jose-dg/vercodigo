import { redirect } from "next/navigation";

import { SETTINGS_PARAM } from "@/components/settings/params";
import { requireAuthenticatedActor } from "@/lib/auth/actor";
import { homePathForRole } from "@/lib/auth/navigation";

// Configuración es un modal; esta dirección lleva al inicio de cada rol con el modal abierto.
export default async function SettingsPage() {
    const actor = await requireAuthenticatedActor();
    redirect(`${homePathForRole(actor.role)}?${SETTINGS_PARAM}`);
}
