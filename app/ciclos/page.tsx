"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  BookOpenText,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  FileSpreadsheet,
  History,
  Layers,
  Lock,
  Plus,
  Scale,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Unlock,
} from "lucide-react"
import { useContabilidad } from "@/components/contabilidad-provider"
import { formatoMoneda } from "@/lib/contabilidad"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function CiclosContablesPage() {
  const {
    ejercicios,
    ejercicioSeleccionado,
    setEjercicioSeleccionado,
    cierres,
    crearEjercicio,
    generarPartidaApertura,
    dbConnected,
  } = useContabilidad()

  // Modal para crear nuevo ejercicio
  const [mostrarCrear, setMostrarCrear] = useState(false)
  const maxAnio =
    ejercicios.length > 0
      ? Math.max(...ejercicios.map((e) => e.ejercicio))
      : new Date().getFullYear()
  const [nuevoAnio, setNuevoAnio] = useState(maxAnio + 1)
  const [creando, setCreando] = useState(false)
  const [errorCrear, setErrorCrear] = useState("")

  // Estado para generar apertura
  const [generandoAperturaAnio, setGenerandoAperturaAnio] = useState<number | null>(null)
  const [mensajeApertura, setMensajeApertura] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null)

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorCrear("")
    const anioNum = Number(nuevoAnio)
    if (!anioNum || anioNum < 1900 || anioNum > 2100) {
      setErrorCrear("Ingresa un año fiscal válido (ej. 2026).")
      return
    }
    if (ejercicios.some((x) => x.ejercicio === anioNum)) {
      setErrorCrear(`El ejercicio fiscal ${anioNum} ya existe en el sistema.`)
      return
    }

    setCreando(true)
    const exito = await crearEjercicio(anioNum)
    setCreando(false)
    if (exito) {
      setMostrarCrear(false)
    } else {
      setErrorCrear("No se pudo crear el ejercicio fiscal. Revisa la conexión.")
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
        texto: `¡Partida de apertura para el ejercicio ${destino} generada con éxito con saldos traspasados del ${anioOrigen}!`,
      })
    } else {
      setMensajeApertura({
        tipo: "error",
        texto: res.error || "No se pudo generar la partida de apertura.",
      })
    }
  }

  // Métricas rápidas
  const totalEjercicios = ejercicios.length
  const abiertos = useMemo(() => ejercicios.filter((e) => e.estado === "ABIERTO").length, [ejercicios])
  const cerrados = useMemo(() => ejercicios.filter((e) => e.estado === "CERRADO").length, [ejercicios])

  return (
    <div className="space-y-8 max-w-5xl">
      {/* ═══ ENCABEZADO ═══ */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <History className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Ciclos Contables y Ejercicios Fiscales
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Historial auditable de periodos fiscales, liquidaciones anuales y partidas de apertura.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => {
              setErrorCrear("")
              setNuevoAnio(maxAnio + 1)
              setMostrarCrear(true)
            }}
            className="gap-2"
          >
            <CalendarPlus className="size-4" />
            <span>+ Nuevo Año Fiscal</span>
          </Button>
        </div>
      </header>

      {/* ═══ MENSAJE DE APERTURA ═══ */}
      {mensajeApertura && (
        <div
          className={`flex items-center justify-between rounded-xl border p-4 text-sm ${
            mensajeApertura.tipo === "exito"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 shrink-0" />
            <p>{mensajeApertura.texto}</p>
          </div>
          <button
            type="button"
            onClick={() => setMensajeApertura(null)}
            className="text-xs font-semibold underline ml-4 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* ═══ MÉTRICAS RESUMEN ═══ */}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Total Ciclos Registrados</span>
            <Layers className="size-4 text-primary" />
          </div>
          <p className="text-2xl font-bold font-mono tracking-tight text-foreground">
            {totalEjercicios}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Periodos fiscales en el sistema
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Ciclos Abiertos</span>
            <Unlock className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
            {abiertos}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Admiten captura de comprobantes de diario
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Ciclos Liquidados y Cerrados</span>
            <Lock className="size-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400">
            {cerrados}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Protegidos en modo solo lectura de auditoría
          </p>
        </div>
      </section>

      {/* ═══ LÍNEA DE TIEMPO DE EJERCICIOS FISCALES ═══ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Línea de Tiempo de Ejercicios
            </h2>
            <p className="text-xs text-muted-foreground">
              Haz clic en cualquier año para seleccionarlo como ejercicio activo de trabajo.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {ejercicios.map((ej) => {
            const esActivo = ej.ejercicio === ejercicioSeleccionado
            const esCerrado = ej.estado === "CERRADO"
            const cierreInfo = cierres.find((c) => c.ejercicio === ej.ejercicio)

            return (
              <Card
                key={ej.ejercicio}
                className={`relative transition shadow-xs ${
                  esActivo
                    ? "border-primary ring-2 ring-primary/20 bg-card"
                    : "border-border/70 bg-card hover:border-primary/40"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold font-mono text-foreground">
                          {ej.ejercicio}
                        </span>
                        {esActivo && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-[10px] font-semibold">
                            Activo en pantalla
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Vigencia: {ej.fecha_inicio} al {ej.fecha_fin}
                      </p>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${
                        esCerrado
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                      }`}
                    >
                      {esCerrado ? <Lock className="size-3" /> : <Unlock className="size-3" />}
                      {esCerrado ? "Cerrado" : "Abierto"}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 text-xs">
                  {/* Estadísticas del ciclo */}
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/30 p-2.5 font-mono">
                    <div>
                      <span className="text-[10px] text-muted-foreground block font-sans">
                        Partidas aplicadas
                      </span>
                      <strong className="text-sm text-foreground">
                        {ej.ultimo_numero > 0 ? `${ej.ultimo_numero} pólizas` : "Sin partidas"}
                      </strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground block font-sans">
                        {cierreInfo ? "Resultado liquidado" : "Liquidación"}
                      </span>
                      {cierreInfo ? (
                        <strong
                          className={`text-sm ${
                            Number(cierreInfo.utilidad) >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {formatoMoneda(Number(cierreInfo.utilidad))}
                        </strong>
                      ) : (
                        <span className="text-xs text-muted-foreground font-sans">
                          {esCerrado ? "Sin registro de utilidad" : "Pendiente de cierre"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Detalle si está cerrado */}
                  {cierreInfo && (
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Fecha de liquidación:</span>
                        <strong className="font-mono text-foreground">{cierreInfo.fecha_cierre}</strong>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Póliza de Cierre:</span>
                        <strong className="font-mono text-foreground">
                          Partida #{cierreInfo.asiento_numero ?? "-"}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Ingresos liquidados:</span>
                        <span className="font-mono text-foreground">
                          {formatoMoneda(Number(cierreInfo.total_ingresos))}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Gastos cancelados:</span>
                        <span className="font-mono text-foreground">
                          {formatoMoneda(Number(cierreInfo.total_gastos))}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Acciones para este año */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
                    {!esActivo ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        onClick={() => setEjercicioSeleccionado(ej.ejercicio)}
                        className="gap-1 text-xs"
                      >
                        <span>Trabajar en {ej.ejercicio}</span>
                        <ArrowRight className="size-3" />
                      </Button>
                    ) : (
                      <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" />
                        Ejercicio actualmente activo
                      </span>
                    )}

                    <Link
                      href="/libro-diario"
                      onClick={() => setEjercicioSeleccionado(ej.ejercicio)}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted transition font-medium"
                    >
                      <BookOpenText className="size-3.5" />
                      Diario
                    </Link>

                    <Link
                      href="/estados-financieros"
                      onClick={() => setEjercicioSeleccionado(ej.ejercicio)}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted transition font-medium"
                    >
                      <Scale className="size-3.5" />
                      Balances
                    </Link>

                    {/* Botón para generar apertura si el año está cerrado */}
                    {esCerrado && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={generandoAperturaAnio === ej.ejercicio}
                        onClick={() => handleGenerarApertura(ej.ejercicio)}
                        className="ml-auto text-xs border-primary/30 text-primary hover:bg-primary/10"
                      >
                        <Plus className="size-3.5 mr-1" />
                        {generandoAperturaAnio === ej.ejercicio
                          ? "Generando apertura..."
                          : `Generar Apertura ${ej.ejercicio + 1}`}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* ═══ TABLA HISTÓRICA AUDITABLE DE CIERRES ═══ */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              Registro Auditable de Cierres Contables
            </h2>
            <p className="text-xs text-muted-foreground">
              Comprobantes de liquidación de cuentas nominales asentados en base de datos.
            </p>
          </div>
          <Badge variant="muted">
            {cierres.length} {cierres.length === 1 ? "cierre registrado" : "cierres registrados"}
          </Badge>
        </div>

        {cierres.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-8 text-center">
            <History className="mx-auto size-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium text-foreground">
              Aún no se han ejecutado cierres contables
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Cuando finalices un ciclo contable en la pantalla de Estados Financieros con &quot;Cerrar Ejercicio&quot;, las cuentas de ingresos y gastos se liquidarán y el comprobante oficial quedará grabado aquí.
            </p>
            <Link
              href="/estados-financieros"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-xs"
            >
              <Scale className="size-3.5" />
              Ir a Estados Financieros
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/60 bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">Fecha</th>
                    <th className="px-3 py-2.5">Año Fiscal</th>
                    <th className="px-4 py-2.5">Glosa / Concepto</th>
                    <th className="px-3 py-2.5 text-right font-mono">Ingresos</th>
                    <th className="px-3 py-2.5 text-right font-mono">Gastos</th>
                    <th className="px-4 py-2.5 text-right font-mono">Resultado Neto</th>
                    <th className="px-3 py-2.5 text-center">Póliza Cierre</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {cierres.map((c) => {
                    const utilidadNum = Number(c.utilidad) || 0
                    const esPositiva = utilidadNum >= 0

                    return (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                          {c.fecha_cierre}
                        </td>
                        <td className="px-3 py-3 font-semibold text-foreground">
                          {c.ejercicio}
                        </td>
                        <td className="px-4 py-3 font-sans text-muted-foreground max-w-xs truncate">
                          {c.concepto}
                        </td>
                        <td className="px-3 py-3 text-right text-foreground whitespace-nowrap">
                          {formatoMoneda(Number(c.total_ingresos))}
                        </td>
                        <td className="px-3 py-3 text-right text-foreground whitespace-nowrap">
                          {formatoMoneda(Number(c.total_gastos))}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap font-bold">
                          <span
                            className={`inline-flex items-center gap-1 ${
                              esPositiva
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {esPositiva ? (
                              <TrendingUp className="size-3.5" />
                            ) : (
                              <TrendingDown className="size-3.5" />
                            )}
                            {formatoMoneda(Math.abs(utilidadNum))}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <Badge variant="muted">
                            Partida #{c.asiento_numero ?? "-"}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ═══ MODAL CREAR NUEVO EJERCICIO ═══ */}
      {mostrarCrear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarPlus className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Crear Nuevo Ejercicio Fiscal</h3>
                <p className="text-xs text-muted-foreground">
                  Registra un nuevo periodo contable para la empresa.
                </p>
              </div>
            </div>

            <form onSubmit={handleCrear} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="nuevoAnioInput" className="text-xs font-semibold text-foreground">
                  Año del Ejercicio (YYYY)
                </label>
                <input
                  id="nuevoAnioInput"
                  type="number"
                  min="2000"
                  max="2100"
                  value={nuevoAnio}
                  onChange={(e) => setNuevoAnio(parseInt(e.target.value, 10))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Vigencia automática: 01 de enero al 31 de diciembre.
                </p>
              </div>

              {errorCrear && (
                <div className="rounded-lg bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
                  {errorCrear}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMostrarCrear(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={creando}>
                  {creando ? "Creando..." : "Crear Ejercicio"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
