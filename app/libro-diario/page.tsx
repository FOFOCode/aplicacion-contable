"use client"

import { Ban, ShieldCheck, Trash2 } from "lucide-react"
import { AsientoForm } from "@/components/asiento-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useContabilidad } from "@/components/contabilidad-provider"
import { formatoMoneda, totalesAsiento } from "@/lib/contabilidad"
import type { Asiento } from "@/lib/types"

export default function LibroDiarioPage() {
  const { asientos, cuentas, anularAsiento } = useContabilidad()

  const nombreCuenta = (codigo: string) =>
    cuentas.find((c) => c.codigo === codigo)?.nombre ?? "Cuenta desconocida"

  // Ordenar por fecha descendente y luego por número descendente
  const ordenados = [...asientos].sort((a, b) => {
    if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha)
    return b.numero - a.numero
  })

  function handleAnular(a: Asiento) {
    if (a.estado === "ANULADO") {
      alert("Esta partida ya se encuentra anulada en el historial contable.")
      return
    }
    const motivo = window.prompt(
      `¿Deseas anular la Partida #${a.numero} del ejercicio ${a.ejercicio || a.fecha.slice(0, 4)}?\n\nPor auditoría contable no se eliminan registros en cascada: la partida se marcará como anulada y sus renglones se conservarán intactos en el historial.\n\nIngresa el motivo de anulación:`,
      "Corrección de partida contable"
    )
    if (motivo !== null) {
      anularAsiento(a.id, motivo.trim() || undefined)
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Libro Diario</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Registro de asientos con numeración reiniciada por año fiscal (Partidas 1..N) y correlativo
          global ininterrumpido. Por auditoría, no se eliminan partidas en cascada: se anulan preservando
          el historial íntegro.
        </p>
      </header>

      <AsientoForm />

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Asientos registrados</h2>
            <p className="text-xs text-muted-foreground">
              {asientos.filter((a) => a.estado !== "ANULADO").length} activos ·{" "}
              {asientos.filter((a) => a.estado === "ANULADO").length} anulados para auditoría
            </p>
          </div>
          <span className="text-sm text-muted-foreground">{asientos.length} partidas en total</span>
        </div>

        {ordenados.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Aún no hay asientos registrados.
            </CardContent>
          </Card>
        ) : (
          ordenados.map((a) => {
            const totales = totalesAsiento(a.lineas)
            const esAnulado = a.estado === "ANULADO"
            const anio = a.ejercicio || (a.fecha ? a.fecha.slice(0, 4) : 2026)

            return (
              <Card
                key={a.id}
                className={esAnulado ? "border-red-500/30 bg-muted/20" : "transition-colors"}
              >
                <CardHeader className="flex-row items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-sm font-bold text-primary">
                        Partida #{a.numero} ({anio})
                      </span>
                      {a.correlativo_global && (
                        <Badge variant="muted">
                          Correlativo #{a.correlativo_global}
                        </Badge>
                      )}
                      {esAnulado ? (
                        <Badge variant="warning" className="flex items-center gap-1">
                          <Ban className="size-3" />
                          ANULADA (AUDITORÍA)
                        </Badge>
                      ) : (
                        <Badge variant="success" className="flex items-center gap-1">
                          <ShieldCheck className="size-3" />
                          APLICADA
                        </Badge>
                      )}
                      <span className="text-sm font-normal text-muted-foreground">{a.fecha}</span>
                    </CardTitle>
                    <CardDescription className="mt-1">{a.concepto}</CardDescription>
                    {esAnulado && a.motivo_anulacion && (
                      <p className="text-xs font-medium text-red-600 dark:text-red-400">
                        Motivo de anulación: {a.motivo_anulacion}
                      </p>
                    )}
                  </div>
                  {!esAnulado ? (
                    <button
                      onClick={() => handleAnular(a)}
                      className="text-muted-foreground transition-colors hover:text-red-600"
                      aria-label={`Anular partida ${a.numero}`}
                      title="Anular partida (preserva trazabilidad de auditoría)"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  ) : (
                    <span
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      title="Registro auditado inmutable"
                    >
                      Auditado
                    </span>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className={`w-full min-w-[480px] text-sm ${esAnulado ? "opacity-60" : ""}`}>
                      <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Cuenta</th>
                          <th className="px-3 py-2 text-right font-medium">Debe</th>
                          <th className="px-3 py-2 text-right font-medium">Haber</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {a.lineas.map((l, i) => (
                          <tr key={i} className={esAnulado ? "line-through text-muted-foreground" : ""}>
                            <td className="px-3 py-2">
                              <span className="font-medium">{l.codigo}</span>
                              <span className="text-muted-foreground"> — {nombreCuenta(l.codigo)}</span>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {l.debe > 0 ? formatoMoneda(l.debe) : ""}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {l.haber > 0 ? formatoMoneda(l.haber) : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/40 font-medium">
                        <tr>
                          <td className="px-3 py-2 text-right">Totales</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatoMoneda(totales.debe)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatoMoneda(totales.haber)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </section>
    </div>
  )
}

