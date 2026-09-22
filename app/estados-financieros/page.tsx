"use client"

import { useMemo, useState } from "react"
import { CircleCheck, CircleX, FileDown, FlaskConical, RotateCcw, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/field"
import { useContabilidad } from "@/components/contabilidad-provider"
import {
  calcularBalanceGeneralAnalitico,
  calcularEstadoResultadosAnalitico,
  formatoMoneda,
  redondear,
} from "@/lib/contabilidad"
import { VALORES_ESPERADOS } from "@/lib/datos-prueba"
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

function Fila({ label, monto, negativo }: { label: string; monto: number; negativo?: boolean }) {
  return <div className="flex items-center justify-between px-1 py-1.5 text-sm"><span>{label}</span><span className="tabular-nums">{negativo ? `-${formatoMoneda(Math.abs(monto))}` : formatoMoneda(monto)}</span></div>
}

export default function EstadosFinancierosPage() {
  const { estadoResultados: er, balanceGeneral: bg, cerrarCicloContable, asientos, mayor, escenarioPrueba, cargarEscenarioPrueba } = useContabilidad()
  const [inventarioFinal, setInventarioFinal] = useState("6486.72")

  const invFinal = redondear(Number(inventarioFinal) || 0)

  const analitico = useMemo(() => {
    if (!escenarioPrueba) return null
    const inv = mayor.find((m) => m.cuenta.codigo === "1104")
    const ini = inv ? redondear(inv.debe - inv.haber) : 0
    return calcularEstadoResultadosAnalitico(mayor, ini, invFinal)
  }, [escenarioPrueba, mayor, invFinal])

  const bgAnalitico = useMemo(() => {
    if (!analitico) return null
    return calcularBalanceGeneralAnalitico(mayor, analitico.utilidad, "1104", analitico.inventarioFinal)
  }, [analitico, mayor])

  const b = bgAnalitico ?? bg

  const totalDeudor = redondear(mayor.filter((m) => m.naturalezaSaldo === "deudora").reduce((s, m) => s + Math.abs(m.saldo), 0))
  const totalAcreedor = redondear(mayor.filter((m) => m.naturalezaSaldo === "acreedora").reduce((s, m) => s + Math.abs(m.saldo), 0))

  const esperado = (() => {
    const costoVentas = redondear(VALORES_ESPERADOS.mercaderiaDisponible - invFinal)
    const utilidadBruta = redondear(VALORES_ESPERADOS.totalVentas - costoVentas)
    const utilidad = redondear(utilidadBruta - VALORES_ESPERADOS.totalGastos)
    const totalActivo = redondear(VALORES_ESPERADOS.totalActivo - VALORES_ESPERADOS.inventarioInicial + invFinal)
    const totalCapitalContable = redondear(VALORES_ESPERADOS.capitalSocial + utilidad)
    return {
      costoVentas,
      utilidadBruta,
      utilidad,
      totalActivo,
      totalCapitalContable,
      totalPasivoMasCapital: redondear(VALORES_ESPERADOS.totalPasivo + totalCapitalContable),
    }
  })()

  const cotejo = escenarioPrueba && analitico && bgAnalitico
    ? [
        { label: "Balanza de comprobación: ∑deudores - ∑acreedores", esperado: 0, calculado: redondear(totalDeudor - totalAcreedor) },
        { label: "Ventas netas", esperado: VALORES_ESPERADOS.totalVentas, calculado: analitico.ventasNetas },
        { label: "Compras netas", esperado: VALORES_ESPERADOS.totalCostoVentas, calculado: analitico.comprasNetas },
        { label: "Costo de ventas (M. disponible - Inv. final)", esperado: esperado.costoVentas, calculado: analitico.costoVentas },
        { label: "Utilidad bruta", esperado: esperado.utilidadBruta, calculado: analitico.utilidadBruta },
        { label: "Gastos financieros", esperado: VALORES_ESPERADOS.totalGastos, calculado: analitico.totalGastosFinancieros },
        { label: "Utilidad del ejercicio", esperado: esperado.utilidad, calculado: analitico.utilidad },
        { label: "Total activo", esperado: esperado.totalActivo, calculado: bgAnalitico.totalActivo },
        { label: "Total pasivo", esperado: VALORES_ESPERADOS.totalPasivo, calculado: bgAnalitico.totalPasivo },
        { label: "Capital contable (incluye utilidad)", esperado: esperado.totalCapitalContable, calculado: bgAnalitico.totalCapitalContable },
        { label: "Pasivo + Capital", esperado: esperado.totalPasivoMasCapital, calculado: bgAnalitico.totalPasivoMasCapital },
      ]
    : []

  const todosOk = cotejo.length > 0 && cotejo.every((c) => Math.abs(c.esperado - c.calculado) < 0.01) && b.cuadra

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

  function activarPrueba() {
    const confirmado = window.confirm("Se cargará el escenario de prueba (13 partidas, P1–P13) en memoria para corroborar los Estados Financieros con el método analítico. ¿Deseas continuar?")
    if (confirmado) cargarEscenarioPrueba()
  }

  return <div className="space-y-8 report-page">
    <header className="space-y-3 report-header">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm font-medium text-primary">Reportes contables</p><h1 className="text-2xl font-bold tracking-tight md:text-3xl">Reporte de Estados Financieros</h1><p className="mt-1 text-sm text-muted-foreground">Corte del ejercicio contable · Expresado en dólares de los Estados Unidos de América</p></div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button type="button" variant="outline" onClick={exportarPdf}><FileDown className="size-4"/>Exportar PDF</Button>
          <Button type="button" variant="outline" onClick={activarPrueba} disabled={escenarioPrueba} className={escenarioPrueba ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300" : "border-sky-500/40 text-sky-700 hover:bg-sky-500/10 dark:text-sky-300"}><FlaskConical className="size-4"/>{escenarioPrueba ? "Escenario de prueba activo" : "Cargar escenario de prueba"}</Button>
          <Button type="button" variant="outline" onClick={cerrarEjercicio} disabled={!asientos.length} className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"><RotateCcw className="size-4"/>Cerrar ejercicio</Button>
        </div>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">Información preparada automáticamente a partir de los asientos registrados y clasificada por el catálogo de cuentas. Proceso estricto: Libro Diario → Mayorización → Balanza de Comprobación → Estado de Resultados → Balance General.</p>
    </header>

    {escenarioPrueba && analitico && bgAnalitico && (
      <Card className="report-card">
        <CardHeader><CardTitle>Corroboración con la mayorización de prueba (P1–P13)</CardTitle><CardDescription>Comparación del valor esperado (derivado del proceso analítico a partir de la mayorización y del inventario final indicado) contra el valor calculado por el sistema. Un valor es correcto cuando la diferencia es menor a $0.01.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Concepto</th>
                  <th className="px-3 py-2 text-right font-medium">Esperado</th>
                  <th className="px-3 py-2 text-right font-medium">Calculado</th>
                  <th className="px-3 py-2 text-center font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cotejo.map((c) => {
                  const ok = Math.abs(c.esperado - c.calculado) < 0.01
                  return (
                    <tr key={c.label}>
                      <td className="px-3 py-2 font-medium">{c.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatoMoneda(c.esperado)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatoMoneda(c.calculado)}</td>
                      <td className="px-3 py-2 text-center">{ok ? <CircleCheck className="mx-auto size-5 text-emerald-600"/> : <CircleX className="mx-auto size-5 text-red-600"/>}</td>
                    </tr>
                  )
                })}
                <tr>
                  <td className="px-3 py-2 font-medium">Balance cuadra (Activo = Pasivo + Capital)</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">Sí</td>
                  <td className="px-3 py-2 text-right tabular-nums">{b.cuadra ? "Sí" : "No"}</td>
                  <td className="px-3 py-2 text-center">{b.cuadra ? <CircleCheck className="mx-auto size-5 text-emerald-600"/> : <CircleX className="mx-auto size-5 text-red-600"/>}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className={`flex items-center gap-3 rounded-lg border p-4 text-sm ${todosOk ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"}`}>
            {todosOk ? <CircleCheck className="size-5 shrink-0 text-emerald-600"/> : <TriangleAlert className="size-5 shrink-0 text-red-600"/>}
            <span className="font-medium">{todosOk ? "Todos los valores coinciden: los Estados Financieros son correctos." : "Hay diferencias, revisa la mayorización, el inventario final o los asientos registrados."}</span>
          </div>
        </CardContent>
      </Card>
    )}

    {escenarioPrueba && analitico ? (
      <Card className="report-card">
        <CardHeader><CardTitle>Estado de Resultados</CardTitle><CardDescription>Método analítico (Paso 4): ventas netas menos costo de ventas (determinado a partir de inventarios y compras) menos gastos del ejercicio.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          <div>
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">Ventas <Badge variant="muted">Código 5</Badge></h3>
            <Fila label="Ventas brutas" monto={analitico.ventasBrutas} />
            <Fila label="Devoluciones sobre ventas" monto={analitico.devolucionesVentas} negativo />
            <TotalRow label="Ventas netas" valor={analitico.ventasNetas} />
          </div>
          <div>
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">Costos e inventarios <Badge variant="muted">Códigos 41 y 11</Badge></h3>
            <Fila label="Inventario inicial" monto={analitico.inventarioInicial} />
            <Fila label="Compras" monto={analitico.compras} />
            <Fila label="Devoluciones sobre compras" monto={analitico.devolucionesCompras} negativo />
            <TotalRow label="Compras netas" valor={analitico.comprasNetas} />
            <TotalRow label="Mercadería disponible" valor={analitico.mercaderiaDisponible} />
            <div className="flex items-center justify-between gap-3 px-1 py-1.5 text-sm">
              <span>Inventario final (conteo físico en bodega)</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={inventarioFinal}
                onChange={(e) => setInventarioFinal(e.target.value)}
                className="h-8 w-32 text-right print:hidden"
                aria-label="Inventario final (conteo físico)"
              />
            </div>
            <TotalRow label="Costo de ventas" valor={analitico.costoVentas} />
            <TotalRow label="Utilidad bruta" valor={analitico.utilidadBruta} fuerte />
          </div>
          <div>
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">Gastos del ejercicio <Badge variant="muted">Código 4</Badge></h3>
            {analitico.gastosFinancieros.length > 0 ? <Renglones items={analitico.gastosFinancieros}/> : <p className="px-1 py-2 text-sm text-muted-foreground">Sin movimientos.</p>}
            <TotalRow label="Total gastos" valor={analitico.totalGastos} />
          </div>
          <div className={`flex items-center justify-between rounded-lg border p-4 ${analitico.utilidad >= 0 ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"}`}><span className="font-semibold">{analitico.utilidad >= 0 ? "Utilidad del ejercicio" : "Pérdida del ejercicio"}</span><span className="text-lg font-bold tabular-nums">{formatoMoneda(analitico.utilidad)}</span></div>
        </CardContent>
      </Card>
    ) : (
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
    )}

    <Card className="report-card">
      <CardHeader><CardTitle>Balance General</CardTitle><CardDescription>Activo = Pasivo + Capital contable. El activo se presenta a la izquierda y el pasivo y capital a la derecha.</CardDescription></CardHeader>
      <CardContent className="grid gap-8 md:grid-cols-2">
        <div><h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">Activo <Badge variant="deudora">Código 1</Badge></h3><Renglones items={b.activos}/><TotalRow label="Total activo" valor={b.totalActivo} fuerte/></div>
        <div className="space-y-6"><div><h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">Pasivo <Badge variant="acreedora">Código 2</Badge></h3><Renglones items={b.pasivos}/><TotalRow label="Total pasivo" valor={b.totalPasivo}/></div><div><h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">Capital social y contable <Badge variant="acreedora">Código 3</Badge></h3><Renglones items={b.capital}/><div className="flex items-center justify-between px-1 py-2 text-sm"><span className="text-muted-foreground">Utilidad del ejercicio</span><span className="tabular-nums">{formatoMoneda(b.utilidadEjercicio)}</span></div><TotalRow label="Total capital contable" valor={b.totalCapitalContable}/></div><TotalRow label="Total pasivo + capital" valor={b.totalPasivoMasCapital} fuerte/></div>
      </CardContent>
      <CardContent className="pt-0"><div className={`flex items-center gap-3 rounded-lg border p-4 text-sm ${b.cuadra ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"}`}>{b.cuadra ? <CircleCheck className="size-5 shrink-0 text-emerald-600"/> : <TriangleAlert className="size-5 shrink-0 text-red-600"/>}<span className="font-medium">{b.cuadra ? `Balance cuadrado: ${formatoMoneda(b.totalActivo)} = ${formatoMoneda(b.totalPasivoMasCapital)}` : `El balance no cuadra: Activo ${formatoMoneda(b.totalActivo)} ≠ Pasivo + Capital ${formatoMoneda(b.totalPasivoMasCapital)}`}</span></div></CardContent>
    </Card>
    <footer className="hidden border-t border-border pt-8 text-center text-xs text-muted-foreground print:block"><p>Las notas son parte integrante de los estados financieros.</p><div className="mt-12 grid grid-cols-3 gap-10"><div className="border-t border-foreground/50 pt-2">Representante legal</div><div className="border-t border-foreground/50 pt-2">Contador</div><div className="border-t border-foreground/50 pt-2">Auditor externo</div></div></footer>
  </div>
}