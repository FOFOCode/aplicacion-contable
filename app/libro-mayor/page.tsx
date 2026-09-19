"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useContabilidad } from "@/components/contabilidad-provider"
import { formatoMoneda, redondear } from "@/lib/contabilidad"
import { ETIQUETA_TIPO } from "@/lib/types"

export default function LibroMayorPage() {
  const { mayor } = useContabilidad()

  const totalDebe = redondear(mayor.reduce((s, m) => s + m.debe, 0))
  const totalHaber = redondear(mayor.reduce((s, m) => s + m.haber, 0))
  const totalDeudor = redondear(
    mayor.filter((m) => m.naturalezaSaldo === "deudora").reduce((s, m) => s + Math.abs(m.saldo), 0),
  )
  const totalAcreedor = redondear(
    mayor.filter((m) => m.naturalezaSaldo === "acreedora").reduce((s, m) => s + Math.abs(m.saldo), 0),
  )

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">Tarea 2</p>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Libro Mayor</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Mayorización automática en tiempo real: el sistema consolida los débitos y créditos de
          cada asiento y determina el saldo Deudor o Acreedor de cada cuenta, sin cálculos manuales.
        </p>
      </header>

      {mayor.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No hay movimientos. Registra asientos en el Libro Diario para ver la mayorización.
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2">
            {mayor.map((m) => (
              <Card key={m.cuenta.codigo}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm">
                      <span className="text-primary">{m.cuenta.codigo}</span> {m.cuenta.nombre}
                    </CardTitle>
                    <Badge variant="muted">{ETIQUETA_TIPO[m.cuenta.tipo]}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border text-sm">
                    <div className="border-r border-border">
                      <p className="border-b border-border bg-muted/60 px-3 py-1.5 text-center text-xs font-medium uppercase text-muted-foreground">
                        Debe
                      </p>
                      <p className="px-3 py-2 text-right tabular-nums">{formatoMoneda(m.debe)}</p>
                    </div>
                    <div>
                      <p className="border-b border-border bg-muted/60 px-3 py-1.5 text-center text-xs font-medium uppercase text-muted-foreground">
                        Haber
                      </p>
                      <p className="px-3 py-2 text-right tabular-nums">{formatoMoneda(m.haber)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Saldo</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold tabular-nums">
                        {formatoMoneda(Math.abs(m.saldo))}
                      </span>
                      {m.naturalezaSaldo === "deudora" && <Badge variant="deudora">Deudor</Badge>}
                      {m.naturalezaSaldo === "acreedora" && (
                        <Badge variant="acreedora">Acreedor</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>

          <section>
            <Card>
              <CardHeader>
                <CardTitle>Balance de Comprobación</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Cuenta</th>
                        <th className="px-3 py-2 text-right font-medium">Debe</th>
                        <th className="px-3 py-2 text-right font-medium">Haber</th>
                        <th className="px-3 py-2 text-right font-medium">Saldo deudor</th>
                        <th className="px-3 py-2 text-right font-medium">Saldo acreedor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {mayor.map((m) => (
                        <tr key={m.cuenta.codigo}>
                          <td className="px-3 py-2">
                            <span className="font-medium">{m.cuenta.codigo}</span>
                            <span className="text-muted-foreground"> — {m.cuenta.nombre}</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatoMoneda(m.debe)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatoMoneda(m.haber)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {m.naturalezaSaldo === "deudora" ? formatoMoneda(Math.abs(m.saldo)) : ""}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {m.naturalezaSaldo === "acreedora"
                              ? formatoMoneda(Math.abs(m.saldo))
                              : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/40 font-semibold">
                      <tr>
                        <td className="px-3 py-2 text-right">Totales</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatoMoneda(totalDebe)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatoMoneda(totalHaber)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatoMoneda(totalDeudor)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatoMoneda(totalAcreedor)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  El total del Debe debe coincidir con el total del Haber, y el saldo deudor con el
                  saldo acreedor, confirmando la Partida Doble.
                </p>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  )
}
