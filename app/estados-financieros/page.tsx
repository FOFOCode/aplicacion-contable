"use client"

import { CircleCheck, FileDown, RotateCcw, TriangleAlert } from "lucide-react"
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
  const { estadoResultados: er, balanceGeneral: bg, cerrarCicloContable, asientos } = useContabilidad()

  function exportarPdf() {
    const previousTitle = document.title
    document.title = "Reporte de Estados Financieros"
    window.print()
    window.setTimeout(() => { document.title = previousTitle }, 500)
  }

  function cerrarEjercicio() {
    const confirmado = window.confirm("Se cerrará el ejercicio actual y se generará un asiento de apertura con los saldos de activo, pasivo, capital e inventario. ¿Deseas continuar?")
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
    <footer className="hidden border-t border-border pt-8 text-center text-xs text-muted-foreground print:block"><p>Las notas son parte integrante de los estados financieros.</p><div className="mt-12 grid grid-cols-3 gap-10"><div className="border-t border-foreground/50 pt-2">Representante legal</div><div className="border-t border-foreground/50 pt-2">Contador</div><div className="border-t border-foreground/50 pt-2">Auditor externo</div></div></footer>
  </div>
}
