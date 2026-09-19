"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpenText,
  Library,
  ListTree,
  Scale,
  LayoutDashboard,
  Menu,
  Home,
} from "lucide-react"
import { useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/", label: "Panel principal", icon: LayoutDashboard },
  { href: "/libro-diario", label: "Libro Diario", icon: BookOpenText },
  { href: "/libro-mayor", label: "Libro Mayor", icon: ListTree },
  { href: "/estados-financieros", label: "Reporte de Estados Financieros", icon: Scale },
  { href: "/catalogo", label: "Catálogo de Cuentas", icon: Library },
]

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-svh bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Scale className="size-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Módulo Contable</p>
            <p className="text-xs text-sidebar-foreground/60">Ciclo contable automático</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border px-5 py-4 text-xs text-sidebar-foreground/60">
          <p>Sistema de gestión contable</p>
          <p className="mt-1">Partida doble y reportes financieros</p>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 md:hidden">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex size-9 items-center justify-center rounded-md border border-border"
            aria-label="Abrir menú"
          >
            <Menu className="size-5" />
          </button>
          <span className="text-sm font-semibold">Módulo Contable</span>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mb-5 flex justify-end print:hidden">
            <Link href="/" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label="Ir al panel principal">
              <Home className="size-4" />
              Panel principal
            </Link>
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}
