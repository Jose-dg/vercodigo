import { notFound } from "next/navigation"

import { ApiKeysManager } from "@/components/developers/api-keys-manager"
import { DocPage } from "@/components/developers/doc-primitives"
import { requireAuthenticatedActor } from "@/lib/auth/actor"
import { API_KEY_SCOPES, API_KEY_SCOPE_LABELS, MAX_ACTIVE_API_KEYS } from "@/modules/api-keys/domain"
import { canManageApiKeys } from "@/modules/api-keys/service"

/** Only the company's OWNER or GENERAL_ADMIN, and only for their own company. */
export default async function ApiKeysPage() {
  const actor = await requireAuthenticatedActor()
  if (!canManageApiKeys(actor)) notFound()

  return (
    <DocPage
      title="API keys"
      lead={`Las keys sandbox simulan todo sin cobrar; las de producción consumen saldo real de tu billetera. Hasta ${MAX_ACTIVE_API_KEYS} activas de cada tipo.`}
    >
      <ApiKeysManager
        scopes={API_KEY_SCOPES.map((scope) => ({ value: scope, label: API_KEY_SCOPE_LABELS[scope] }))}
      />
    </DocPage>
  )
}
