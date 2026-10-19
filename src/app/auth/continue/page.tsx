import { auth } from "@clerk/nextjs/server"
import { SignOutButton } from "@clerk/nextjs"
import { redirect } from "next/navigation"

import { Button } from "@/components/ui/button"
import { getAuthenticatedActor } from "@/lib/auth/actor"
import { homePathForRole } from "@/lib/auth/navigation"

/**
 * Destino por defecto después de iniciar sesión: el inicio de cada rol. Si la cuenta
 * de Clerk no corresponde a un usuario activo del portal (registro cerrado, usuario
 * desactivado o empresa inactiva), lo explica en lugar de dar un error.
 */
export default async function ContinueAfterSignIn() {
  const { userId } = await auth()
  if (!userId) redirect("/login")
  const actor = await getAuthenticatedActor()
  if (actor) redirect(homePathForRole(actor.role))

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-muted p-6 text-center">
      <h1 className="text-xl font-semibold">Tu cuenta no tiene acceso al portal</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Pide al administrador de tu empresa que te dé acceso, o entra con el correo con el que te crearon la cuenta.
      </p>
      <SignOutButton redirectUrl="/login">
        <Button variant="outline">Usar otra cuenta</Button>
      </SignOutButton>
    </div>
  )
}
