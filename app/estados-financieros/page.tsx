"use client"

import { CircleCheck, FileDown, History, RotateCcw, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useContabilidad } from "@/components/contabilidad-provider"
import { formatoMoneda } from "@/lib/contabilidad"
import type { LineaReporte } from "@/lib/contabilidad"

function Renglones({ items }: { items: LineaReporte[] }) {
  if (items.length === 0) return <p className="px-1 py-2 text-sm text-muted-foreground">Sin movimientos.</p>
  return <div className="divide-y divide-border">{items.map((it) => <div key={it.cuenta.codigo} className="flex items-center justify-between px-1 py-2 text-sm"><span><span className="mr-2 text-muted-foreground">{it.cuenta.codigo}</span>{it.cuenta.nombre}</span><span className="tabular-nums">{formatoMoneda(it.monto)}</span></div>)}</div>
}

function TotalRow({ label, valor, fuerte }: { label: string; valor: number; fuerte?: boolean }) {
  return <div className={`flex items-center justify-between border-t border-border px-1 pt-2 text-sm ${fuerte ? "font-bold" : "font-semibold"}`}><span>{label}</span><span className="tabular-nums">{formatoMoneda(valor)}</span></div>
}

function ReportSection({ title, code, items, totalLabel, total }: { title: string; code: string; items: LineaReporte[]; totalLabel: string; total: number }) {
  return <div><h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">{title}<Badge variant="muted">Código {code}</Badge></h3><Renglones items={items}/><TotalRow label={totalLabel} valor={total}/></div>
}

export default function EstadosFinancierosPage() {
  const { estadoResultados: er, balanceGeneral: bg, cerrarCicloContable, asientos, cierres } = useContabilidad()

  function exportarPdf() {
    const previousTitle = document.title
    document.title = "Reporte de Estados Financieros"
    window.print()
    window.setTimeout(() => { document.title = previousTitle }, 500)
  }

  function cerrarEjercicio() {
    const confirmado = window.confirm("Se liquidarán las cuentas nominales de resultado (ingresos y gastos) transfiriendo la utilidad/pérdida a Capital, y se guardará el registro en el historial de cierres. ¿Deseas continuar?")
    if (confirmado) cerrarCicloContable()
  }

  return <div className="space-y-8 report-page">
    <header className="space-y-3 report-header">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm font-medium text-primary">Reportes contables</p><h1 className="text-2xl font-bold tracking-tight md:text-3xl">Reporte de Estados Financieros</h1><p className="mt-1 text-sm text-muted-foreground">Corte del ejercicio contable · Expresado en dólares de los Estados Unidos de América</p></div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button type="button" variant="outline" onClick={exportarPdf}><FileDown className="size-4"/>Exportar PDF</Button>
          <Button type="button" variant="outline" onClick={cerrarEjercicio} disabled={!asientos.length} className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"><RotateCcw className="size-4"/>Cerrar ejercicio</Button>
        </div>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">Información preparada automáticamente a partir de los asientos registrados y clasificada por el catálogo de cuentas.</p>
    </header>

    <Card className="report-card">
      <CardHeader><CardTitle>Estado de Resultados</CardTitle><CardDescription>Presentación en cascada: ventas, costo de ventas, gastos de operación y resultado del ejercicio.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <ReportSection title="Ventas" code="5" items={er.ventas} totalLabel="Ventas netas" total={er.totalVentas}/>
        <ReportSection title="Costo de ventas" code="41" items={er.costoVentas} totalLabel="Utilidad bruta" total={er.utilidadBruta}/>
        <ReportSection title="Gastos de operación" code="4" items={er.gastosOperacion} totalLabel="Utilidad de operación" total={er.utilidadOperacion}/>
        <div className="grid gap-5 border-t border-border pt-5 md:grid-cols-2"><ReportSection title="Ingresos financieros" code="52" items={er.ingresosFinancieros} totalLabel="Total ingresos financieros" total={er.totalIngresosFinancieros}/><ReportSection title="Gastos financieros" code="43" items={er.gastosFinancieros} totalLabel="Total gastos financieros" total={er.totalGastosFinancieros}/></div>
        <div className={`flex items-center justify-between rounded-lg border p-4 ${er.utilidad >= 0 ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"}`}><span className="font-semibold">{er.utilidad >= 0 ? "Utilidad del ejercicio" : "Pérdida del ejercicio"}</span><span className="text-lg font-bold tabular-nums">{formatoMoneda(er.utilidad)}</span></div>
      </CardContent>
    </Card>

    <Card className="report-card">
      <CardHeader><CardTitle>Balance General</CardTitle><CardDescription>Activo = Pasivo + Capital contable. El activo se presenta a la izquierda y el pasivo y capital a la derecha.</CardDescription></CardHeader>
      <CardContent className="grid gap-8 md:grid-cols-2">
        <div><h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">Activo <Badge variant="deudora">Código 1</Badge></h3><Renglones items={bg.activos}/><TotalRow label="Total activo" valor={bg.totalActivo} fuerte/></div>
        <div className="space-y-6"><div><h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">Pasivo <Badge variant="acreedora">Código 2</Badge></h3><Renglones items={bg.pasivos}/><TotalRow label="Total pasivo" valor={bg.totalPasivo}/></div><div><h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">Capital social y contable <Badge variant="acreedora">Código 3</Badge></h3><Renglones items={bg.capital}/><div className="flex items-center justify-between px-1 py-2 text-sm"><span className="text-muted-foreground">Utilidad del ejercicio</span><span className="tabular-nums">{formatoMoneda(bg.utilidadEjercicio)}</span></div><TotalRow label="Total capital contable" valor={bg.totalCapitalContable}/></div><TotalRow label="Total pasivo + capital" valor={bg.totalPasivoMasCapital} fuerte/></div>
      </CardContent>
      <CardContent className="pt-0"><div className={`flex items-center gap-3 rounded-lg border p-4 text-sm ${bg.cuadra ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"}`}>{bg.cuadra ? <CircleCheck className="size-5 shrink-0 text-emerald-600"/> : <TriangleAlert className="size-5 shrink-0 text-red-600"/>}<span className="font-medium">{bg.cuadra ? `Balance cuadrado: ${formatoMoneda(bg.totalActivo)} = ${formatoMoneda(bg.totalPasivoMasCapital)}` : `El balance no cuadra: Activo ${formatoMoneda(bg.totalActivo)} ≠ Pasivo + Capital ${formatoMoneda(bg.totalPasivoMasCapital)}`}</span></div></CardContent>
    </Card>

    <Card className="report-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="size-5 text-primary" />
              Historial de Cierres Contables
            </CardTitle>
            <CardDescription>
              Registro auditable e inmutable de los cierres de ejercicio y liquidación de cuentas nominales.
            </CardDescription>
          </div>
          <Badge variant="muted">{cierres.length} {cierres.length === 1 ? "cierre registrado" : "cierres registrados"}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {cierres.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Aún no se han ejecutado cierres contables. Al hacer clic en &quot;Cerrar ejercicio&quot;, las cuentas de ingresos y gastos se liquidarán y el cierre se registrará aquí para auditoría.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="py-2 px-3">Fecha</th>
                  <th className="py-2 px-3">Ejercicio</th>
                  <th className="py-2 px-3">Concepto</th>
                  <th className="py-2 px-3 text-right">Ingresos</th>
                  <th className="py-2 px-3 text-right">Gastos</th>
                  <th className="py-2 px-3 text-right">Resultado</th>
                  <th className="py-2 px-3 text-center">Partida #</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cierres.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/50 transition-colors">
                    <td className="py-2.5 px-3 font-medium">{c.fecha_cierre}</td>
                    <td className="py-2.5 px-3">{c.ejercicio}</td>
                    <td className="py-2.5 px-3 text-muted-foreground max-w-xs truncate">{c.concepto}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{formatoMoneda(Number(c.total_ingresos))}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{formatoMoneda(Number(c.total_gastos))}</td>
                    <td className={`py-2.5 px-3 text-right font-mono font-semibold ${Number(c.utilidad) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatoMoneda(Number(c.utilidad))}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant="muted">#{c.asiento_numero ?? "-"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
    <footer className="hidden border-t border-border pt-8 text-center text-xs text-muted-foreground print:block"><p>Las notas son parte integrante de los estados financieros.</p><div className="mt-12 grid grid-cols-3 gap-10"><div className="border-t border-foreground/50 pt-2">Representante legal</div><div className="border-t border-foreground/50 pt-2">Contador</div><div className="border-t border-foreground/50 pt-2">Auditor externo</div></div></footer>
  </div>
}
