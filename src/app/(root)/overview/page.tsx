import { CompanyHome } from "@/components/dashboard/company-home";
import { defineAbilitiesFor } from "@/lib/auth/abilities";
import { actorIsPlatform, requireAuthenticatedActor } from "@/lib/auth/actor";

/** Company home: owners and general admins see theirs; the platform picks a company. */
export default async function CompanyOverviewPage() {
    const actor = await requireAuthenticatedActor();
    if (defineAbilitiesFor(actor).cannot("read", "Company")) {
        return <div className="p-8">No tienes permisos para ver esta página.</div>;
    }
    return <CompanyHome name={actor.name} email={actor.email} isPlatform={actorIsPlatform(actor)} />;
}
