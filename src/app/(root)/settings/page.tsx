import { redirect } from "next/navigation";

import { requireAuthenticatedActor } from "@/lib/auth/actor";
import { homePathForRole } from "@/lib/auth/navigation";
import { SETTINGS_PARAM } from "@/components/settings/params";

/** Compatibility deep-link: account security is managed in Clerk's modal. */
export default async function SettingsProfilePage() {
    const actor = await requireAuthenticatedActor();
    redirect(`${homePathForRole(actor.role)}?${SETTINGS_PARAM}`);
}
