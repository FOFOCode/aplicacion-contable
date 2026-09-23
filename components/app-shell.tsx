"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpenText,
  ClipboardList,
  Library,
  ListTree,
  Scale,
  LayoutDashboard,
  Menu,
  Home,
  Calendar,
  CalendarPlus,
  Lock,
  X,
  History,
} from "lucide-react"
import { useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { useContabilidad } from "@/components/contabilidad-provider"

const NAV = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  { href: "/libro-diario", label: "Libro Diario", icon: BookOpenText },
  { href: "/libro-mayor", label: "Libro Mayor", icon: ListTree },
  { href: "/kardex", label: "Kardex", icon: ClipboardList },
  { href: "/estados-financieros", label: "Estados Financieros", icon: Scale },
  { href: "/ciclos", label: "Ciclos Contables", icon: History },
  { href: "/catalogo", label: "Catálogo de Cuentas", icon: Library },
]

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const {
    dbConnected,
    ejercicios,
    ejercicioSeleccionado,
    setEjercicioSeleccionado,
    esEjercicioCerrado,
    crearEjercicio,
  } = useContabilidad()

  const [mostrarCrear, setMostrarCrear] = useState(false)
  const maxAnio = ejercicios.length > 0 ? Math.max(...ejercicios.map((e) => e.ejercicio)) : new Date().getFullYear()
  const [nuevoAnio, setNuevoAnio] = useState(maxAnio + 1)
  const [creando, setCreando] = useState(false)
  const [errorCrear, setErrorCrear] = useState("")

  const abrirModalCrear = () => {
    setErrorCrear("")
    const sugerido = (ejercicios.length > 0 ? Math.max(...ejercicios.map((e) => e.ejercicio)) : new Date().getFullYear()) + 1
    setNuevoAnio(sugerido)
    setMostrarCrear(true)
  }

  const handleCrearEjercicio = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorCrear("")
    const anioNum = Number(nuevoAnio)
    if (isNaN(anioNum) || anioNum < 2000 || anioNum > 2100) {
      setErrorCrear("Ingresa un año válido entre 2000 y 2100.")
      return
    }
    if (ejercicios.some((ej) => ej.ejercicio === anioNum)) {
      setErrorCrear(`El ejercicio fiscal ${anioNum} ya existe en el sistema.`)
      return
    }
    setCreando(true)
    const ok = await crearEjercicio(anioNum)
    setCreando(false)
    if (ok) {
      setMostrarCrear(false)
    } else {
      setErrorCrear("No se pudo registrar el ejercicio en la base de datos.")
    }
  }

  return (
    <div className="flex min-h-svh bg-background print:block print:min-h-0 print:bg-white print:text-black">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform md:static md:translate-x-0 print:hidden",
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
          className="fixed inset-0 z-30 bg-black/40 md:hidden print:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden print:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex size-9 items-center justify-center rounded-md border border-border"
              aria-label="Abrir menú"
            >
              <Menu className="size-5" />
            </button>
            <span className="text-sm font-semibold">Módulo Contable</span>
          </div>

          <div className="flex items-center gap-1.5">
            <select
              value={ejercicioSeleccionado}
              onChange={(e) => setEjercicioSeleccionado(parseInt(e.target.value, 10))}
              className="rounded border border-border bg-muted/60 px-2 py-1 text-xs font-bold text-foreground"
              aria-label="Seleccionar ejercicio fiscal"
            >
              {ejercicios.map((ej) => (
                <option key={ej.ejercicio} value={ej.ejercicio}>
                  {ej.ejercicio} ({ej.estado === "ABIERTO" ? "Abierto" : "Cerrado"})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={abrirModalCrear}
              className="flex size-7 items-center justify-center rounded border border-primary/30 bg-primary/10 text-primary cursor-pointer"
              title="Registrar nuevo ciclo"
            >
              <CalendarPlus className="size-3.5" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8 print:max-w-none print:p-0 print:m-0">
          <div className="mb-5 hidden md:flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex flex-wrap items-center gap-2.5">
              {!dbConnected && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  Modo Navegador (Offline)
                </span>
              )}

              {/* Selector Global de Ciclo */}
              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs shadow-sm">
                <Calendar className="size-3.5 text-muted-foreground" />
                <span className="font-medium text-muted-foreground">Ciclo:</span>
                <select
                  value={ejercicioSeleccionado}
                  onChange={(e) => setEjercicioSeleccionado(parseInt(e.target.value, 10))}
                  className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer"
                  aria-label="Seleccionar ciclo contable"
                >
                  {ejercicios.map((ej) => (
                    <option key={ej.ejercicio} value={ej.ejercicio} className="bg-popover text-popover-foreground">
                      {ej.ejercicio} ({ej.estado === "ABIERTO" ? "Abierto" : "Cerrado"})
                    </option>
                  ))}
                </select>

                {esEjercicioCerrado ? (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                    <Lock className="size-2.5" />
                    Solo Lectura
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                    Abierto
                  </span>
                )}
              </div>

              {/* Botón para crear un nuevo ciclo */}
              <button
                type="button"
                onClick={abrirModalCrear}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                title="Registrar nuevo ciclo contable"
              >
                <CalendarPlus className="size-3.5" />
                <span>+ Ciclo</span>
              </button>

              <Link
                href="/ciclos"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground shadow-xs"
                title="Ver ciclos contables"
              >
                <History className="size-3.5 text-primary" />
                <span>Ciclos</span>
              </Link>
            </div>

            {pathname !== "/" && (
              <Link href="/" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label="Ir al inicio">
                <Home className="size-4" />
                Inicio
              </Link>
            )}
          </div>

          {/* Banner de alerta si el ciclo está cerrado */}
          {esEjercicioCerrado && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 print:hidden">
              <div className="flex items-center gap-2">
                <Lock className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p>
                  <strong>Ciclo {ejercicioSeleccionado} cerrado:</strong> Este periodo está en modo solo lectura de auditoría. Las cifras son definitivas.
                </p>
              </div>
              {ejercicios.some((ej) => ej.estado === "ABIERTO") && (
                <button
                  type="button"
                  onClick={() => {
                    const abierto = ejercicios.find((ej) => ej.estado === "ABIERTO")
                    if (abierto) setEjercicioSeleccionado(abierto.ejercicio)
                  }}
                  className="rounded border border-amber-600/40 bg-background/80 px-2.5 py-1 font-semibold text-amber-700 transition hover:bg-background dark:text-amber-300 cursor-pointer"
                >
                  Ir al Ciclo Activo ({ejercicios.find((ej) => ej.estado === "ABIERTO")?.ejercicio}) →
                </button>
              )}
            </div>
          )}

          {children}
        </main>
      </div>

      {/* Modal: Registrar Nuevo Ejercicio Fiscal */}
      {mostrarCrear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setMostrarCrear(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarPlus className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-base">Registrar Nuevo Ejercicio Fiscal</h3>
                <p className="text-xs text-muted-foreground">Habilita un nuevo año para operaciones contables</p>
              </div>
            </div>

            <form onSubmit={handleCrearEjercicio} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="nuevo-anio" className="text-xs font-semibold text-foreground">
                  Año Calendario
                </label>
                <input
                  id="nuevo-anio"
                  type="number"
                  min={2000}
                  max={2100}
                  value={nuevoAnio}
                  onChange={(e) => setNuevoAnio(parseInt(e.target.value, 10))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-bold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Vigencia reglamentaria:</p>
                <p>• Periodo: 01 de enero de {nuevoAnio || "----"} al 31 de diciembre de {nuevoAnio || "----"}</p>
                <p>• Estado inicial: <span className="font-semibold text-emerald-600 dark:text-emerald-400">ABIERTO</span> para captura de partidas</p>
                <p>• Correlativo anual independiente (iniciará en Partida #1)</p>
              </div>

              {errorCrear && (
                <p className="rounded border border-red-500/30 bg-red-500/10 p-2 text-xs font-medium text-red-600">
                  {errorCrear}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMostrarCrear(false)}
                  disabled={creando}
                  className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creando}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {creando ? "Creando..." : `Crear Ejercicio ${nuevoAnio}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
