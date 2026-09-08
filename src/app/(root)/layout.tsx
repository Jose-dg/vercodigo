import { ReactNode } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AuthProvider } from "@/components/auth/auth-provider"
import prisma from "@/lib/prisma"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await getServerSession(authOptions)
  const companyName = session?.user?.companyId
    ? (await prisma.company.findUnique({
        where: { id: session.user.companyId },
        select: { name: true },
      }))?.name ?? "Empresa"
    : "Diem"
  const authUser = session?.user
    ? {
        id: session.user.id,
        role: session.user.role,
        companyId: session.user.companyId ?? null,
        storeId: session.user.storeId ?? null,
      }
    : null

  return (
    <AuthProvider user={authUser}>
      <SidebarProvider>
        <AppSidebar
          companyName={companyName}
          user={{
            name: session?.user?.name ?? "Usuario",
            email: session?.user?.email ?? "",
            avatar: session?.user?.image ?? "",
          }}
        />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </AuthProvider>
  )
}
