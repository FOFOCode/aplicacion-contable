"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Archive,
  BookOpenText,
  Eye,
  EyeOff,
  Home,
  LayoutDashboard,
  Library,
  ListTree,
  LockKeyhole,
  LogIn,
  LogOut,
  Menu,
  Scale,
  UserRound,
} from "lucide-react"

import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"

import { cn } from "@/lib/utils"
import { useContabilidad } from "@/components/contabilidad-provider"

const NAV = [
  {
    href: "/",
    label: "Panel principal",
    icon: LayoutDashboard,
  },
  {
    href: "/libro-diario",
    label: "Libro Diario",
    icon: BookOpenText,
  },
  {
    href: "/libro-mayor",
    label: "Libro Mayor",
    icon: ListTree,
  },
  {
    href: "/estados-financieros",
    label: "Reporte de Estados Financieros",
    icon: Scale,
  },
  {
    href: "/catalogo",
    label: "Catálogo de Cuentas",
    icon: Library,
  },
  {
  href: "/archivo-contable",
  label: "Archivo Contable",
  icon: Archive,
},
]

const SESSION_KEY = "finexa:sesion"

export function AppShell({
  children,
}: {
  children: ReactNode
}) {
  const pathname = usePathname()

  const [open, setOpen] = useState(false)

  const [sesionIniciada, setSesionIniciada] =
    useState(false)

  const [verificandoSesion, setVerificandoSesion] =
    useState(true)

  const [usuario, setUsuario] =
    useState("")

  const [password, setPassword] =
    useState("")

  const [mostrarPassword, setMostrarPassword] =
    useState(false)

  const [errorLogin, setErrorLogin] =
    useState("")

  const { dbConnected } =
    useContabilidad()

  // ============================================================
  // REVISAR SESIÓN LOCAL
  // ============================================================

  useEffect(() => {
    const sesion =
      localStorage.getItem(
        SESSION_KEY
      )

    if (sesion === "true") {
      setSesionIniciada(true)
    }

    setVerificandoSesion(false)
  }, [])

  // ============================================================
  // INICIAR SESIÓN
  // ============================================================

  function iniciarSesion(
    e: FormEvent
  ) {
    e.preventDefault()

    setErrorLogin("")

    if (!usuario.trim()) {
      setErrorLogin(
        "Ingrese el usuario."
      )

      return
    }

    if (!password.trim()) {
      setErrorLogin(
        "Ingrese la contraseña."
      )

      return
    }

    /*
      LOGIN TEMPORAL.

      Mientras todavía no exista una tabla de usuarios,
      cualquier usuario y contraseña no vacíos permiten
      ingresar al sistema.

      El rol es únicamente Contador.
    */

    localStorage.setItem(
      SESSION_KEY,
      "true"
    )

    setSesionIniciada(true)

    setPassword("")
  }

  // ============================================================
  // CERRAR SESIÓN
  // ============================================================

  function cerrarSesion() {
    localStorage.removeItem(
      SESSION_KEY
    )

    setSesionIniciada(false)
    setUsuario("")
    setPassword("")
    setErrorLogin("")
    setOpen(false)
  }

  // ============================================================
  // CARGANDO SESIÓN
  // Evita que aparezca brevemente el sistema antes del login.
  // ============================================================

  if (verificandoSesion) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Scale className="size-6" />
          </div>

          <p className="text-sm text-muted-foreground">
            Cargando Finexa...
          </p>
        </div>
      </div>
    )
  }

  // ============================================================
  // LOGIN
  // ============================================================

  if (!sesionIniciada) {
    return (
      <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4">

        {/* FONDO DECORATIVO */}

        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[450px] w-[700px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="relative w-full max-w-md">

          {/* MARCA */}

          <div className="mb-7 text-center">

            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <Scale className="size-7" />
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight">
              Finexa
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Gestión contable inteligente
            </p>

          </div>

          {/* TARJETA LOGIN */}

          <div className="rounded-2xl border border-border bg-card p-7 shadow-xl">

            <div className="mb-6">
              <h2 className="text-xl font-semibold">
                Iniciar sesión
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Ingresa tus credenciales para acceder al sistema.
              </p>
            </div>

            <form
              onSubmit={
                iniciarSesion
              }
              className="space-y-5"
            >

              {/* USUARIO */}

              <div className="space-y-2">

                <label
                  htmlFor="usuario"
                  className="text-sm font-medium"
                >
                  Usuario
                </label>

                <div className="relative">

                  <UserRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                  <input
                    id="usuario"
                    type="text"
                    autoComplete="username"
                    placeholder="Ingrese su usuario"
                    value={usuario}
                    onChange={(e) => {
                      setUsuario(
                        e.target.value
                      )

                      setErrorLogin("")
                    }}
                    className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />

                </div>

              </div>

              {/* CONTRASEÑA */}

              <div className="space-y-2">

                <label
                  htmlFor="password"
                  className="text-sm font-medium"
                >
                  Contraseña
                </label>

                <div className="relative">

                  <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                  <input
                    id="password"
                    type={
                      mostrarPassword
                        ? "text"
                        : "password"
                    }
                    autoComplete="current-password"
                    placeholder="Ingrese su contraseña"
                    value={password}
                    onChange={(e) => {
                      setPassword(
                        e.target.value
                      )

                      setErrorLogin("")
                    }}
                    className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-11 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setMostrarPassword(
                        (v) => !v
                      )
                    }
                    className="absolute right-3 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label={
                      mostrarPassword
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
                    }
                  >
                    {mostrarPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>

                </div>

              </div>

              {/* ROL */}

              <div className="space-y-2">

                <label className="text-sm font-medium">
                  Tipo de usuario
                </label>

                <div className="flex h-11 items-center gap-3 rounded-lg border border-border bg-muted/30 px-3">

                  <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <UserRound className="size-4" />
                  </div>

                  <div>
                    <p className="text-sm font-medium">
                      Contador
                    </p>
                  </div>

                </div>

              </div>

              {/* ERROR */}

              {errorLogin && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
                  <p className="text-sm text-red-500">
                    {errorLogin}
                  </p>
                </div>
              )}

              {/* BOTÓN */}

              <button
                type="submit"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <LogIn className="size-4" />

                Iniciar sesión
              </button>

            </form>

          </div>

          {/* PIE */}

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Finexa · Sistema de gestión contable
          </p>

        </div>

      </div>
    )
  }

  // ============================================================
  // SISTEMA
  // ============================================================

  return (
    <div className="flex min-h-svh bg-background">

      {/* ====================================================== */}
      {/* MENÚ LATERAL */}
      {/* ====================================================== */}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform md:static md:translate-x-0",
          open
            ? "translate-x-0"
            : "-translate-x-full"
        )}
      >

        {/* MARCA */}

        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">

          <div className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <Scale className="size-5" />
          </div>

          <div className="leading-tight">

            <p className="text-base font-bold tracking-tight">
              Finexa
            </p>

            <p className="mt-0.5 text-xs text-sidebar-foreground/60">
              Gestión contable inteligente
            </p>

          </div>

        </div>

        {/* ====================================================== */}
        {/* NAVEGACIÓN */}
        {/* ====================================================== */}

        <nav className="flex-1 space-y-1 px-3 py-4">

          {NAV.map((item) => {
            const active =
              pathname === item.href

            const Icon =
              item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() =>
                  setOpen(false)
                }
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",

                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />

                {item.label}
              </Link>
            )
          })}

        </nav>

        {/* ====================================================== */}
        {/* USUARIO */}
        {/* ====================================================== */}

        <div className="border-t border-sidebar-border p-3">

          <div className="mb-2 flex items-center gap-3 rounded-lg bg-sidebar-accent/40 px-3 py-3">

            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/10 text-sidebar-primary">
              <UserRound className="size-4" />
            </div>

            <div className="min-w-0 flex-1">

              <p className="truncate text-sm font-medium">
                {usuario || "Contador"}
              </p>

              <p className="text-xs text-sidebar-foreground/60">
                Contador
              </p>

            </div>

          </div>

          <button
            type="button"
            onClick={
              cerrarSesion
            }
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-red-500/10 hover:text-red-500"
          >
            <LogOut className="size-4" />

            Cerrar sesión
          </button>

        </div>

      </aside>

      {/* ====================================================== */}
      {/* FONDO MÓVIL */}
      {/* ====================================================== */}

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() =>
            setOpen(false)
          }
          aria-hidden
        />
      )}

      {/* ====================================================== */}
      {/* CONTENIDO */}
      {/* ====================================================== */}

      <div className="flex min-w-0 flex-1 flex-col">

        {/* HEADER MÓVIL */}

        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 md:hidden">

          <button
            onClick={() =>
              setOpen(
                (v) => !v
              )
            }
            className="flex size-9 items-center justify-center rounded-md border border-border"
            aria-label="Abrir menú"
          >
            <Menu className="size-5" />
          </button>

          <div className="leading-tight">

            <p className="text-sm font-bold">
              Finexa
            </p>

            <p className="text-[11px] text-muted-foreground">
              Gestión contable inteligente
            </p>

          </div>

        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">

          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">

            {/* CONEXIÓN BD */}

            <div className="flex items-center gap-2">

              {dbConnected ? (

                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">

                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />

                  Base de Datos: PostgreSQL Conectado

                </span>

              ) : (

                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">

                  <span className="size-1.5 rounded-full bg-amber-500" />

                  Modo Navegador (Sin BD activa)

                </span>

              )}

            </div>

            {/* PANEL PRINCIPAL */}

            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Ir al panel principal"
            >
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