import type { ReactNode } from "react"

import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { DevelopersSidebar } from "@/components/developers/developers-sidebar"
import { DocsBreadcrumb } from "@/components/developers/docs-breadcrumb"
import { requireAuthenticatedActor } from "@/lib/auth/actor"
import { canManageApiKeys } from "@/modules/api-keys/service"

export const metadata = { title: "API para empresas · Desarrolladores" }

/** Docs are behind a session for now; they become public later. */
export default async function DevelopersLayout({ children }: { children: ReactNode }) {
  const actor = await requireAuthenticatedActor()
  const canManageKeys = canManageApiKeys(actor)

  return (
    <SidebarProvider>
      <DevelopersSidebar canManageKeys={canManageKeys} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur">
          <div className="flex items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <DocsBreadcrumb />
          </div>
        </header>
        <div className="flex flex-1 flex-col px-4 py-8 sm:px-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
