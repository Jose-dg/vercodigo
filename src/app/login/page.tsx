import Link from "next/link"
import { GalleryVerticalEnd } from "lucide-react"

import { LoginForm } from "@/components/login-form"
import { ThemeToggle } from "@/components/ui/theme-toggle"

export default function LoginPage() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-medium">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GalleryVerticalEnd aria-hidden="true" className="size-4" />
          </div>
          <span translate="no">Vercode</span>
        </Link>
        <LoginForm />
      </div>
    </div>
  )
}
