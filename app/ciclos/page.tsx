"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  BookOpenText,
  CalendarPlus,
  CheckCircle2,
  History,
  Lock,
  Plus,
  Scale,
  Unlock,
} from "lucide-react"
import { useContabilidad } from "@/components/contabilidad-provider"
import { formatoMoneda } from "@/lib/contabilidad"
import { Button } from "@/components/ui/button"

export default function CiclosContablesPage() {
  const {
    ejercicios,
    ejercicioSeleccionado,
    setEjercicioSeleccionado,
    cierres,
    estadoResultados,
    crearEjercicio,
    generarPartidaApertura,
  } = useContabilidad()

  const [mostrarCrear, setMostrarCrear] = useState(false)
  const maxAnio =
    ejercicios.length > 0
      ? Math.max(...ejercicios.map((e) => e.ejercicio))
      : new Date().getFullYear()
  const [nuevoAnio, setNuevoAnio] = useState(maxAnio + 1)
  const [creando, setCreando] = useState(false)
  const [errorCrear, setErrorCrear] = useState("")

  const [generandoAperturaAnio, setGenerandoAperturaAnio] = useState<number | null>(null)
  const [mensajeApertura, setMensajeApertura] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null)

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorCrear("")
    const anioNum = Number(nuevoAnio)
    if (!anioNum || anioNum < 1900 || anioNum > 2100) {
      setErrorCrear("Ingresa un año válido.")
      return
    }
    if (ejercicios.some((x) => x.ejercicio === anioNum)) {
      setErrorCrear(`El ciclo ${anioNum} ya existe.`)
      return
    }

    setCreando(true)
    const exito = await crearEjercicio(anioNum)
    setCreando(false)
    if (exito) {
      setMostrarCrear(false)
    } else {
      setErrorCrear("No se pudo crear el ciclo. Revisa la conexión.")
    }
  }

  const handleGenerarApertura = async (anioOrigen: number) => {
    const destino = anioOrigen + 1
    setGenerandoAperturaAnio(anioOrigen)
    setMensajeApertura(null)

    const res = await generarPartidaApertura(anioOrigen, destino)
    setGenerandoAperturaAnio(null)

    if (res.success) {
      setMensajeApertura({
        tipo: "exito",
        texto: `Partida de apertura para el ciclo ${destino} generada con saldos del ciclo ${anioOrigen}.`,
      })
    } else {
      setMensajeApertura({
        tipo: "error",
        texto: res.error || "No se pudo generar la partida de apertura.",
      })
    }
  }

  // Ordenar ciclos descendente (2026, 2025...)
  const ciclosOrdenados = useMemo(() => {
    return [...ejercicios].sort((a, b) => b.ejercicio - a.ejercicio)
  }, [ejercicios])

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ═══ ENCABEZADO SOBRIO ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/40 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Ciclos Contables
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Historial de periodos contables, estado de liquidación y traslados de saldos.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => {
            setErrorCrear("")
            setNuevoAnio(maxAnio + 1)
            setMostrarCrear(true)
          }}
          className="gap-1.5 text-xs"
        >
          <CalendarPlus className="size-3.5" />
          <span>+ Nuevo Ciclo</span>
        </Button>
      </div>

      {/* ═══ AVISO DE ACCIÓN ═══ */}
      {mensajeApertura && (
        <div
          className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-xs ${
            mensajeApertura.tipo === "exito"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <p>{mensajeApertura.texto}</p>
            {mensajeApertura.tipo === "exito" && (
              <Link
                href="/libro-diario"
                className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-emerald-700 transition ml-2"
              >
                <span>Ver Partida #1 en Diario</span>
                <ArrowRight className="size-3" />
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMensajeApertura(null)}
            className="font-medium underline ml-3 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* ═══ TABLA GENERAL SOBRIA DE TODOS LOS CICLOS ═══ */}
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border/60 bg-muted/30 text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">
              <tr>
                <th className="px-4 py-3 w-28">Ciclo</th>
                <th className="px-3 py-3 w-24">Estado</th>
                <th className="px-3 py-3 text-right w-24">Partidas</th>
                <th className="px-4 py-3 text-right font-mono">Ingresos</th>
                <th className="px-4 py-3 text-right font-mono">Gastos</th>
                <th className="px-4 py-3 text-right font-mono">Resultado</th>
                <th className="px-4 py-3 w-36">Cierre</th>
                <th className="px-4 py-3 text-right w-44">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {ciclosOrdenados.map((c) => {
                const esActivo = c.ejercicio === ejercicioSeleccionado
                const esCerrado = c.estado === "CERRADO"
                const cierreInfo = cierres.find((ci) => ci.ejercicio === c.ejercicio)

                // Valores financieros del ciclo
                let totalIng = 0
                let totalGto = 0
                let resultado = 0

                if (cierreInfo) {
                  totalIng = Number(cierreInfo.total_ingresos) || 0
                  totalGto = Number(cierreInfo.total_gastos) || 0
                  resultado = Number(cierreInfo.utilidad) || 0
                } else if (esActivo) {
                  totalIng = estadoResultados.totalIngresos
                  totalGto = estadoResultados.totalGastos
                  resultado = estadoResultados.utilidad
                }

                return (
                  <tr
                    key={c.ejercicio}
                    className={`hover:bg-muted/20 transition-colors ${
                      esActivo ? "bg-primary/[0.03]" : ""
                    }`}
                  >
                    {/* Ciclo */}
                    <td className="px-4 py-3 font-semibold text-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-sm">{c.ejercicio}</span>
                        {esActivo && (
                          <span className="rounded bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.2 text-[10px] font-normal">
                            Activo
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Estado */}
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium border ${
                          esCerrado
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                        }`}
                      >
                        {esCerrado ? <Lock className="size-2.5" /> : <Unlock className="size-2.5" />}
                        {esCerrado ? "Cerrado" : "Abierto"}
                      </span>
                    </td>

                    {/* Partidas */}
                    <td className="px-3 py-3 text-right font-mono text-muted-foreground">
                      {c.ultimo_numero > 0 ? c.ultimo_numero : "0"}
                    </td>

                    {/* Ingresos */}
                    <td className="px-4 py-3 text-right font-mono text-foreground whitespace-nowrap">
                      {totalIng > 0 ? formatoMoneda(totalIng) : "—"}
                    </td>

                    {/* Gastos */}
                    <td className="px-4 py-3 text-right font-mono text-foreground whitespace-nowrap">
                      {totalGto > 0 ? formatoMoneda(totalGto) : "—"}
                    </td>

                    {/* Resultado */}
                    <td className="px-4 py-3 text-right font-mono font-semibold whitespace-nowrap">
                      {totalIng > 0 || totalGto > 0 || cierreInfo ? (
                        <span
                          className={
                            resultado >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }
                        >
                          {formatoMoneda(resultado)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-normal">—</span>
                      )}
                    </td>

                    {/* Cierre */}
                    <td className="px-4 py-3 text-muted-foreground text-[11px] whitespace-nowrap">
                      {cierreInfo ? (
                        <div>
                          <span>{cierreInfo.fecha_cierre}</span>
                          <span className="text-[10px] text-muted-foreground/70 block">
                            Partida #{cierreInfo.asiento_numero ?? "-"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60">En curso</span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {!esActivo ? (
                          <button
                            type="button"
                            onClick={() => setEjercicioSeleccionado(c.ejercicio)}
                            className="rounded px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                            title={`Seleccionar ciclo ${c.ejercicio}`}
                          >
                            Activar
                          </button>
                        ) : null}

                        <Link
                          href="/libro-diario"
                          onClick={() => setEjercicioSeleccionado(c.ejercicio)}
                          className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          title="Ver Libro Diario"
                        >
                          Diario
                        </Link>

                        <Link
                          href="/libro-mayor"
                          onClick={() => setEjercicioSeleccionado(c.ejercicio)}
                          className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          title="Ver Libro Mayor"
                        >
                          Mayor
                        </Link>

                        <Link
                          href="/kardex"
                          onClick={() => setEjercicioSeleccionado(c.ejercicio)}
                          className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          title="Ver Libro Auxiliar / Kardex"
                        >
                          Auxiliar
                        </Link>

                        <Link
                          href="/estados-financieros"
                          onClick={() => setEjercicioSeleccionado(c.ejercicio)}
                          className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          title="Ver Estados Financieros"
                        >
                          Balances
                        </Link>

                        {esCerrado && (
                          <button
                            type="button"
                            disabled={generandoAperturaAnio === c.ejercicio}
                            onClick={() => handleGenerarApertura(c.ejercicio)}
                            className="rounded border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-50"
                            title={`Generar Partida de Apertura para ${c.ejercicio + 1}`}
                          >
                            {generandoAperturaAnio === c.ejercicio
                              ? "Generando..."
                              : `Apertura ${c.ejercicio + 1}`}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ MODAL CREAR NUEVO CICLO ═══ */}
      {mostrarCrear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Nuevo Ciclo Contable</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Registra un nuevo periodo para comenzar a contabilizar.
              </p>
            </div>

            <form onSubmit={handleCrear} className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="nuevoAnioInput" className="text-xs font-medium text-foreground">
                  Año
                </label>
                <input
                  id="nuevoAnioInput"
                  type="number"
                  min="2000"
                  max="2100"
                  value={nuevoAnio}
                  onChange={(e) => setNuevoAnio(parseInt(e.target.value, 10))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              {errorCrear && (
                <div className="rounded bg-red-500/10 p-2 text-xs text-red-600 dark:text-red-400">
                  {errorCrear}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMostrarCrear(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={creando}>
                  {creando ? "Creando..." : "Crear Ciclo"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
