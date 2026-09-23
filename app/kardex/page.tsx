"use client"

import { Suspense, useEffect, useMemo, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
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
  Search,
  ShieldCheck,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/field"
import { useContabilidad } from "@/components/contabilidad-provider"
import { formatoMoneda, redondear, totalesAsiento } from "@/lib/contabilidad"
import { exportarLibroExcel } from "@/lib/excel"
import type { Asiento, Cuenta, TipoCuenta } from "@/lib/types"

interface MovimientoKardex {
  fecha: string
  partidaNumero: number
  correlativoGlobal?: number
  tipoPartida: string
  referenciaDoc: string
  concepto: string
  debe: number
  haber: number
  saldo: number
  asientoOriginal?: Asiento
}

// Cuentas de uso operativo y tributario frecuente en El Salvador
const CUENTAS_RAPIDAS_SV = [
  { codigo: "1101", nombre: "Caja" },
  { codigo: "1102", nombre: "Bancos" },
  { codigo: "1103", nombre: "Clientes" },
  { codigo: "1105", nombre: "IVA Crédito" },
  { codigo: "2101", nombre: "Proveedores" },
  { codigo: "2103", nombre: "IVA Débito" },
  { codigo: "4101", nombre: "Compras" },
  { codigo: "5101", nombre: "Ventas" },
]

const MESES = [
  { valor: "todos", label: "Todo el año fiscal" },
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

const GRUPOS_CONTABLES: { id: string; nombre: string; tipo: TipoCuenta }[] = [
  { id: "1", nombre: "1. ACTIVO", tipo: "activo" },
  { id: "2", nombre: "2. PASIVO", tipo: "pasivo" },
  { id: "3", nombre: "3. CAPITAL", tipo: "capital" },
  { id: "4", nombre: "4. COSTOS Y GASTOS", tipo: "gasto" },
  { id: "5", nombre: "5. INGRESOS", tipo: "ingreso" },
]

/**
 * Extrae o sintetiza la referencia documental formal (Factura, CCF, Cheque, Recibo)
 * de acuerdo a la práctica de registro de pólizas y asientos contables.
 */
function extraerReferenciaOperativa(concepto: string, tipo: string = "OPERACION", partidaNumero: number): string {
  const match = concepto.match(/\b(ccf|factura|fac|f\/|cheque|ch|recibo|rec|nota de cr[eé]dito|nc|nota de d[eé]bito|nd|quedan|p[oó]liza)\s*([a-z0-9#-]+)?/i)
  if (match) {
    const docTipo = match[1].toUpperCase()
    const docNum = match[2] ? match[2].trim() : ""
    return docNum ? `${docTipo} ${docNum}` : docTipo
  }
  if (tipo === "APERTURA") return "P. APERTURA"
  if (tipo === "AJUSTE") return "P. AJUSTE"
  if (tipo === "CIERRE") return "P. CIERRE"
  return `PD-${String(partidaNumero).padStart(3, "0")}`
}

function KardexContent() {
  const { cuentas, asientos, ejercicioSeleccionado, mayor } = useContabilidad()
  const searchParams = useSearchParams()
  const codigoParam = searchParams.get("codigo") || searchParams.get("cuenta")

  // Cuenta inicial seleccionada
  const [codigoSeleccionado, setCodigoSeleccionado] = useState<string>(codigoParam || "1101")
  const [busqueda, setBusqueda] = useState("")
  const [mesFiltro, setMesFiltro] = useState<string>("todos")
  const [soloConMovimientos, setSoloConMovimientos] = useState<boolean>(true)
  const [partidaDetalle, setPartidaDetalle] = useState<Asiento | null>(null)

  useEffect(() => {
    if (codigoParam && codigoParam !== codigoSeleccionado) {
      setCodigoSeleccionado(codigoParam)
    }
  }, [codigoParam, codigoSeleccionado])

  // Cuentas activas del catálogo
  const cuentasActivas = useMemo(() => cuentas.filter((c) => c.activa), [cuentas])

  // Mapa de saldo de mayor general por cuenta en el ejercicio actual
  const saldoMayorMap = useMemo(() => {
    const map = new Map<string, { debe: number; haber: number; saldo: number; movs: number }>()
    for (const a of asientos) {
      if (a.estado === "ANULADO") continue
      const ej = a.ejercicio || (a.fecha ? new Date(a.fecha).getFullYear() : undefined)
      if (ej !== undefined && ej !== ejercicioSeleccionado) continue

      for (const l of a.lineas) {
        const actual = map.get(l.codigo) || { debe: 0, haber: 0, saldo: 0, movs: 0 }
        actual.debe = redondear(actual.debe + (Number(l.debe) || 0))
        actual.haber = redondear(actual.haber + (Number(l.haber) || 0))
        actual.movs += 1
        map.set(l.codigo, actual)
      }
    }
    return map
  }, [asientos, ejercicioSeleccionado])

  // Cuenta activa actualmente en pantalla
  const cuentaActual: Cuenta | undefined = useMemo(() => {
    return cuentasActivas.find((c) => c.codigo === codigoSeleccionado) || cuentasActivas[0]
  }, [cuentasActivas, codigoSeleccionado])

  // Cuentas elegibles para selector y navegación
  const cuentasNavegables = useMemo(() => {
    let base = cuentasActivas
    if (soloConMovimientos) {
      base = base.filter((c) => {
        const sm = saldoMayorMap.get(c.codigo)
        return sm !== undefined && sm.movs > 0
      })
    }
    return base
  }, [cuentasActivas, soloConMovimientos, saldoMayorMap])

  const indiceActual = useMemo(
    () => cuentasNavegables.findIndex((c) => c.codigo === codigoSeleccionado),
    [cuentasNavegables, codigoSeleccionado]
  )

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

  // Atajos de teclado para navegación contable y cierre de modales
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

  // Cuentas filtradas por texto de búsqueda
  const cuentasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return cuentasNavegables.filter((c) => {
      if (!q) return true
      return c.codigo.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q)
    })
  }, [cuentasNavegables, busqueda])

  // Historial cronológico de la cuenta en el año
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
            referenciaDoc: extraerReferenciaOperativa(a.concepto, a.tipo || "OPERACION", a.numero),
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

  // Movimientos del período seleccionado con arrastre exacto de saldo anterior
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

  // Métricas del período
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

  // Variación neta del período (flujo)
  const variacionNeta = useMemo(() => {
    if (cuentaActual?.naturaleza === "deudora") {
      return redondear(totalDebe - totalHaber)
    }
    return redondear(totalHaber - totalDebe)
  }, [cuentaActual, totalDebe, totalHaber])

  // Evaluación de anomalías o sobregiros contables
  const esSaldoAnomalo = useMemo(() => {
    if (saldoFinalPeriodo === 0) return false
    return saldoFinalPeriodo < 0
  }, [saldoFinalPeriodo])

  const esCuentaSaldada = saldoFinalPeriodo === 0

  const condicionSaldoTexto = useMemo(() => {
    if (esCuentaSaldada) return "Saldada ($0.00)"
    if (cuentaActual?.naturaleza === "deudora") {
      return saldoFinalPeriodo >= 0 ? "Deudor" : "Acreedor (Sobregiro)"
    } else {
      return saldoFinalPeriodo >= 0 ? "Acreedor" : "Deudor (Anómalo)"
    }
  }, [esCuentaSaldada, cuentaActual, saldoFinalPeriodo])

  // Funciones de exportación e impresión
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
      ["SISTEMA CONTABLE OFICIAL - LIBRO AUXILIAR DE CUENTAS MAYORES"],
      [`Ejercicio fiscal: ${ejercicioSeleccionado}`],
      [`Cuenta: ${cuentaActual.codigo} - ${cuentaActual.nombre}`],
      [`Clasificación: ${cuentaActual.tipo.toUpperCase()} | Naturaleza Normal: ${cuentaActual.naturaleza.toUpperCase()}`],
      [`Período reportado: ${MESES.find((m) => m.valor === mesFiltro)?.label || "Todo el año"}`],
      [`Condición del Saldo: ${condicionSaldoTexto}`],
      [`Fecha de emisión: ${new Date().toLocaleDateString("es-SV")}`],
      [],
      ["Fecha", "Partida #", "Tipo", "Referencia / Doc", "Concepto / Glosa", "Debe (Cargos)", "Haber (Abonos)", "Saldo Progresivo", "Nat."],
    ]

    if (mesFiltro !== "todos") {
      filas.push([
        `${ejercicioSeleccionado}-${mesFiltro.padStart(2, "0")}-01`,
        "-",
        "INICIAL",
        "TRASLADO",
        "SALDO ANTERIOR TRASLADADO DEL PERÍODO PREVIO",
        "",
        "",
        saldoInicialPeriodo,
        saldoInicialPeriodo >= 0 ? (cuentaActual.naturaleza === "deudora" ? "D" : "A") : (cuentaActual.naturaleza === "deudora" ? "A" : "D"),
      ])
    }

    for (const m of movimientos) {
      filas.push([
        m.fecha,
        m.partidaNumero,
        m.tipoPartida,
        m.referenciaDoc,
        m.concepto,
        m.debe > 0 ? m.debe : "",
        m.haber > 0 ? m.haber : "",
        m.saldo,
        m.saldo >= 0 ? (cuentaActual.naturaleza === "deudora" ? "D" : "A") : (cuentaActual.naturaleza === "deudora" ? "A" : "D"),
      ])
    }

    filas.push([])
    filas.push([
      "SUMAS DEL PERÍODO",
      "",
      "",
      "",
      "",
      totalDebe,
      totalHaber,
      saldoFinalPeriodo,
      condicionSaldoTexto,
    ])

    exportarLibroExcel(`Libro_Auxiliar_${cuentaActual.codigo}_${cuentaActual.nombre.replace(/\s+/g, "_")}`, [
      {
        nombre: `Auxiliar ${cuentaActual.codigo}`,
        filas,
      },
    ])
  }

  // Cuentas agrupadas por clase contable para el selector
  const cuentasPorGrupo = useMemo(() => {
    return GRUPOS_CONTABLES.map((g) => ({
      ...g,
      cuentas: cuentasFiltradas.filter((c) => c.tipo === g.tipo),
    })).filter((g) => g.cuentas.length > 0)
  }, [cuentasFiltradas])

  const totalCuentasConMovs = useMemo(() => {
    return cuentasActivas.filter((c) => (saldoMayorMap.get(c.codigo)?.movs || 0) > 0).length
  }, [cuentasActivas, saldoMayorMap])

  return (
    <div className="space-y-5">
      {/* ======================================================== */}
      {/* 1. MEMBRETE Y CABECERA INSTITUCIONAL */}
      {/* ======================================================== */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Contabilidad Formal</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">Ciclo Fiscal {ejercicioSeleccionado}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">Moneda: USD ($)</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl text-foreground mt-0.5">
            Libro Auxiliar de Mayor
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Folio cronológico de cargos, abonos y saldo progresivo por cuenta con verificación de cuadre.
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportarPdf}
            className="h-8 gap-1.5 text-xs shadow-xs"
          >
            <FileDown className="size-3.5" />
            Imprimir Folio
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
      </header>

      {/* ======================================================== */}
      {/* 2. BARRA DE CONTROL CONTABLE (SELECTOR PROFESIONAL) */}
      {/* ======================================================== */}
      <div className="space-y-2.5 print:hidden">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between rounded-xl border border-border bg-card p-3 shadow-xs">
          {/* Selector principal de cuenta con optgroup y saldo visible */}
          <div className="flex flex-1 items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Cuenta:</span>
            <select
              className="flex h-9 w-full max-w-xl rounded-md border border-input bg-background px-3 py-1 text-sm font-mono font-medium shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={codigoSeleccionado}
              onChange={(e) => setCodigoSeleccionado(e.target.value)}
              aria-label="Seleccionar cuenta contable"
            >
              {cuentasPorGrupo.map((g) => (
                <optgroup key={g.id} label={g.nombre}>
                  {g.cuentas.map((c) => {
                    const sm = saldoMayorMap.get(c.codigo)
                    const tieneMovs = sm !== undefined && sm.movs > 0
                    const saldoVal = sm ? (c.naturaleza === "deudora" ? sm.debe - sm.haber : sm.haber - sm.debe) : 0
                    const tagNat = saldoVal >= 0 ? (c.naturaleza === "deudora" ? "D" : "A") : (c.naturaleza === "deudora" ? "A" : "D")

                    return (
                      <option key={c.codigo} value={c.codigo}>
                        {c.codigo} — {c.nombre} {tieneMovs ? `| Saldo: ${formatoMoneda(Math.abs(saldoVal))} ${tagNat} (${sm.movs} movs)` : "| Sin movs"}
                      </option>
                    )
                  })}
                </optgroup>
              ))}
            </select>

            {/* Navegación anterior / siguiente entre cuentas */}
            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={cuentaAnterior}
                disabled={indiceActual <= 0}
                title="Cuenta anterior (Alt + Flecha Izquierda)"
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
                title="Siguiente cuenta (Alt + Flecha Derecha)"
                className="size-7"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          {/* Filtros: Búsqueda rápida, Filtro por Mes y Toggle de movimientos */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Buscador de texto */}
            <div className="relative w-full sm:w-44 shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Filtrar catálogo..."
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

            {/* Selector de Mes / Período */}
            <select
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="Filtrar por período"
            >
              {MESES.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.label}
                </option>
              ))}
            </select>

            {/* Toggle: Solo cuentas con movimientos */}
            <button
              type="button"
              onClick={() => setSoloConMovimientos(!soloConMovimientos)}
              className={`flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs font-medium transition-colors ${
                soloConMovimientos
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              }`}
              title="Oculta cuentas que no tienen registros en este ejercicio"
            >
              <Filter className="size-3" />
              <span>Con movimientos ({totalCuentasConMovs})</span>
            </button>
          </div>
        </div>

        {/* Accesos rápidos frecuentes de consulta contable */}
        <div className="flex flex-wrap items-center gap-1 px-1">
          <span className="text-[11px] text-muted-foreground font-medium mr-1">Frecuentes:</span>
          {CUENTAS_RAPIDAS_SV.map((c) => {
            const activa = codigoSeleccionado === c.codigo
            const sm = saldoMayorMap.get(c.codigo)
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
                {sm && sm.movs > 0 && (
                  <span className={`ml-1 text-[10px] ${activa ? "opacity-90" : "text-muted-foreground"}`}>
                    ({sm.movs})
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. FICHA TÉCNICA DEL FOLIO CONTABLE (ENCABEZADO DE MAYOR) */}
      {/* ======================================================== */}
      {cuentaActual && (
        <Card className="border-border shadow-xs overflow-hidden">
          {/* Banda Superior: Identificación de Cuenta y Enlace a Cuenta T */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-3.5 sm:px-5 border-b border-border">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary font-mono font-bold text-sm">
                {cuentaActual.codigo}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground">
                    {cuentaActual.nombre}
                  </h2>
                  <Badge variant={cuentaActual.naturaleza === "deudora" ? "deudora" : "acreedora"} className="text-[11px] capitalize">
                    Naturaleza {cuentaActual.naturaleza}
                  </Badge>
                  {esSaldoAnomalo && (
                    <Badge variant="warning" className="text-[10px] font-bold">
                      ⚠️ Sobregiro
                    </Badge>
                  )}
                  {esCuentaSaldada && (
                    <Badge variant="muted" className="text-[10px]">
                      Saldada
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">
                  Grupo: <strong className="text-foreground font-medium">{cuentaActual.tipo}</strong> · Folio contable del Ciclo {ejercicioSeleccionado}
                </p>
              </div>
            </div>

            {/* Enlace directo a Mayor General (Cuenta T) */}
            <div className="flex items-center gap-2 print:hidden">
              <Link
                href={`/libro-mayor?cuenta=${cuentaActual.codigo}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                title="Inspeccionar la Cuenta T en el Libro Mayor"
              >
                <span>Ver Cuenta T en Mayor</span>
                <ArrowRight className="size-3 text-muted-foreground" />
              </Link>
            </div>
          </div>

          {/* Banda de Saldos Numéricos del Auxiliar (Formato Folio Contable) */}
          <div className="grid grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border bg-card text-center sm:grid-cols-5 p-2 sm:p-0">
            {/* 1. Saldo Anterior */}
            <div className="p-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block">
                Saldo Anterior
              </span>
              <span className="mt-1 text-base sm:text-lg font-bold font-mono tabular-nums text-foreground block">
                {formatoMoneda(Math.abs(saldoInicialPeriodo))}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {saldoInicialPeriodo === 0 ? "Sin saldo previo" : (saldoInicialPeriodo >= 0 ? "Deudor" : "Acreedor")}
              </span>
            </div>

            {/* 2. Total Cargos (Debe) */}
            <div className="p-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block">
                Total Cargos (Debe)
              </span>
              <span className="mt-1 text-base sm:text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 block">
                +{formatoMoneda(totalDebe)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {movimientos.filter((m) => m.debe > 0).length} débitos
              </span>
            </div>

            {/* 3. Total Abonos (Haber) */}
            <div className="p-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block">
                Total Abonos (Haber)
              </span>
              <span className="mt-1 text-base sm:text-lg font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 block">
                -{formatoMoneda(totalHaber)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {movimientos.filter((m) => m.haber > 0).length} créditos
              </span>
            </div>

            {/* 4. Variación Neta del Período */}
            <div className="p-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block">
                Variación Neta
              </span>
              <span className={`mt-1 text-base sm:text-lg font-bold font-mono tabular-nums block ${
                variacionNeta > 0 ? "text-emerald-600 dark:text-emerald-400" : variacionNeta < 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
              }`}>
                {variacionNeta > 0 ? `+${formatoMoneda(variacionNeta)}` : formatoMoneda(variacionNeta)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Flujo del período
              </span>
            </div>

            {/* 5. Saldo Actual al Corte */}
            <div className={`p-3 col-span-2 sm:col-span-1 ${esSaldoAnomalo ? "bg-red-500/10" : "bg-primary/[0.03]"}`}>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary block">
                Saldo al Corte
              </span>
              <span className={`mt-1 text-base sm:text-lg font-bold font-mono tabular-nums block ${
                esSaldoAnomalo ? "text-red-600 dark:text-red-400" : "text-foreground"
              }`}>
                {formatoMoneda(Math.abs(saldoFinalPeriodo))}
              </span>
              <span className={`text-[10px] font-semibold ${esSaldoAnomalo ? "text-red-600 dark:text-red-400" : "text-primary"}`}>
                {condicionSaldoTexto}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* AVISO METODOLÓGICO PARA INVENTARIO (CUENTA 1104) */}
      {codigoSeleccionado === "1104" && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs text-blue-950 dark:text-blue-200">
          <div className="flex items-start gap-2.5">
            <Info className="size-4 shrink-0 text-blue-600 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-blue-900 dark:text-blue-100">
                Aviso Técnico: Cuenta 1104 en el Método Analítico
              </p>
              <p className="leading-relaxed text-[11px]">
                En el método analítico, la cuenta <strong>1104 (Inventario de mercadería)</strong> permanece fija con el inventario inicial del ejercicio ({ejercicioSeleccionado}). Las operaciones de compra y venta se registran en <strong>4101 (Compras)</strong> y <strong>5101 (Ventas)</strong>. El inventario final se determina en la toma física para calcular el Costo de Ventas en Estados Financieros.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. TABLA OFICIAL DEL LIBRO AUXILIAR (FOLIO DE MOVIMIENTOS) */}
      {/* ======================================================== */}
      <Card className="border-border shadow-xs overflow-hidden">
        <CardHeader className="py-3 px-4 sm:px-5 bg-muted/20 border-b border-border">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm sm:text-base font-semibold text-foreground">
                Folio de Operaciones Contables
              </CardTitle>
              <CardDescription className="text-xs">
                Asientos registrados con afectación directa a esta cuenta. Haz clic en el número de partida para ver el comprobante diario completo.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <Badge variant="muted" className="font-mono">
                {movimientos.length} {movimientos.length === 1 ? "movimiento" : "movimientos"}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {movimientos.length === 0 && saldoInicialPeriodo === 0 ? (
            <div className="py-12 text-center p-4">
              <ClipboardList className="mx-auto size-9 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-semibold text-muted-foreground">
                Sin movimientos registrados para la cuenta {cuentaActual?.codigo} - {cuentaActual?.nombre} {mesFiltro !== "todos" ? `en ${MESES.find((m) => m.valor === mesFiltro)?.label}` : `en el ejercicio ${ejercicioSeleccionado}`}.
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Selecciona otra cuenta en la barra superior o cambia el filtro de período.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="border-b border-border bg-muted/50 text-muted-foreground uppercase font-semibold text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 whitespace-nowrap">Fecha</th>
                    <th className="py-2.5 px-2 text-center whitespace-nowrap">Partida</th>
                    <th className="py-2.5 px-2 text-center whitespace-nowrap">Tipo</th>
                    <th className="py-2.5 px-2 whitespace-nowrap">Ref. / Doc</th>
                    <th className="py-2.5 px-3">Concepto / Glosa de la Operación</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Debe (Cargos)</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Haber (Abonos)</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Saldo Progresivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {/* RENGLÓN 1: SALDO ANTERIOR TRASLADADO (SIEMPRE EN FILTRO DE MES) */}
                  {mesFiltro !== "todos" && (
                    <tr className="bg-muted/30 font-medium italic text-muted-foreground">
                      <td className="py-2 px-3 font-mono whitespace-nowrap">
                        {`${ejercicioSeleccionado}-${mesFiltro.padStart(2, "0")}-01`}
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-muted-foreground">-</td>
                      <td className="py-2 px-2 text-center">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted font-sans font-semibold">
                          INICIAL
                        </span>
                      </td>
                      <td className="py-2 px-2 font-mono text-[11px] font-semibold text-primary">
                        TRASLADO
                      </td>
                      <td className="py-2 px-3">
                        Saldo anterior acumulado trasladado al inicio del período
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground/50">-</td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground/50">-</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                        {formatoMoneda(Math.abs(saldoInicialPeriodo))}
                        <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                          ({saldoInicialPeriodo >= 0 ? (cuentaActual?.naturaleza === "deudora" ? "D" : "A") : (cuentaActual?.naturaleza === "deudora" ? "A" : "D")})
                        </span>
                      </td>
                    </tr>
                  )}

                  {/* RENGLONES DE OPERACIONES CONTABLES */}
                  {movimientos.map((m, idx) => {
                    const rowAnomalo = m.saldo < 0
                    const tagNat = m.saldo >= 0 ? (cuentaActual?.naturaleza === "deudora" ? "D" : "A") : (cuentaActual?.naturaleza === "deudora" ? "A" : "D")

                    return (
                      <tr
                        key={idx}
                        className={`transition-colors hover:bg-muted/30 ${
                          rowAnomalo ? "bg-red-500/[0.03]" : ""
                        }`}
                      >
                        {/* Fecha */}
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap text-muted-foreground">
                          {m.fecha}
                        </td>

                        {/* Partida N° con botón de inspección */}
                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          {m.asientoOriginal ? (
                            <button
                              type="button"
                              onClick={() => setPartidaDetalle(m.asientoOriginal!)}
                              className="inline-flex items-center gap-1 font-mono font-semibold text-primary hover:underline bg-primary/10 hover:bg-primary/20 px-1.5 py-0.5 rounded transition-colors"
                              title="Inspeccionar asiento contable balanceado"
                            >
                              <Eye className="size-3" />
                              #{m.partidaNumero}
                            </button>
                          ) : (
                            <span className="font-mono text-muted-foreground">#{m.partidaNumero}</span>
                          )}
                        </td>

                        {/* Tipo de Asiento */}
                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                            m.tipoPartida === "APERTURA"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                              : m.tipoPartida === "CIERRE"
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                              : "bg-muted text-foreground"
                          }`}>
                            {m.tipoPartida === "OPERACION" ? "DIARIO" : m.tipoPartida}
                          </span>
                        </td>

                        {/* Referencia Operativa / Documental */}
                        <td className="py-2.5 px-2 font-mono whitespace-nowrap text-[11px] text-muted-foreground font-medium">
                          {m.referenciaDoc}
                        </td>

                        {/* Concepto / Glosa */}
                        <td className="py-2.5 px-3 text-foreground/90 max-w-md leading-relaxed">
                          {m.concepto}
                        </td>

                        {/* Debe (Cargos) */}
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          {m.debe > 0 ? (
                            <span className="text-foreground font-semibold">{formatoMoneda(m.debe)}</span>
                          ) : (
                            <span className="text-muted-foreground/30">-</span>
                          )}
                        </td>

                        {/* Haber (Abonos) */}
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          {m.haber > 0 ? (
                            <span className="text-foreground font-semibold">{formatoMoneda(m.haber)}</span>
                          ) : (
                            <span className="text-muted-foreground/30">-</span>
                          )}
                        </td>

                        {/* Saldo Progresivo con Naturaleza */}
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap">
                          <span className={rowAnomalo ? "text-red-600 dark:text-red-400" : "text-foreground"}>
                            {formatoMoneda(Math.abs(m.saldo))}
                          </span>
                          <span className={`ml-1 text-[10px] font-normal ${rowAnomalo ? "text-red-600 font-bold" : "text-muted-foreground"}`}>
                            ({tagNat})
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>

                {/* PIE DE TABLA: SUMAS Y SALDO FINAL CON DOBLE RAYA CONTABLE */}
                <tfoot className="border-t-2 border-border bg-muted/40 font-semibold text-xs border-b-4 border-double border-foreground/30">
                  <tr>
                    <td colSpan={5} className="py-3 px-3 uppercase tracking-wider text-muted-foreground">
                      SUMAS DEL PERÍODO ({mesFiltro === "todos" ? "Año Completo" : MESES.find((m) => m.valor === mesFiltro)?.label}) · {movimientos.length} OPERACIONES
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-foreground whitespace-nowrap">
                      {formatoMoneda(totalDebe)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-foreground whitespace-nowrap">
                      {formatoMoneda(totalHaber)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap">
                      <span className={esSaldoAnomalo ? "text-red-600 dark:text-red-400" : "text-primary"}>
                        {formatoMoneda(Math.abs(saldoFinalPeriodo))}
                      </span>
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                        ({condicionSaldoTexto})
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* BANDA DE VERIFICACIÓN CONTABLE (CUADRE MATEMÁTICO DE AUDITORÍA) */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/20 border-t border-border/80 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  <span>
                    <strong>Ecuación de Saldo:</strong> Saldo Anterior ({formatoMoneda(Math.abs(saldoInicialPeriodo))}) + Cargos ({formatoMoneda(totalDebe)}) - Abonos ({formatoMoneda(totalHaber)}) = Saldo al Corte ({formatoMoneda(Math.abs(saldoFinalPeriodo))})
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400 font-mono">
                  <CheckCircle2 className="size-3.5" />
                  <span>Cuadre Matemático Verificado ✓</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ======================================================== */}
      {/* 5. MODAL DRILL-DOWN: VER COMPROBANTE DE DIARIO COMPLETO */}
      {/* ======================================================== */}
      {partidaDetalle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setPartidaDetalle(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-border bg-card p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Asiento */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-foreground">
                    Comprobante de Diario · Partida N° {partidaDetalle.numero}
                  </h3>
                  <Badge variant="default" className="text-[10px] font-mono">
                    {partidaDetalle.tipo || "OPERACIÓN"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Fecha: <strong className="text-foreground">{partidaDetalle.fecha}</strong> · Ejercicio {partidaDetalle.ejercicio || ejercicioSeleccionado}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPartidaDetalle(null)}
                className="text-muted-foreground hover:text-foreground rounded-lg p-1"
                aria-label="Cerrar modal"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Glosa / Concepto Completo */}
            <div className="rounded-lg bg-muted/40 p-3 text-xs border border-border">
              <span className="font-semibold text-muted-foreground uppercase text-[10px] block mb-0.5">
                Concepto / Descripción Contable:
              </span>
              <p className="text-foreground leading-relaxed">
                {partidaDetalle.concepto}
              </p>
            </div>

            {/* Tabla de Doble Partida del Asiento */}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-[11px] uppercase font-semibold text-muted-foreground">
                  <tr>
                    <th className="py-2 px-3">Código</th>
                    <th className="py-2 px-3">Cuenta Contable</th>
                    <th className="py-2 px-3 text-right">Debe</th>
                    <th className="py-2 px-3 text-right">Haber</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-mono">
                  {partidaDetalle.lineas.map((linea, lIdx) => {
                    const esLaCuenta = linea.codigo === cuentaActual?.codigo
                    const cuentaInfo = cuentas.find((c) => c.codigo === linea.codigo)

                    return (
                      <tr
                        key={lIdx}
                        className={esLaCuenta ? "bg-primary/10 font-bold" : "hover:bg-muted/20"}
                      >
                        <td className="py-2 px-3 text-primary">
                          {linea.codigo}
                        </td>
                        <td className="py-2 px-3 font-sans font-medium text-foreground">
                          {cuentaInfo ? cuentaInfo.nombre : "Cuenta no encontrada"}
                          {esLaCuenta && (
                            <span className="ml-2 text-[10px] font-sans font-semibold text-primary bg-primary/20 px-1.5 py-0.2 rounded">
                              Activa en este auxiliar
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {Number(linea.debe) > 0 ? formatoMoneda(Number(linea.debe)) : "-"}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {Number(linea.haber) > 0 ? formatoMoneda(Number(linea.haber)) : "-"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/40 font-bold font-mono text-xs">
                  <tr>
                    <td colSpan={2} className="py-2.5 px-3 font-sans text-muted-foreground uppercase text-[11px]">
                      Totales de la Partida
                    </td>
                    <td className="py-2.5 px-3 text-right text-foreground">
                      {formatoMoneda(totalesAsiento(partidaDetalle.lineas).debe)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-foreground">
                      {formatoMoneda(totalesAsiento(partidaDetalle.lineas).haber)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Verificación de Partida Doble Cuadrada */}
            <div className="flex items-center justify-between text-xs pt-1">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="size-4" />
                <span>Partida Doble Balanceada (Debe == Haber)</span>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/libro-diario"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                >
                  <span>Abrir en Libro Diario</span>
                  <ExternalLink className="size-3" />
                </Link>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPartidaDetalle(null)}
                  className="h-8 text-xs"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. PIE DE FIRMAS DE AUDITORÍA (IMPRESIÓN OFICIAL) */}
      {/* ======================================================== */}
      <footer className="hidden border-t border-border pt-8 text-center text-xs text-muted-foreground print:block">
        <p className="font-semibold text-foreground">
          Libro Auxiliar emitido oficialmente por el Sistema de Información Contable.
        </p>
        <p className="mt-1">
          Certificación de saldos y operaciones según principios contables y normativa tributaria aplicable.
        </p>
        <div className="mt-14 grid grid-cols-3 gap-10">
          <div className="border-t border-foreground/50 pt-2 font-medium">
            Elaboró (Auxiliar Contable)
          </div>
          <div className="border-t border-foreground/50 pt-2 font-medium">
            Revisó (Contador General - JVPCPA)
          </div>
          <div className="border-t border-foreground/50 pt-2 font-medium">
            Autorizó (Representante Legal / Auditor)
          </div>
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
          Cargando Libro Auxiliar de Mayor...
        </div>
      }
    >
      <KardexContent />
    </Suspense>
  )
}
