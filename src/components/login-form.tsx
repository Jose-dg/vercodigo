"use client"

import { useRef, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { LoaderCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { homePathForRole } from "@/lib/auth/navigation"
import type { UserRole } from "@prisma/client"

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const errorRef = useRef<HTMLParagraphElement>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/admin",
      })

      if (!result?.ok) {
        setError("El correo o la contraseña no son correctos.")
        requestAnimationFrame(() => errorRef.current?.focus())
        return
      }

      const me = await fetch("/api/auth/me", { cache: "no-store" })
      const payload = await me.json()
      if (!me.ok || !payload.user?.role) throw new Error("No se pudo verificar la sesión")
      router.push(homePathForRole(payload.user.role as UserRole))
      router.refresh()
    } catch {
      setError("No fue posible iniciar sesión. Intenta nuevamente.")
      requestAnimationFrame(() => errorRef.current?.focus())
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <h1 className="text-xl font-semibold leading-none tracking-tight text-balance">Bienvenido</h1>
          <CardDescription>
            Ingresa con la cuenta de tu empresa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-6">
              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="nombre@empresa.com"
                    autoComplete="email"
                    spellCheck={false}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={isLoading}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "login-error" : undefined}
                    required
                  />
                </div>
                {error ? (
                  <p ref={errorRef} id="login-error" role="alert" tabIndex={-1} className="text-sm text-destructive focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" className="w-full" disabled={isLoading} aria-busy={isLoading}>
                  {isLoading ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
                  {isLoading ? "Iniciando sesión…" : "Iniciar sesión"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
