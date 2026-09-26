"use client"

import { useMemo, useState, useEffect, useCallback, useRef } from "react"
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
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Layers,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Sparkles,
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

// Cuentas que el modulo de Kardex reconoce como movimientos de inventario
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
  
  // 3 vistas principales:
  // - "todas": Todas las Cuentas (vista principal por defecto, inician contraídas como pastilla simple)
  // - "individual": Cuenta T en pantalla completa con menú desplegable hacia abajo (secundaria)
  // - "comprobacion": Balance de Comprobación formal
  const [vista, setVista] = useState<"todas" | "individual" | "comprobacion">("todas")
  
  // Cuenta actualmente seleccionada para visualizar en la vista individual (inicia en null)
  const [cuentaActivaCodigo, setCuentaActivaCodigo] = useState<string | null>(null)
  
  // Menú desplegable hacia abajo en vista individual (contraído de inicio)
  const [menuAbierto, setMenuAbierto] = useState(false)
  
  // Modal Finder estilo Spotlight
  const [finderOpen, setFinderOpen] = useState(false)

  // -------------------------------------------------------------
  // ESTADO DE VISTA PANORÁMICA DE CUENTAS T
  // -------------------------------------------------------------
  // Tarjetas expandidas medianamente (inicia vacío: todas contraídas como pastilla simple por defecto)
  const [cuentasExpandidas, setCuentasExpandidas] = useState<Set<string>>(new Set())
  // Tarjeta en modal centrado (sobresale enfrente y en medio tras hover de 5s con fondo blur)
  const [cuentaModalCentrada, setCuentaModalCentrada] = useState<string | null>(null)
  const [modalCerrando, setModalCerrando] = useState(false)
  const mouseEnteredModalRef = useRef(false)
  // Cuenta actualmente bajo hover para el temporizador de 5s
  const [cuentaEnHover, setCuentaEnHover] = useState<string | null>(null)
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null)

  const handleCerrarModalCentrado = useCallback(() => {
    setModalCerrando(true)
    setTimeout(() => {
      setCuentaModalCentrada(null)
      setModalCerrando(false)
      mouseEnteredModalRef.current = false
    }, 250)
  }, [])

  // Atajo de teclado global (⌘K o /) para abrir el Finder y Esc para cerrar modal centrado
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setFinderOpen(true)
      } else if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault()
        setFinderOpen(true)
      } else if (e.key === "Escape" && cuentaModalCentrada) {
        handleCerrarModalCentrado()
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown)
    return () => window.removeEventListener("keydown", handleGlobalKeyDown)
  }, [cuentaModalCentrada, handleCerrarModalCentrado])

  // Asientos del ejercicio actual ordenados cronológicamente
  const asientosEjercicio = useMemo(() => {
    return asientos
      .filter((a) => {
        if (a.estado === "ANULADO") return false
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

  // Datos de la cuenta seleccionada para mostrar en pantalla completa
  const cuentaActivaMayor = useMemo(() => {
    if (!cuentaActivaCodigo) return null
    return mayor.find((m) => m.cuenta.codigo === cuentaActivaCodigo) || null
  }, [mayor, cuentaActivaCodigo])

  // Índice actual para navegar entre cuentas cuando hay una abierta
  const indiceCuentaActiva = useMemo(() => {
    if (!cuentaActivaMayor) return -1
    return mayor.findIndex((m) => m.cuenta.codigo === cuentaActivaMayor.cuenta.codigo)
  }, [mayor, cuentaActivaMayor])

  const irACuentaAnterior = useCallback(() => {
    if (indiceCuentaActiva > 0) {
      setCuentaActivaCodigo(mayor[indiceCuentaActiva - 1].cuenta.codigo)
    }
  }, [indiceCuentaActiva, mayor])

  const irACuentaSiguiente = useCallback(() => {
    if (indiceCuentaActiva >= 0 && indiceCuentaActiva < mayor.length - 1) {
      setCuentaActivaCodigo(mayor[indiceCuentaActiva + 1].cuenta.codigo)
    }
  }, [indiceCuentaActiva, mayor])

  const totalDebe = redondear(mayor.reduce((s, m) => s + m.debe, 0))
  const totalHaber = redondear(mayor.reduce((s, m) => s + m.haber, 0))
  const totalDeudor = redondear(
    mayor.filter((m) => m.naturalezaSaldo === "deudora").reduce((s, m) => s + Math.abs(m.saldo), 0),
  )
  const totalAcreedor = redondear(
    mayor.filter((m) => m.naturalezaSaldo === "acreedora").reduce((s, m) => s + Math.abs(m.saldo), 0),
  )

  const cuadraMovimientos = totalDebe === totalHaber
  const cuadraSaldos = totalDeudor === totalAcreedor

  // Manejar selección desde el Finder
  const handleSeleccionarCuentaDesdeFinder = useCallback((codigo: string | null) => {
    setCuentaActivaCodigo(codigo)
    setVista("individual")
    setMenuAbierto(false)
  }, [])

  // -------------------------------------------------------------
  // ACCIONES DE EXPANSIÓN EN VISTA PANORÁMICA
  // -------------------------------------------------------------
  const todasExpandidas = mayor.length > 0 && cuentasExpandidas.size === mayor.length

  const handleToggleExpandirTodas = useCallback(() => {
    if (todasExpandidas) {
      setCuentasExpandidas(new Set())
    } else {
      setCuentasExpandidas(new Set(mayor.map((m) => m.cuenta.codigo)))
    }
  }, [todasExpandidas, mayor])

  const handleToggleExpandirTarjeta = useCallback((codigo: string) => {
    setCuentasExpandidas((prev) => {
      const next = new Set(prev)
      if (next.has(codigo)) {
        next.delete(codigo)
      } else {
        next.add(codigo)
      }
      return next
    })
  }, [])

  // Temporizador de Hover 5s: sobresale enfrente y en medio de la pantalla
  const handleCardMouseEnter = useCallback((codigo: string) => {
    if (cuentaModalCentrada) return
    setCuentaEnHover(codigo)
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => {
      mouseEnteredModalRef.current = false
      setCuentaModalCentrada(codigo)
      setCuentaEnHover(null)
    }, 4800) // ~5 segundos
  }, [cuentaModalCentrada])

  const handleCardMouseLeave = useCallback((codigo: string) => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    setCuentaEnHover((prev) => (prev === codigo ? null : prev))
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

        {/* FILA INFERIOR: ALTERNADOR DE 3 VISTAS + BOTÓN FINDER */}
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Alternador de 3 Vistas: Dark Container Pill */}
            <div className="inline-flex rounded-xl p-1 bg-neutral-900 dark:bg-neutral-900 border border-neutral-800 text-neutral-300 shadow-2xs">
              <button
                type="button"
                onClick={() => setVista("todas")}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                  vista === "todas"
                    ? "bg-neutral-800 text-white shadow-xs font-bold"
                    : "text-neutral-400 hover:text-white"
                )}
              >
                <LayoutGrid className="size-3.5" />
                <span>Todas las Cuentas</span>
              </button>

              <button
                type="button"
                onClick={() => setVista("individual")}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                  vista === "individual"
                    ? "bg-neutral-800 text-white shadow-xs font-bold"
                    : "text-neutral-400 hover:text-white"
                )}
              >
                <BookOpen className="size-3.5" />
                <span>Cuenta T (Individual)</span>
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setFinderOpen(true)}
              className="h-9 px-4 gap-2 text-xs font-medium rounded-xl shadow-2xs cursor-pointer transition-all bg-card hover:bg-muted/60 text-foreground border-border"
            >
              <Search className="size-3.5 text-muted-foreground" />
              <span>Buscar por cuenta</span>
              <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] font-mono rounded bg-muted text-muted-foreground border border-border/80">
                ⌘K
              </kbd>
            </Button>
          </div>

          {/* Contador de cuentas */}
          <div className="flex items-center gap-2">
            <Badge variant="muted" className="text-xs font-mono font-medium">
              {mayor.length} cuentas en el libro
            </Badge>
          </div>
        </div>

        {/* =================================================================== */}
        {/* BARRA PROMINENTE DEL MENÚ DE CUENTAS (EN VISTA INDIVIDUAL)          */}
        {/* Mantiene estilo oscuro/neutral consistente sin tornarse blanco      */}
        {/* =================================================================== */}
        {vista === "individual" && (
          <div className="space-y-3 print:hidden pt-1">
            <button
              type="button"
              onClick={() => setMenuAbierto((prev) => !prev)}
              className={cn(
                "w-full p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 text-left shadow-2xs group",
                menuAbierto
                  ? "bg-muted/50 dark:bg-neutral-800/80 border-primary/50 text-foreground ring-1 ring-primary/30"
                  : cuentaActivaMayor
                  ? "bg-card border-primary/40 text-foreground hover:bg-muted/30 hover:border-primary/60"
                  : "bg-card border-border hover:border-primary/40 hover:bg-muted/30 text-foreground"
              )}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={cn(
                    "size-10 rounded-xl flex items-center justify-center shrink-0 transition-colors shadow-2xs",
                    menuAbierto
                      ? "bg-primary/20 text-foreground ring-1 ring-primary/40"
                      : cuentaActivaMayor
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-foreground group-hover:bg-primary/10 group-hover:text-primary"
                  )}
                >
                  <Layers className="size-5" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {cuentaActivaMayor ? "Cuenta T en Pantalla" : "Menú de Cuentas Mayorizadas"}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground">
                      {mayor.length} cuentas
                    </span>
                  </div>

                  <div className="text-sm sm:text-base font-bold truncate mt-0.5 text-foreground">
                    {cuentaActivaMayor
                      ? `${cuentaActivaMayor.cuenta.codigo} · ${cuentaActivaMayor.cuenta.nombre}`
                      : "Haz clic aquí para desplegar el catálogo y seleccionar una Cuenta T"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {cuentaActivaMayor && !menuAbierto && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setCuentaActivaCodigo(null)
                    }}
                    className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer mr-1"
                    title="Cerrar cuenta activa"
                  >
                    <X className="size-4" />
                  </button>
                )}

                <span className="text-xs font-semibold hidden sm:inline-block text-primary">
                  {menuAbierto ? "Contraer menú" : cuentaActivaMayor ? "Cambiar cuenta" : "Desplegar menú"}
                </span>

                <div
                  className={cn(
                    "size-8 rounded-xl flex items-center justify-center transition-transform duration-300",
                    menuAbierto
                      ? "bg-primary/15 text-primary rotate-180"
                      : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                  )}
                >
                  <ChevronDown className="size-4.5" />
                </div>
              </div>
            </button>

            {/* MENÚ DE CUENTAS DESPLEGABLE HACIA ABAJO CON ANIMACIÓN SUAVE */}
            <div
              className={cn(
                "overflow-hidden transition-all duration-300 ease-in-out",
                menuAbierto
                  ? "max-h-[560px] opacity-100 transform translate-y-0"
                  : "max-h-0 opacity-0 transform -translate-y-2 pointer-events-none"
              )}
            >
              <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-lg space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="size-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Selecciona una cuenta para visualizarla en pantalla completa
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMenuAbierto(false)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <span>Contraer</span>
                    <ChevronUp className="size-3.5" />
                  </button>
                </div>

                {/* Listado de cuentas en cuadrícula limpia */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto p-1">
                  {mayor.map((m) => {
                    const esActiva = cuentaActivaMayor?.cuenta.codigo === m.cuenta.codigo
                    const saldoCero = m.saldo === 0
                    const contradiceNaturaleza =
                      m.cuenta.naturaleza === "deudora" ? m.saldo < 0 : m.saldo > 0
                    const sobregirada = m.cuenta.tipo === "activo" && contradiceNaturaleza

                    return (
                      <button
                        key={m.cuenta.codigo}
                        type="button"
                        onClick={() => {
                          setCuentaActivaCodigo(m.cuenta.codigo)
                          setMenuAbierto(false)
                        }}
                        className={cn(
                          "text-left p-3 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 text-xs border",
                          esActiva
                            ? "bg-primary/10 border-primary text-foreground shadow-2xs font-semibold ring-1 ring-primary/30"
                            : "border-border/70 hover:border-primary/40 hover:bg-muted/40 text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={cn(
                              "font-mono text-xs font-bold px-2 py-0.5 rounded-md shrink-0 shadow-2xs",
                              esActiva
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {m.cuenta.codigo}
                          </span>
                          <div className="min-w-0">
                            <span className="block truncate font-semibold text-foreground text-xs">
                              {m.cuenta.nombre}
                            </span>
                            <span className="block text-[10px] text-muted-foreground truncate">
                              {ETIQUETA_TIPO[m.cuenta.tipo]} · {m.cuenta.naturaleza}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-xs text-foreground tabular-nums">
                            {formatoMoneda(Math.abs(m.saldo))}
                          </div>
                          <div>
                            {sobregirada ? (
                              <span className="text-[9px] font-bold text-red-600 dark:text-red-400">
                                Sobregiro
                              </span>
                            ) : saldoCero ? (
                              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">
                                Saldada
                              </span>
                            ) : (
                              <span className="text-[9px] text-muted-foreground uppercase font-mono">
                                {m.naturalezaSaldo === "deudora" ? "Deudor" : "Acreedor"}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* MODAL FINDER DE CUENTAS ESTILO SPOTLIGHT                              */}
      {/* ===================================================================== */}
      <CuentaMayorFinderModal
        isOpen={finderOpen}
        onClose={() => setFinderOpen(false)}
        cuentasMayor={mayor}
        cuentaFiltroCodigo={cuentaActivaCodigo}
        busquedaTexto=""
        categoriaFiltro="todas"
        onSeleccionarCuenta={handleSeleccionarCuentaDesdeFinder}
        onAplicarFiltroTexto={(q) => {
          const coincidencia = mayor.find(
            (m) =>
              m.cuenta.codigo.toLowerCase().includes(q.toLowerCase()) ||
              m.cuenta.nombre.toLowerCase().includes(q.toLowerCase())
          )
          if (coincidencia) {
            setCuentaActivaCodigo(coincidencia.cuenta.codigo)
            setVista("individual")
          }
        }}
        onLimpiarFiltros={() => setCuentaActivaCodigo(null)}
      />

      {/* ===================================================================== */}
      {/* CONTENIDO PRINCIPAL SEGÚN LA VISTA SELECCIONADA                       */}
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
      ) : vista === "individual" ? (
        /* =================================================================== */
        /* VISTA 1: CUENTA T INDIVIDUAL EN PANTALLA COMPLETA                   */
        /* =================================================================== */
        !cuentaActivaMayor ? (
          <div className="rounded-2xl border border-dashed border-border/80 p-12 sm:p-16 text-center space-y-4 bg-muted/5 print:hidden">
            <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-2xs">
              <BookOpen className="size-7" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-base sm:text-lg font-bold text-foreground">
                Ninguna Cuenta T en pantalla
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Haz clic en la barra <strong>Menú de Cuentas</strong> superior o utiliza el <strong>Buscador (⌘K)</strong> para desplegar y seleccionar cualquier cuenta.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <Button
                type="button"
                onClick={() => setMenuAbierto(true)}
                className="h-10 px-5 gap-2 text-xs font-semibold cursor-pointer shadow-xs"
              >
                <Layers className="size-4" />
                <span>Desplegar menú de cuentas</span>
                <ChevronDown className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFinderOpen(true)}
                className="h-10 px-5 gap-2 text-xs font-medium cursor-pointer"
              >
                <Search className="size-4 text-muted-foreground" />
                <span>Buscar cuenta (⌘K)</span>
              </Button>
            </div>
          </div>
        ) : (
          /* TARJETA EN PANTALLA COMPLETA CON ESPACIO ESPACIOSO Y REFINADO */
          (() => {
            const m = cuentaActivaMayor
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
                  "rounded-2xl border bg-card text-card-foreground shadow-xs transition-all overflow-hidden flex flex-col justify-between report-card",
                  sobregirada
                    ? "border-red-500/40 bg-red-500/[0.015]"
                    : "border-border/80"
                )}
              >
                {/* BARRA SUPERIOR DE CONTROL Y NAVEGACIÓN */}
                <div className="p-4 sm:p-6 border-b border-border/70 flex flex-wrap items-center justify-between gap-4 bg-muted/15">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-base font-extrabold px-3 py-1 rounded-xl bg-primary/10 text-primary shrink-0 shadow-2xs">
                      {m.cuenta.codigo}
                    </span>

                    <div className="min-w-0">
                      <h2 className="text-lg sm:text-xl font-bold text-foreground truncate">
                        {m.cuenta.nombre}
                      </h2>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap mt-0.5">
                        <span>{ETIQUETA_TIPO[m.cuenta.tipo]}</span>
                        <span>·</span>
                        <span className="capitalize">Naturaleza {m.cuenta.naturaleza}</span>
                        <span>·</span>
                        <span>{totalMovimientos} {totalMovimientos === 1 ? "movimiento registrado" : "movimientos registrados"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Botones de navegación Anterior / Siguiente y enlace Auxiliar */}
                  <div className="flex items-center gap-2 print:hidden ml-auto">
                    {CUENTAS_INVENTARIO.has(m.cuenta.codigo) && (
                      <Link
                        href={`/kardex?codigo=${m.cuenta.codigo}`}
                        className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-xl transition-colors"
                        title="Abrir extracto auxiliar de esta cuenta"
                      >
                        <span>Auxiliar Kardex</span>
                        <ArrowRight className="size-3.5" />
                      </Link>
                    )}

                    <div className="flex items-center gap-1 border border-border/80 rounded-xl p-1 bg-background">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={indiceCuentaActiva <= 0}
                        onClick={irACuentaAnterior}
                        className="h-7 px-2 text-xs cursor-pointer gap-1"
                        title="Cuenta anterior"
                      >
                        <ChevronLeft className="size-3.5" />
                        <span className="hidden sm:inline">Anterior</span>
                      </Button>

                      <span className="px-2 text-xs font-mono text-muted-foreground font-medium">
                        {indiceCuentaActiva + 1} de {mayor.length}
                      </span>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={indiceCuentaActiva >= mayor.length - 1}
                        onClick={irACuentaSiguiente}
                        className="h-7 px-2 text-xs cursor-pointer gap-1"
                        title="Cuenta siguiente"
                      >
                        <span className="hidden sm:inline">Siguiente</span>
                        <ChevronRight className="size-3.5" />
                      </Button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCuentaActivaCodigo(null)}
                      className="p-1.5 rounded-xl border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                      title="Cerrar cuenta"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>

                {/* TIRA DE MÉTRICAS RÁPIDAS DE LA CUENTA ACTIVA */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 sm:p-6 pb-2 print:hidden">
                  <div className="p-3.5 rounded-xl border border-border/70 bg-background shadow-2xs space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Total Debe (Cargos)
                    </span>
                    <div className="font-mono text-lg font-bold text-foreground tabular-nums">
                      {formatoMoneda(m.debe)}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {movs.debe.length} {movs.debe.length === 1 ? "cargo" : "cargos"} aplicados
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-border/70 bg-background shadow-2xs space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Total Haber (Abonos)
                    </span>
                    <div className="font-mono text-lg font-bold text-foreground tabular-nums">
                      {formatoMoneda(m.haber)}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {movs.haber.length} {movs.haber.length === 1 ? "abono" : "abonos"} aplicados
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-border/70 bg-background shadow-2xs space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Saldo Neto Resultante
                    </span>
                    <div className="font-mono text-lg font-extrabold text-foreground tabular-nums">
                      {formatoMoneda(Math.abs(m.saldo))}
                    </div>
                    <div>
                      {sobregirada ? (
                        <Badge variant="warning" className="text-[10px] font-bold">
                          ¡Sobregiro Anómalo!
                        </Badge>
                      ) : saldoCero ? (
                        <Badge variant="muted" className="text-[10px]">
                          Cuenta Saldada ($0.00)
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

                {/* CUERPO: ESTRUCTURA FORMAL Y ESPACIOSA DE CUENTA T */}
                <div className="p-4 sm:p-6 space-y-4">
                  <div className="rounded-xl border border-border/80 overflow-hidden text-xs print-accounting-table">
                    {/* ENCABEZADOS DEBE Y HABER */}
                    <div className="grid grid-cols-2 border-b border-border/80 bg-muted/40 text-xs font-bold text-muted-foreground uppercase tracking-wider text-center divide-x divide-border/80">
                      <div className="py-2.5 px-4 flex items-center justify-between">
                        <span>DEBE (DÉBITOS / CARGOS)</span>
                        <span className="font-mono text-[11px] text-muted-foreground font-normal">
                          {movs.debe.length} movs
                        </span>
                      </div>
                      <div className="py-2.5 px-4 flex items-center justify-between">
                        <span>HABER (CRÉDITOS / ABONOS)</span>
                        <span className="font-mono text-[11px] text-muted-foreground font-normal">
                          {movs.haber.length} movs
                        </span>
                      </div>
                    </div>

                    {/* COLUMNAS DE MOVIMIENTOS EN T EXPANDIDAS */}
                    <div className="grid grid-cols-2 divide-x divide-border/80 min-h-[220px]">
                      {/* LADO DEBE */}
                      <div className="flex flex-col justify-between">
                        <div className="p-3 space-y-2 max-h-[460px] overflow-y-auto divide-y divide-border/30">
                          {movs.debe.length === 0 ? (
                            <div className="py-16 text-center text-muted-foreground/30 text-xs italic">
                              No se registran cargos en el DEBE para este ejercicio
                            </div>
                          ) : (
                            movs.debe.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-start justify-between gap-3 pt-2 first:pt-0 group hover:bg-muted/40 p-1.5 rounded-lg transition-colors"
                              >
                                <div className="min-w-0 pr-2 space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[11px] font-bold text-primary px-1.5 py-0.2 rounded bg-primary/10">
                                      #{item.numero}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground font-mono">
                                      {item.fecha}
                                    </span>
                                  </div>
                                  <p className="text-xs text-foreground font-medium leading-relaxed">
                                    {item.concepto}
                                  </p>
                                </div>
                                <span className="shrink-0 font-mono font-bold tabular-nums text-foreground text-right text-xs sm:text-sm pt-0.5">
                                  {formatoMoneda(item.monto)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                        {/* TOTAL DEBE */}
                        <div className="bg-muted/40 px-4 py-3 border-t border-border/80 flex items-center justify-between font-mono font-bold text-xs sm:text-sm">
                          <span className="text-muted-foreground text-xs uppercase font-semibold">
                            Total Debe (Suma Débitos)
                          </span>
                          <span className="tabular-nums text-foreground">{formatoMoneda(m.debe)}</span>
                        </div>
                      </div>

                      {/* LADO HABER */}
                      <div className="flex flex-col justify-between">
                        <div className="p-3 space-y-2 max-h-[460px] overflow-y-auto divide-y divide-border/30">
                          {movs.haber.length === 0 ? (
                            <div className="py-16 text-center text-muted-foreground/30 text-xs italic">
                              No se registran abonos en el HABER para este ejercicio
                            </div>
                          ) : (
                            movs.haber.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-start justify-between gap-3 pt-2 first:pt-0 group hover:bg-muted/40 p-1.5 rounded-lg transition-colors"
                              >
                                <div className="min-w-0 pr-2 space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[11px] font-bold text-primary px-1.5 py-0.2 rounded bg-primary/10">
                                      #{item.numero}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground font-mono">
                                      {item.fecha}
                                    </span>
                                  </div>
                                  <p className="text-xs text-foreground font-medium leading-relaxed">
                                    {item.concepto}
                                  </p>
                                </div>
                                <span className="shrink-0 font-mono font-bold tabular-nums text-foreground text-right text-xs sm:text-sm pt-0.5">
                                  {formatoMoneda(item.monto)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                        {/* TOTAL HABER */}
                        <div className="bg-muted/40 px-4 py-3 border-t border-border/80 flex items-center justify-between font-mono font-bold text-xs sm:text-sm">
                          <span className="text-muted-foreground text-xs uppercase font-semibold">
                            Total Haber (Suma Créditos)
                          </span>
                          <span className="tabular-nums text-foreground">{formatoMoneda(m.haber)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PIE DE LA TARJETA: CERTIFICACIÓN DE SALDO NETO */}
                <div className="px-4 sm:px-6 py-4 bg-muted/25 dark:bg-muted/15 border-t border-border/70 flex flex-wrap items-center justify-between gap-4 text-xs saldo-doble-linea">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                      Saldo Final de la Cuenta:
                    </span>
                    <span className="font-mono font-extrabold text-base sm:text-lg text-foreground tabular-nums">
                      {formatoMoneda(Math.abs(m.saldo))}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {sobregirada ? (
                      <Badge variant="warning" className="text-xs font-bold flex items-center gap-1 px-3 py-1">
                        <AlertTriangle className="size-3.5" />
                        <span>Sobregiro anómalo detectado</span>
                      </Badge>
                    ) : saldoCero ? (
                      <Badge variant="muted" className="text-xs flex items-center gap-1 px-3 py-1">
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                        <span>Cuenta Balanceada / Saldada en Cero</span>
                      </Badge>
                    ) : m.naturalezaSaldo === "deudora" ? (
                      <Badge variant="deudora" className="text-xs px-3 py-1">
                        Saldo Final Deudor (Débito)
                      </Badge>
                    ) : (
                      <Badge
                        variant="default"
                        className="text-xs px-3 py-1 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                      >
                        Saldo Final Acreedor (Crédito)
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )
          })()
        )
      ) : vista === "todas" ? (
        /* =================================================================== */
        /* VISTA 1: TODAS LAS CUENTAS (VISTA PRINCIPAL)                        */
        /* Inician contraídas como pastilla simple, expandibles individual      */
        /* o en bloque, con modal centrado y fondo blur tras hover de 5s       */
        /* =================================================================== */
        <div className="space-y-4">
          {/* BARRA DE HERRAMIENTAS: OPCIÓN SOLA A LA IZQUIERDA PARA EXPANDIR TODAS */}
          <div className="flex items-center justify-start print:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleToggleExpandirTodas}
              className="h-8 gap-2 text-xs font-semibold rounded-xl cursor-pointer shadow-2xs border-border/80 bg-card hover:bg-muted/60"
            >
              {todasExpandidas ? (
                <>
                  <Minimize2 className="size-3.5" />
                  <span>Contraer todas</span>
                </>
              ) : (
                <>
                  <Maximize2 className="size-3.5" />
                  <span>Expandir todas ({mayor.length})</span>
                </>
              )}
            </Button>
          </div>

          {/* CUADRÍCULA SIMÉTRICA DE TARJETAS */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4 items-start">
            {mayor.map((m) => {
              const movs = movimientosPorCuenta.get(m.cuenta.codigo) || { debe: [], haber: [] }
              const saldoCero = m.saldo === 0
              const contradiceNaturaleza =
                m.cuenta.naturaleza === "deudora" ? m.saldo < 0 : m.saldo > 0
              const sobregirada = m.cuenta.tipo === "activo" && contradiceNaturaleza
              const totalMovimientos = movs.debe.length + movs.haber.length

              const estaExpandida = cuentasExpandidas.has(m.cuenta.codigo)
              const estaEnHover = cuentaEnHover === m.cuenta.codigo

              return (
                <div
                  key={m.cuenta.codigo}
                  onMouseEnter={() => handleCardMouseEnter(m.cuenta.codigo)}
                  onMouseLeave={() => handleCardMouseLeave(m.cuenta.codigo)}
                  className={cn(
                    "relative transition-all duration-300",
                    estaExpandida ? "col-span-1 md:col-span-2" : "col-span-1"
                  )}
                >
                  {/* ========================================================= */}
                  {/* ESTADO 1: PASTILLA CONTRAÍDA (MINIMALISTA)                 */}
                  {/* ========================================================= */}
                  {!estaExpandida ? (
                    <div
                      onClick={() => handleToggleExpandirTarjeta(m.cuenta.codigo)}
                      className={cn(
                        "rounded-2xl border bg-card text-card-foreground p-3 transition-all relative overflow-hidden group shadow-2xs cursor-pointer select-none report-card",
                        sobregirada
                          ? "border-red-500/40 bg-red-500/[0.015] hover:border-red-500/70"
                          : estaEnHover
                          ? "border-primary/60 shadow-xs ring-1 ring-primary/20"
                          : "border-border/80 hover:border-primary/40 hover:shadow-xs"
                      )}
                    >
                      {/* Micro barra de progreso hover 5s */}
                      {estaEnHover && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-primary/10 overflow-hidden z-20">
                          <div className="h-full bg-primary animate-progress-5s" />
                        </div>
                      )}

                      {/* Fila 1: Código, Nombre y Opciones */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-muted text-foreground shrink-0">
                            {m.cuenta.codigo}
                          </span>
                          <h4 className="font-semibold text-xs sm:text-sm text-foreground truncate" title={m.cuenta.nombre}>
                            {m.cuenta.nombre}
                          </h4>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              setCuentaActivaCodigo(m.cuenta.codigo)
                              setVista("individual")
                            }}
                            className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                            title="Ver en vista individual"
                          >
                            <ArrowRight className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleExpandirTarjeta(m.cuenta.codigo)}
                            className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title="Expandir cuenta"
                          >
                            <ChevronDown className="size-4" />
                          </button>
                        </div>
                      </div>

                      {/* Fila 2: Saldo Neto y Condición (Deudor / Acreedor) */}
                      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/40">
                        <div className="flex items-baseline gap-1.5 min-w-0">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground shrink-0">
                            Saldo:
                          </span>
                          <span className="font-mono font-extrabold text-sm text-foreground tabular-nums truncate">
                            {formatoMoneda(Math.abs(m.saldo))}
                          </span>
                        </div>

                        <div className="shrink-0">
                          {sobregirada ? (
                            <Badge variant="warning" className="text-[9px] font-bold px-1.5 py-0.5">
                              Sobregiro
                            </Badge>
                          ) : saldoCero ? (
                            <Badge variant="muted" className="text-[9px] font-medium px-1.5 py-0.5">
                              Saldada
                            </Badge>
                          ) : m.naturalezaSaldo === "deudora" ? (
                            <Badge variant="deudora" className="text-[9px] font-semibold px-2 py-0.5">
                              Deudor
                            </Badge>
                          ) : (
                            <Badge
                              variant="default"
                              className="text-[9px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                            >
                              Acreedor
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* ========================================================= */
                    /* ESTADO 2: EXPANDIDA MEDIANAMENTE (CUENTA T AMPLIA Y CLARA) */
                    /* ========================================================= */
                    <div
                      className={cn(
                        "rounded-2xl border bg-card text-card-foreground shadow-xs transition-all relative overflow-hidden flex flex-col justify-between report-card",
                        sobregirada ? "border-red-500/40 bg-red-500/[0.015]" : "border-primary/50 ring-1 ring-primary/20"
                      )}
                    >
                      {/* Micro barra hover 5s */}
                      {estaEnHover && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-primary/10 overflow-hidden z-20">
                          <div className="h-full bg-primary animate-progress-5s" />
                        </div>
                      )}

                      {/* Cabecera de la tarjeta expandida */}
                      <div className="p-3.5 sm:p-4 border-b border-border/60 flex items-center justify-between gap-3 bg-muted/10">
                        <div className="min-w-0 flex items-center gap-2.5">
                          <span className="font-mono text-xs sm:text-sm font-extrabold px-2.5 py-1 rounded-lg bg-primary/10 text-primary shrink-0">
                            {m.cuenta.codigo}
                          </span>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm sm:text-base text-foreground truncate" title={m.cuenta.nombre}>
                              {m.cuenta.nombre}
                            </h4>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                              <span>{ETIQUETA_TIPO[m.cuenta.tipo]}</span>
                              <span>·</span>
                              <span className="capitalize">{m.cuenta.naturaleza}</span>
                              <span>·</span>
                              <span>{totalMovimientos} {totalMovimientos === 1 ? "movimiento" : "movimientos"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {sobregirada ? (
                            <Badge variant="warning" className="text-[10px] font-bold px-2 py-0.5">Sobregiro</Badge>
                          ) : saldoCero ? (
                            <Badge variant="muted" className="text-[10px] px-2 py-0.5">Saldada</Badge>
                          ) : m.naturalezaSaldo === "deudora" ? (
                            <Badge variant="deudora" className="text-[10px] font-semibold px-2.5 py-0.5">Deudor</Badge>
                          ) : (
                            <Badge variant="default" className="text-[10px] font-semibold px-2.5 py-0.5 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">Acreedor</Badge>
                          )}
                          <button
                            type="button"
                            onClick={() => handleToggleExpandirTarjeta(m.cuenta.codigo)}
                            className="size-8 rounded-xl flex items-center justify-center text-primary bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer ml-1"
                            title="Contraer tarjeta"
                          >
                            <ChevronUp className="size-4" />
                          </button>
                        </div>
                      </div>

                      {/* Cuenta T amplia y proporcionada */}
                      <div className="p-3.5 sm:p-4 space-y-3">
                        <div className="rounded-xl border border-border/70 overflow-hidden text-xs">
                          {/* Encabezado columnas Debe y Haber */}
                          <div className="grid grid-cols-2 border-b border-border/70 bg-muted/40 text-xs font-bold text-muted-foreground uppercase text-center divide-x divide-border/70">
                            <div className="py-2 px-3 flex justify-between items-center">
                              <span>DEBE (DÉBITOS)</span>
                              <span className="font-mono text-[11px] font-normal">{movs.debe.length} cargos</span>
                            </div>
                            <div className="py-2 px-3 flex justify-between items-center">
                              <span>HABER (CRÉDITOS)</span>
                              <span className="font-mono text-[11px] font-normal">{movs.haber.length} abonos</span>
                            </div>
                          </div>

                          {/* Lista con altura ampliada cómodamente */}
                          <div className="grid grid-cols-2 divide-x divide-border/70 min-h-[120px] max-h-[220px] overflow-y-auto">
                            {/* Lado Debe */}
                            <div className="p-2 space-y-1.5 divide-y divide-border/30">
                              {movs.debe.length === 0 ? (
                                <div className="py-10 text-center text-muted-foreground/35 text-xs italic">
                                  Sin cargos en este ejercicio
                                </div>
                              ) : (
                                movs.debe.map((d, i) => (
                                  <div key={i} className="flex justify-between items-center gap-2 pt-1.5 first:pt-0">
                                    <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                      <span className="font-mono text-[11px] font-bold text-primary px-1.5 py-0.2 rounded bg-primary/10 shrink-0">
                                        #{d.numero}
                                      </span>
                                      <span className="text-[11px] text-muted-foreground font-mono shrink-0 hidden sm:inline">
                                        {d.fecha}
                                      </span>
                                      <span className="text-xs text-foreground font-medium truncate max-w-[110px] sm:max-w-[180px]" title={d.concepto}>
                                        {d.concepto}
                                      </span>
                                    </div>
                                    <span className="font-mono font-bold text-xs sm:text-sm text-foreground shrink-0 tabular-nums">
                                      {formatoMoneda(d.monto)}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>

                            {/* Lado Haber */}
                            <div className="p-2 space-y-1.5 divide-y divide-border/30">
                              {movs.haber.length === 0 ? (
                                <div className="py-10 text-center text-muted-foreground/35 text-xs italic">
                                  Sin abonos en este ejercicio
                                </div>
                              ) : (
                                movs.haber.map((h, i) => (
                                  <div key={i} className="flex justify-between items-center gap-2 pt-1.5 first:pt-0">
                                    <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                      <span className="font-mono text-[11px] font-bold text-primary px-1.5 py-0.2 rounded bg-primary/10 shrink-0">
                                        #{h.numero}
                                      </span>
                                      <span className="text-[11px] text-muted-foreground font-mono shrink-0 hidden sm:inline">
                                        {h.fecha}
                                      </span>
                                      <span className="text-xs text-foreground font-medium truncate max-w-[110px] sm:max-w-[180px]" title={h.concepto}>
                                        {h.concepto}
                                      </span>
                                    </div>
                                    <span className="font-mono font-bold text-xs sm:text-sm text-foreground shrink-0 tabular-nums">
                                      {formatoMoneda(h.monto)}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Totales Debe y Haber */}
                          <div className="grid grid-cols-2 divide-x divide-border/70 border-t border-border/70 bg-muted/25 p-2.5 font-mono font-bold text-xs sm:text-sm">
                            <div className="flex justify-between items-center pr-2">
                              <span className="text-muted-foreground text-[10px] sm:text-xs uppercase font-semibold">Total Debe:</span>
                              <span className="tabular-nums text-foreground">{formatoMoneda(m.debe)}</span>
                            </div>
                            <div className="flex justify-between items-center pl-2">
                              <span className="text-muted-foreground text-[10px] sm:text-xs uppercase font-semibold">Total Haber:</span>
                              <span className="tabular-nums text-foreground">{formatoMoneda(m.haber)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Fila de Saldo y Acciones */}
                        <div className="flex items-center justify-between gap-3 pt-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-semibold text-muted-foreground">Saldo Neto:</span>
                            <span className="font-mono font-extrabold text-base sm:text-lg text-foreground tabular-nums">
                              {formatoMoneda(Math.abs(m.saldo))}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleExpandirTarjeta(m.cuenta.codigo)}
                              className="h-8 px-2.5 text-xs cursor-pointer font-medium"
                            >
                              Contraer
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                setCuentaActivaCodigo(m.cuenta.codigo)
                                setVista("individual")
                              }}
                              className="h-8 px-3 gap-1.5 text-xs font-semibold cursor-pointer"
                            >
                              <span>Ver individual</span>
                              <ArrowRight className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* =================================================================== */}
          {/* MODAL / LIGHTBOX CENTRADO CON ANIMACIÓN SUAVE Y FONDO BLUR          */}
          {/* Sobresale enfrente y en medio tras mantener el cursor 5s             */}
          {/* =================================================================== */}
          {cuentaModalCentrada && (() => {
            const m = mayor.find((c) => c.cuenta.codigo === cuentaModalCentrada)
            if (!m) return null
            const movs = movimientosPorCuenta.get(m.cuenta.codigo) || { debe: [], haber: [] }
            const saldoCero = m.saldo === 0
            const contradiceNaturaleza =
              m.cuenta.naturaleza === "deudora" ? m.saldo < 0 : m.saldo > 0
            const sobregirada = m.cuenta.tipo === "activo" && contradiceNaturaleza
            const totalMovimientos = movs.debe.length + movs.haber.length

            return (
              <div
                className={cn(
                  "fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 transition-all duration-300",
                  "bg-black/60 dark:bg-black/80 backdrop-blur-md",
                  modalCerrando ? "opacity-0 pointer-events-none" : "opacity-100"
                )}
                onClick={handleCerrarModalCentrado}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  onMouseEnter={() => {
                    mouseEnteredModalRef.current = true
                  }}
                  onMouseLeave={() => {
                    if (mouseEnteredModalRef.current) {
                      handleCerrarModalCentrado()
                    }
                  }}
                  className={cn(
                    "w-full max-w-3xl max-h-[90vh] bg-card rounded-3xl border border-primary/40 shadow-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 transform",
                    modalCerrando
                      ? "scale-90 opacity-0 translate-y-6"
                      : "scale-100 opacity-100 translate-y-0"
                  )}
                >
                  {/* CABECERA MODAL */}
                  <div className="p-4 sm:p-5 border-b border-border/70 flex items-center justify-between gap-4 bg-muted/20">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-sm sm:text-base font-extrabold px-3 py-1 rounded-xl bg-primary/10 text-primary shrink-0 shadow-2xs">
                        {m.cuenta.codigo}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-bold text-foreground truncate">
                          {m.cuenta.nombre}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span>{ETIQUETA_TIPO[m.cuenta.tipo]}</span>
                          <span>·</span>
                          <span className="capitalize">Naturaleza {m.cuenta.naturaleza}</span>
                          <span>·</span>
                          <span>{totalMovimientos} movimientos</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {sobregirada ? (
                        <Badge variant="warning" className="text-xs font-bold">
                          Sobregiro
                        </Badge>
                      ) : saldoCero ? (
                        <Badge variant="muted" className="text-xs">
                          Saldada
                        </Badge>
                      ) : m.naturalezaSaldo === "deudora" ? (
                        <Badge variant="deudora" className="text-xs">
                          Saldo Deudor
                        </Badge>
                      ) : (
                        <Badge
                          variant="default"
                          className="text-xs bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                        >
                          Saldo Acreedor
                        </Badge>
                      )}

                      <button
                        type="button"
                        onClick={handleCerrarModalCentrado}
                        className="size-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer ml-1"
                        title="Cerrar y regresar"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>

                  {/* MÉTRICAS RÁPIDAS EN MODAL */}
                  <div className="grid grid-cols-3 gap-3 p-4 sm:p-5 pb-2 bg-muted/5 border-b border-border/50 text-xs">
                    <div className="p-3 rounded-xl border border-border/70 bg-card shadow-2xs">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                        Total Debe (Cargos)
                      </span>
                      <div className="font-mono text-base font-bold text-foreground tabular-nums mt-0.5">
                        {formatoMoneda(m.debe)}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{movs.debe.length} cargos</span>
                    </div>

                    <div className="p-3 rounded-xl border border-border/70 bg-card shadow-2xs">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                        Total Haber (Abonos)
                      </span>
                      <div className="font-mono text-base font-bold text-foreground tabular-nums mt-0.5">
                        {formatoMoneda(m.haber)}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{movs.haber.length} abonos</span>
                    </div>

                    <div className="p-3 rounded-xl border border-border/70 bg-card shadow-2xs">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                        Saldo Neto
                      </span>
                      <div className="font-mono text-base font-extrabold text-foreground tabular-nums mt-0.5">
                        {formatoMoneda(Math.abs(m.saldo))}
                      </div>
                      <span className="text-[10px] text-muted-foreground capitalize">
                        {m.naturalezaSaldo || "Saldada"}
                      </span>
                    </div>
                  </div>

                  {/* CUERPO T EXPANDIDA CON DETALLE COMPLETO Y LEGIBLE */}
                  <div className="p-4 sm:p-5 overflow-y-auto max-h-[46vh]">
                    <div className="rounded-2xl border border-border/80 overflow-hidden text-xs">
                      <div className="grid grid-cols-2 border-b border-border/80 bg-muted/40 text-xs font-bold text-muted-foreground uppercase text-center divide-x divide-border/80">
                        <div className="py-2.5 px-3 flex justify-between items-center">
                          <span>DEBE (DÉBITOS)</span>
                          <span className="font-mono text-[11px] font-normal">{movs.debe.length} cargos</span>
                        </div>
                        <div className="py-2.5 px-3 flex justify-between items-center">
                          <span>HABER (CRÉDITOS)</span>
                          <span className="font-mono text-[11px] font-normal">{movs.haber.length} abonos</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 divide-x divide-border/80 min-h-[140px] max-h-[280px] overflow-y-auto">
                        {/* Lado Debe Amplio */}
                        <div className="p-3 space-y-2 divide-y divide-border/30">
                          {movs.debe.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground/30 text-xs italic">
                              Sin cargos registrados
                            </div>
                          ) : (
                            movs.debe.map((d, i) => (
                              <div key={i} className="flex justify-between items-start gap-2.5 pt-2 first:pt-0">
                                <div className="min-w-0 pr-1 space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-[10px] font-bold text-primary px-1.5 py-0.2 rounded bg-primary/10">
                                      #{d.numero}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                      {d.fecha}
                                    </span>
                                  </div>
                                  <p className="text-xs text-foreground font-medium leading-relaxed">
                                    {d.concepto}
                                  </p>
                                </div>
                                <span className="font-mono font-bold text-xs text-foreground shrink-0 tabular-nums pt-0.5">
                                  {formatoMoneda(d.monto)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Lado Haber Amplio */}
                        <div className="p-3 space-y-2 divide-y divide-border/30">
                          {movs.haber.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground/30 text-xs italic">
                              Sin abonos registrados
                            </div>
                          ) : (
                            movs.haber.map((h, i) => (
                              <div key={i} className="flex justify-between items-start gap-2.5 pt-2 first:pt-0">
                                <div className="min-w-0 pr-1 space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-[10px] font-bold text-primary px-1.5 py-0.2 rounded bg-primary/10">
                                      #{h.numero}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                      {h.fecha}
                                    </span>
                                  </div>
                                  <p className="text-xs text-foreground font-medium leading-relaxed">
                                    {h.concepto}
                                  </p>
                                </div>
                                <span className="font-mono font-bold text-xs text-foreground shrink-0 tabular-nums pt-0.5">
                                  {formatoMoneda(h.monto)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Totales Debe y Haber */}
                      <div className="grid grid-cols-2 divide-x divide-border/80 border-t border-border/80 bg-muted/30 p-3 font-mono font-bold text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground text-[11px] uppercase">Total Debe:</span>
                          <span className="tabular-nums text-foreground">{formatoMoneda(m.debe)}</span>
                        </div>
                        <div className="flex justify-between pl-3">
                          <span className="text-muted-foreground text-[11px] uppercase">Total Haber:</span>
                          <span className="tabular-nums text-foreground">{formatoMoneda(m.haber)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PIE DEL MODAL */}
                  <div className="p-4 sm:p-5 bg-muted/20 border-t border-border/70 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Saldo resultante:</span>
                      <span className="font-mono font-extrabold text-base text-foreground tabular-nums">
                        {formatoMoneda(Math.abs(m.saldo))}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCerrarModalCentrado}
                        className="h-8 px-3 text-xs cursor-pointer"
                      >
                        Regresar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setCuentaActivaCodigo(m.cuenta.codigo)
                          setVista("individual")
                          handleCerrarModalCentrado()
                        }}
                        className="h-8 px-3 gap-1.5 text-xs font-semibold cursor-pointer"
                      >
                        <span>Ver en pantalla completa</span>
                        <ArrowRight className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      ) : (
        /* =================================================================== */
        /* VISTA 3: BALANCE DE COMPROBACIÓN FORMAL Y MINIMALISTA                */
        /* =================================================================== */
        <div className="space-y-4">
          {/* TIRA DE MÉTRICAS / RESUMEN EJECUTIVO DE COMPROBACIÓN */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Total Movimientos
              </span>
              <div className="text-base sm:text-lg font-bold font-mono tabular-nums text-foreground">
                {formatoMoneda(totalDebe)}
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
                {formatoMoneda(totalDeudor)}
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
                {mayor.length}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Cuentas con saldo en el ejercicio
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
                  {mayor.length} cuentas
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
                    {mayor.map((m) => {
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
                        Sumas Iguales
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono tabular-nums text-xs">
                        {formatoMoneda(totalDebe)}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono tabular-nums text-xs">
                        {formatoMoneda(totalHaber)}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono tabular-nums text-foreground text-xs">
                        {formatoMoneda(totalDeudor)}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono tabular-nums text-foreground text-xs">
                        {formatoMoneda(totalAcreedor)}
                      </td>
                    </tr>
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
                      <strong>Verificación de Partida Doble:</strong>{" "}
                      Débitos ({formatoMoneda(totalDebe)}){" "}
                      {cuadraMovimientos ? "=" : "≠"} Créditos ({formatoMoneda(totalHaber)}) ·
                      Saldos Deudores ({formatoMoneda(totalDeudor)}){" "}
                      {cuadraSaldos ? "=" : "≠"} Saldos Acreedores ({formatoMoneda(totalAcreedor)})
                    </span>
                  </div>

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
