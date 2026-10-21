import Link from "next/link"
import { SignIn } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"
import { GalleryVerticalEnd } from "lucide-react"
import { redirect } from "next/navigation"

import { ThemeToggle } from "@/components/ui/theme-toggle"

/**
 * Inicio de sesión con Clerk: correo y contraseña, Google, Apple y "Olvidé mi
 * contraseña". El registro está cerrado (cuentas creadas por un admin), por eso no
 * se muestra el enlace de registro. Ruta catch-all: Clerk usa subrutas para sus pasos.
 */
export default async function LoginPage() {
  const { userId } = await auth()
  if (userId) redirect("/auth/continue")

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-medium">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GalleryVerticalEnd aria-hidden="true" className="size-4" />
          </div>
          <span translate="no">Vercode</span>
        </Link>
        <SignIn
          path="/login"
          routing="path"
          appearance={{
            elements: {
              rootBox: "w-full",
              cardBox: "w-full shadow-none",
              footerAction: "hidden",
            },
          }}
        />
      </div>
    </div>
  )
}
