"use client"

import { UserButton } from "@clerk/nextjs"

import { SidebarMenu, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"

/**
 * Cuenta de la persona con el UserButton de Clerk: foto, nombre, "Gestionar cuenta"
 * (correo, contraseña, Google/Apple, dispositivos) y cerrar sesión. Con el menú
 * colapsado queda solo el avatar.
 */
export function NavUser() {
  const { state, isMobile } = useSidebar()
  const collapsed = state === "collapsed" && !isMobile

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <UserButton
          showName={!collapsed}
          appearance={{
            elements: {
              rootBox: "w-full",
              userButtonTrigger:
                "w-full justify-start rounded-md p-1 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:shadow-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              userButtonBox: "flex-row-reverse gap-2",
              userButtonOuterIdentifier: "truncate text-sm font-medium text-sidebar-foreground",
              avatarBox: "size-8 rounded-lg",
            },
          }}
        />
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
