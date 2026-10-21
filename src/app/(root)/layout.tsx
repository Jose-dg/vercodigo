import { ReactNode } from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AppTopBar } from "@/components/wallet/app-top-bar"
import { TopUpProvider } from "@/components/wallet/top-up-provider"
import { AuthProvider } from "@/components/auth/auth-provider"
import { PasswordChangeNudge } from "@/components/auth/password-change-nudge"
import { OpenProfileFromUrl } from "@/components/settings/open-profile-from-url"
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
        <OpenProfileFromUrl />
        <AppSidebar companyName={companyName} />
        <SidebarInset>
          <TopUpProvider>
            <AppTopBar />
            {actor.mustChangePassword ? <PasswordChangeNudge /> : null}
            {children}
          </TopUpProvider>
        </SidebarInset>
      </SidebarProvider>
    </AuthProvider>
  )
}
