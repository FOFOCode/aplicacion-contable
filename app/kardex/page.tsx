"use client"

import { Suspense, useEffect, useMemo, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Eye,
  FileDown,
  FileSpreadsheet,
  Filter,
  Search,
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

  // Cálculos analíticos y tributarios de El Salvador
  const saldoMayorCuenta = useCallback(
    (codigo: string) => {
      const sm = saldoMayorMap.get(codigo)
      if (!sm) return 0
      const c = cuentas.find((x) => x.codigo === codigo)
      if (!c) return 0
      return c.naturaleza === "deudora" ? sm.debe - sm.haber : sm.haber - sm.debe
    },
    [saldoMayorMap, cuentas]
  )

  const totalDF = useMemo(() => Math.max(0, saldoMayorCuenta("2103")), [saldoMayorCuenta])
  const totalCF = useMemo(() => Math.max(0, saldoMayorCuenta("1105")), [saldoMayorCuenta])
  const diferenciaIVA = useMemo(() => redondear(totalDF - totalCF), [totalDF, totalCF])

  const comprasBrutas = useMemo(() => Math.max(0, saldoMayorCuenta("4101")), [saldoMayorCuenta])
  const gastosCompras = useMemo(() => Math.max(0, saldoMayorCuenta("4102")), [saldoMayorCuenta])
  const devCompras = useMemo(() => Math.max(0, saldoMayorCuenta("5102")), [saldoMayorCuenta])
  const rebCompras = useMemo(() => Math.max(0, saldoMayorCuenta("5103")), [saldoMayorCuenta])

  const ventasBrutas = useMemo(() => Math.max(0, saldoMayorCuenta("5101")), [saldoMayorCuenta])
  const devVentas = useMemo(() => Math.max(0, saldoMayorCuenta("4103")), [saldoMayorCuenta])
  const rebVentas = useMemo(() => Math.max(0, saldoMayorCuenta("4104")), [saldoMayorCuenta])

  const comprasNetas = useMemo(
    () => redondear(comprasBrutas + gastosCompras - devCompras - rebCompras),
    [comprasBrutas, gastosCompras, devCompras, rebCompras]
  )
  const ventasNetas = useMemo(
    () => redondear(ventasBrutas - devVentas - rebVentas),
    [ventasBrutas, devVentas, rebVentas]
  )

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
      {/* CABECERA FORMAL EXCLUSIVA PARA IMPRESIÓN OFICIAL (PDF) */}
      <div className="hidden print:block pb-4 mb-4 border-b-2 border-foreground/80 text-foreground">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wider">
              Sistema de Información Contable
            </h1>
            <p className="text-sm font-semibold uppercase text-muted-foreground">
              Libro Auxiliar de Mayor · Folio Contable Oficial
            </p>
          </div>
          <div className="text-right text-xs font-mono">
            <p><strong>Ciclo Fiscal:</strong> {ejercicioSeleccionado}</p>
            <p><strong>Fecha de Emisión:</strong> {new Date().toLocaleDateString("es-SV")}</p>
            <p><strong>Moneda:</strong> USD ($)</p>
          </div>
        </div>

        {cuentaActual && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-foreground/30 pt-2 font-mono">
            <div>
              <p><strong>Cuenta:</strong> {cuentaActual.codigo} — {cuentaActual.nombre}</p>
              <p><strong>Clasificación:</strong> {cuentaActual.tipo.toUpperCase()} · <strong>Naturaleza:</strong> {cuentaActual.naturaleza.toUpperCase()}</p>
            </div>
            <div className="text-right">
              <p><strong>Período:</strong> {MESES.find((m) => m.valor === mesFiltro)?.label || "Todo el año"}</p>
              <p><strong>Saldo al Corte:</strong> {formatoMoneda(Math.abs(saldoFinalPeriodo))} ({condicionSaldoTexto})</p>
            </div>
          </div>
        )}
      </div>

      {/* 1. CABECERA WEB */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3 print:hidden">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold tracking-tight md:text-2xl text-foreground">
            Libro Auxiliar
          </h1>
          <Badge variant="outline" className="text-xs font-mono font-medium">
            Ciclo {ejercicioSeleccionado}
          </Badge>
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
      </header>

      {/* 2. BARRA DE CONTROL */}
      <div className="space-y-2.5 print:hidden">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between rounded-xl border border-border bg-card p-3 shadow-xs">
          {/* Selector principal de cuenta */}
          <div className="flex flex-1 items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Cuenta:</span>
            <select
              className="flex h-9 w-full max-w-xl rounded-md border border-input bg-background px-3 py-1 text-sm font-medium shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

                    return (
                      <option key={c.codigo} value={c.codigo}>
                        {c.codigo} — {c.nombre} {tieneMovs ? `(${formatoMoneda(Math.abs(saldoVal))})` : ""}
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

        {/* Accesos rápidos frecuentes */}
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          <span className="text-xs text-muted-foreground font-medium mr-1">Frecuentes:</span>
          {CUENTAS_RAPIDAS_SV.map((c) => {
            const activa = codigoSeleccionado === c.codigo
            return (
              <button
                key={c.codigo}
                type="button"
                onClick={() => setCodigoSeleccionado(c.codigo)}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  activa
                    ? "bg-primary text-primary-foreground font-medium shadow-xs"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                {c.nombre}
              </button>
            )
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. FICHA TÉCNICA DEL FOLIO CONTABLE (ENCABEZADO DE MAYOR) */}
      {/* ======================================================== */}
      {/* 3. RESUMEN DE LA CUENTA */}
      {cuentaActual && (
        <Card className="border-border shadow-xs overflow-hidden print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 px-4 py-2.5 border-b border-border">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono font-bold text-sm text-foreground bg-muted px-2 py-0.5 rounded border border-border">
                {cuentaActual.codigo}
              </span>
              <h2 className="text-base font-semibold text-foreground">
                {cuentaActual.nombre}
              </h2>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground capitalize">
                {cuentaActual.tipo} ({cuentaActual.naturaleza})
              </span>
              {esSaldoAnomalo && (
                <Badge variant="warning" className="text-[10px]">
                  Sobregiro
                </Badge>
              )}
            </div>

            <Link
              href={`/libro-mayor?cuenta=${cuentaActual.codigo}`}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors print:hidden"
            >
              <span>Ver en Libro Mayor</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border bg-card text-center sm:grid-cols-4 p-2 sm:p-0">
            <div className="p-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block">
                Saldo Anterior
              </span>
              <span className="mt-1 text-base font-semibold font-mono tabular-nums text-foreground block">
                {formatoMoneda(Math.abs(saldoInicialPeriodo))}
              </span>
            </div>

            <div className="p-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block">
                Cargos (Debe)
              </span>
              <span className="mt-1 text-base font-semibold font-mono tabular-nums text-foreground block">
                {formatoMoneda(totalDebe)}
              </span>
            </div>

            <div className="p-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block">
                Abonos (Haber)
              </span>
              <span className="mt-1 text-base font-semibold font-mono tabular-nums text-foreground block">
                {formatoMoneda(totalHaber)}
              </span>
            </div>

            <div className="p-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block">
                Saldo Actual
              </span>
              <span className={`mt-1 text-base font-bold font-mono tabular-nums block ${
                esSaldoAnomalo ? "text-red-600 dark:text-red-400" : "text-foreground"
              }`}>
                {formatoMoneda(Math.abs(saldoFinalPeriodo))}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {condicionSaldoTexto}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* RESUMEN DE LIQUIDACIÓN DE IVA */}
      {(codigoSeleccionado === "1105" || codigoSeleccionado === "2103") && (
        <Card className="border-border bg-card shadow-xs print:hidden">
          <CardHeader className="py-2.5 px-4 bg-muted/20 border-b border-border">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Liquidación de IVA
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="rounded-lg border border-border/60 p-2.5 bg-background">
              <span className="text-muted-foreground text-[11px] block">Débito Fiscal (Ventas)</span>
              <span className="text-base font-semibold font-mono text-foreground">{formatoMoneda(totalDF)}</span>
            </div>
            <div className="rounded-lg border border-border/60 p-2.5 bg-background">
              <span className="text-muted-foreground text-[11px] block">Crédito Fiscal (Compras)</span>
              <span className="text-base font-semibold font-mono text-foreground">{formatoMoneda(totalCF)}</span>
            </div>
            <div className="rounded-lg border border-border/60 p-2.5 bg-background">
              <span className="text-muted-foreground text-[11px] block">
                {diferenciaIVA > 0 ? "Impuesto por Pagar" : diferenciaIVA < 0 ? "Remanente a Favor" : "Saldo Neto"}
              </span>
              <span className="text-base font-bold font-mono text-foreground">
                {formatoMoneda(Math.abs(diferenciaIVA))}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* RESUMEN ANALÍTICO DE COMPRAS */}
      {codigoSeleccionado === "4101" && (
        <Card className="border-border bg-card shadow-xs print:hidden">
          <CardHeader className="py-2.5 px-4 bg-muted/20 border-b border-border">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Resumen de Compras Netas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="rounded-lg border border-border/60 p-2.5 bg-background">
              <span className="text-muted-foreground text-[11px] block">Compras Brutas</span>
              <span className="text-sm font-semibold font-mono text-foreground">{formatoMoneda(comprasBrutas)}</span>
            </div>
            <div className="rounded-lg border border-border/60 p-2.5 bg-background">
              <span className="text-muted-foreground text-[11px] block">Fletes sobre Compras</span>
              <span className="text-sm font-semibold font-mono text-foreground">{formatoMoneda(gastosCompras)}</span>
            </div>
            <div className="rounded-lg border border-border/60 p-2.5 bg-background">
              <span className="text-muted-foreground text-[11px] block">Devoluciones y Rebajas</span>
              <span className="text-sm font-semibold font-mono text-foreground">{formatoMoneda(devCompras + rebCompras)}</span>
            </div>
            <div className="rounded-lg border border-border/60 p-2.5 bg-background">
              <span className="text-muted-foreground text-[11px] block">Compras Netas</span>
              <span className="text-sm font-bold font-mono text-foreground">{formatoMoneda(comprasNetas)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* RESUMEN ANALÍTICO DE VENTAS */}
      {codigoSeleccionado === "5101" && (
        <Card className="border-border bg-card shadow-xs print:hidden">
          <CardHeader className="py-2.5 px-4 bg-muted/20 border-b border-border">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Resumen de Ventas Netas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="rounded-lg border border-border/60 p-2.5 bg-background">
              <span className="text-muted-foreground text-[11px] block">Ventas Brutas</span>
              <span className="text-sm font-semibold font-mono text-foreground">{formatoMoneda(ventasBrutas)}</span>
            </div>
            <div className="rounded-lg border border-border/60 p-2.5 bg-background">
              <span className="text-muted-foreground text-[11px] block">Devoluciones y Rebajas</span>
              <span className="text-sm font-semibold font-mono text-foreground">{formatoMoneda(devVentas + rebVentas)}</span>
            </div>
            <div className="rounded-lg border border-border/60 p-2.5 bg-background">
              <span className="text-muted-foreground text-[11px] block">Ventas Netas</span>
              <span className="text-sm font-bold font-mono text-foreground">{formatoMoneda(ventasNetas)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. TABLA DE MOVIMIENTOS */}
      <Card className="border-border shadow-xs overflow-hidden print:border-0 print:shadow-none print:bg-transparent">
        <CardHeader className="py-2.5 px-4 sm:px-5 bg-muted/20 border-b border-border print:hidden">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-foreground">
              Movimientos Registrados
            </CardTitle>
            <span className="text-xs font-mono text-muted-foreground">
              {movimientos.length} {movimientos.length === 1 ? "movimiento" : "movimientos"}
            </span>
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
                <thead className="border-b border-border bg-muted/40 text-muted-foreground uppercase font-semibold text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 whitespace-nowrap">Fecha</th>
                    <th className="py-2.5 px-2 text-center whitespace-nowrap">Partida</th>
                    <th className="py-2.5 px-2 text-center whitespace-nowrap">Tipo</th>
                    <th className="py-2.5 px-2 whitespace-nowrap">Referencia</th>
                    <th className="py-2.5 px-3">Concepto</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Debe</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Haber</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Saldo</th>
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
                    <td colSpan={5} className="py-2.5 px-3 uppercase text-muted-foreground">
                      Sumas del Período
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-foreground whitespace-nowrap">
                      {formatoMoneda(totalDebe)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-foreground whitespace-nowrap">
                      {formatoMoneda(totalHaber)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap">
                      <span className="text-foreground">
                        {formatoMoneda(Math.abs(saldoFinalPeriodo))}
                      </span>
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                        ({condicionSaldoTexto})
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
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
