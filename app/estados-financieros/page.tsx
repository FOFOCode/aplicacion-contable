"use client"

import { useState } from "react"
import Link from "next/link"
import {
  CircleCheck,
  FileDown,
  FileSpreadsheet,
  History,
  RotateCcw,
  TriangleAlert,
  Calculator,
  ClipboardCheck,
  Edit3,
  X,
  Save,
  CheckCircle2,
  CalendarPlus,
  ArrowRight,
  Layers,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input, Label } from "@/components/ui/field"
import { useContabilidad } from "@/components/contabilidad-provider"
import { formatoMoneda } from "@/lib/contabilidad"
import { exportarLibroExcel } from "@/lib/excel"
import type { LineaReporte } from "@/lib/contabilidad"

function Renglones({ items }: { items: LineaReporte[] }) {
  if (items.length === 0) return <p className="px-1 py-2 text-sm text-muted-foreground">Sin movimientos.</p>
  return (
    <div className="divide-y divide-border">
      {items.map((it) => (
        <div key={it.cuenta.codigo} className="flex items-center justify-between px-1 py-2 text-sm">
          <span>
            <span className="mr-2 text-muted-foreground">{it.cuenta.codigo}</span>
            {it.cuenta.nombre}
          </span>
          <span className="tabular-nums font-mono">{formatoMoneda(it.monto)}</span>
        </div>
      ))}
    </div>
  )
}

function TotalRow({ label, valor, fuerte }: { label: string; valor: number; fuerte?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between border-t border-border px-1 pt-2 text-sm ${
        fuerte ? "font-bold" : "font-semibold"
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums font-mono">{formatoMoneda(valor)}</span>
    </div>
  )
}

function ReportSection({
  title,
  code,
  items,
  totalLabel,
  total,
}: {
  title: string
  code: string
  items: LineaReporte[]
  totalLabel: string
  total: number
}) {
  return (
    <div>
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        {title}
        <Badge variant="muted">Código {code}</Badge>
      </h3>
      <Renglones items={items} />
      <TotalRow label={totalLabel} valor={total} />
    </div>
  )
}

export default function EstadosFinancierosPage() {
  const {
    estadoResultados: er,
    balanceGeneral: bg,
    cerrarCicloContable,
    generarPartidaApertura,
    asientos,
    cierres,
    tomaFisica,
    guardarTomaFisica,
    esEjercicioCerrado,
    ejercicioSeleccionado,
    dbConnected,
  } = useContabilidad()

  const [modoVista, setModoVista] = useState<"analitico" | "general">("analitico")

  // Estado para el modal de actualización de Toma Física
  const [modalTomaAbierto, setModalTomaAbierto] = useState(false)
  const [valorToma, setValorToma] = useState<string>(
    (tomaFisica?.valor_inventario_final ?? er.analitico.valorInventarioFinal).toString()
  )
  const [fechaToma, setFechaToma] = useState<string>(
    tomaFisica?.fecha_toma || `${ejercicioSeleccionado}-12-31`
  )
  const [responsableToma, setResponsableToma] = useState<string>(
    tomaFisica?.responsable || "Comité de Auditoría y Control de Inventarios"
  )
  const [observacionesToma, setObservacionesToma] = useState<string>(
    tomaFisica?.observaciones || "Toma física de existencias y conteo al cierre del ejercicio"
  )
  const [guardandoToma, setGuardandoToma] = useState(false)
  const [mensajeExitoToma, setMensajeExitoToma] = useState(false)

  function exportarPdf() {
    const previousTitle = document.title
    document.title = `Reporte de Estados Financieros - Ejercicio ${ejercicioSeleccionado}`
    window.print()
    window.setTimeout(() => {
      document.title = previousTitle
    }, 500)
  }

  function exportarExcel() {
    const filasER: (string | number | null | undefined)[][] = [
      ["ESTADO DE RESULTADOS - MÉTODO ANALÍTICO O PORMENORIZADO"],
      ["Expresado en dólares de los Estados Unidos de América (USD)"],
      [`Ejercicio fiscal: ${ejercicioSeleccionado}`],
      [`Origen de datos: ${er.calculadoPorSql ? "Motor Central Validado" : "Motor Local (Modo Offline)"}`],
      [`Fecha de emisión: ${new Date().toLocaleDateString("es-SV")}`],
      [],
      ["1. DETERMINACIÓN DE VENTAS NETAS", ""],
      ["Ventas totales (5101)", er.analitico.ventasTotales],
      ["(-) Menos: Devoluciones sobre ventas (4103)", er.analitico.devolucionesSobreVentas],
      ["(-) Menos: Rebajas y descuentos sobre ventas (4104)", er.analitico.rebajasSobreVentas],
      ["(=) VENTAS NETAS", er.analitico.ventasNetas],
      [],
      ["2. DETERMINACIÓN DE COMPRAS NETAS Y TOTAL DE MERCANCÍAS", ""],
      ["Compras (4101)", er.analitico.compras],
      ["(+) Más: Gastos sobre compras (4102)", er.analitico.gastosSobreCompras],
      ["(=) Compras Totales", er.analitico.comprasTotales],
      ["(-) Menos: Devoluciones sobre compras (5102)", er.analitico.devolucionesSobreCompras],
      ["(-) Menos: Rebajas y descuentos sobre compras (5103)", er.analitico.rebajasSobreCompras],
      ["(=) COMPRAS NETAS", er.analitico.comprasNetas],
      ["(+) Más: Inventario Inicial de Mercaderías (1104)", er.analitico.inventarioInicial],
      ["(=) TOTAL DE MERCANCÍAS DISPONIBLES", er.analitico.totalMercancias],
      [
        `(-) Menos: Inventario Final de Mercaderías (Toma física al ${er.analitico.fechaInventarioFinal || "cierre"})`,
        er.analitico.valorInventarioFinal,
      ],
      [`    Responsable de toma física: ${er.analitico.responsableInventarioFinal || "N/A"}`],
      ["(=) COSTO DE LO VENDIDO (Costo de Ventas)", er.analitico.costoVentas],
      [],
      ["3. UTILIDAD BRUTA", ""],
      ["(=) UTILIDAD BRUTA (Ventas Netas - Costo de Ventas)", er.analitico.utilidadBruta],
      [],
      ["4. GASTOS DE OPERACIÓN", ""],
    ]

    for (const g of er.gastosOperacion) {
      filasER.push([`${g.cuenta.codigo} - ${g.cuenta.nombre}`, g.monto])
    }
    filasER.push(["(=) TOTAL GASTOS DE OPERACIÓN", er.totalGastosOperacion])
    filasER.push(["(=) UTILIDAD DE OPERACIÓN", er.analitico.utilidadOperacion])
    filasER.push([])

    if (
      er.totalIngresosFinancieros > 0 ||
      er.totalGastosFinancieros > 0 ||
      er.analitico.otrosIngresos > 0
    ) {
      filasER.push(["5. PRODUCTOS Y GASTOS FINANCIEROS / OTROS", ""])
      if (er.analitico.otrosIngresos > 0)
        filasER.push(["(+) Otros ingresos operativos (5104)", er.analitico.otrosIngresos])
      if (er.totalIngresosFinancieros > 0)
        filasER.push(["(+) Productos financieros (52)", er.totalIngresosFinancieros])
      if (er.totalGastosFinancieros > 0)
        filasER.push(["(-) Gastos financieros (43)", er.totalGastosFinancieros])
      filasER.push([])
    }

    filasER.push(["RESULTADO FINAL", ""])
    filasER.push([
      er.utilidad >= 0 ? "UTILIDAD NETA DEL EJERCICIO" : "PÉRDIDA NETA DEL EJERCICIO",
      er.utilidad,
    ])

    const filasBG: (string | number | null | undefined)[][] = [
      ["BALANCE GENERAL"],
      ["Ecuación Contable: Activo = Pasivo + Capital Contable"],
      [`Ejercicio fiscal: ${ejercicioSeleccionado}`],
      [`Fecha de corte: ${new Date().toLocaleDateString("es-SV")}`],
      [],
      ["ACTIVO (Código 1)", ""],
    ]
    for (const a of bg.activos) {
      filasBG.push([`${a.cuenta.codigo} - ${a.cuenta.nombre}`, a.monto])
    }
    filasBG.push(["TOTAL ACTIVO", bg.totalActivo])
    filasBG.push([])

    filasBG.push(["PASIVO (Código 2)", ""])
    for (const p of bg.pasivos) {
      filasBG.push([`${p.cuenta.codigo} - ${p.cuenta.nombre}`, p.monto])
    }
    filasBG.push(["TOTAL PASIVO", bg.totalPasivo])
    filasBG.push([])

    filasBG.push(["CAPITAL CONTABLE (Código 3)", ""])
    for (const c of bg.capital) {
      filasBG.push([`${c.cuenta.codigo} - ${c.cuenta.nombre}`, c.monto])
    }
    filasBG.push(["Utilidad neta del ejercicio", bg.utilidadEjercicio])
    filasBG.push(["TOTAL CAPITAL CONTABLE", bg.totalCapitalContable])
    filasBG.push([])

    filasBG.push(["TOTAL PASIVO + CAPITAL", bg.totalPasivoMasCapital])
    filasBG.push(["ESTADO DE CUADRE", bg.cuadra ? "CUADRADO AL CENTAVO" : "DESCUADRADO"])

    exportarLibroExcel(`Estados_Financieros_Ejercicio_${ejercicioSeleccionado}`, [
      { nombre: "Estado de Resultados", filas: filasER },
      { nombre: "Balance General", filas: filasBG },
    ])
  }

  const [modalCierreAbierto, setModalCierreAbierto] = useState(false)
  const [cierreConfirmadoCheckbox, setCierreConfirmadoCheckbox] = useState(false)
  const [aperturarSiguienteCheckbox, setAperturarSiguienteCheckbox] = useState(true)
  const [ejecutandoCierre, setEjecutandoCierre] = useState(false)
  const [aperturandoSiguiente, setAperturandoSiguiente] = useState(false)

  function abrirModalCierre() {
    if (esEjercicioCerrado) {
      alert("Este ejercicio fiscal ya se encuentra cerrado o bloqueado.")
      return
    }
    setCierreConfirmadoCheckbox(false)
    setAperturarSiguienteCheckbox(true)
    setModalCierreAbierto(true)
  }

  async function ejecutarCierreSeguro() {
    setEjecutandoCierre(true)
    await cerrarCicloContable({ aperturarSiguiente: aperturarSiguienteCheckbox })
    setEjecutandoCierre(false)
    setModalCierreAbierto(false)
  }

  async function guardarTomaFormulario(e: React.FormEvent) {
    e.preventDefault()
    setGuardandoToma(true)
    const exito = await guardarTomaFisica({
      ejercicio: ejercicioSeleccionado,
      fecha_toma: fechaToma,
      valor_inventario_final: parseFloat(valorToma) || 0,
      responsable: responsableToma,
      observaciones: observacionesToma,
    })
    setGuardandoToma(false)
    if (exito) {
      setMensajeExitoToma(true)
      setTimeout(() => {
        setMensajeExitoToma(false)
        setModalTomaAbierto(false)
      }, 1000)
    }
  }

  return (
    <div className="space-y-8 report-page">
      <header className="space-y-3 report-header">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">Reportes contables oficiales</p>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Reporte de Estados Financieros
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ciclo: <strong className="text-foreground">{ejercicioSeleccionado}</strong> · Corte oficial expresado en dólares de los Estados Unidos de América (USD)
            </p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              type="button"
              variant="outline"
              onClick={exportarExcel}
              className="border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/20"
            >
              <FileSpreadsheet className="size-4 text-emerald-600 mr-1.5" />
              Exportar Excel
            </Button>
            <Button type="button" variant="outline" onClick={exportarPdf}>
              <FileDown className="size-4 mr-1.5" />
              Exportar PDF
            </Button>
            <Link
              href="/ciclos"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors shadow-xs"
            >
              <History className="size-4 text-primary" />
              Historial de Ciclos
            </Link>
          </div>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Preparado automáticamente a partir de los asientos mayorizados y clasificados bajo el Método Analítico o Pormenorizado, con cruce real de Toma Física de Inventarios.
        </p>
      </header>

      {/* Tarjeta de Control: Toma Física de Inventario */}
      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ClipboardCheck className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground text-sm">
                    Toma Física Oficial de Inventario:{" "}
                    <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                      {formatoMoneda(er.analitico.valorInventarioFinal)}
                    </span>
                  </p>
                  {dbConnected && (
                    <Badge variant="success" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 text-[10px]">
                      Sincronizado en Libros
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Fecha de Conteo: <strong>{er.analitico.fechaInventarioFinal || `${ejercicioSeleccionado}-12-31`}</strong> · Responsable: <strong>{er.analitico.responsableInventarioFinal || "Comité de Auditoría"}</strong>
                </p>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setValorToma((tomaFisica?.valor_inventario_final ?? er.analitico.valorInventarioFinal).toString())
                setFechaToma(tomaFisica?.fecha_toma || `${ejercicioSeleccionado}-12-31`)
                setResponsableToma(tomaFisica?.responsable || "Comité de Auditoría y Control de Inventarios")
                setObservacionesToma(tomaFisica?.observaciones || "")
                setModalTomaAbierto(true)
              }}
              disabled={esEjercicioCerrado}
              className="print:hidden border-primary/30 text-primary hover:bg-primary/5"
            >
              <Edit3 className="size-3.5 mr-1.5" />
              Actualizar Toma Física
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal / Dialog para Actualizar Toma Física */}
      {modalTomaAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="size-5 text-primary" />
                <h3 className="font-semibold text-base text-foreground">
                  Registrar Toma Física de Inventario Final
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalTomaAbierto(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={guardarTomaFormulario} className="space-y-4 text-sm">
              <p className="text-xs text-muted-foreground">
                En el <strong>Método Analítico</strong>, el Inventario Final físico determina directamente el Costo de Ventas y la Utilidad Bruta del ejercicio {ejercicioSeleccionado}.
              </p>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="valor_inventario">Valor del Inventario Final ($ USD):</Label>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/kardex?ejercicio=${ejercicioSeleccionado}`)
                        if (res.ok) {
                          const data = await res.json()
                          if (data.totalInventarioValorado !== undefined && data.totalInventarioValorado > 0) {
                            setValorToma(Number(data.totalInventarioValorado).toFixed(2))
                            setObservacionesToma(`Conteo conciliado con saldo de Kardex CPP ($${Number(data.totalInventarioValorado).toFixed(2)})`)
                          }
                        }
                      } catch (err) {
                        console.error(err)
                      }
                    }}
                    className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Layers className="size-3" />
                    Cargar saldo actual de Kardex
                  </button>
                </div>
                <Input
                  id="valor_inventario"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={valorToma}
                  onChange={(e) => setValorToma(e.target.value)}
                  className="font-mono text-base font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fecha_toma">Fecha de Conteo Físico:</Label>
                  <Input
                    id="fecha_toma"
                    type="date"
                    required
                    value={fechaToma}
                    onChange={(e) => setFechaToma(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="responsable_toma">Auditor / Responsable:</Label>
                  <Input
                    id="responsable_toma"
                    type="text"
                    required
                    value={responsableToma}
                    onChange={(e) => setResponsableToma(e.target.value)}
                    placeholder="Ej. Comité de Inventarios"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="obs_toma">Observaciones de Auditoría:</Label>
                <Input
                  id="obs_toma"
                  type="text"
                  value={observacionesToma}
                  onChange={(e) => setObservacionesToma(e.target.value)}
                  placeholder="Observaciones de conteo físico..."
                />
              </div>

              {mensajeExitoToma && (
                <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded">
                  <CheckCircle2 className="size-4" />
                  Toma física guardada y sincronizada correctamente en los registros contables.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalTomaAbierto(false)}
                  disabled={guardandoToma}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={guardandoToma}>
                  <Save className="size-4 mr-1.5" />
                  {guardandoToma ? "Guardando..." : "Guardar en Base de Datos"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ESTADO DE RESULTADOS */}
      <Card className="report-card">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Estado de Resultados</CardTitle>
                <Badge variant="default" className="text-xs bg-primary/15 text-primary border-primary/30">
                  Método Analítico o Pormenorizado
                </Badge>
                {er.calculadoPorSql ? (
                  <Badge variant="success" className="text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1 font-medium">
                    <CircleCheck className="size-3" />
                    Cálculo Oficial Validado por el Servidor
                  </Badge>
                ) : (
                  <Badge variant="acreedora" className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-500/30 flex items-center gap-1 font-medium">
                    Cálculo Local en Memoria (Modo Offline)
                  </Badge>
                )}
              </div>
              <CardDescription className="mt-1">
                Determinación analítica de Ventas Netas, Compras Netas, Mercancías Disponibles, Costo de Ventas y Utilidades para el ejercicio {ejercicioSeleccionado}.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <Button
                type="button"
                size="sm"
                variant={modoVista === "analitico" ? "default" : "outline"}
                onClick={() => setModoVista("analitico")}
              >
                <Calculator className="size-3.5 mr-1" />
                Método Analítico
              </Button>
              <Button
                type="button"
                size="sm"
                variant={modoVista === "general" ? "default" : "outline"}
                onClick={() => setModoVista("general")}
              >
                Vista por Cuentas
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {modoVista === "analitico" ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border/60">
                  {/* 1. VENTAS NETAS */}
                  <tr className="bg-muted/40 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    <td colSpan={2} className="py-2.5 px-3">
                      1. Determinación de Ventas Netas
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">
                      Ventas totales <span className="text-xs text-muted-foreground">(5101)</span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      {formatoMoneda(er.analitico.ventasTotales)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 pl-6 text-muted-foreground">
                      (-) Menos: Devoluciones sobre ventas{" "}
                      <span className="text-xs text-muted-foreground/80">(4103)</span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                      {formatoMoneda(er.analitico.devolucionesSobreVentas)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 pl-6 text-muted-foreground">
                      (-) Menos: Rebajas y descuentos sobre ventas{" "}
                      <span className="text-xs text-muted-foreground/80">(4104)</span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                      {formatoMoneda(er.analitico.rebajasSobreVentas)}
                    </td>
                  </tr>
                  <tr className="font-semibold bg-muted/20">
                    <td className="py-2.5 px-3">(=) Ventas Netas</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold">
                      {formatoMoneda(er.analitico.ventasNetas)}
                    </td>
                  </tr>

                  {/* 2. COMPRAS NETAS Y TOTAL DE MERCANCÍAS */}
                  <tr className="bg-muted/40 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    <td colSpan={2} className="py-2.5 px-3">
                      2. Determinación de Compras Netas y Mercancías
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">
                      Compras <span className="text-xs text-muted-foreground">(4101)</span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      {formatoMoneda(er.analitico.compras)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 pl-6 text-muted-foreground">
                      (+) Más: Gastos sobre compras{" "}
                      <span className="text-xs text-muted-foreground/80">(4102)</span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                      {formatoMoneda(er.analitico.gastosSobreCompras)}
                    </td>
                  </tr>
                  <tr className="text-muted-foreground">
                    <td className="py-2 px-3 font-medium">(=) Compras Totales</td>
                    <td className="py-2 px-3 text-right font-mono font-medium">
                      {formatoMoneda(er.analitico.comprasTotales)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 pl-6 text-muted-foreground">
                      (-) Menos: Devoluciones sobre compras{" "}
                      <span className="text-xs text-muted-foreground/80">(5102)</span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                      {formatoMoneda(er.analitico.devolucionesSobreCompras)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 pl-6 text-muted-foreground">
                      (-) Menos: Rebajas y descuentos sobre compras{" "}
                      <span className="text-xs text-muted-foreground/80">(5103)</span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                      {formatoMoneda(er.analitico.rebajasSobreCompras)}
                    </td>
                  </tr>
                  <tr className="font-semibold bg-muted/20">
                    <td className="py-2.5 px-3">(=) Compras Netas</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold">
                      {formatoMoneda(er.analitico.comprasNetas)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">
                      (+) Inventario Inicial de Mercaderías{" "}
                      <span className="text-xs text-muted-foreground">(1104)</span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      {formatoMoneda(er.analitico.inventarioInicial)}
                    </td>
                  </tr>
                  <tr className="font-semibold">
                    <td className="py-2.5 px-3">(=) Total de Mercancías Disponibles</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold">
                      {formatoMoneda(er.analitico.totalMercancias)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 pl-6 text-muted-foreground">
                      (-) Menos: Inventario Final de Mercaderías{" "}
                      {er.analitico.fechaInventarioFinal && (
                        <span className="text-xs text-muted-foreground/80 font-normal">
                          (Toma física al {er.analitico.fechaInventarioFinal})
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-medium text-emerald-700 dark:text-emerald-400">
                      {formatoMoneda(er.analitico.valorInventarioFinal)}
                    </td>
                  </tr>
                  <tr className="font-semibold bg-muted/20">
                    <td className="py-2.5 px-3">(=) Costo de lo Vendido (Costo de Ventas)</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold">
                      {formatoMoneda(er.analitico.costoVentas)}
                    </td>
                  </tr>

                  {/* 3. UTILIDAD BRUTA */}
                  <tr className="bg-primary/5 font-bold border-y-2 border-primary/20">
                    <td className="py-3 px-3 text-primary">
                      (=) Utilidad Bruta (Ventas Netas - Costo de Ventas)
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-primary font-bold">
                      {formatoMoneda(er.analitico.utilidadBruta)}
                    </td>
                  </tr>

                  {/* 4. GASTOS DE OPERACIÓN */}
                  <tr className="bg-muted/40 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    <td colSpan={2} className="py-2.5 px-3">
                      4. Gastos de Operación
                    </td>
                  </tr>
                  {er.gastosOperacion.map((g) => (
                    <tr key={g.cuenta.codigo}>
                      <td className="py-2 px-3 pl-6 text-muted-foreground">
                        {g.cuenta.nombre} <span className="text-xs">({g.cuenta.codigo})</span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                        {formatoMoneda(g.monto)}
                      </td>
                    </tr>
                  ))}
                  {er.gastosOperacion.length === 0 && (
                    <tr>
                      <td colSpan={2} className="py-2 px-3 pl-6 text-xs text-muted-foreground italic">
                        Sin gastos operativos registrados.
                      </td>
                    </tr>
                  )}
                  <tr className="font-semibold bg-muted/20">
                    <td className="py-2.5 px-3">(=) Total Gastos de Operación</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold">
                      {formatoMoneda(er.totalGastosOperacion)}
                    </td>
                  </tr>
                  <tr className="font-semibold">
                    <td className="py-2.5 px-3">(=) Utilidad de Operación</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold">
                      {formatoMoneda(er.analitico.utilidadOperacion)}
                    </td>
                  </tr>

                  {/* 5. FINANCIEROS Y OTROS */}
                  {(er.totalIngresosFinancieros > 0 ||
                    er.totalGastosFinancieros > 0 ||
                    er.analitico.otrosIngresos > 0) && (
                    <>
                      <tr className="bg-muted/40 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                        <td colSpan={2} className="py-2.5 px-3">
                          5. Productos y Gastos Financieros / Otros
                        </td>
                      </tr>
                      {er.analitico.otrosIngresos > 0 && (
                        <tr>
                          <td className="py-2 px-3 pl-6 text-muted-foreground">
                            (+) Otros ingresos operativos (5104)
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                            {formatoMoneda(er.analitico.otrosIngresos)}
                          </td>
                        </tr>
                      )}
                      {er.totalIngresosFinancieros > 0 && (
                        <tr>
                          <td className="py-2 px-3 pl-6 text-muted-foreground">
                            (+) Productos financieros (52)
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                            {formatoMoneda(er.totalIngresosFinancieros)}
                          </td>
                        </tr>
                      )}
                      {er.totalGastosFinancieros > 0 && (
                        <tr>
                          <td className="py-2 px-3 pl-6 text-muted-foreground">
                            (-) Gastos financieros (43)
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                            {formatoMoneda(er.totalGastosFinancieros)}
                          </td>
                        </tr>
                      )}
                    </>
                  )}

                  {/* RESULTADO FINAL */}
                  <tr
                    className={`font-bold border-t-2 text-base ${
                      er.utilidad >= 0
                        ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30"
                        : "bg-red-500/10 text-red-800 dark:text-red-300 border-red-500/30"
                    }`}
                  >
                    <td className="py-3 px-3">
                      {er.utilidad >= 0
                        ? "(=) Utilidad Neta del Ejercicio"
                        : "(=) Pérdida Neta del Ejercicio"}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-lg">
                      {formatoMoneda(er.utilidad)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <ReportSection
                title="Ingresos"
                code="5"
                items={er.ingresos}
                totalLabel="Total ingresos"
                total={er.totalIngresos}
              />
              <ReportSection
                title="Costos y gastos"
                code="4"
                items={er.gastos}
                totalLabel="Total costos y gastos"
                total={er.totalGastos}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* BALANCE GENERAL */}
      <Card className="report-card">
        <CardHeader>
          <CardTitle>Balance General</CardTitle>
          <CardDescription>
            Activo = Pasivo + Capital Contable · Verificación de cuadre contable
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <ReportSection
              title="Activo"
              code="1"
              items={bg.activos}
              totalLabel="Total activo"
              total={bg.totalActivo}
            />
            <div className="space-y-6">
              <ReportSection
                title="Pasivo"
                code="2"
                items={bg.pasivos}
                totalLabel="Total pasivo"
                total={bg.totalPasivo}
              />
              <div>
                <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  Capital contable
                  <Badge variant="muted">Código 3</Badge>
                </h3>
                <Renglones items={bg.capital} />
                <div className="flex items-center justify-between border-t border-border px-1 pt-2 text-sm">
                  <span>Resultado del ejercicio</span>
                  <span className="tabular-nums font-mono">{formatoMoneda(bg.utilidadEjercicio)}</span>
                </div>
                <TotalRow label="Total capital contable" valor={bg.totalCapitalContable} />
              </div>
              <TotalRow
                label="Total pasivo + capital"
                valor={bg.totalPasivoMasCapital}
                fuerte
              />
            </div>
          </div>
        </CardContent>
        <CardContent className="pt-0">
          <div
            className={`flex items-center gap-3 rounded-lg border p-4 text-sm ${
              bg.cuadra
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-red-500/30 bg-red-500/10"
            }`}
          >
            {bg.cuadra ? (
              <CircleCheck className="size-5 shrink-0 text-emerald-600" />
            ) : (
              <TriangleAlert className="size-5 shrink-0 text-red-600" />
            )}
            <span className="font-medium">
              {bg.cuadra
                ? `Balance cuadrado: ${formatoMoneda(bg.totalActivo)} = ${formatoMoneda(
                    bg.totalPasivoMasCapital
                  )}`
                : `El balance no cuadra: Activo ${formatoMoneda(
                    bg.totalActivo
                  )} ≠ Pasivo + Capital ${formatoMoneda(bg.totalPasivoMasCapital)}`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* SECCIÓN DE ADMINISTRACIÓN Y CIERRE FISCAL */}
      <Card className="report-card border-amber-500/30 bg-amber-500/[0.02] print:hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">
                  Administración y Cierre del Ciclo {ejercicioSeleccionado}
                </CardTitle>
                <Badge variant={esEjercicioCerrado ? "muted" : "default"} className="text-xs">
                  {esEjercicioCerrado ? "Ciclo Cerrado" : "Abierto para Operación"}
                </Badge>
              </div>
              <CardDescription className="text-xs mt-1">
                {esEjercicioCerrado
                  ? "Este ejercicio ha sido liquidado formalmente. Sus cuentas de resultados están en $0.00 y sus cifras finales están protegidas."
                  : "La liquidación de fin de año cancela las cuentas de resultados (ingresos y gastos) e imputa la utilidad o pérdida a Capital Contable (3102)."}
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {esEjercicioCerrado ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={aperturandoSiguiente}
                  onClick={async () => {
                    setAperturandoSiguiente(true)
                    const res = await generarPartidaApertura(ejercicioSeleccionado, ejercicioSeleccionado + 1)
                    setAperturandoSiguiente(false)
                    if (!res.success) {
                      alert(res.error || "No se pudo generar la partida de apertura.")
                    }
                  }}
                  className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                >
                  <CalendarPlus className="size-3.5 mr-1.5" />
                  {aperturandoSiguiente
                    ? "Generando..."
                    : `Generar Partida de Apertura para ${ejercicioSeleccionado + 1}`}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={abrirModalCierre}
                  disabled={!asientos.length}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <RotateCcw className="size-3.5 mr-1.5" />
                  Proceder al Cierre Contable
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* MODAL DE PRE-CIERRE CONTABLE SEGURO */}
      {modalCierreAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="size-5 text-amber-600" />
                <h3 className="font-bold text-base text-foreground">
                  Liquidación y Cierre Fiscal {ejercicioSeleccionado}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalCierreAbierto(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <p className="text-muted-foreground">
                Revise el resumen preliminar de las cuentas que se cancelarán antes de asentar la partida definitiva de cierre:
              </p>

              <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Ingresos a liquidar:</span>
                  <span className="font-bold text-foreground">{formatoMoneda(er.totalIngresos)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Gastos y Costos a liquidar:</span>
                  <span className="font-bold text-foreground">{formatoMoneda(er.totalGastos)}</span>
                </div>
                <div className="border-t border-border/80 pt-1.5 flex justify-between font-bold text-sm">
                  <span>Resultado Neto ({er.utilidad >= 0 ? "Utilidad" : "Pérdida"}):</span>
                  <span className={er.utilidad >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"}>
                    {formatoMoneda(er.utilidad)}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground font-sans pt-1">
                  Destino: Transferencia automática a cuenta <strong>3102 (Utilidades acumuladas)</strong>.
                </div>
              </div>

              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-950 dark:text-amber-200">
                <strong>Aviso de Auditoría:</strong> Al cerrar el ejercicio, las cuentas de ingresos y gastos quedarán en $0.00 y no se admitirán nuevas partidas ni anulaciones en el ejercicio {ejercicioSeleccionado}.
              </div>

              <label className="flex items-start gap-2 pt-1 cursor-pointer select-none text-xs">
                <input
                  type="checkbox"
                  checked={cierreConfirmadoCheckbox}
                  onChange={(e) => setCierreConfirmadoCheckbox(e.target.checked)}
                  className="rounded border-border size-4 text-primary focus:ring-primary mt-0.5"
                />
                <span>He revisado la toma física de inventario y confirmo la liquidación del año {ejercicioSeleccionado}.</span>
              </label>

              <label className="flex items-start gap-2 pt-1 cursor-pointer select-none text-xs bg-primary/5 p-2.5 rounded-lg border border-primary/25">
                <input
                  type="checkbox"
                  checked={aperturarSiguienteCheckbox}
                  onChange={(e) => setAperturarSiguienteCheckbox(e.target.checked)}
                  className="rounded border-border size-4 text-primary focus:ring-primary mt-0.5"
                />
                <span className="leading-snug">
                  <strong className="text-foreground">Transición Contable Automática:</strong> Crear el ejercicio fiscal <strong>{ejercicioSeleccionado + 1}</strong> y generar su <strong>Partida #1 de Apertura</strong> con los saldos de balance y el inventario final contado.
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalCierreAbierto(false)}
                disabled={ejecutandoCierre}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={ejecutarCierreSeguro}
                disabled={!cierreConfirmadoCheckbox || ejecutandoCierre}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {ejecutandoCierre ? "Procesando Cierre..." : "Confirmar y Cerrar Ejercicio"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORIAL DE CIERRES */}
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
            <div className="flex items-center gap-2">
              <Badge variant="muted">
                {cierres.length} {cierres.length === 1 ? "cierre registrado" : "cierres registrados"}
              </Badge>
              <Link
                href="/ciclos"
                className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
              >
                <span>Ver pantalla de Ciclos</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>
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
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-semibold ${
                          Number(c.utilidad) >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
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
      <footer className="hidden border-t border-border pt-8 text-center text-xs text-muted-foreground print:block">
        <p>Las notas son parte integrante de los estados financieros.</p>
        <div className="mt-12 grid grid-cols-3 gap-10">
          <div className="border-t border-foreground/50 pt-2">Representante legal</div>
          <div className="border-t border-foreground/50 pt-2">Contador</div>
          <div className="border-t border-foreground/50 pt-2">Auditor externo</div>
        </div>
      </footer>
    </div>
  )
}
