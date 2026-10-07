import { ReactNode } from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AuthProvider } from "@/components/auth/auth-provider"
import { getActorCompanyName, requireAuthenticatedActor } from "@/lib/auth/actor"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const actor = await requireAuthenticatedActor()
  const companyName = await getActorCompanyName(actor)
  const authUser = {
    id: actor.id,
    role: actor.role,
    companyId: actor.companyId,
    storeId: actor.storeId,
  }

  return (
    <AuthProvider user={authUser}>
      <SidebarProvider>
        <AppSidebar
          companyName={companyName}
          user={{
            name: actor.name,
            email: actor.email,
            avatar: "",
          }}
        />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </AuthProvider>
  )
}
