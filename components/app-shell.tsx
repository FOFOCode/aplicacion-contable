"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Archive,
  BookOpenText,
  Calendar,
  CalendarPlus,
  ClipboardList,
  Eye,
  EyeOff,
  History,
  Home,
  LayoutDashboard,
  Library,
  ListTree,
  Lock,
  LockKeyhole,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Scale,
  Sun,
  UserRound,
  X,
} from "lucide-react"

import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"

import { cn } from "@/lib/utils"
import { useContabilidad } from "@/components/contabilidad-provider"

// ============================================================
// NAVEGACIÓN
// ============================================================

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
    href: "/kardex",
    label: "Kardex / Auxiliar",
    icon: ClipboardList,
  },
  {
    href: "/estados-financieros",
    label: "Estados Financieros",
    icon: Scale,
  },
  {
    href: "/ciclos",
    label: "Ciclos Contables",
    icon: History,
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

// ============================================================
// SESIÓN
// ============================================================

const SESSION_KEY = "finexa:sesion"

type UsuarioSesion = {
  id: string
  nombre: string
  email: string
  tipo: string
}

// ============================================================
// COMPONENTE
// ============================================================

export function AppShell({
  children,
}: {
  children: ReactNode
}) {
  const pathname = usePathname()

  const [open, setOpen] = useState(false)

  // ============================================================
  // CONTABILIDAD / CICLOS
  // ============================================================

  const {
    dbConnected,
    ejercicios,
    ejercicioSeleccionado,
    setEjercicioSeleccionado,
    esEjercicioCerrado,
    crearEjercicio,
  } = useContabilidad()

  // ============================================================
  // LOGIN
  // ============================================================

  const [sesionIniciada, setSesionIniciada] =
    useState(false)

  const [verificandoSesion, setVerificandoSesion] =
    useState(true)

  const [email, setEmail] =
    useState("")

  const [password, setPassword] =
    useState("")

  const [usuarioSesion, setUsuarioSesion] =
    useState<UsuarioSesion | null>(null)

  const [iniciandoSesion, setIniciandoSesion] =
    useState(false)

  const [mostrarPassword, setMostrarPassword] =
    useState(false)

  const [errorLogin, setErrorLogin] =
    useState("")

  // ============================================================
  // TEMA
  // ============================================================

  const [isDark, setIsDark] = useState(true)

useEffect(() => {
  const temaGuardado =
    localStorage.getItem("finexa-theme")

  const usarOscuro =
    temaGuardado !== "light"

  setIsDark(usarOscuro)

  document.documentElement.classList.toggle(
    "dark",
    usarOscuro
  )

  document.documentElement.style.colorScheme =
    usarOscuro
      ? "dark"
      : "light"
}, [])

function toggleTheme() {
  setIsDark((actual) => {
    const nuevoTemaOscuro =
      !actual

    document.documentElement.classList.toggle(
      "dark",
      nuevoTemaOscuro
    )

    document.documentElement.style.colorScheme =
      nuevoTemaOscuro
        ? "dark"
        : "light"

    localStorage.setItem(
      "finexa-theme",
      nuevoTemaOscuro
        ? "dark"
        : "light"
    )

    return nuevoTemaOscuro
  })
}
  // ============================================================
  // CREAR EJERCICIO
  // ============================================================

  const [mostrarCrear, setMostrarCrear] =
    useState(false)

  const maxAnio =
    ejercicios &&
    ejercicios.length > 0
      ? Math.max(
          ...ejercicios.map(
            (e) => e.ejercicio
          )
        )
      : new Date().getFullYear()

  const [nuevoAnio, setNuevoAnio] =
    useState(maxAnio + 1)

  const [creando, setCreando] =
    useState(false)

  const [errorCrear, setErrorCrear] =
    useState("")

  function abrirModalCrear() {
    setErrorCrear("")

    const sugerido =
      ejercicios &&
      ejercicios.length > 0
        ? Math.max(
            ...ejercicios.map(
              (e) => e.ejercicio
            )
          ) + 1
        : new Date().getFullYear() + 1

    setNuevoAnio(sugerido)

    setMostrarCrear(true)
  }

  async function handleCrearEjercicio(
    e: FormEvent
  ) {
    e.preventDefault()

    setErrorCrear("")

    const anioNum =
      Number(nuevoAnio)

    if (
      Number.isNaN(anioNum) ||
      anioNum < 2000 ||
      anioNum > 2100
    ) {
      setErrorCrear(
        "Ingresa un año válido entre 2000 y 2100."
      )

      return
    }

    if (
      ejercicios &&
      ejercicios.some(
        (ej) =>
          ej.ejercicio === anioNum
      )
    ) {
      setErrorCrear(
        `El ejercicio fiscal ${anioNum} ya existe en el sistema.`
      )

      return
    }

    setCreando(true)

    const ok =
      await crearEjercicio(anioNum)

    setCreando(false)

    if (ok) {
      setMostrarCrear(false)
    } else {
      setErrorCrear(
        "No se pudo registrar el ejercicio en la base de datos."
      )
    }
  }

  // ============================================================
  // REVISAR SESIÓN
  // ============================================================

  useEffect(() => {
    try {
      const sesionGuardada =
        localStorage.getItem(
          SESSION_KEY
        )

      if (sesionGuardada) {
        const datos =
          JSON.parse(
            sesionGuardada
          ) as UsuarioSesion

        if (
          datos &&
          datos.id &&
          datos.email
        ) {
          setUsuarioSesion(
            datos
          )

          setSesionIniciada(
            true
          )
        }
      }
    } catch {
      localStorage.removeItem(
        SESSION_KEY
      )
    } finally {
      setVerificandoSesion(
        false
      )
    }
  }, [])

  // ============================================================
  // INICIAR SESIÓN
  // ============================================================

  async function iniciarSesion(
    e: FormEvent
  ) {
    e.preventDefault()

    setErrorLogin("")

    if (!email.trim()) {
      setErrorLogin(
        "Ingrese su correo electrónico."
      )

      return
    }

    if (!password.trim()) {
      setErrorLogin(
        "Ingrese su contraseña."
      )

      return
    }

    setIniciandoSesion(true)

    try {
      const respuesta =
        await fetch(
          "/api/login",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              email:
                email
                  .trim()
                  .toLowerCase(),
              password,
            }),
          }
        )

      const data =
        await respuesta.json()

      if (!respuesta.ok) {
        setErrorLogin(
          data.error ??
            "No se pudo iniciar sesión."
        )

        return
      }

      const datosUsuario: UsuarioSesion =
        data.usuario

      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify(
          datosUsuario
        )
      )

      setUsuarioSesion(
        datosUsuario
      )

      setSesionIniciada(
        true
      )

      setPassword("")
      setErrorLogin("")
    } catch {
      setErrorLogin(
        "No fue posible comunicarse con el servidor."
      )
    } finally {
      setIniciandoSesion(
        false
      )
    }
  }

  // ============================================================
  // CERRAR SESIÓN
  // ============================================================

  function cerrarSesion() {
    localStorage.removeItem(
      SESSION_KEY
    )

    setSesionIniciada(false)

    setUsuarioSesion(null)

    setEmail("")
    setPassword("")

    setMostrarPassword(false)

    setErrorLogin("")

    setOpen(false)
  }

  // ============================================================
  // CARGANDO SESIÓN
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

        <div className="pointer-events-none absolute inset-0">

          <div className="absolute left-1/2 top-0 h-[450px] w-[700px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />

        </div>

        <div className="relative w-full max-w-md">

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

              <div className="space-y-2">

                <label
                  htmlFor="email"
                  className="text-sm font-medium"
                >
                  Correo electrónico
                </label>

                <div className="relative">

                  <UserRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="correo@finexa.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(
                        e.target.value
                      )

                      setErrorLogin(
                        ""
                      )
                    }}
                    className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />

                </div>

              </div>

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

                      setErrorLogin(
                        ""
                      )
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

              <div className="space-y-2">

                <label className="text-sm font-medium">
                  Tipo de usuario
                </label>

                <div className="flex h-11 items-center gap-3 rounded-lg border border-border bg-muted/30 px-3">

                  <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">

                    <UserRound className="size-4" />

                  </div>

                  <p className="text-sm font-medium">
                    Contador
                  </p>

                </div>

              </div>

              {errorLogin && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">

                  <p className="text-sm text-red-500">
                    {errorLogin}
                  </p>

                </div>
              )}

              <button
                type="submit"
                disabled={
                  iniciandoSesion
                }
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >

                <LogIn className="size-4" />

                {iniciandoSesion
                  ? "Verificando credenciales..."
                  : "Iniciar sesión"}

              </button>

            </form>

          </div>

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
    <div className="flex min-h-svh bg-background print:block print:min-h-0 print:bg-white print:text-black">

      {/* SIDEBAR */}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform md:static md:translate-x-0 print:hidden",
          open
            ? "translate-x-0"
            : "-translate-x-full"
        )}
      >

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

        <nav className="flex-1 space-y-1 px-3 py-4">

          {NAV.map((item) => {
            const active =
              pathname ===
              item.href

            const Icon =
              item.icon

            return (
              <Link
                key={
                  item.href
                }
                href={
                  item.href
                }
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

        <div className="border-t border-sidebar-border p-3">

          <div className="mb-2 flex items-center gap-3 rounded-lg bg-sidebar-accent/40 px-3 py-3">

            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/10 text-sidebar-primary">

              <UserRound className="size-4" />

            </div>

            <div className="min-w-0 flex-1">

              <p className="truncate text-sm font-medium">
                {usuarioSesion?.nombre ??
                  "Usuario"}
              </p>

              <p className="truncate text-xs text-sidebar-foreground/60">
                {usuarioSesion?.tipo ??
                  "Contador"}
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

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden print:hidden"
          onClick={() =>
            setOpen(false)
          }
          aria-hidden
        />
      )}

      {/* CONTENIDO */}

      <div className="flex min-w-0 flex-1 flex-col">

        {/* HEADER MÓVIL */}

        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden print:hidden">

          <div className="flex items-center gap-3">

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

          </div>

          <div className="flex items-center gap-1.5">

            <select
              value={
                ejercicioSeleccionado
              }
              onChange={(e) =>
                setEjercicioSeleccionado(
                  parseInt(
                    e.target.value,
                    10
                  )
                )
              }
              className="rounded border border-border bg-muted/60 px-2 py-1 text-xs font-bold text-foreground"
              aria-label="Seleccionar ejercicio fiscal"
            >
              {ejercicios &&
                ejercicios.map(
                  (ej) => (
                    <option
                      key={
                        ej.ejercicio
                      }
                      value={
                        ej.ejercicio
                      }
                    >
                      {
                        ej.ejercicio
                      }{" "}
                      (
                      {ej.estado ===
                      "ABIERTO"
                        ? "Abierto"
                        : "Cerrado"}
                      )
                    </option>
                  )
                )}
            </select>

            <button
              type="button"
              onClick={
                abrirModalCrear
              }
              className="flex size-7 items-center justify-center rounded border border-primary/30 bg-primary/10 text-primary"
              title="Registrar nuevo ciclo"
            >
              <CalendarPlus className="size-3.5" />
            </button>

          </div>

        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8 print:m-0 print:max-w-none print:p-0">

          {/* BARRA SUPERIOR */}

          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">

            <div className="flex flex-wrap items-center gap-2.5">

              {dbConnected ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">

                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />

                  Base de Datos Conectada

                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">

                  <span className="size-1.5 rounded-full bg-amber-500" />

                  Modo Navegador (Offline)

                </span>
              )}

              {/* SELECTOR DE CICLO */}

              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1 text-xs">

                <Calendar className="size-3.5 text-muted-foreground" />

                <span className="font-semibold text-foreground">
                  Ciclo
                </span>

                <select
                  value={
                    ejercicioSeleccionado
                  }
                  onChange={(e) =>
                    setEjercicioSeleccionado(
                      parseInt(
                        e.target.value,
                        10
                      )
                    )
                  }
                  className="cursor-pointer bg-transparent font-bold text-foreground focus:outline-none"
                  aria-label="Seleccionar ciclo contable"
                >
                  {ejercicios &&
                    ejercicios.map(
                      (ej) => (
                        <option
                          key={
                            ej.ejercicio
                          }
                          value={
                            ej.ejercicio
                          }
                          className="bg-popover text-popover-foreground"
                        >
                          {
                            ej.ejercicio
                          }{" "}
                          (
                          {ej.estado ===
                          "ABIERTO"
                            ? "Abierto"
                            : "Cerrado"}
                          )
                        </option>
                      )
                    )}
                </select>

                <span className="text-muted-foreground/40">
                  ·
                </span>

                {esEjercicioCerrado ? (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">

                    <Lock className="size-2.5" />

                    Cerrado

                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">

                    Abierto

                  </span>
                )}

                <div className="ml-1 flex items-center gap-1 border-l border-border pl-1.5">

                  <button
                    type="button"
                    onClick={
                      abrirModalCrear
                    }
                    className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                    title="Registrar nuevo ciclo contable"
                    aria-label="Nuevo ciclo"
                  >
                    <CalendarPlus className="size-3.5" />
                  </button>

                  <Link
                    href="/ciclos"
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Ver historial de ciclos contables"
                    aria-label="Historial de ciclos"
                  >
                    <History className="size-3.5" />
                  </Link>

                </div>

              </div>

            </div>

            <div className="flex items-center gap-2">

              <button
                type="button"
                onClick={
                  toggleTheme
                }
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                title={
                  isDark
                    ? "Cambiar a modo claro"
                    : "Cambiar a modo oscuro"
                }
              >
                {isDark ? (
                  <Sun className="size-3.5 text-amber-400" />
                ) : (
                  <Moon className="size-3.5 text-slate-400" />
                )}

                <span>
                  {isDark
                    ? "Claro"
                    : "Oscuro"}
                </span>
              </button>

              {pathname !== "/" && (
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Ir al inicio"
                >
                  <Home className="size-3.5" />

                  <span>
                    Inicio
                  </span>
                </Link>
              )}

            </div>

          </div>

          {/* AVISO CICLO CERRADO */}

          {esEjercicioCerrado && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 print:hidden">

              <div className="flex items-center gap-2">

                <Lock className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />

                <p>
                  <strong>
                    Ciclo{" "}
                    {
                      ejercicioSeleccionado
                    }{" "}
                    cerrado:
                  </strong>{" "}
                  Este período está en modo solo lectura de auditoría. Las cifras son definitivas.
                </p>

              </div>

              {ejercicios &&
                ejercicios.some(
                  (ej) =>
                    ej.estado ===
                    "ABIERTO"
                ) && (
                  <button
                    type="button"
                    onClick={() => {
                      const abierto =
                        ejercicios.find(
                          (ej) =>
                            ej.estado ===
                            "ABIERTO"
                        )

                      if (abierto) {
                        setEjercicioSeleccionado(
                          abierto.ejercicio
                        )
                      }
                    }}
                    className="cursor-pointer rounded border border-amber-600/40 bg-background/80 px-2.5 py-1 font-semibold text-amber-700 transition hover:bg-background dark:text-amber-300"
                  >
                    Ir al Ciclo Activo (
                    {
                      ejercicios.find(
                        (ej) =>
                          ej.estado ===
                          "ABIERTO"
                      )?.ejercicio
                    }
                    ) →
                  </button>
                )}

            </div>
          )}

          {children}

        </main>

      </div>

      {/* MODAL NUEVO EJERCICIO */}

      {mostrarCrear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">

          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">

            <button
              type="button"
              onClick={() =>
                setMostrarCrear(
                  false
                )
              }
              className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="size-5" />
            </button>

            <div className="mb-4 flex items-center gap-3">

              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">

                <CalendarPlus className="size-5" />

              </div>

              <div>

                <h3 className="text-base font-semibold text-foreground">
                  Registrar Nuevo Ejercicio Fiscal
                </h3>

                <p className="text-xs text-muted-foreground">
                  Habilita un nuevo año para operaciones contables
                </p>

              </div>

            </div>

            <form
              onSubmit={
                handleCrearEjercicio
              }
              className="space-y-4"
            >

              <div className="space-y-1.5">

                <label
                  htmlFor="nuevo-anio"
                  className="text-xs font-semibold text-foreground"
                >
                  Año calendario
                </label>

                <input
                  id="nuevo-anio"
                  type="number"
                  min={2000}
                  max={2100}
                  value={nuevoAnio}
                  onChange={(e) =>
                    setNuevoAnio(
                      parseInt(
                        e.target.value,
                        10
                      )
                    )
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-bold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />

              </div>

              <div className="space-y-1 rounded-lg border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">

                <p className="font-semibold text-foreground">
                  Vigencia reglamentaria:
                </p>

                <p>
                  • Período: 01 de enero de{" "}
                  {nuevoAnio ||
                    "----"}{" "}
                  al 31 de diciembre de{" "}
                  {nuevoAnio ||
                    "----"}
                </p>

                <p>
                  • Estado inicial:{" "}
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    ABIERTO
                  </span>
                </p>

                <p>
                  • Correlativo anual independiente
                </p>

              </div>

              {errorCrear && (
                <p className="rounded border border-red-500/30 bg-red-500/10 p-2 text-xs font-medium text-red-600">
                  {errorCrear}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">

                <button
                  type="button"
                  onClick={() =>
                    setMostrarCrear(
                      false
                    )
                  }
                  disabled={
                    creando
                  }
                  className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    creando
                  }
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {creando
                    ? "Creando..."
                    : `Crear Ejercicio ${nuevoAnio}`}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  )
}