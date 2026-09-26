"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileDown,
  FileSpreadsheet,
  ListTree,
  Search,
  TableProperties,
  X,
  Scale,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Layers,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useContabilidad } from "@/components/contabilidad-provider"
import { formatoMoneda, redondear } from "@/lib/contabilidad"
import { exportarLibroExcel, type EstiloCelda } from "@/lib/excel"
import { ETIQUETA_TIPO } from "@/lib/types"
import { CuentaMayorFinderModal } from "@/components/contabilidad/CuentaMayorFinderModal"
import { cn } from "@/lib/utils"

const CATEGORIAS_LABELS: Record<string, string> = {
  todas: "Todas las cuentas",
  activo: "1. Activos",
  pasivo: "2. Pasivos",
  capital: "3. Capital Contable",
  gasto: "4. Costos y Gastos",
  ingreso: "5. Ingresos",
}

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
  const [cuentaFiltroCodigo, setCuentaFiltroCodigo] = useState<string | null>(null)
  const [finderOpen, setFinderOpen] = useState(false)

  // Atajo de teclado global (⌘K o /) para abrir el Finder
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setFinderOpen(true)
      } else if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault()
        setFinderOpen(true)
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown)
    return () => window.removeEventListener("keydown", handleGlobalKeyDown)
  }, [])

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

  // Filtrado de cuentas
  const cuentasFiltradas = useMemo(() => {
    if (cuentaFiltroCodigo) {
      return mayor.filter((m) => m.cuenta.codigo === cuentaFiltroCodigo)
    }

    const q = busqueda.trim().toLowerCase()
    return mayor.filter((m) => {
      if (categoria !== "todas" && m.cuenta.tipo !== categoria) return false
      if (!q) return true
      return (
        m.cuenta.codigo.toLowerCase().includes(q) ||
        m.cuenta.nombre.toLowerCase().includes(q)
      )
    })
  }, [mayor, cuentaFiltroCodigo, busqueda, categoria])

  const totalDebe = redondear(mayor.reduce((s, m) => s + m.debe, 0))
  const totalHaber = redondear(mayor.reduce((s, m) => s + m.haber, 0))
  const totalDeudor = redondear(
    mayor.filter((m) => m.naturalezaSaldo === "deudora").reduce((s, m) => s + Math.abs(m.saldo), 0),
  )
  const totalAcreedor = redondear(
    mayor.filter((m) => m.naturalezaSaldo === "acreedora").reduce((s, m) => s + Math.abs(m.saldo), 0),
  )

  const hayFiltroActivo = Boolean(cuentaFiltroCodigo || categoria !== "todas" || busqueda.trim() !== "")

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

  const cuadraMovimientos = totalesVisibles.debe === totalesVisibles.haber
  const cuadraSaldos = totalesVisibles.deudor === totalesVisibles.acreedor
  const cuadraLibroCompleto = totalDebe === totalHaber && totalDeudor === totalAcreedor

  // Cuenta activa para mostrar en el botón si hay selección individual
  const cuentaFiltroSeleccionada = useMemo(() => {
    if (!cuentaFiltroCodigo) return null
    return mayor.find((m) => m.cuenta.codigo === cuentaFiltroCodigo) || null
  }, [mayor, cuentaFiltroCodigo])

  // Limpiar todos los filtros
  const handleLimpiarFiltros = useCallback(() => {
    setCuentaFiltroCodigo(null)
    setBusqueda("")
    setCategoria("todas")
  }, [])

  // Manejar selección desde el Finder
  const handleSeleccionarCuentaDesdeFinder = useCallback((codigo: string | null) => {
    setCuentaFiltroCodigo(codigo)
    setBusqueda("")
    setCategoria("todas")
  }, [])

  // Manejar filtro de texto y categoría desde el Finder
  const handleAplicarFiltroTextoDesdeFinder = useCallback((q: string, cat: string) => {
    setCuentaFiltroCodigo(null)
    setBusqueda(q)
    setCategoria(cat)
  }, [])

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
      {/* ===================================================================== */}
      {/* ENCABEZADO Y CONTROLES SEGÚN MAQUETA                                  */}
      {/* ===================================================================== */}
      <div className="space-y-4 report-header">
        {/* FILA SUPERIOR: TÍTULO + CICLO FISCAL Y BOTONES DE ACCIÓN */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl text-foreground">
              Libro Mayor y Balanza
            </h1>
            <Badge
              variant="default"
              className="text-xs font-mono bg-neutral-900 text-white dark:bg-neutral-800 dark:text-neutral-200 border border-neutral-700/60 px-2.5 py-1 rounded-full shadow-2xs"
            >
              Ciclo Fiscal {ejercicioSeleccionado}
            </Badge>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportarPdf}
              className="h-8 gap-1.5 text-xs shadow-xs cursor-pointer"
            >
              <FileDown className="size-3.5" />
              Imprimir
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportarExcel}
              className="h-8 gap-1.5 text-xs border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/20 shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-600" />
              Exportar Excel
            </Button>
          </div>
        </div>

        {/* FILA INFERIOR: ALTERNADOR DE VISTAS + BOTÓN BUSCADOR DE CUENTAS */}
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Alternador de Vistas: Dark Container Pill como en el diseño de referencia */}
            <div className="inline-flex rounded-xl p-1 bg-neutral-900 dark:bg-neutral-900 border border-neutral-800 text-neutral-300 shadow-2xs">
              <button
                type="button"
                onClick={() => setVista("cuentasT")}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                  vista === "cuentasT"
                    ? "bg-neutral-800 text-white shadow-xs font-bold"
                    : "text-neutral-400 hover:text-white"
                )}
              >
                <BookOpen className="size-3.5" />
                <span>Cuentas T (Detallado)</span>
              </button>
              <button
                type="button"
                onClick={() => setVista("comprobacion")}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                  vista === "comprobacion"
                    ? "bg-neutral-800 text-white shadow-xs font-bold"
                    : "text-neutral-400 hover:text-white"
                )}
              >
                <TableProperties className="size-3.5" />
                <span>Balance de Comprobación</span>
              </button>
            </div>

            {/* Botón Finder: "Buscar por cuenta" */}
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFinderOpen(true)}
                className={cn(
                  "h-9 px-4 gap-2 text-xs font-medium rounded-xl shadow-2xs cursor-pointer transition-all border",
                  hayFiltroActivo
                    ? "bg-primary/10 border-primary/40 text-primary font-semibold hover:bg-primary/15"
                    : "bg-card hover:bg-muted/60 text-foreground border-border"
                )}
              >
                <Search className="size-3.5 text-muted-foreground" />
                <span className="truncate max-w-[200px] sm:max-w-[260px]">
                  {cuentaFiltroSeleccionada
                    ? `${cuentaFiltroSeleccionada.cuenta.codigo} · ${cuentaFiltroSeleccionada.cuenta.nombre}`
                    : busqueda
                    ? `Búsqueda: "${busqueda}"`
                    : categoria !== "todas"
                    ? CATEGORIAS_LABELS[categoria]
                    : "Buscar por cuenta"}
                </span>
                <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] font-mono rounded bg-muted text-muted-foreground border border-border/80">
                  ⌘K
                </kbd>
              </Button>

              {/* Botón rápido para limpiar filtro si hay alguno activo */}
              {hayFiltroActivo && (
                <button
                  type="button"
                  onClick={handleLimpiarFiltros}
                  className="size-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 border border-border/80 transition-colors cursor-pointer"
                  title="Restablecer filtro y ver todas las cuentas"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Contador de cuentas visibles */}
          <div className="flex items-center gap-2">
            <Badge variant="muted" className="text-xs font-mono font-medium">
              {cuentasFiltradas.length} de {mayor.length} cuentas con saldo
            </Badge>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL FINDER DE CUENTAS ESTILO SPOTLIGHT                              */}
      {/* ===================================================================== */}
      <CuentaMayorFinderModal
        isOpen={finderOpen}
        onClose={() => setFinderOpen(false)}
        cuentasMayor={mayor}
        cuentaFiltroCodigo={cuentaFiltroCodigo}
        busquedaTexto={busqueda}
        categoriaFiltro={categoria}
        onSeleccionarCuenta={handleSeleccionarCuentaDesdeFinder}
        onAplicarFiltroTexto={handleAplicarFiltroTextoDesdeFinder}
        onLimpiarFiltros={handleLimpiarFiltros}
      />

      {/* ===================================================================== */}
      {/* CONTENIDO PRINCIPAL: CUENTAS T O BALANCE DE COMPROBACIÓN              */}
      {/* ===================================================================== */}
      {mayor.length === 0 ? (
        <Card className="rounded-2xl border-border/80 shadow-2xs">
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            <ListTree className="mx-auto size-10 text-muted-foreground/40 mb-3" />
            <p className="font-semibold text-foreground text-base">No hay movimientos en este ejercicio</p>
            <p className="text-xs mt-1 max-w-md mx-auto">
              Registra asientos en el Libro Diario para generar la mayorización automática de débitos y créditos.
            </p>
          </CardContent>
        </Card>
      ) : cuentasFiltradas.length === 0 ? (
        <Card className="rounded-2xl border-border/80 shadow-2xs">
          <CardContent className="p-12 text-center text-sm text-muted-foreground space-y-3">
            <Search className="mx-auto size-9 text-muted-foreground/40" />
            <div>
              <p className="font-semibold text-foreground text-base">No se encontraron cuentas para este filtro</p>
              <p className="text-xs mt-1 text-muted-foreground">
                Prueba con otro término de búsqueda o categoría en el buscador.
              </p>
            </div>
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLimpiarFiltros}
                className="text-xs cursor-pointer"
              >
                Ver todas las cuentas
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : vista === "cuentasT" ? (
        /* =================================================================== */
        /* VISTA 1: TARJETAS DE CUENTAS T (DISEÑO MINIMALISTA Y REFINADO)       */
        /* =================================================================== */
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
          {cuentasFiltradas.map((m) => {
            const movs = movimientosPorCuenta.get(m.cuenta.codigo) || { debe: [], haber: [] }
            const saldoCero = m.saldo === 0
            const contradiceNaturaleza =
              m.cuenta.naturaleza === "deudora" ? m.saldo < 0 : m.saldo > 0
            const sobregirada = m.cuenta.tipo === "activo" && contradiceNaturaleza
            const totalMovimientos = movs.debe.length + movs.haber.length

            return (
              <div
                key={m.cuenta.codigo}
                className={cn(
                  "report-card rounded-2xl border bg-card text-card-foreground shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between overflow-hidden",
                  sobregirada
                    ? "border-red-500/40 bg-red-500/[0.015]"
                    : "border-border/80 hover:border-primary/40"
                )}
              >
                {/* CABECERA MINIMALISTA DE LA CUENTA */}
                <div className="p-4 sm:p-5 border-b border-border/70 flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-primary/10 text-primary shrink-0">
                        {m.cuenta.codigo}
                      </span>
                      <h2 className="text-sm sm:text-base font-bold text-foreground truncate">
                        {m.cuenta.nombre}
                      </h2>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                      <span>{ETIQUETA_TIPO[m.cuenta.tipo]}</span>
                      <span>·</span>
                      <span className="capitalize">Naturaleza {m.cuenta.naturaleza}</span>
                      <span>·</span>
                      <span>{totalMovimientos} {totalMovimientos === 1 ? "movimiento" : "movimientos"}</span>
                    </div>
                  </div>

                  {CUENTAS_INVENTARIO.has(m.cuenta.codigo) && (
                    <Link
                      href={`/kardex?codigo=${m.cuenta.codigo}`}
                      className="text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-1 bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-lg shrink-0 transition-colors"
                      title="Abrir extracto auxiliar de esta cuenta"
                    >
                      <span>Auxiliar</span>
                      <ArrowRight className="size-3" />
                    </Link>
                  )}
                </div>

                {/* CUERPO: ESTRUCTURA FORMAL DE CUENTA T */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="rounded-xl border border-border/80 overflow-hidden text-xs print-accounting-table">
                    {/* ENCABEZADOS DEBE Y HABER */}
                    <div className="grid grid-cols-2 border-b border-border/80 bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-center divide-x divide-border/80">
                      <div className="py-2 px-3">Debe (Cargos)</div>
                      <div className="py-2 px-3">Haber (Abonos)</div>
                    </div>

                    {/* COLUMNAS DE MOVIMIENTOS EN T */}
                    <div className="grid grid-cols-2 divide-x divide-border/80 min-h-[140px]">
                      {/* LADO DEBE */}
                      <div className="flex flex-col justify-between">
                        <div className="p-2 space-y-1.5 max-h-44 overflow-y-auto divide-y divide-border/30">
                          {movs.debe.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground/30 text-xs italic">
                              Sin cargos
                            </div>
                          ) : (
                            movs.debe.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-start justify-between gap-2 pt-1.5 first:pt-0 group hover:bg-muted/30 px-1 rounded transition-colors"
                              >
                                <div className="min-w-0 pr-1">
                                  <div className="font-mono text-[10px] text-muted-foreground font-semibold">
                                    #{item.numero} <span className="font-normal">({item.fecha.slice(5)})</span>
                                  </div>
                                  <span
                                    className="block truncate text-[10px] text-foreground/90"
                                    title={item.concepto}
                                  >
                                    {item.concepto}
                                  </span>
                                </div>
                                <span className="shrink-0 font-mono font-semibold tabular-nums text-foreground text-right text-[11px]">
                                  {formatoMoneda(item.monto)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                        {/* TOTAL DEBE */}
                        <div className="bg-muted/30 px-3 py-2 border-t border-border/80 flex items-center justify-between font-mono font-bold text-xs">
                          <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                            Total Debe
                          </span>
                          <span className="tabular-nums text-foreground">{formatoMoneda(m.debe)}</span>
                        </div>
                      </div>

                      {/* LADO HABER */}
                      <div className="flex flex-col justify-between">
                        <div className="p-2 space-y-1.5 max-h-44 overflow-y-auto divide-y divide-border/30">
                          {movs.haber.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground/30 text-xs italic">
                              Sin abonos
                            </div>
                          ) : (
                            movs.haber.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-start justify-between gap-2 pt-1.5 first:pt-0 group hover:bg-muted/30 px-1 rounded transition-colors"
                              >
                                <div className="min-w-0 pr-1">
                                  <div className="font-mono text-[10px] text-muted-foreground font-semibold">
                                    #{item.numero} <span className="font-normal">({item.fecha.slice(5)})</span>
                                  </div>
                                  <span
                                    className="block truncate text-[10px] text-foreground/90"
                                    title={item.concepto}
                                  >
                                    {item.concepto}
                                  </span>
                                </div>
                                <span className="shrink-0 font-mono font-semibold tabular-nums text-foreground text-right text-[11px]">
                                  {formatoMoneda(item.monto)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                        {/* TOTAL HABER */}
                        <div className="bg-muted/30 px-3 py-2 border-t border-border/80 flex items-center justify-between font-mono font-bold text-xs">
                          <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                            Total Haber
                          </span>
                          <span className="tabular-nums text-foreground">{formatoMoneda(m.haber)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PIE DE LA TARJETA: SALDO NETO Y CONDICIÓN */}
                <div className="px-4 sm:px-5 py-3 bg-muted/25 dark:bg-muted/15 border-t border-border/70 flex items-center justify-between gap-3 text-xs saldo-doble-linea">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs font-medium">Saldo Neto:</span>
                    <span className="font-mono font-bold text-sm sm:text-base text-foreground tabular-nums">
                      {formatoMoneda(Math.abs(m.saldo))}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {sobregirada ? (
                      <Badge variant="warning" className="text-[10px] font-bold flex items-center gap-1">
                        <AlertTriangle className="size-3" />
                        <span>¡Sobregiro!</span>
                      </Badge>
                    ) : saldoCero ? (
                      <Badge variant="muted" className="text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="size-3 text-emerald-600" />
                        <span>Saldada</span>
                      </Badge>
                    ) : m.naturalezaSaldo === "deudora" ? (
                      <Badge variant="deudora" className="text-[10px]">
                        Saldo Deudor
                      </Badge>
                    ) : (
                      <Badge
                        variant="default"
                        className="text-[10px] bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                      >
                        Saldo Acreedor
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </section>
      ) : (
        /* =================================================================== */
        /* VISTA 2: BALANCE DE COMPROBACIÓN FORMAL Y MINIMALISTA                */
        /* =================================================================== */
        <div className="space-y-4">
          {/* TIRA DE MÉTRICAS / RESUMEN EJECUTIVO DE COMPROBACIÓN */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Total Movimientos
              </span>
              <div className="text-base sm:text-lg font-bold font-mono tabular-nums text-foreground">
                {formatoMoneda(totalesVisibles.debe)}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                {cuadraMovimientos ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> Débito = Crédito
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-1">
                    <AlertTriangle className="size-3" /> Diferencia detectada
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Total Saldos
              </span>
              <div className="text-base sm:text-lg font-bold font-mono tabular-nums text-foreground">
                {formatoMoneda(totalesVisibles.deudor)}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                {cuadraSaldos ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> Deudor = Acreedor
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-1">
                    <AlertTriangle className="size-3" /> Diferencia en saldos
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Estado Partida Doble
              </span>
              <div className="pt-0.5">
                <Badge
                  variant={cuadraMovimientos && cuadraSaldos ? "success" : "warning"}
                  className="font-mono text-xs px-2 py-0.5"
                >
                  {cuadraMovimientos && cuadraSaldos ? "Cuadrada al Centavo ✓" : "Diferencia"}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {cuadraMovimientos && cuadraSaldos
                  ? "Cumple estricta igualdad contable"
                  : "Revisar asientos del ejercicio"}
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Cuentas en Balanza
              </span>
              <div className="text-base sm:text-lg font-bold font-mono tabular-nums text-foreground">
                {cuentasFiltradas.length}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {hayFiltroActivo ? "Filtradas del libro completo" : "Cuentas con saldo en el ejercicio"}
              </p>
            </div>
          </div>

          {/* TABLA PRINCIPAL DE BALANCE DE COMPROBACIÓN */}
          <Card className="rounded-2xl border-border/80 overflow-hidden shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    Balance de Comprobación de Sumas y Saldos
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Comprobación rigurosa de igualdad matemática entre movimientos (débitos/créditos) y saldos (deudores/acreedores).
                  </CardDescription>
                </div>

                <Badge variant="muted" className="text-xs font-mono font-medium">
                  {cuentasFiltradas.length} cuentas
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm print-accounting-table">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                    <tr className="border-b border-border">
                      <th rowSpan={2} className="py-2.5 px-3.5 text-left font-bold">
                        Código
                      </th>
                      <th rowSpan={2} className="py-2.5 px-3.5 text-left font-bold">
                        Nombre de la Cuenta
                      </th>
                      <th colSpan={2} className="py-1 px-3.5 text-center border-b border-border font-bold">
                        Movimientos
                      </th>
                      <th colSpan={2} className="py-1 px-3.5 text-center border-b border-border font-bold">
                        Saldos
                      </th>
                    </tr>
                    <tr className="border-b border-border text-[11px]">
                      <th className="py-1.5 px-3.5 text-right font-bold">Debe</th>
                      <th className="py-1.5 px-3.5 text-right font-bold">Haber</th>
                      <th className="py-1.5 px-3.5 text-right font-bold">Deudor</th>
                      <th className="py-1.5 px-3.5 text-right font-bold">Acreedor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {cuentasFiltradas.map((m) => {
                      const deudor = m.naturalezaSaldo === "deudora" ? Math.abs(m.saldo) : 0
                      const acreedor = m.naturalezaSaldo === "acreedora" ? Math.abs(m.saldo) : 0
                      return (
                        <tr
                          key={m.cuenta.codigo}
                          className="hover:bg-muted/30 transition-colors group"
                        >
                          <td className="py-2.5 px-3.5 font-mono font-semibold text-xs">
                            <Link
                              href={`/kardex?codigo=${m.cuenta.codigo}`}
                              className="text-primary hover:underline font-bold inline-flex items-center gap-1"
                              title="Abrir extracto en Libro Auxiliar"
                            >
                              <span>{m.cuenta.codigo}</span>
                              <ArrowRight className="size-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                          </td>
                          <td className="py-2.5 px-3.5 text-foreground font-medium">
                            <Link
                              href={`/kardex?codigo=${m.cuenta.codigo}`}
                              className="hover:underline"
                              title="Abrir extracto en Libro Auxiliar"
                            >
                              {m.cuenta.nombre}
                            </Link>
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-xs">
                            {m.debe > 0 ? (
                              formatoMoneda(m.debe)
                            ) : (
                              <span className="text-muted-foreground/40">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-xs">
                            {m.haber > 0 ? (
                              formatoMoneda(m.haber)
                            ) : (
                              <span className="text-muted-foreground/40">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono tabular-nums font-semibold text-foreground text-xs">
                            {deudor > 0 ? (
                              formatoMoneda(deudor)
                            ) : (
                              <span className="text-muted-foreground/40 font-normal">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono tabular-nums font-semibold text-foreground text-xs">
                            {acreedor > 0 ? (
                              formatoMoneda(acreedor)
                            ) : (
                              <span className="text-muted-foreground/40 font-normal">-</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-border bg-muted/40 font-bold border-b-4 border-double border-foreground/30">
                    <tr>
                      <td
                        colSpan={2}
                        className="py-3 px-3.5 uppercase text-xs tracking-wider text-muted-foreground font-bold"
                      >
                        {hayFiltroActivo ? "Suma de cuentas filtradas" : "Sumas Iguales"}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono tabular-nums text-xs">
                        {formatoMoneda(totalesVisibles.debe)}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono tabular-nums text-xs">
                        {formatoMoneda(totalesVisibles.haber)}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono tabular-nums text-foreground text-xs">
                        {formatoMoneda(totalesVisibles.deudor)}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono tabular-nums text-foreground text-xs">
                        {formatoMoneda(totalesVisibles.acreedor)}
                      </td>
                    </tr>

                    {hayFiltroActivo && (
                      <tr className="border-t border-border/60">
                        <td
                          colSpan={2}
                          className="py-2 px-3.5 text-[10px] uppercase tracking-wider text-muted-foreground/80 font-bold"
                        >
                          Totales generales (Libro Completo)
                        </td>
                        <td className="py-2 px-3.5 text-right font-mono tabular-nums text-xs text-muted-foreground">
                          {formatoMoneda(totalDebe)}
                        </td>
                        <td className="py-2 px-3.5 text-right font-mono tabular-nums text-xs text-muted-foreground">
                          {formatoMoneda(totalHaber)}
                        </td>
                        <td className="py-2 px-3.5 text-right font-mono tabular-nums text-xs text-muted-foreground">
                          {formatoMoneda(totalDeudor)}
                        </td>
                        <td className="py-2 px-3.5 text-right font-mono tabular-nums text-xs text-muted-foreground">
                          {formatoMoneda(totalAcreedor)}
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>

                {/* BANDA DE VERIFICACIÓN DE CUADRE DE BALANZA */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-muted/20 border-t border-border text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {cuadraMovimientos && cuadraSaldos ? (
                      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
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

                  {hayFiltroActivo && (
                    <span className="text-[10px] text-muted-foreground/80 font-mono">
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
        </div>
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
