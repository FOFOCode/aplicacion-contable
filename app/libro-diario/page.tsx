"use client"

import { Trash2 } from "lucide-react"
import { AsientoForm } from "@/components/asiento-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useContabilidad } from "@/components/contabilidad-provider"
import { formatoMoneda, totalesAsiento } from "@/lib/contabilidad"

export default function LibroDiarioPage() {
  const { asientos, cuentas, eliminarAsiento } = useContabilidad()

  const nombreCuenta = (codigo: string) =>
    cuentas.find((c) => c.codigo === codigo)?.nombre ?? "Cuenta desconocida"

  const ordenados = [...asientos].sort((a, b) => b.numero - a.numero)

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Libro Diario</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Registro de asientos con Fecha, Código/Cuenta, Concepto, Debe y Haber. El sistema bloquea
          el guardado si el asiento no cumple la Partida Doble.
        </p>
      </header>

      <AsientoForm />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Asientos registrados</h2>
          <span className="text-sm text-muted-foreground">{asientos.length} en total</span>
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
            return (
              <Card key={a.id}>
                <CardHeader className="flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-sm text-primary">
                        Partida #{a.numero}
                      </span>
                      <span className="text-sm font-normal text-muted-foreground">{a.fecha}</span>
                    </CardTitle>
                    <CardDescription className="mt-1">{a.concepto}</CardDescription>
                  </div>
                  <button
                    onClick={() => eliminarAsiento(a.id)}
                    className="text-muted-foreground transition-colors hover:text-red-600"
                    aria-label={`Eliminar partida ${a.numero}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full min-w-[480px] text-sm">
                      <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Cuenta</th>
                          <th className="px-3 py-2 text-right font-medium">Debe</th>
                          <th className="px-3 py-2 text-right font-medium">Haber</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {a.lineas.map((l, i) => (
                          <tr key={i}>
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
