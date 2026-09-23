"use client"

import { Suspense, useEffect, useMemo, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Eye,
  FileDown,
  FileSpreadsheet,
  Filter,
  Info,
  Layers,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/field"
import { useContabilidad } from "@/components/contabilidad-provider"
import { formatoMoneda, redondear, totalesAsiento } from "@/lib/contabilidad"
import { exportarLibroExcel } from "@/lib/excel"
import type { Asiento, Cuenta } from "@/lib/types"

interface MovimientoKardex {
  fecha: string
  partidaNumero: number
  correlativoGlobal?: number
  tipoPartida: string
  concepto: string
  debe: number
  haber: number
  saldo: number
  esSaldoAnterior?: boolean
  asientoOriginal?: Asiento
}

// Cuentas de consulta frecuente
const CUENTAS_RAPIDAS_SV = [
  { codigo: "1101", nombre: "Caja" },
  { codigo: "1102", nombre: "Bancos" },
  { codigo: "1103", nombre: "Clientes" },
  { codigo: "1105", nombre: "IVA Crédito" },
  { codigo: "2101", nombre: "Proveedores" },
  { codigo: "2103", nombre: "IVA Débito" },
  { codigo: "4101", nombre: "Compras" },
  { codigo: "5101", nombre: "Ventas" },
  { codigo: "1104", nombre: "Inventario" },
]

const MESES = [
  { valor: "todos", label: "Todo el año" },
  { valor: "1", label: "01 - Enero" },
  { valor: "2", label: "02 - Febrero" },
  { valor: "3", label: "03 - Marzo" },
  { valor: "4", label: "04 - Abril" },
  { valor: "5", label: "05 - Mayo" },
  { valor: "6", label: "06 - Junio" },
  { valor: "7", label: "07 - Julio" },
  { valor: "8", label: "08 - Agosto" },
  { valor: "9", label: "09 - Septiembre" },
  { valor: "10", label: "10 - Octubre" },
  { valor: "11", label: "11 - Noviembre" },
  { valor: "12", label: "12 - Diciembre" },
]

function KardexContent() {
  const { cuentas, asientos, ejercicioSeleccionado } = useContabilidad()
  const searchParams = useSearchParams()
  const codigoParam = searchParams.get("codigo") || searchParams.get("cuenta")

  // Cuenta inicial: Preferir 1101 o 1102 en vez de 1104 para evitar iniciar en pantalla estática
  const [codigoSeleccionado, setCodigoSeleccionado] = useState<string>(codigoParam || "1102")
  const [busqueda, setBusqueda] = useState("")
  const [mesFiltro, setMesFiltro] = useState<string>("todos")
  const [soloConMovimientos, setSoloConMovimientos] = useState<boolean>(false)
  const [partidaDetalle, setPartidaDetalle] = useState<Asiento | null>(null)

  useEffect(() => {
    if (codigoParam && codigoParam !== codigoSeleccionado) {
      setCodigoSeleccionado(codigoParam)
    }
  }, [codigoParam, codigoSeleccionado])

  // Cuentas activas en catálogo
  const cuentasActivas = useMemo(() => cuentas.filter((c) => c.activa), [cuentas])

  // Mapa de conteo de movimientos por cuenta en el ejercicio actual
  const actividadCuentas = useMemo(() => {
    const mapa = new Map<string, number>()
    const asientosEjercicio = asientos.filter((a) => {
      if (a.estado === "ANULADO") return false
      const ej = a.ejercicio || (a.fecha ? new Date(a.fecha).getFullYear() : undefined)
      return ej === undefined || ej === ejercicioSeleccionado
    })

    for (const a of asientosEjercicio) {
      for (const l of a.lineas) {
        mapa.set(l.codigo, (mapa.get(l.codigo) || 0) + 1)
      }
    }
    return mapa
  }, [asientos, ejercicioSeleccionado])

  // Cuentas elegibles para navegación secuencial
  const cuentasNavegables = useMemo(() => {
    if (!soloConMovimientos) return cuentasActivas
    return cuentasActivas.filter((c) => (actividadCuentas.get(c.codigo) || 0) > 0)
  }, [cuentasActivas, soloConMovimientos, actividadCuentas])

  const indiceActual = useMemo(
    () => cuentasNavegables.findIndex((c) => c.codigo === codigoSeleccionado),
    [cuentasNavegables, codigoSeleccionado]
  )

  const cuentaActual: Cuenta | undefined = useMemo(() => {
    return cuentasActivas.find((c) => c.codigo === codigoSeleccionado) || cuentasActivas[0]
  }, [cuentasActivas, codigoSeleccionado])

  const cuentaAnterior = useCallback(() => {
    if (indiceActual > 0) {
      setCodigoSeleccionado(cuentasNavegables[indiceActual - 1].codigo)
    }
  }, [indiceActual, cuentasNavegables])

  const cuentaSiguiente = useCallback(() => {
    if (indiceActual >= 0 && indiceActual < cuentasNavegables.length - 1) {
      setCodigoSeleccionado(cuentasNavegables[indiceActual + 1].codigo)
    }
  }, [indiceActual, cuentasNavegables])

  // Atajos de teclado para navegación entre cuentas y cierre de modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (partidaDetalle) {
        if (e.key === "Escape") setPartidaDetalle(null)
        return
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return

      if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault()
        cuentaAnterior()
      } else if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault()
        cuentaSiguiente()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [partidaDetalle, cuentaAnterior, cuentaSiguiente])

  // Cuentas filtradas en el selector reactivo
  const cuentasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return cuentasActivas.filter((c) => {
      const matchTexto = c.codigo.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q)
      if (soloConMovimientos) {
        return matchTexto && (actividadCuentas.get(c.codigo) || 0) > 0
      }
      return matchTexto
    })
  }, [cuentasActivas, busqueda, soloConMovimientos, actividadCuentas])

  // Extracción cronológica de todos los movimientos del año
  const todosMovimientosAño = useMemo(() => {
    if (!cuentaActual) return []

    const asientosDelEjercicio = asientos
      .filter((a) => {
        if (a.estado === "ANULADO") return false
        const ej = a.ejercicio || (a.fecha ? new Date(a.fecha).getFullYear() : undefined)
        if (ej !== undefined && ej !== ejercicioSeleccionado) return false
        return true
      })
      .slice()
      .sort((a, b) => {
        const fComp = (a.fecha || "").localeCompare(b.fecha || "")
        if (fComp !== 0) return fComp
        return a.numero - b.numero
      })

    const lista: MovimientoKardex[] = []
    let saldoAcumulado = 0

    for (const a of asientosDelEjercicio) {
      for (const linea of a.lineas) {
        if (linea.codigo === cuentaActual.codigo) {
          const debe = Number(linea.debe) || 0
          const haber = Number(linea.haber) || 0

          if (cuentaActual.naturaleza === "deudora") {
            saldoAcumulado = redondear(saldoAcumulado + debe - haber)
          } else {
            saldoAcumulado = redondear(saldoAcumulado + haber - debe)
          }

          lista.push({
            fecha: a.fecha,
            partidaNumero: a.numero,
            correlativoGlobal: a.correlativo_global,
            tipoPartida: a.tipo || "OPERACION",
            concepto: a.concepto,
            debe,
            haber,
            saldo: saldoAcumulado,
            asientoOriginal: a,
          })
        }
      }
    }

    return lista
  }, [asientos, cuentaActual, ejercicioSeleccionado])

  // Movimientos filtrados por mes con ARRASTRE DE SALDO INICIAL exacto
  const { movimientos, saldoInicialPeriodo } = useMemo(() => {
    if (mesFiltro === "todos") {
      return { movimientos: todosMovimientosAño, saldoInicialPeriodo: 0 }
    }

    const mesNum = Number(mesFiltro)
    let saldoInicial = 0
    const delMes: MovimientoKardex[] = []

    for (const m of todosMovimientosAño) {
      const fechaObj = new Date(m.fecha + "T00:00:00")
      const mesItem = fechaObj.getMonth() + 1
      if (mesItem < mesNum) {
        saldoInicial = m.saldo
      } else if (mesItem === mesNum) {
        delMes.push(m)
      }
    }

    return { movimientos: delMes, saldoInicialPeriodo: saldoInicial }
  }, [todosMovimientosAño, mesFiltro])

  // Estadísticas del periodo
  const totalDebe = useMemo(
    () => redondear(movimientos.reduce((acc, m) => acc + m.debe, 0)),
    [movimientos]
  )
  const totalHaber = useMemo(
    () => redondear(movimientos.reduce((acc, m) => acc + m.haber, 0)),
    [movimientos]
  )

  const saldoFinalPeriodo = useMemo(() => {
    if (movimientos.length === 0) return saldoInicialPeriodo
    return movimientos[movimientos.length - 1].saldo
  }, [movimientos, saldoInicialPeriodo])

  // Naturaleza del saldo final (identificación de sobregiros o anomalías)
  const esSaldoAnomalo = useMemo(() => {
    if (saldoFinalPeriodo === 0) return false
    return saldoFinalPeriodo < 0
  }, [saldoFinalPeriodo])

  const etiquetaNaturalezaSaldo = useMemo(() => {
    if (saldoFinalPeriodo === 0) return "Saldada ($0.00)"
    if (cuentaActual?.naturaleza === "deudora") {
      return saldoFinalPeriodo >= 0 ? "Saldo Deudor (Normal)" : "Saldo Acreedor (⚠️ Sobregiro / Anómalo)"
    } else {
      return saldoFinalPeriodo >= 0 ? "Saldo Acreedor (Normal)" : "Saldo Deudor (⚠️ Anómalo)"
    }
  }, [saldoFinalPeriodo, cuentaActual])

  function exportarPdf() {
    const previousTitle = document.title
    document.title = `Libro_Auxiliar_${cuentaActual?.codigo || "cuenta"}_${ejercicioSeleccionado}`
    window.print()
    window.setTimeout(() => {
      document.title = previousTitle
    }, 500)
  }

  function exportarExcel() {
    if (!cuentaActual) return

    const filas: (string | number | null | undefined)[][] = [
      ["SISTEMA CONTABLE AUTOMATIZADO - LIBRO AUXILIAR / KARDEX"],
      [`Ejercicio fiscal: ${ejercicioSeleccionado}`],
      [`Cuenta: ${cuentaActual.codigo} - ${cuentaActual.nombre}`],
      [`Tipo: ${cuentaActual.tipo.toUpperCase()} | Naturaleza Normal: ${cuentaActual.naturaleza.toUpperCase()}`],
      [`Filtro aplicado: ${MESES.find((m) => m.valor === mesFiltro)?.label || "Todo el año"}`],
      [`Condición de Saldo: ${etiquetaNaturalezaSaldo}`],
      [`Fecha de emisión: ${new Date().toLocaleDateString("es-SV")}`],
      [],
      ["Fecha", "Partida #", "Correlativo", "Tipo", "Concepto / Glosa", "Debe (Cargos)", "Haber (Abonos)", "Saldo Progresivo"],
    ]

    if (mesFiltro !== "todos") {
      filas.push([
        `${ejercicioSeleccionado}-${mesFiltro.padStart(2, "0")}-01`,
        "-",
        "-",
        "INICIAL",
        "SALDO ANTERIOR TRASLADADO DEL PERIODO PREVIO",
        "",
        "",
        saldoInicialPeriodo,
      ])
    }

    for (const m of movimientos) {
      filas.push([
        m.fecha,
        m.partidaNumero,
        m.correlativoGlobal ?? "-",
        m.tipoPartida,
        m.concepto,
        m.debe > 0 ? m.debe : "",
        m.haber > 0 ? m.haber : "",
        m.saldo,
      ])
    }

    filas.push([])
    filas.push([
      "TOTALES DEL PERIODO",
      "",
      "",
      "",
      "",
      totalDebe,
      totalHaber,
      saldoFinalPeriodo,
    ])

    exportarLibroExcel(`Libro_Auxiliar_${cuentaActual.codigo}_${cuentaActual.nombre.replace(/\s+/g, "_")}`, [
      {
        nombre: `Auxiliar ${cuentaActual.codigo}`,
        filas,
      },
    ])
  }

  return (
    <div className="space-y-6">
      {/* HEADER DE MÓDULO */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Libros Contables</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">Ciclo {ejercicioSeleccionado}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl text-foreground mt-0.5">
            Libro Auxiliar / Kardex
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Consulta cronológica de cargos, abonos y saldo progresivo por cuenta contable.
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportarPdf}
            className="h-8 gap-1.5 text-xs"
          >
            <FileDown className="size-3.5" />
            Imprimir / PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportarExcel}
            className="h-8 gap-1.5 text-xs border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/20"
          >
            <FileSpreadsheet className="size-3.5 text-emerald-600" />
            Exportar Excel
          </Button>
        </div>
      </header>

      {/* SELECCIÓN SOBRIA DE CUENTA */}
      <div className="space-y-2.5 print:hidden">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-card p-3 shadow-xs">
          {/* Selector principal de cuenta */}
          <div className="flex flex-1 items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Cuenta:</span>
            <select
              className="flex h-9 w-full max-w-lg rounded-md border border-input bg-background px-3 py-1 text-sm font-mono font-medium shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={codigoSeleccionado}
              onChange={(e) => setCodigoSeleccionado(e.target.value)}
              aria-label="Seleccionar cuenta del catálogo"
            >
              {cuentasFiltradas.map((c) => {
                const movs = actividadCuentas.get(c.codigo) || 0
                return (
                  <option key={c.codigo} value={c.codigo}>
                    {c.codigo} — {c.nombre} ({c.naturaleza}){movs > 0 ? ` · ${movs} movs` : ""}
                  </option>
                )
              })}
            </select>

            {/* Flechas de navegación rápida */}
            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={cuentaAnterior}
                disabled={indiceActual <= 0}
                title="Cuenta anterior"
                className="size-7"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={cuentaSiguiente}
                disabled={indiceActual < 0 || indiceActual >= cuentasNavegables.length - 1}
                title="Siguiente cuenta"
                className="size-7"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          {/* Búsqueda rápida */}
          <div className="relative w-full sm:w-56 shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Filtrar por código o nombre..."
              value={busqueda}
              onChange={(e) => {
                const val = e.target.value
                setBusqueda(val)
                const match = cuentasActivas.find((c) => c.codigo === val.trim())
                if (match) setCodigoSeleccionado(match.codigo)
              }}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {/* Cuentas frecuentes en una sola línea discreta */}
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          <span className="text-[11px] text-muted-foreground font-medium mr-1">Frecuentes:</span>
          {CUENTAS_RAPIDAS_SV.map((c) => {
            const activa = codigoSeleccionado === c.codigo
            return (
              <button
                key={c.codigo}
                type="button"
                onClick={() => setCodigoSeleccionado(c.codigo)}
                className={`rounded-md px-2 py-0.5 text-xs font-mono transition-colors ${
                  activa
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span className="opacity-70 mr-1">{c.codigo}</span>
                <span>{c.nombre}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* AVISO METODOLÓGICO PARA INVENTARIO (CUENTA 1104) */}
      {codigoSeleccionado === "1104" && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 text-xs text-blue-950 dark:text-blue-200">
          <div className="flex items-start gap-3">
            <Info className="size-5 shrink-0 text-blue-600 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-sm text-blue-900 dark:text-blue-100">
                Aviso: Cuenta 1104 bajo el Método Analítico o Pormenorizado
              </p>
              <p className="leading-relaxed">
                Bajo el <strong>Método Analítico</strong>, la cuenta <strong>1104 (Inventario de mercadería)</strong> permanece estática durante el ejercicio ({ejercicioSeleccionado}), reflejando únicamente el <em>Inventario Inicial</em>.
              </p>
              <p className="leading-relaxed">
                Para auditar el flujo operativo comercial, audite las cuentas de flujo: <strong>4101 (Compras)</strong>, <strong>1105 (IVA Crédito Fiscal)</strong>, <strong>2103 (IVA Débito Fiscal)</strong> y <strong>5101 (Ventas)</strong>. La existencia final física se valida en la <em>Toma Física de Inventario</em>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TARJETA DE CABECERA Y KPIS (LINEAR / STRIPE STYLE) */}
      {cuentaActual && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Identificación de Cuenta */}
          <Card className="border-border/80 shadow-sm">
            <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Cuenta en Consulta
                </p>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <p className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {cuentaActual.codigo}
                  </p>
                  <Badge variant={cuentaActual.naturaleza === "deudora" ? "deudora" : "acreedora"}>
                    {cuentaActual.naturaleza}
                  </Badge>
                </div>
                <p className="text-sm font-medium text-foreground truncate mt-0.5" title={cuentaActual.nombre}>
                  {cuentaActual.nombre}
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3 capitalize">
                Clasificación: <span className="font-semibold text-foreground">{cuentaActual.tipo}</span>
              </p>
            </CardContent>
          </Card>

          {/* 2. Total Cargos (Debe) */}
          <Card className="border-border/80 shadow-sm">
            <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Total Cargos (Debe)
                  </p>
                  <span className="p-1 rounded bg-emerald-500/10 text-emerald-600">
                    <ArrowDownLeft className="size-4" />
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-foreground tracking-tight">
                  {formatoMoneda(totalDebe)}
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                {movimientos.filter((m) => m.debe > 0).length} partidas con cargos
              </p>
            </CardContent>
          </Card>

          {/* 3. Total Abonos (Haber) */}
          <Card className="border-border/80 shadow-sm">
            <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Total Abonos (Haber)
                  </p>
                  <span className="p-1 rounded bg-amber-500/10 text-amber-600">
                    <ArrowUpRight className="size-4" />
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-foreground tracking-tight">
                  {formatoMoneda(totalHaber)}
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                {movimientos.filter((m) => m.haber > 0).length} partidas con abonos
              </p>
            </CardContent>
          </Card>

          {/* 4. Saldo Progresivo Actual */}
          <Card className={`border shadow-sm ${
            esSaldoAnomalo
              ? "border-red-500/40 bg-red-500/5"
              : "border-primary/30 bg-primary/[0.02]"
          }`}>
            <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Saldo Progresivo
                  </p>
                  {esSaldoAnomalo ? (
                    <Badge variant="warning" className="text-[10px] uppercase font-bold tracking-wide">
                      Anómalo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {cuentaActual.naturaleza === "deudora" ? "D" : "A"}
                    </Badge>
                  )}
                </div>
                <p className={`mt-2 text-2xl font-bold font-mono tabular-nums tracking-tight ${
                  esSaldoAnomalo ? "text-red-600 dark:text-red-400" : "text-primary"
                }`}>
                  {formatoMoneda(Math.abs(saldoFinalPeriodo))}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground font-medium">
                  {movimientos.length} movs. en periodo
                </span>
                <span className={`font-semibold ${esSaldoAnomalo ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                  {etiquetaNaturalezaSaldo}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* EXTRACTO CRONOLÓGICO Y TABLA DE MOVIMIENTOS */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold">
                Movimientos de la Cuenta
              </CardTitle>
              <CardDescription>
                Registro cronológico de cargos, abonos y saldo progresivo. Clic en una partida para ver su asiento completo.
              </CardDescription>
            </div>

            {/* Filtro por Período */}
            <div className="flex items-center gap-2 print:hidden">
              <Calendar className="size-4 text-muted-foreground" />
              <select
                value={mesFiltro}
                onChange={(e) => setMesFiltro(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Filtrar por mes"
              >
                {MESES.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.label}
                  </option>
                ))}
              </select>
              <Badge variant="muted" className="text-xs font-mono">
                {movimientos.length} {movimientos.length === 1 ? "registro" : "registros"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {movimientos.length === 0 && saldoInicialPeriodo === 0 ? (
            <div className="py-12 text-center">
              <ClipboardList className="mx-auto size-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">
                No hay movimientos registrados para la cuenta {cuentaActual?.codigo} - {cuentaActual?.nombre} {mesFiltro !== "todos" ? `en ${MESES.find((m) => m.valor === mesFiltro)?.label}` : `en el ejercicio ${ejercicioSeleccionado}`}.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Cambia el filtro de período arriba o selecciona otra cuenta con transacciones activas.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground uppercase font-medium">
                  <tr>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3 text-center">Partida #</th>
                    <th className="py-2.5 px-3 text-center">Tipo</th>
                    <th className="py-2.5 px-3">Concepto / Glosa</th>
                    <th className="py-2.5 px-3 text-right">Debe (Cargos)</th>
                    <th className="py-2.5 px-3 text-right">Haber (Abonos)</th>
                    <th className="py-2.5 px-3 text-right">Saldo Progresivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {/* RENGLÓN DE SALDO ANTERIOR (EN FILTRO MENSUAL) */}
                  {mesFiltro !== "todos" && (
                    <tr className="bg-muted/20 font-medium text-xs text-muted-foreground italic">
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                        {`${ejercicioSeleccionado}-${mesFiltro.padStart(2, "0")}-01`}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">-</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted font-sans font-semibold">
                          INICIAL
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        Saldo anterior trasladado de periodos previos
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground/60">-</td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground/60">-</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                        {formatoMoneda(Math.abs(saldoInicialPeriodo))}
                        <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                          ({saldoInicialPeriodo >= 0 ? "D" : "A"})
                        </span>
                      </td>
                    </tr>
                  )}

                  {/* MOVIMIENTOS CONTABLES */}
                  {movimientos.map((m, idx) => {
                    const rowAnomalo = m.saldo < 0
                    return (
                      <tr
                        key={idx}
                        className={`transition-colors hover:bg-muted/40 ${
                          rowAnomalo ? "bg-red-500/[0.02]" : ""
                        }`}
                      >
                        <td className="py-2.5 px-3 font-medium whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {m.fecha}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {m.asientoOriginal ? (
                            <button
                              type="button"
                              onClick={() => setPartidaDetalle(m.asientoOriginal!)}
                              className="inline-flex items-center gap-1 text-xs font-semibold font-mono text-primary hover:underline bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded transition-colors"
                              title="Inspeccionar asiento contable completo"
                            >
                              <Eye className="size-3" />
                              #{m.partidaNumero}
                            </button>
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground">#{m.partidaNumero}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-muted text-foreground">
                            {m.tipoPartida}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-foreground/90 max-w-sm text-xs leading-relaxed">
                          {m.concepto}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {m.debe > 0 ? (
                            <span className="text-foreground font-semibold">{formatoMoneda(m.debe)}</span>
                          ) : (
                            <span className="text-muted-foreground/30">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {m.haber > 0 ? (
                            <span className="text-foreground font-semibold">{formatoMoneda(m.haber)}</span>
                          ) : (
                            <span className="text-muted-foreground/30">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold">
                          <span className={rowAnomalo ? "text-red-600 dark:text-red-400" : "text-primary"}>
                            {formatoMoneda(Math.abs(m.saldo))}
                          </span>
                          <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                            ({m.saldo >= 0 ? "D" : "A"})
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/30 font-semibold">
                  <tr>
                    <td colSpan={4} className="py-3 px-3 text-xs uppercase tracking-wider text-muted-foreground">
                      Totales del período ({mesFiltro === "todos" ? "Año completo" : MESES.find((m) => m.valor === mesFiltro)?.label})
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-foreground">
                      {formatoMoneda(totalDebe)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-foreground">
                      {formatoMoneda(totalHaber)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-primary">
                      {formatoMoneda(Math.abs(saldoFinalPeriodo))}
                      <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                        ({saldoFinalPeriodo >= 0 ? "D" : "A"})
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL DE DRILL-DOWN: VER PARTIDA CONTABLE COMPLETA (DOUBLE ENTRY VALIDATED) */}
      {partidaDetalle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setPartidaDetalle(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-foreground">
                    Partida Contable #{partidaDetalle.numero}
                  </h3>
                  <Badge variant="default" className="text-xs">
                    {partidaDetalle.tipo || "OPERACIÓN"}
                  </Badge>
                  {partidaDetalle.estado === "ANULADO" ? (
                    <Badge variant="warning" className="text-xs">
                      ANULADA
                    </Badge>
                  ) : (
                    <Badge variant="success" className="text-xs flex items-center gap-1">
                      <CheckCircle2 className="size-3" />
                      APLICADA
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Fecha: <strong>{partidaDetalle.fecha}</strong> · Correlativo global: <strong>#{partidaDetalle.correlativo_global ?? "-"}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPartidaDetalle(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
                title="Cerrar modal (Esc)"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                Concepto / Glosa Oficial:
              </p>
              <p className="text-sm bg-muted/40 p-2.5 rounded-lg border border-border/60 text-foreground leading-relaxed">
                {partidaDetalle.concepto}
              </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground uppercase font-medium">
                  <tr>
                    <th className="py-2 px-3 text-left">Código</th>
                    <th className="py-2 px-3 text-left">Cuenta</th>
                    <th className="py-2 px-3 text-right">Debe</th>
                    <th className="py-2 px-3 text-right">Haber</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {partidaDetalle.lineas.map((l, i) => {
                    const c = cuentas.find((x) => x.codigo === l.codigo)
                    const esCuentaActual = l.codigo === cuentaActual?.codigo
                    return (
                      <tr
                        key={i}
                        className={esCuentaActual ? "bg-primary/10 font-semibold" : ""}
                      >
                        <td className="py-2 px-3 font-mono text-xs">{l.codigo}</td>
                        <td className="py-2 px-3">
                          {c?.nombre || "Cuenta desconocida"}
                          {esCuentaActual && (
                            <span className="ml-2 text-[10px] text-primary font-normal bg-primary/20 px-1.5 py-0.5 rounded">
                              Cuenta auditada
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {l.debe > 0 ? formatoMoneda(l.debe) : "-"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {l.haber > 0 ? formatoMoneda(l.haber) : "-"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-muted/30 font-bold border-t border-border">
                  {(() => {
                    const { debe, haber, diferencia } = totalesAsiento(partidaDetalle.lineas)
                    const cuadrada = Math.abs(diferencia) < 0.01
                    return (
                      <tr>
                        <td colSpan={2} className="py-2 px-3 text-xs uppercase flex items-center gap-1.5">
                          {cuadrada ? (
                            <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                              <CheckCircle2 className="size-3.5" />
                              Sumas Iguales (Partida Doble Cuadrada)
                            </span>
                          ) : (
                            <span className="text-red-600 flex items-center gap-1 font-semibold">
                              <AlertCircle className="size-3.5" />
                              Descuadre: {formatoMoneda(diferencia)}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {formatoMoneda(debe)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {formatoMoneda(haber)}
                        </td>
                      </tr>
                    )
                  })()}
                </tfoot>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Link
                href="/libro-diario"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                onClick={() => setPartidaDetalle(null)}
              >
                <ExternalLink className="size-3.5" />
                Ver en Libro Diario
              </Link>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPartidaDetalle(null)}
              >
                Cerrar Detalle
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PIE DE FIRMAS DE AUDITORÍA (IMPRESIÓN OFICIAL) */}
      <footer className="hidden border-t border-border pt-8 text-center text-xs text-muted-foreground print:block">
        <p>Libro Auxiliar oficial emitido por el Sistema Contable Automatizado.</p>
        <div className="mt-12 grid grid-cols-3 gap-10">
          <div className="border-t border-foreground/50 pt-2 font-medium">Elaboró (Contador)</div>
          <div className="border-t border-foreground/50 pt-2 font-medium">Revisó (Auditor Interno)</div>
          <div className="border-t border-foreground/50 pt-2 font-medium">Autorizó (Representante Legal)</div>
        </div>
      </footer>
    </div>
  )
}

export default function KardexPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">
          Cargando Libro Auxiliar...
        </div>
      }
    >
      <KardexContent />
    </Suspense>
  )
}
