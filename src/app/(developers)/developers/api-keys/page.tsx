import { notFound } from "next/navigation"

import { ApiKeysManager } from "@/components/developers/api-keys-manager"
import { DocPage } from "@/components/developers/doc-primitives"
import { defineAbilitiesFor } from "@/lib/auth/abilities"
import { actorIsPlatform, requireAuthenticatedActor } from "@/lib/auth/actor"
import { API_KEY_SCOPES, API_KEY_SCOPE_LABELS, MAX_ACTIVE_API_KEYS } from "@/modules/api-keys/domain"

export default async function ApiKeysPage() {
  const actor = await requireAuthenticatedActor()
  const ability = defineAbilitiesFor(actor)
  if (ability.cannot("read", "ApiKey")) notFound()

  return (
    <DocPage
      title="API keys"
      lead={`Cada key da acceso a la API en nombre de quien la crea. Puedes tener hasta ${MAX_ACTIVE_API_KEYS} activas.`}
    >
      <ApiKeysManager
        isPlatform={actorIsPlatform(actor)}
        canCreate={ability.can("create", "ApiKey") && !actorIsPlatform(actor)}
        scopes={API_KEY_SCOPES.map((scope) => ({ value: scope, label: API_KEY_SCOPE_LABELS[scope] }))}
      />
    </DocPage>
  )
}
