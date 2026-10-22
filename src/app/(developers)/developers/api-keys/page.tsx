import { notFound } from "next/navigation"

import { ApiKeysManager } from "@/components/developers/api-keys-manager"
import { Callout, DocPage } from "@/components/developers/doc-primitives"
import { actorIsPlatform, requireAuthenticatedActor } from "@/lib/auth/actor"
import { API_KEY_SCOPES, API_KEY_SCOPE_LABELS, MAX_ACTIVE_API_KEYS } from "@/modules/api-keys/domain"
import { apiKeysConfigured, canManageApiKeys } from "@/modules/api-keys/service"

/** Only the company's OWNER or GENERAL_ADMIN, and only for their own company. */
export default async function ApiKeysPage() {
  const actor = await requireAuthenticatedActor()

  if (actorIsPlatform(actor)) {
    // Keys are each company's credentials: say so instead of a bare 404.
    return (
      <DocPage title="API keys">
        <Callout>
          Las API keys son credenciales de cada empresa: las crea y las ve solo su dueño o un administrador general.
          Con un usuario de plataforma no se gestionan. Para probar, entra con el usuario dueño de una empresa.
        </Callout>
      </DocPage>
    )
  }
  if (!canManageApiKeys(actor)) notFound()

  return (
    <DocPage
      title="API keys"
      lead={`Las keys sandbox simulan todo sin cobrar; las de producción consumen saldo real de tu billetera. Hasta ${MAX_ACTIVE_API_KEYS} activas de cada tipo.`}
    >
      {apiKeysConfigured() ? (
        <ApiKeysManager
          scopes={API_KEY_SCOPES.map((scope) => ({ value: scope, label: API_KEY_SCOPE_LABELS[scope] }))}
        />
      ) : (
        <Callout tone="warning">
          Las API keys todavía no están habilitadas en este servidor (falta la variable API_KEY_PEPPER). Avísale al equipo
          de Diem.
        </Callout>
      )}
    </DocPage>
  )
}
