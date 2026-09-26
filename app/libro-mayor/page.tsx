"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileDown,
  FileSpreadsheet,
  Filter,
  ListTree,
  Search,
  TableProperties,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/field"
import { useContabilidad } from "@/components/contabilidad-provider"
import { formatoMoneda, redondear } from "@/lib/contabilidad"
import { exportarLibroExcel, type EstiloCelda } from "@/lib/excel"
import { ETIQUETA_TIPO, type TipoCuenta } from "@/lib/types"

const CATEGORIAS: { valor: string; label: string }[] = [
  { valor: "todas", label: "Todas las cuentas" },
  { valor: "activo", label: "1. Activos" },
  { valor: "pasivo", label: "2. Pasivos" },
  { valor: "capital", label: "3. Capital Contable" },
  { valor: "gasto", label: "4. Costos y Gastos" },
  { valor: "ingreso", label: "5. Ingresos" },
]

// Cuentas que el modulo de Kardex reconoce como movimientos de inventario
// (declaradas en app/kardex/page.tsx). El enlace "Auxiliar" solo tiene
// sentido para estas: en Capital Social o Gastos de Sueldos el destino
// abriria el kardex de un articulo sin relacion con la cuenta elegida.
const CUENTAS_INVENTARIO = new Set([
  "1104",
  "4101",
  "5101",
  "5102",
  "4103",
  "4106",
  "5103",
])

// ============================================================
// MAQUETACION DE LA EXPORTACION A EXCEL
// ============================================================

const BORDE = {
  top: { style: "thin", color: { rgb: "94A3B8" } },
  bottom: { style: "thin", color: { rgb: "94A3B8" } },
  left: { style: "thin", color: { rgb: "94A3B8" } },
  right: { style: "thin", color: { rgb: "94A3B8" } },
} as const

const BORDE_DOBLE = {
  ...BORDE,
  top: { style: "double", color: { rgb: "334155" } },
} as const

const TITULO: EstiloCelda = { font: { bold: true, sz: 14, color: { rgb: "0F172A" } } }
const SUBTITULO: EstiloCelda = { font: { sz: 10, color: { rgb: "475569" } } }
const ENCABEZADO: EstiloCelda = {
  font: { bold: true, sz: 10, color: { rgb: "FFFFFF" } },
  fill: { patternType: "solid", fgColor: { rgb: "0F766E" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: BORDE,
}
const TOTAL: EstiloCelda = {
  font: { bold: true, sz: 10 },
  fill: { patternType: "solid", fgColor: { rgb: "E2E8F0" } },
  border: BORDE_DOBLE,
}
const MONEDA: EstiloCelda = { numFmt: "#,##0.00" }
const MONEDA_TOTAL: EstiloCelda = { numFmt: "#,##0.00", font: { bold: true } }
const CENTRO: EstiloCelda = { alignment: { horizontal: "center" } }

/** Encabezado + cuerpo con bordes, y pie de totales resaltado. */
function maquetar(
  filas: (string | number | null | undefined)[][],
  filaEncabezado: number,
  columnasMoneda: number[],
  anchos: number[],
  anchoTitulo: number,
  filtro?: string,
) {
  const estilos: Record<string, EstiloCelda> = {
    "0:0": TITULO,
    "1:0": SUBTITULO,
    "2:0": SUBTITULO,
  }

  for (let c = 0; c < anchos.length; c++) {
    estilos[`${filaEncabezado}:${c}`] = ENCABEZADO
  }

  const ultima = filas.length - 1
  for (let f = filaEncabezado + 1; f < ultima; f++) {
    const fila = filas[f]
    if (!fila || fila.every((v) => v === null || v === undefined || v === "")) continue
    for (let c = 0; c < anchos.length; c++) {
      const esMoneda = columnasMoneda.includes(c)
      estilos[`${f}:${c}`] = {
        ...(esMoneda ? MONEDA : {}),
        border: BORDE,
      }
    }
    if (fila[0] !== undefined && fila[0] !== null && fila[0] !== "") {
      estilos[`${f}:0`] = { ...estilos[`${f}:0`], font: { bold: false, sz: 10 } }
    }
  }

  for (let c = 0; c < anchos.length; c++) {
    estilos[`${ultima}:${c}`] = columnasMoneda.includes(c) ? { ...TOTAL, ...MONEDA_TOTAL } : TOTAL
  }

  const totalColumnas = anchos.length
  const letraFinal = totalColumnas > 0
    ? XLSX_ENCODE_COL(totalColumnas - 1)
    : "A"

  return {
    anchos,
    alturas: filas.map((_, i) => (i === filaEncabezado ? 26 : i === 0 ? 20 : 14)),
    combinar: [`A1:${letraFinal}1`],
    filtro: filtro ?? `A${filaEncabezado + 1}:${letraFinal}${ultima - 1}`,
    estilos,
  }
}

/** "0" -> "A", "25" -> "Z", "26" -> "AA" */
function XLSX_ENCODE_COL(n: number) {
  let s = ""
  let x = n + 1
  while (x > 0) {
    const resto = (x - 1) % 26
    s = String.fromCharCode(65 + resto) + s
    x = Math.floor((x - 1) / 26)
  }
  return s
}

export default function LibroMayorPage() {
  const { mayor, asientos, ejercicioSeleccionado } = useContabilidad()
  const [vista, setVista] = useState<"cuentasT" | "comprobacion">("cuentasT")
  const [busqueda, setBusqueda] = useState("")
  const [categoria, setCategoria] = useState("todas")

  // Asientos del ejercicio actual ordenados cronológicamente
  const asientosEjercicio = useMemo(() => {
    return asientos
      .filter((a) => {
        if (a.estado === "ANULADO") return false
        // Debe replicar exactamente los filtros de calcularMayor
        // (lib/contabilidad.ts), que recibe incluirCierre=false desde el
        // provider. Sin esto, las partidas de cierre aparecian listadas en la
        // Cuenta T mientras la "Suma:" del pie las excluia y las lineas
        // visibles no cuadraban con el total de su propia tarjeta.
        if (a.tipo === "CIERRE") return false
        const ej = a.ejercicio || (a.fecha ? new Date(a.fecha).getFullYear() : undefined)
        return ej === undefined || ej === ejercicioSeleccionado
      })
      .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "") || a.numero - b.numero)
  }, [asientos, ejercicioSeleccionado])

  // Desglose de partidas por cuenta para las Cuentas T reales
  const movimientosPorCuenta = useMemo(() => {
    const mapa = new Map<
      string,
      {
        debe: { fecha: string; numero: number; concepto: string; monto: number }[]
        haber: { fecha: string; numero: number; concepto: string; monto: number }[]
      }
    >()

    for (const a of asientosEjercicio) {
      for (const l of a.lineas) {
        if (!mapa.has(l.codigo)) {
          mapa.set(l.codigo, { debe: [], haber: [] })
        }
        const obj = mapa.get(l.codigo)!
        const concepto = a.concepto?.trim() || "Concepto no informado"
        if (Number(l.debe) > 0) {
          obj.debe.push({ fecha: a.fecha, numero: a.numero, concepto, monto: Number(l.debe) })
        }
        if (Number(l.haber) > 0) {
          obj.haber.push({ fecha: a.fecha, numero: a.numero, concepto, monto: Number(l.haber) })
        }
      }
    }
    return mapa
  }, [asientosEjercicio])

  const cuentasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return mayor.filter((m) => {
      if (categoria !== "todas" && m.cuenta.tipo !== categoria) return false
      if (!q) return true
      return (
        m.cuenta.codigo.toLowerCase().includes(q) ||
        m.cuenta.nombre.toLowerCase().includes(q)
      )
    })
  }, [mayor, busqueda, categoria])

  const totalDebe = redondear(mayor.reduce((s, m) => s + m.debe, 0))
  const totalHaber = redondear(mayor.reduce((s, m) => s + m.haber, 0))
  const totalDeudor = redondear(
    mayor.filter((m) => m.naturalezaSaldo === "deudora").reduce((s, m) => s + Math.abs(m.saldo), 0),
  )
  const totalAcreedor = redondear(
    mayor.filter((m) => m.naturalezaSaldo === "acreedora").reduce((s, m) => s + Math.abs(m.saldo), 0),
  )

  // Los totales del libro completo nunca deben confundirse con las filas
  // visibles: al filtrar por categoria o buscar texto la tabla muestra un
  // subconjunto, pero el pie anunciaba la suma de todo. Se calculan aparte y
  // se etiquetan de forma explicita.
  const hayFiltroActivo = categoria !== "todas" || busqueda.trim() !== ""

  const totalesVisibles = useMemo(() => {
    const items = hayFiltroActivo ? cuentasFiltradas : mayor
    return {
      debe: redondear(items.reduce((s, m) => s + m.debe, 0)),
      haber: redondear(items.reduce((s, m) => s + m.haber, 0)),
      deudor: redondear(
        items.filter((m) => m.naturalezaSaldo === "deudora").reduce((s, m) => s + Math.abs(m.saldo), 0),
      ),
      acreedor: redondear(
        items.filter((m) => m.naturalezaSaldo === "acreedora").reduce((s, m) => s + Math.abs(m.saldo), 0),
      ),
    }
  }, [cuentasFiltradas, mayor, hayFiltroActivo])

  // La igualdad se calcula, no se escribe a mano: antes el texto imprimia los
  // signos "=" aunque los importes no coincidieran.
  const cuadraMovimientos = totalesVisibles.debe === totalesVisibles.haber
  const cuadraSaldos = totalesVisibles.deudor === totalesVisibles.acreedor
  const cuadraLibroCompleto = totalDebe === totalHaber && totalDeudor === totalAcreedor

  function exportarExcel() {
    const filasMayor: (string | number | null | undefined)[][] = [
      ["SISTEMA CONTABLE AUTOMATIZADO - LIBRO MAYOR"],
      [`Ejercicio fiscal: ${ejercicioSeleccionado}`],
      [`Fecha de emisión: ${new Date().toLocaleDateString("es-SV")}`],
      [],
      ["Código", "Nombre de la Cuenta", "Tipo", "Naturaleza", "Total Debe", "Total Haber", "Saldo Neto", "Condición"],
    ]

    for (const m of mayor) {
      filasMayor.push([
        m.cuenta.codigo,
        m.cuenta.nombre,
        m.cuenta.tipo,
        m.cuenta.naturaleza,
        m.debe,
        m.haber,
        Math.abs(m.saldo),
        m.naturalezaSaldo || "Saldada",
      ])
    }
    filasMayor.push([])
    filasMayor.push(["TOTALES", "", "", "", totalDebe, totalHaber, "", ""])

    const filasDetalle: (string | number | null | undefined)[][] = [
      ["DETALLE DE CUENTAS T"],
      [`Ejercicio fiscal: ${ejercicioSeleccionado}`],
      [`Fecha de emisión: ${new Date().toLocaleDateString("es-SV")}`],
      [],
      ["Código", "Cuenta", "Folio", "Fecha", "Concepto", "Debe", "Haber", "Saldo final", "Condición"],
    ]

    for (const m of mayor) {
      const movimientos = movimientosPorCuenta.get(m.cuenta.codigo)
      for (const movimiento of movimientos?.debe || []) {
        filasDetalle.push([
          m.cuenta.codigo,
          m.cuenta.nombre,
          movimiento.numero,
          movimiento.fecha,
          movimiento.concepto,
          movimiento.monto,
          0,
          "",
          "",
        ])
      }
      for (const movimiento of movimientos?.haber || []) {
        filasDetalle.push([
          m.cuenta.codigo,
          m.cuenta.nombre,
          movimiento.numero,
          movimiento.fecha,
          movimiento.concepto,
          0,
          movimiento.monto,
          "",
          "",
        ])
      }
      filasDetalle.push([
        m.cuenta.codigo,
        m.cuenta.nombre,
        "",
        "",
        "Saldo final",
        "",
        "",
        m.saldo,
        m.naturalezaSaldo || "Saldada",
      ])
    }

    const filasComprobacion: (string | number | null | undefined)[][] = [
      ["BALANCE DE COMPROBACIÓN"],
      [`Ejercicio fiscal: ${ejercicioSeleccionado}`],
      [`Fecha de emisión: ${new Date().toLocaleDateString("es-SV")}`],
      [],
      ["Código", "Nombre de la Cuenta", "Movimiento Debe", "Movimiento Haber", "Saldo Deudor", "Saldo Acreedor"],
    ]

    for (const m of mayor) {
      const deudor = m.naturalezaSaldo === "deudora" ? Math.abs(m.saldo) : 0
      const acreedor = m.naturalezaSaldo === "acreedora" ? Math.abs(m.saldo) : 0
      filasComprobacion.push([
        m.cuenta.codigo,
        m.cuenta.nombre,
        m.debe,
        m.haber,
        deudor,
        acreedor,
      ])
    }
    filasComprobacion.push([])
    filasComprobacion.push(["SUMAS IGUALES", "", totalDebe, totalHaber, totalDeudor, totalAcreedor])

    exportarLibroExcel(`Libro_Mayor_Ejercicio_${ejercicioSeleccionado}`, [
      {
        nombre: "Libro Mayor",
        filas: filasMayor,
        ...maquetar(filasMayor, 4, [4, 5, 6], [10, 38, 11, 13, 15, 15, 15, 13], 8),
      },
      {
        nombre: "Detalle Cuentas T",
        filas: filasDetalle,
        ...maquetar(filasDetalle, 4, [5, 6, 7], [10, 34, 8, 12, 52, 14, 14, 14, 13], 9),
      },
      {
        nombre: "Balance de Comprobación",
        filas: filasComprobacion,
        ...maquetar(filasComprobacion, 4, [2, 3, 4, 5], [10, 38, 17, 17, 15, 15], 6),
      },
    ])
  }

  function exportarPdf() {
    const previousTitle = document.title
    document.title = `Libro_Mayor_${vista === "comprobacion" ? "Balance_Comprobacion" : "CuentasT"}_${ejercicioSeleccionado}`
    window.print()
    window.setTimeout(() => {
      document.title = previousTitle
    }, 500)
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2 report-header">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">Mayorización Central</span>
              <span className="text-xs text-muted-foreground">·</span>
              <Badge variant="default" className="text-xs font-mono">
                Ciclo Fiscal {ejercicioSeleccionado}
              </Badge>
              <Badge variant="success" className="text-[10px]">
                Mayorización automática
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl mt-0.5">Libro Mayor y Balanza</h1>
            <p className="max-w-2xl text-xs sm:text-sm text-muted-foreground">
              Consolidación automática en tiempo real de débitos y créditos en Cuentas T y Balance de Comprobación.
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportarPdf}
              className="h-8 gap-1.5 text-xs shadow-xs"
            >
              <FileDown className="size-3.5" />
              Imprimir
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportarExcel}
              className="h-8 gap-1.5 text-xs border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/20 shadow-xs"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-600" />
              Exportar Excel
            </Button>
          </div>
        </div>
      </header>

      {/* BARRA DE HERRAMIENTAS: BÚSQUEDA, FILTRO Y ALTERNADOR DE VISTAS */}
      <Card className="print:hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Alternador de Vistas */}
            <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40">
              <button
                type="button"
                onClick={() => setVista("cuentasT")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  vista === "cuentasT"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BookOpen className="size-3.5" />
                Cuentas T (Detallado)
              </button>
              <button
                type="button"
                onClick={() => setVista("comprobacion")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  vista === "comprobacion"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <TableProperties className="size-3.5" />
                Balance de Comprobación
              </button>
            </div>

            {/* Contador de cuentas filtradas */}
            <Badge variant="muted" className="text-xs">
              {cuentasFiltradas.length} de {mayor.length} cuentas con saldo
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar cuenta por código o nombre..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9 h-10 text-sm"
              />
            </div>

            <div className="relative">
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {CATEGORIAS.map((cat) => (
                  <option key={cat.valor} value={cat.valor}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {mayor.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            <ListTree className="mx-auto size-10 text-muted-foreground/40 mb-3" />
            <p className="font-semibold text-foreground">No hay movimientos en este ejercicio</p>
            <p className="text-xs mt-1">Registra asientos en el Libro Diario para generar la mayorización automática.</p>
          </CardContent>
        </Card>
      ) : vista === "cuentasT" ? (
        /* VISTA: CUENTAS T REALES Y DETALLADAS */
        <section className="grid gap-4 sm:grid-cols-2">
          {cuentasFiltradas.map((m) => {
            const movs = movimientosPorCuenta.get(m.cuenta.codigo) || { debe: [], haber: [] }
            // Deteccion de anomalias contables
            //
            // Un saldo solo es anomalo cuando el signo CONTRADICE la naturaleza
            // configurada de la cuenta. Antes se comparaba contra el signo del
            // saldo, lo que marcaba como sobregiro a toda cuenta acreedora de
            // tipo activo (p.ej. 1206 Depreciacion acumulada), que son
            // precisamente las que acumulan saldo en el haber por diseno.
            const saldoCero = m.saldo === 0
            const contradiceNaturaleza =
              m.cuenta.naturaleza === "deudora" ? m.saldo < 0 : m.saldo > 0
            const sobregirada = m.cuenta.tipo === "activo" && contradiceNaturaleza

            return (
              <Card
                key={m.cuenta.codigo}
                className={`report-card ${sobregirada ? "border-red-500/40 bg-red-500/[0.02]" : ""}`}
              >
                <CardHeader className="pb-3 border-b border-border/60">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="font-mono text-primary font-bold">{m.cuenta.codigo}</span>
                        <span>{m.cuenta.nombre}</span>
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {ETIQUETA_TIPO[m.cuenta.tipo]} · Naturaleza {m.cuenta.naturaleza}
                      </CardDescription>
                    </div>

                    {CUENTAS_INVENTARIO.has(m.cuenta.codigo) && (
                      <Link
                        href={`/kardex?codigo=${m.cuenta.codigo}`}
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded"
                        title="Abrir extracto auxiliar de esta cuenta"
                      >
                        Auxiliar <ArrowRight className="size-3" />
                      </Link>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-3">
                  {/* Estructura formal de Cuenta T */}
                  <div className="grid grid-cols-2 rounded-lg border border-border overflow-hidden text-xs print-accounting-table">
                    {/* Columna DEBE */}
                    <div className="border-r border-border flex flex-col justify-between">
                      <div>
                        <div className="bg-muted/60 p-2 text-center font-bold text-muted-foreground uppercase border-b border-border text-[11px]">
                          Debe (Cargos)
                        </div>
                        <div className="p-2 space-y-1 max-h-36 overflow-y-auto divide-y divide-border/40">
                          {movs.debe.length === 0 ? (
                            <p className="text-center text-muted-foreground/40 py-2">-</p>
                          ) : (
                            movs.debe.map((item, idx) => (
                              <div key={idx} className="flex items-start justify-between gap-2 pt-1">
                                <div className="min-w-0">
                                  <span className="block font-mono text-[10px] text-muted-foreground">
                                    #{item.numero} ({item.fecha.slice(5)})
                                  </span>
                                  <span className="mt-0.5 block truncate text-[10px] text-foreground" title={item.concepto}>
                                    {item.concepto}
                                  </span>
                                </div>
                                <span className="shrink-0 font-mono font-medium text-foreground">
                                  {formatoMoneda(item.monto)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="bg-muted/30 p-2 border-t border-border flex justify-between font-mono font-bold">
                        <span className="text-muted-foreground text-[10px]">Suma:</span>
                        <span>{formatoMoneda(m.debe)}</span>
                      </div>
                    </div>

                    {/* Columna HABER */}
                    <div className="flex flex-col justify-between">
                      <div>
                        <div className="bg-muted/60 p-2 text-center font-bold text-muted-foreground uppercase border-b border-border text-[11px]">
                          Haber (Abonos)
                        </div>
                        <div className="p-2 space-y-1 max-h-36 overflow-y-auto divide-y divide-border/40">
                          {movs.haber.length === 0 ? (
                            <p className="text-center text-muted-foreground/40 py-2">-</p>
                          ) : (
                            movs.haber.map((item, idx) => (
                              <div key={idx} className="flex items-start justify-between gap-2 pt-1">
                                <div className="min-w-0">
                                  <span className="block font-mono text-[10px] text-muted-foreground">
                                    #{item.numero} ({item.fecha.slice(5)})
                                  </span>
                                  <span className="mt-0.5 block truncate text-[10px] text-foreground" title={item.concepto}>
                                    {item.concepto}
                                  </span>
                                </div>
                                <span className="shrink-0 font-mono font-medium text-foreground">
                                  {formatoMoneda(item.monto)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="bg-muted/30 p-2 border-t border-border flex justify-between font-mono font-bold">
                        <span className="text-muted-foreground text-[10px]">Suma:</span>
                        <span>{formatoMoneda(m.haber)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Saldo Final y Estado */}
                  <div className="flex items-center justify-between pt-1 text-xs saldo-doble-linea">
                    <span className="text-muted-foreground font-medium">Saldo Neto:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-foreground">
                        {formatoMoneda(Math.abs(m.saldo))}
                      </span>

                      {sobregirada ? (
                        <Badge variant="warning" className="text-[10px] flex items-center gap-1 font-bold">
                          <AlertTriangle className="size-3" />
                          {`¡Sobregiro! (Saldo ${m.naturalezaSaldo === "deudora" ? "Deudor" : "Acreedor"})`}
                        </Badge>
                      ) : saldoCero ? (
                        <Badge variant="muted" className="text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="size-3 text-emerald-600" />
                          Saldada
                        </Badge>
                      ) : m.naturalezaSaldo === "deudora" ? (
                        <Badge variant="deudora" className="text-[10px]">
                          Saldo Deudor
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-[10px] bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                          Saldo Acreedor
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </section>
      ) : (
        /* VISTA: BALANCE DE COMPROBACIÓN FORMAL */
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Balance de Comprobación de Sumas y Saldos
            </CardTitle>
            <CardDescription>
              Comprobación estricta de igualdad matemática entre movimientos y saldos deudores y acreedores.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[700px] text-sm print-accounting-table">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b border-border">
                    <th rowSpan={2} className="py-2.5 px-3 text-left">Código</th>
                    <th rowSpan={2} className="py-2.5 px-3 text-left">Nombre de la Cuenta</th>
                    <th colSpan={2} className="py-1 px-3 text-center border-b border-border">
                      Movimientos
                    </th>
                    <th colSpan={2} className="py-1 px-3 text-center border-b border-border">
                      Saldos
                    </th>
                  </tr>
                  <tr className="border-b border-border text-[11px]">
                    <th className="py-1.5 px-3 text-right">Debe</th>
                    <th className="py-1.5 px-3 text-right">Haber</th>
                    <th className="py-1.5 px-3 text-right">Deudor</th>
                    <th className="py-1.5 px-3 text-right">Acreedor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {cuentasFiltradas.map((m) => {
                    const deudor = m.naturalezaSaldo === "deudora" ? Math.abs(m.saldo) : 0
                    const acreedor = m.naturalezaSaldo === "acreedora" ? Math.abs(m.saldo) : 0
                    return (
                      <tr key={m.cuenta.codigo} className="hover:bg-muted/30 transition-colors group">
                        <td className="py-2.5 px-3 font-mono font-medium text-xs">
                          <Link
                            href={`/kardex?codigo=${m.cuenta.codigo}`}
                            className="text-primary hover:underline font-bold inline-flex items-center gap-1"
                            title="Abrir extracto en Libro Auxiliar"
                          >
                            <span>{m.cuenta.codigo}</span>
                            <ArrowRight className="size-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                        </td>
                        <td className="py-2.5 px-3 text-foreground">
                          <Link
                            href={`/kardex?codigo=${m.cuenta.codigo}`}
                            className="hover:underline"
                            title="Abrir extracto en Libro Auxiliar"
                          >
                            {m.cuenta.nombre}
                          </Link>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {m.debe > 0 ? formatoMoneda(m.debe) : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {m.haber > 0 ? formatoMoneda(m.haber) : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-foreground">
                          {deudor > 0 ? formatoMoneda(deudor) : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-foreground">
                          {acreedor > 0 ? formatoMoneda(acreedor) : "-"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/40 font-bold border-b-4 border-double border-foreground/30">
                  <tr>
                    <td colSpan={2} className="py-3 px-3 uppercase text-xs tracking-wider text-muted-foreground">
                      {hayFiltroActivo ? "Suma de cuentas filtradas" : "Sumas Iguales"}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {formatoMoneda(totalesVisibles.debe)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {formatoMoneda(totalesVisibles.haber)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-foreground">
                      {formatoMoneda(totalesVisibles.deudor)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-foreground">
                      {formatoMoneda(totalesVisibles.acreedor)}
                    </td>
                  </tr>

                  {/* Los totales generales se muestran aparte y rotulados, para
                      que con un filtro activo nunca se confundan con la suma de
                      las filas visibles. */}
                  {hayFiltroActivo && (
                    <tr className="border-t border-border/60">
                      <td colSpan={2} className="py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                        Totales generales (Libro Completo)
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-xs text-muted-foreground">
                        {formatoMoneda(totalDebe)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-xs text-muted-foreground">
                        {formatoMoneda(totalHaber)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-xs text-muted-foreground">
                        {formatoMoneda(totalDeudor)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-xs text-muted-foreground">
                        {formatoMoneda(totalAcreedor)}
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>

              {/* BANDA DE VERIFICACIÓN DE CUADRE DE BALANZA */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/20 border-t border-border text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  {cuadraMovimientos && cuadraSaldos ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="size-4 text-amber-600" />
                  )}
                  <span>
                    <strong>
                      {hayFiltroActivo
                        ? "Verificación de la vista filtrada:"
                        : "Verificación de Partida Doble:"}
                    </strong>{" "}
                    Débitos ({formatoMoneda(totalesVisibles.debe)}){" "}
                    {cuadraMovimientos ? "=" : "≠"} Créditos ({formatoMoneda(totalesVisibles.haber)}) ·
                    Saldos Deudores ({formatoMoneda(totalesVisibles.deudor)}){" "}
                    {cuadraSaldos ? "=" : "≠"} Saldos Acreedores ({formatoMoneda(totalesVisibles.acreedor)})
                  </span>
                </div>

                {/* Con un filtro activo la comprobacion parcial no certifica el
                    libro entero, asi que se informa tambien del total general. */}
                {hayFiltroActivo && (
                  <span className="text-[10px] text-muted-foreground/80">
                    Libro completo: {formatoMoneda(totalDebe)} {cuadraLibroCompleto ? "=" : "≠"}{" "}
                    {formatoMoneda(totalHaber)}
                  </span>
                )}

                <Badge
                  variant={cuadraMovimientos && cuadraSaldos ? "success" : "warning"}
                  className="font-mono text-[10px]"
                >
                  {cuadraMovimientos && cuadraSaldos
                    ? "Balanza Cuadrada al Centavo ✓"
                    : "Diferencia detectada"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PIE DE FIRMAS DE AUDITORÍA (IMPRESIÓN OFICIAL) */}
      <footer className="hidden border-t border-border pt-8 text-center text-xs text-muted-foreground print:block">
        <p className="font-semibold text-foreground">
          Libro Mayor y Balance de Comprobación emitido oficialmente por el Sistema Contable.
        </p>
        <p className="mt-1">
          Certificación de sumas y saldos mayorizados correspondientes al Ciclo Fiscal {ejercicioSeleccionado}.
        </p>
        <div className="mt-14 grid grid-cols-3 gap-10">
          <div className="border-t border-foreground/50 pt-2 font-medium">Elaboró (Auxiliar Contable)</div>
          <div className="border-t border-foreground/50 pt-2 font-medium">Revisó (Contador General - JVPCPA)</div>
          <div className="border-t border-foreground/50 pt-2 font-medium">Autorizó (Representante Legal / Auditor)</div>
        </div>
      </footer>
    </div>
  )
}
