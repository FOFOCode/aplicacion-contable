"use client"

import { Suspense, useEffect, useMemo, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowRight,
  BookOpenText,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Eye,
  FileDown,
  FileSpreadsheet,
  Filter,
  Layers,
  Package,
  Plus,
  RotateCcw,
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

export interface MovimientoKardexInventario {
  id: string
  fecha: string
  comprobante: string
  concepto: string
  tipo: "ENTRADA" | "SALIDA" | "DEVOLUCION_COMPRA" | "DEVOLUCION_VENTA" | "AJUSTE"
  unidadesEntrada: number
  unidadesSalida: number
  unidadesSaldo: number
  costoUnitario: number
  debe: number
  haber: number
  saldo: number
}

export const STORAGE_KARDEX_INVENTARIO = "modulo-contable:kardex_inventario_v1"

export const ARTICULOS_KARDEX = [
  {
    codigo: "ART-001",
    nombre: "Mercaderías Generales para la Venta (Lote Central)",
    unidad: "Unidades",
    cuentaCodigo: "1104",
    cuentaNombre: "Inventario de mercadería",
    ubicacion: "Bodega Principal - Estante A-3",
    stockMinimo: 200,
    stockMaximo: 2500,
  },
  {
    codigo: "ART-002",
    nombre: "Suministros y Accesorios Comerciales",
    unidad: "Cajas",
    cuentaCodigo: "1104",
    cuentaNombre: "Inventario de mercadería",
    ubicacion: "Bodega Principal - Estante B-1",
    stockMinimo: 50,
    stockMaximo: 800,
  },
]

export const MOVIMIENTOS_KARDEX_DEFECTO: MovimientoKardexInventario[] = [
  {
    id: "k1",
    fecha: "2026-01-02",
    comprobante: "P-001 (Apertura)",
    concepto: "Inventario inicial de mercaderías para apertura de operaciones",
    tipo: "ENTRADA",
    unidadesEntrada: 1000,
    unidadesSalida: 0,
    unidadesSaldo: 1000,
    costoUnitario: 5.0,
    debe: 5000.0,
    haber: 0.0,
    saldo: 5000.0,
  },
  {
    id: "k2",
    fecha: "2026-01-05",
    comprobante: "CCF-1045",
    concepto: "Compra de mercadería al contado según factura comercial",
    tipo: "ENTRADA",
    unidadesEntrada: 800,
    unidadesSalida: 0,
    unidadesSaldo: 1800,
    costoUnitario: 5.0,
    debe: 4000.0,
    haber: 0.0,
    saldo: 9000.0,
  },
  {
    id: "k3",
    fecha: "2026-01-09",
    comprobante: "NC-102",
    concepto: "Devolución de mercadería dañada al proveedor según nota de crédito",
    tipo: "DEVOLUCION_COMPRA",
    unidadesEntrada: 0,
    unidadesSalida: 80,
    unidadesSaldo: 1720,
    costoUnitario: 5.0,
    debe: 0.0,
    haber: 400.0,
    saldo: 8600.0,
  },
  {
    id: "k4",
    fecha: "2026-01-12",
    comprobante: "FAC-1001",
    concepto: "Venta de mercaderías al contado (Despacho de almacén)",
    tipo: "SALIDA",
    unidadesEntrada: 0,
    unidadesSalida: 800,
    unidadesSaldo: 920,
    costoUnitario: 5.0,
    debe: 0.0,
    haber: 4000.0,
    saldo: 4600.0,
  },
  {
    id: "k5",
    fecha: "2026-01-15",
    comprobante: "NC-001",
    concepto: "Reingreso por devolución de cliente por especificaciones técnicas",
    tipo: "DEVOLUCION_VENTA",
    unidadesEntrada: 40,
    unidadesSalida: 0,
    unidadesSaldo: 960,
    costoUnitario: 5.0,
    debe: 200.0,
    haber: 0.0,
    saldo: 4800.0,
  },
  {
    id: "k6",
    fecha: "2026-12-31",
    comprobante: "TF-2026",
    concepto: "Ajuste e incorporación de inventario final según toma física de auditoría",
    tipo: "AJUSTE",
    unidadesEntrada: 340,
    unidadesSalida: 0,
    unidadesSaldo: 1300,
    costoUnitario: 5.0,
    debe: 1700.0,
    haber: 0.0,
    saldo: 6500.0,
  },
]

function recalcularKardexMovimientos(
  movs: {
    id: string
    fecha: string
    comprobante: string
    concepto: string
    tipo: "ENTRADA" | "SALIDA" | "DEVOLUCION_COMPRA" | "DEVOLUCION_VENTA" | "AJUSTE"
    unidadesEntrada: number
    unidadesSalida: number
    costoUnitario: number
  }[]
): MovimientoKardexInventario[] {
  let uSaldo = 0
  let mSaldo = 0

  return movs.map((m) => {
    let costoUnit = m.costoUnitario
    let debe = 0
    let haber = 0

    if (m.tipo === "ENTRADA" || m.tipo === "DEVOLUCION_VENTA") {
      uSaldo += m.unidadesEntrada
      debe = redondear(m.unidadesEntrada * costoUnit)
      mSaldo = redondear(mSaldo + debe)
    } else if (m.tipo === "SALIDA" || m.tipo === "DEVOLUCION_COMPRA") {
      if (uSaldo > 0 && mSaldo > 0) {
        costoUnit = redondear(mSaldo / uSaldo)
      }
      uSaldo -= m.unidadesSalida
      haber = redondear(m.unidadesSalida * costoUnit)
      mSaldo = redondear(mSaldo - haber)
    } else if (m.tipo === "AJUSTE") {
      if (m.unidadesEntrada > 0) {
        uSaldo += m.unidadesEntrada
        debe = redondear(m.unidadesEntrada * costoUnit)
        mSaldo = redondear(mSaldo + debe)
      } else {
        uSaldo -= m.unidadesSalida
        haber = redondear(m.unidadesSalida * costoUnit)
        mSaldo = redondear(mSaldo - haber)
      }
    }

    return {
      id: m.id,
      fecha: m.fecha,
      comprobante: m.comprobante,
      concepto: m.concepto,
      tipo: m.tipo,
      unidadesEntrada: m.unidadesEntrada,
      unidadesSalida: m.unidadesSalida,
      unidadesSaldo: Math.max(0, uSaldo),
      costoUnitario: costoUnit,
      debe,
      haber,
      saldo: redondear(mSaldo),
    }
  })
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

/**
 * Normaliza cadenas para búsqueda insensible a acentos, diacríticos y mayúsculas.
 */
function normalizar(texto: string): string {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

function KardexContent() {
  const { cuentas, asientos, ejercicioSeleccionado, mayor, tomaFisica } = useContabilidad()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const codigoParam = searchParams.get("codigo") || searchParams.get("cuenta")

  // Pestaña principal: "kardex_inventario" (Tarjeta con Entrada, Salida, Debe, Haber, Saldo) | "libro_auxiliar" (Cuentas)
  const [pestañaPrincipal, setPestañaPrincipal] = useState<"kardex_inventario" | "libro_auxiliar">(
    tabParam === "auxiliar" || codigoParam ? "libro_auxiliar" : "kardex_inventario"
  )

  // ----------------------------------------------------
  // ESTADO: TARJETA DE KARDEX DE INVENTARIOS
  // ----------------------------------------------------
  const [articuloId, setArticuloId] = useState<string>("ART-001")
  const [metodoValuacion, setMetodoValuacion] = useState<"PROMEDIO" | "PEPS">("PROMEDIO")
  const [movimientosKardex, setMovimientosKardex] = useState<MovimientoKardexInventario[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KARDEX_INVENTARIO)
        if (saved) return JSON.parse(saved)
      } catch {
        // fallback
      }
    }
    return MOVIMIENTOS_KARDEX_DEFECTO
  })

  const [modalNuevoMovimiento, setModalNuevoMovimiento] = useState(false)
  const [nuevoTipo, setNuevoTipo] = useState<"ENTRADA" | "SALIDA" | "DEVOLUCION_COMPRA" | "DEVOLUCION_VENTA" | "AJUSTE">("ENTRADA")
  const [nuevoFecha, setNuevoFecha] = useState(`${ejercicioSeleccionado}-01-20`)
  const [nuevoComprobante, setNuevoComprobante] = useState("")
  const [nuevoConcepto, setNuevoConcepto] = useState("")
  const [nuevoUnidades, setNuevoUnidades] = useState<string>("100")
  const [nuevoCosto, setNuevoCosto] = useState<string>("5.00")

  const guardarMovimientosKardex = useCallback((nuevos: MovimientoKardexInventario[]) => {
    setMovimientosKardex(nuevos)
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KARDEX_INVENTARIO, JSON.stringify(nuevos))
      } catch {
        // ignore
      }
    }
  }, [])

  const restablecerKardex = useCallback(() => {
    guardarMovimientosKardex(MOVIMIENTOS_KARDEX_DEFECTO)
  }, [guardarMovimientosKardex])

  const articuloActual = useMemo(() => {
    return ARTICULOS_KARDEX.find((a) => a.codigo === articuloId) || ARTICULOS_KARDEX[0]
  }, [articuloId])

  const totalesKardex = useMemo(() => {
    let entradas = 0
    let salidas = 0
    let debe = 0
    let haber = 0
    for (const m of movimientosKardex) {
      entradas += m.unidadesEntrada
      salidas += m.unidadesSalida
      debe += m.debe
      haber += m.haber
    }
    const ultimo = movimientosKardex[movimientosKardex.length - 1]
    const existenciaFinal = ultimo?.unidadesSaldo || 0
    const saldoFinal = ultimo?.saldo || 0
    const costoUnitarioMedio = existenciaFinal > 0 ? redondear(saldoFinal / existenciaFinal) : 0

    return {
      entradas,
      salidas,
      existenciaFinal,
      saldoUnidades: existenciaFinal,
      totalEntradas: entradas,
      totalSalidas: salidas,
      debe: redondear(debe),
      haber: redondear(haber),
      totalDebe: redondear(debe),
      totalHaber: redondear(haber),
      saldoFinal: redondear(saldoFinal),
      saldoValor: redondear(saldoFinal),
      costoUnitarioMedio,
      costoPromedioActual: costoUnitarioMedio,
    }
  }, [movimientosKardex])

  function agregarMovimientoKardex(e: React.FormEvent) {
    e.preventDefault()
    const u = Number(nuevoUnidades) || 0
    const c = Number(nuevoCosto) || 0
    if (u <= 0) return

    const esEntrada = nuevoTipo === "ENTRADA" || nuevoTipo === "DEVOLUCION_VENTA" || (nuevoTipo === "AJUSTE" && c > 0)
    const esSalida = nuevoTipo === "SALIDA" || nuevoTipo === "DEVOLUCION_COMPRA"

    const raw = [
      ...movimientosKardex.map((m) => ({
        id: m.id,
        fecha: m.fecha,
        comprobante: m.comprobante,
        concepto: m.concepto,
        tipo: m.tipo,
        unidadesEntrada: m.unidadesEntrada,
        unidadesSalida: m.unidadesSalida,
        costoUnitario: m.costoUnitario,
      })),
      {
        id: `k-${Date.now()}`,
        fecha: nuevoFecha,
        comprobante: nuevoComprobante.trim() || (esEntrada ? "CCF-PROV" : "FAC-CLI"),
        concepto: nuevoConcepto.trim() || (esEntrada ? "Ingreso de existencias a bodega" : "Despacho de existencias por venta"),
        tipo: nuevoTipo,
        unidadesEntrada: esEntrada ? u : 0,
        unidadesSalida: esSalida ? u : 0,
        costoUnitario: c,
      },
    ].sort((a, b) => a.fecha.localeCompare(b.fecha))

    const recalculados = recalcularKardexMovimientos(raw)
    guardarMovimientosKardex(recalculados)
    setModalNuevoMovimiento(false)
    setNuevoComprobante("")
    setNuevoConcepto("")
  }

  // ----------------------------------------------------
  // ESTADO: LIBRO AUXILIAR DE CUENTAS CONTABLES
  // ----------------------------------------------------
  const [codigoSeleccionado, setCodigoSeleccionado] = useState<string>(codigoParam || "1101")
  const [modoVista, setModoVista] = useState<"ficha" | "continuo">("ficha")
  const [busqueda, setBusqueda] = useState("")
  const [mesFiltro, setMesFiltro] = useState<string>("todos")
  const [soloConMovimientos, setSoloConMovimientos] = useState<boolean>(true)
  const [partidaDetalle, setPartidaDetalle] = useState<Asiento | null>(null)

  useEffect(() => {
    if (codigoParam && codigoParam !== codigoSeleccionado) {
      setCodigoSeleccionado(codigoParam)
      setPestañaPrincipal("libro_auxiliar")
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

  // Cuentas filtradas por texto de búsqueda (insensible a acentos/tildes y mayúsculas)
  const cuentasFiltradas = useMemo(() => {
    const q = normalizar(busqueda)
    if (!q) return cuentasNavegables
    return cuentasNavegables.filter((c) => {
      const codNorm = normalizar(c.codigo)
      const nomNorm = normalizar(c.nombre)
      return codNorm.includes(q) || nomNorm.includes(q)
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

  // Datos consolidados para Libro Auxiliar Continuo (Todas las cuentas con saldo o movimientos)
  const libroContinuoData = useMemo(() => {
    if (modoVista !== "continuo") return []

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

    const mesNum = mesFiltro !== "todos" ? Number(mesFiltro) : null

    return cuentasFiltradas.map((cuenta) => {
      let saldoAcumulado = 0
      let saldoInicial = 0
      const movs: MovimientoKardex[] = []

      for (const a of asientosDelEjercicio) {
        for (const linea of a.lineas) {
          if (linea.codigo === cuenta.codigo) {
            const debe = Number(linea.debe) || 0
            const haber = Number(linea.haber) || 0
            if (cuenta.naturaleza === "deudora") {
              saldoAcumulado = redondear(saldoAcumulado + debe - haber)
            } else {
              saldoAcumulado = redondear(saldoAcumulado + haber - debe)
            }

            const mItem: MovimientoKardex = {
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
            }

            if (mesNum !== null) {
              const mMes = new Date(a.fecha + "T00:00:00").getMonth() + 1
              if (mMes < mesNum) {
                saldoInicial = saldoAcumulado
              } else if (mMes === mesNum) {
                movs.push(mItem)
              }
            } else {
              movs.push(mItem)
            }
          }
        }
      }

      const totalDebe = redondear(movs.reduce((acc, m) => acc + m.debe, 0))
      const totalHaber = redondear(movs.reduce((acc, m) => acc + m.haber, 0))
      const saldoFinal = movs.length > 0 ? movs[movs.length - 1].saldo : saldoInicial

      return {
        cuenta,
        movimientos: movs,
        saldoInicial,
        totalDebe,
        totalHaber,
        saldoFinal,
      }
    }).filter((item) => item.movimientos.length > 0 || item.saldoInicial !== 0)
  }, [modoVista, asientos, ejercicioSeleccionado, mesFiltro, cuentasFiltradas])

  const totalesLibroContinuo = useMemo(() => {
    let debe = 0
    let haber = 0
    for (const item of libroContinuoData) {
      debe += item.totalDebe
      haber += item.totalHaber
    }
    return { debe: redondear(debe), haber: redondear(haber) }
  }, [libroContinuoData])

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
    if (pestañaPrincipal === "kardex_inventario") {
      const previousTitle = document.title
      document.title = `Tarjeta_Kardex_${articuloActual.codigo}_${ejercicioSeleccionado}`
      window.print()
      window.setTimeout(() => {
        document.title = previousTitle
      }, 500)
      return
    }

    const previousTitle = document.title
    document.title = modoVista === "continuo"
      ? `Libro_Auxiliar_General_Completo_${ejercicioSeleccionado}`
      : `Libro_Auxiliar_${cuentaActual?.codigo || "cuenta"}_${ejercicioSeleccionado}`
    window.print()
    window.setTimeout(() => {
      document.title = previousTitle
    }, 500)
  }

  function exportarExcel() {
    if (pestañaPrincipal === "kardex_inventario") {
      const filas: (string | number | null | undefined)[][] = [
        ["SISTEMA CONTABLE OFICIAL - TARJETA DE CONTROL DE INVENTARIOS (KARDEX)"],
        [`Ejercicio fiscal: ${ejercicioSeleccionado}`],
        [`Artículo: ${articuloActual.codigo} - ${articuloActual.nombre}`],
        [`Método de Valuación: Costo Promedio Ponderado (Art. 143 C.T.) · Unidad: ${articuloActual.unidad}`],
        [`Cuenta Contable: ${articuloActual.cuentaCodigo} - ${articuloActual.cuentaNombre}`],
        [`Ubicación: ${articuloActual.ubicacion}`],
        [`Fecha de emisión: ${new Date().toLocaleDateString("es-SV")}`],
        [],
        [
          "Fecha",
          "Comprobante / Ref",
          "Concepto / Detalle Operativo",
          "Entrada (Físico)",
          "Salida (Físico)",
          "Existencia (Saldo Físico)",
          "Costo Unitario ($)",
          "Debe (Entradas $)",
          "Haber (Salidas $)",
          "Saldo (Total $)",
        ],
      ]

      for (const m of movimientosKardex) {
        filas.push([
          m.fecha,
          m.comprobante,
          m.concepto,
          m.unidadesEntrada > 0 ? m.unidadesEntrada : "",
          m.unidadesSalida > 0 ? m.unidadesSalida : "",
          m.unidadesSaldo,
          m.costoUnitario,
          m.debe > 0 ? m.debe : "",
          m.haber > 0 ? m.haber : "",
          m.saldo,
        ])
      }

      filas.push([])
      filas.push([
        "TOTALES DE LA TARJETA DE KARDEX",
        "",
        "",
        totalesKardex.entradas,
        totalesKardex.salidas,
        totalesKardex.existenciaFinal,
        "",
        totalesKardex.debe,
        totalesKardex.haber,
        totalesKardex.saldoFinal,
      ])

      exportarLibroExcel(`Tarjeta_Kardex_${articuloActual.codigo}`, [
        {
          nombre: `Kardex ${articuloActual.codigo}`,
          filas,
        },
      ])
      return
    }

    if (modoVista === "continuo") {
      const hojas = libroContinuoData.map((item) => {
        const filas: (string | number | null | undefined)[][] = [
          ["SISTEMA CONTABLE OFICIAL - LIBRO AUXILIAR DE MAYOR"],
          [`Ejercicio fiscal: ${ejercicioSeleccionado}`],
          [`Cuenta: ${item.cuenta.codigo} - ${item.cuenta.nombre}`],
          [`Clasificación: ${item.cuenta.tipo.toUpperCase()} | Naturaleza: ${item.cuenta.naturaleza.toUpperCase()}`],
          [`Período reportado: ${MESES.find((m) => m.valor === mesFiltro)?.label || "Todo el año"}`],
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
            item.saldoInicial,
            item.saldoInicial >= 0 ? (item.cuenta.naturaleza === "deudora" ? "D" : "A") : (item.cuenta.naturaleza === "deudora" ? "A" : "D"),
          ])
        }

        for (const m of item.movimientos) {
          filas.push([
            m.fecha,
            m.partidaNumero,
            m.tipoPartida,
            m.referenciaDoc,
            m.concepto,
            m.debe > 0 ? m.debe : "",
            m.haber > 0 ? m.haber : "",
            m.saldo,
            m.saldo >= 0 ? (item.cuenta.naturaleza === "deudora" ? "D" : "A") : (item.cuenta.naturaleza === "deudora" ? "A" : "D"),
          ])
        }

        filas.push([])
        filas.push([
          "SUMAS DE LA CUENTA",
          "",
          "",
          "",
          "",
          item.totalDebe,
          item.totalHaber,
          item.saldoFinal,
          item.saldoFinal >= 0 ? (item.cuenta.naturaleza === "deudora" ? "D" : "A") : (item.cuenta.naturaleza === "deudora" ? "A" : "D"),
        ])

        return {
          nombre: `Aux ${item.cuenta.codigo}`,
          filas,
        }
      })

      exportarLibroExcel(`Libro_Auxiliar_General_${ejercicioSeleccionado}`, hojas)
      return
    }

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
              {pestañaPrincipal === "kardex_inventario"
                ? "Tarjeta de Control de Inventarios (Kardex Físico-Valorado)"
                : modoVista === "continuo"
                ? "Libro Auxiliar General de Mayor · Todas las Cuentas"
                : "Libro Auxiliar de Mayor · Folio Contable Individual"}
            </p>
          </div>
          <div className="text-right text-xs font-mono">
            <p><strong>Ciclo Fiscal:</strong> {ejercicioSeleccionado}</p>
            <p><strong>Fecha de Emisión:</strong> {new Date().toLocaleDateString("es-SV")}</p>
            <p><strong>Moneda:</strong> USD ($)</p>
          </div>
        </div>

        {pestañaPrincipal === "kardex_inventario" ? (
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-foreground/30 pt-2 font-mono">
            <div>
              <p><strong>Artículo:</strong> {articuloActual.codigo} — {articuloActual.nombre}</p>
              <p><strong>Ubicación:</strong> {articuloActual.ubicacion} · <strong>Unidad:</strong> {articuloActual.unidad}</p>
              <p><strong>Cuenta Mayor:</strong> {articuloActual.cuentaCodigo} — {articuloActual.cuentaNombre}</p>
            </div>
            <div className="text-right">
              <p><strong>Método de Valuación:</strong> Costo Promedio Ponderado (Art. 143 C.T.)</p>
              <p><strong>Existencia Final:</strong> {totalesKardex.saldoUnidades.toLocaleString()} {articuloActual.unidad.toLowerCase()}</p>
              <p><strong>Saldo Valorado en Libros:</strong> {formatoMoneda(totalesKardex.saldoValor)}</p>
            </div>
          </div>
        ) : (
          <>
            {modoVista === "ficha" && cuentaActual && (
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

            {modoVista === "continuo" && (
              <div className="mt-3 flex items-center justify-between text-xs border-t border-foreground/30 pt-2 font-mono">
                <p><strong>Período:</strong> {MESES.find((m) => m.valor === mesFiltro)?.label || "Todo el año fiscal"}</p>
                <p><strong>Cuentas reportadas:</strong> {libroContinuoData.length} cuentas con movimientos</p>
                <p><strong>Total Cargos:</strong> {formatoMoneda(totalesLibroContinuo.debe)} · <strong>Total Abonos:</strong> {formatoMoneda(totalesLibroContinuo.haber)}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* BARRA DE PESTAÑAS PRINCIPALES: KARDEX (INVENTARIO) VS LIBRO AUXILIAR (CUENTAS) */}
      <div className="flex border-b border-border gap-2 print:hidden">
        <button
          type="button"
          onClick={() => setPestañaPrincipal("kardex_inventario")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            pestañaPrincipal === "kardex_inventario"
              ? "border-primary text-primary bg-primary/5 rounded-t-lg"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-t-lg"
          }`}
        >
          <Boxes className="size-4" />
          <span>Tarjeta de Kardex (Inventario)</span>
          <Badge variant="muted" className="text-[10px] ml-1 px-1.5 py-0 font-normal">
            Físico-Valorado
          </Badge>
        </button>
        <button
          type="button"
          onClick={() => setPestañaPrincipal("libro_auxiliar")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            pestañaPrincipal === "libro_auxiliar"
              ? "border-primary text-primary bg-primary/5 rounded-t-lg"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-t-lg"
          }`}
        >
          <BookOpenText className="size-4" />
          <span>Libro Auxiliar (Cuentas Contables)</span>
          <Badge variant="muted" className="text-[10px] ml-1 px-1.5 py-0 font-normal">
            Folio de Mayor
          </Badge>
        </button>
      </div>

      {/* 2. CONTENIDO PRINCIPAL: KARDEX DE INVENTARIOS VS LIBRO AUXILIAR CONTABLE */}
      {pestañaPrincipal === "kardex_inventario" ? (
        <div className="space-y-4">
          {/* Header Web del Kardex */}
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3 print:hidden">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Tarjeta de Kardex
                </h1>
                <Badge variant="outline" className="text-xs font-mono">
                  Ciclo {ejercicioSeleccionado}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Valuación por Costo Promedio Ponderado
              </p>
            </div>

            <div className="flex items-center gap-2 print:hidden shrink-0">
              <Button
                type="button"
                size="sm"
                onClick={() => setModalNuevoMovimiento(true)}
                className="h-8 gap-1.5 text-xs shadow-xs"
              >
                <Plus className="size-3.5" />
                Registrar Movimiento
              </Button>
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
                className="h-8 gap-1.5 text-xs text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/20 shadow-xs"
              >
                <FileSpreadsheet className="size-3.5 text-emerald-600" />
                Excel
              </Button>
              <button
                type="button"
                onClick={restablecerKardex}
                title="Restablecer datos de demostración"
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                aria-label="Restablecer movimientos de demostración"
              >
                <RotateCcw className="size-3.5" />
              </button>
            </div>
          </header>

          {/* Selector de Artículo en Bodega */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-xl border border-border bg-card p-3 shadow-xs">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <span className="text-xs font-medium text-muted-foreground shrink-0">
                Artículo:
              </span>
              <select
                value={articuloId}
                onChange={(e) => setArticuloId(e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-3 py-1 text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-hidden max-w-md w-full"
              >
                {ARTICULOS_KARDEX.map((art) => (
                  <option key={art.codigo} value={art.codigo}>
                    {art.codigo} — {art.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0 flex-wrap">
              <span>Ubicación: <strong className="text-foreground font-medium">{articuloActual.ubicacion}</strong></span>
              <span>·</span>
              <span>Cuenta Mayor: <strong className="text-foreground font-medium">{articuloActual.cuentaCodigo} ({articuloActual.cuentaNombre})</strong></span>
              <span>·</span>
              <span>Unidad: <strong className="text-foreground font-medium">{articuloActual.unidad}</strong></span>
            </div>
          </div>

          {/* Resumen de Existencias y Valores */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
              <span className="text-[11px] text-muted-foreground block uppercase font-medium">Existencia Física</span>
              <div className="text-xl font-bold font-mono text-foreground mt-0.5">
                {totalesKardex.saldoUnidades.toLocaleString()} <span className="text-xs font-normal font-sans text-muted-foreground">{articuloActual.unidad.toLowerCase()}</span>
              </div>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                +{totalesKardex.totalEntradas} entradas · -{totalesKardex.totalSalidas} salidas
              </span>
            </div>

            <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
              <span className="text-[11px] text-muted-foreground block uppercase font-medium">Costo Promedio</span>
              <div className="text-xl font-bold font-mono text-foreground mt-0.5">
                {formatoMoneda(totalesKardex.costoPromedioActual)}
              </div>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                Por unidad física
              </span>
            </div>

            <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
              <span className="text-[11px] text-muted-foreground block uppercase font-medium">Saldo Valorado</span>
              <div className="text-xl font-bold font-mono text-foreground mt-0.5">
                {formatoMoneda(totalesKardex.saldoValor)}
              </div>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                Valor contable en inventarios
              </span>
            </div>

            <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
              <span className="text-[11px] text-muted-foreground block uppercase font-medium">Cuenta 1104 (Mayor)</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xl font-bold font-mono text-foreground">
                  {formatoMoneda(totalesKardex.saldoValor)}
                </span>
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  (Cuadrado)
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                Conciliado con inventario
              </span>
            </div>
          </div>

          {/* TABLA PRINCIPAL DEL KARDEX: 9 COLUMNAS CLÁSICAS */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  {/* Fila 1 de encabezado agrupado */}
                  <tr className="bg-muted/80 border-b border-border text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
                    <th rowSpan={2} className="py-2.5 px-3 border-r border-border/60">Fecha</th>
                    <th rowSpan={2} className="py-2.5 px-3 border-r border-border/60">Comprobante</th>
                    <th rowSpan={2} className="py-2.5 px-3 border-r border-border/60 min-w-[220px]">Concepto / Detalle Operativo</th>
                    <th colSpan={3} className="py-2 px-3 text-center border-r border-border/60 bg-muted/90 text-foreground font-semibold">
                      Control Físico (Cantidades)
                    </th>
                    <th rowSpan={2} className="py-2.5 px-3 text-right border-r border-border/60">Costo Unit.</th>
                    <th colSpan={3} className="py-2 px-3 text-center bg-muted/90 text-foreground font-semibold">
                      Control Valorado (Valores Monetarios en USD)
                    </th>
                  </tr>
                  {/* Fila 2 de sub-encabezados */}
                  <tr className="bg-muted/60 border-b border-border text-[10px] uppercase font-semibold text-muted-foreground">
                    <th className="py-1.5 px-3 text-right border-r border-border/40 text-emerald-700 dark:text-emerald-400">Entrada</th>
                    <th className="py-1.5 px-3 text-right border-r border-border/40 text-rose-700 dark:text-rose-400">Salida</th>
                    <th className="py-1.5 px-3 text-right border-r border-border/60 font-bold text-foreground">Existencia</th>
                    <th className="py-1.5 px-3 text-right border-r border-border/40 text-emerald-700 dark:text-emerald-400">Debe (+)</th>
                    <th className="py-1.5 px-3 text-right border-r border-border/40 text-rose-700 dark:text-rose-400">Haber (-)</th>
                    <th className="py-1.5 px-3 text-right font-bold text-foreground">Saldo ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-mono">
                  {movimientosKardex.map((m) => {
                    const esApertura = m.tipo === "AJUSTE" && m.comprobante.includes("APE")
                    const esDevolucion = m.tipo.startsWith("DEVOLUCION")
                    return (
                      <tr
                        key={m.id}
                        className={`hover:bg-muted/40 transition-colors ${
                          esApertura ? "bg-muted/20" : ""
                        }`}
                      >
                        <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">
                          {m.fecha}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap font-medium text-foreground">
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                            {m.comprobante}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-xs text-foreground min-w-[220px]">
                          <div className="flex items-center gap-1.5">
                            <span>{m.concepto}</span>
                            {esDevolucion && (
                              <Badge variant="outline" className="text-[9px] py-0 px-1 border-amber-500/50 text-amber-600 dark:text-amber-400">
                                Devolución
                              </Badge>
                            )}
                          </div>
                        </td>
                        {/* Unidades */}
                        <td className="py-2.5 px-3 text-right tabular-nums border-r border-border/40">
                          {m.unidadesEntrada > 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              +{m.unidadesEntrada.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums border-r border-border/40">
                          {m.unidadesSalida > 0 ? (
                            <span className="text-rose-600 dark:text-rose-400 font-semibold">
                              -{m.unidadesSalida.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-bold text-foreground border-r border-border/60 bg-muted/10">
                          {m.unidadesSaldo.toLocaleString()}
                        </td>
                        {/* Costo Unitario */}
                        <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground border-r border-border/60">
                          {formatoMoneda(m.costoUnitario)}
                        </td>
                        {/* Valores Monetarios */}
                        <td className="py-2.5 px-3 text-right tabular-nums border-r border-border/40">
                          {m.debe > 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {formatoMoneda(m.debe)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums border-r border-border/40">
                          {m.haber > 0 ? (
                            <span className="text-rose-600 dark:text-rose-400">
                              {formatoMoneda(m.haber)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-bold text-foreground bg-muted/10">
                          {formatoMoneda(m.saldo)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/50 font-mono text-xs font-bold">
                    <td colSpan={3} className="py-3 px-3 uppercase text-foreground font-sans">
                      Totales del Período / Saldo Final
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400 border-r border-border/40">
                      +{totalesKardex.totalEntradas.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-rose-600 dark:text-rose-400 border-r border-border/40">
                      -{totalesKardex.totalSalidas.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-foreground border-r border-border/60">
                      {totalesKardex.saldoUnidades.toLocaleString()} {articuloActual.unidad.toLowerCase()}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-muted-foreground border-r border-border/60">
                      {formatoMoneda(totalesKardex.costoPromedioActual)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400 border-r border-border/40">
                      {formatoMoneda(totalesKardex.totalDebe)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-rose-600 dark:text-rose-400 border-r border-border/40">
                      {formatoMoneda(totalesKardex.totalHaber)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-primary border-b-4 border-double border-primary text-sm font-extrabold">
                      {formatoMoneda(totalesKardex.saldoValor)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* 1. CABECERA WEB */}
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3 print:hidden">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight md:text-2xl text-foreground">
                Libro Auxiliar
              </h1>
          <Badge variant="outline" className="text-xs font-mono font-medium">
            Ciclo {ejercicioSeleccionado}
          </Badge>

          {/* Selector de Modo de Visualización */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs font-medium ml-1">
            <button
              type="button"
              onClick={() => setModoVista("ficha")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                modoVista === "ficha"
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileSpreadsheet className="size-3.5" />
              <span>Ficha Individual</span>
            </button>
            <button
              type="button"
              onClick={() => setModoVista("continuo")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                modoVista === "continuo"
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ClipboardList className="size-3.5" />
              <span>Libro Continuo (Todas)</span>
            </button>
          </div>
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
            Imprimir {modoVista === "continuo" ? "Libro Completo" : "Folio"}
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
          {/* Selector principal de cuenta (solo en modo ficha) */}
          {modoVista === "ficha" ? (
            <div className="flex flex-1 items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Cuenta:</span>
              <select
                className="flex h-9 w-full max-w-xl rounded-md border border-input bg-background px-3 py-1 text-sm font-medium shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={codigoSeleccionado}
                onChange={(e) => setCodigoSeleccionado(e.target.value)}
                aria-label="Seleccionar cuenta contable"
              >
                {!cuentasFiltradas.some((c) => c.codigo === codigoSeleccionado) && cuentaActual && (
                  <optgroup label="Cuenta actualmente abierta">
                    <option value={cuentaActual.codigo}>
                      {cuentaActual.codigo} — {cuentaActual.nombre} (Actual)
                    </option>
                  </optgroup>
                )}
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
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ClipboardList className="size-4 text-primary" />
              <span>Mostrando el Libro Auxiliar Continuo con todas las cuentas del ejercicio</span>
            </div>
          )}

          {/* Filtros: Búsqueda rápida, Filtro por Mes y Toggle de movimientos */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Buscador de texto */}
            <div className="relative w-full sm:w-56 shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar cuenta... (Enter)"
                value={busqueda}
                onChange={(e) => {
                  const val = e.target.value
                  setBusqueda(val)
                  const q = normalizar(val)
                  if (!q) return
                  const match = cuentasActivas.find(
                    (c) => normalizar(c.codigo) === q || normalizar(c.nombre) === q
                  )
                  if (match) {
                    setCodigoSeleccionado(match.codigo)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    if (cuentasFiltradas.length > 0) {
                      setCodigoSeleccionado(cuentasFiltradas[0].codigo)
                    }
                  }
                }}
                className="pl-8 pr-7 h-8 text-xs"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title="Limpiar búsqueda"
                >
                  <X className="size-3.5" />
                </button>
              )}
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

        {/* Accesos rápidos frecuentes (solo en modo ficha) */}
        {modoVista === "ficha" && (
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
        )}

        {/* Chips de coincidencia de búsqueda rápida al tipear */}
        {busqueda.trim() && cuentasFiltradas.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground px-1 pt-1">
            <span className="text-[11px] font-medium">Coincidencias ({cuentasFiltradas.length}):</span>
            {cuentasFiltradas.slice(0, 4).map((c) => (
              <button
                key={c.codigo}
                type="button"
                onClick={() => {
                  setCodigoSeleccionado(c.codigo)
                  if (modoVista !== "ficha") setModoVista("ficha")
                }}
                className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                  codigoSeleccionado === c.codigo
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "bg-muted hover:bg-muted/80 text-foreground"
                }`}
                title="Clic para seleccionar cuenta"
              >
                {c.codigo} {c.nombre}
              </button>
            ))}
            {cuentasFiltradas.length > 4 && (
              <span className="text-[10px] text-muted-foreground">+{cuentasFiltradas.length - 4} más</span>
            )}
            <span className="text-[11px] text-primary font-medium ml-1">· Pulsa Enter para abrir la primera</span>
          </div>
        )}
      </div>

      {modoVista === "ficha" ? (
        <>
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
        </>
      ) : (
        /* ======================================================== */
        /* 4. VISTA CONTINUA: TODAS LAS CUENTAS CON MOVIMIENTO     */
        /* ======================================================== */
        <div className="space-y-6">
          {/* Tarjeta resumen consolidado del libro */}
          <Card className="border-border bg-card shadow-xs print:hidden">
            <CardHeader className="py-2.5 px-4 bg-muted/20 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Libro Auxiliar General Consolidado · Ejercicio {ejercicioSeleccionado}
                </CardTitle>
                <Badge variant="outline" className="text-xs font-mono">
                  {libroContinuoData.length} cuentas con saldo o movimientos
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs text-center">
              <div className="rounded-lg border border-border/60 p-2.5 bg-background">
                <span className="text-muted-foreground text-[11px] block uppercase">Período</span>
                <span className="text-sm font-semibold text-foreground">
                  {MESES.find((m) => m.valor === mesFiltro)?.label || "Todo el año"}
                </span>
              </div>
              <div className="rounded-lg border border-border/60 p-2.5 bg-background">
                <span className="text-muted-foreground text-[11px] block uppercase">Total Cargos (Debe)</span>
                <span className="text-sm font-semibold font-mono text-foreground">
                  {formatoMoneda(totalesLibroContinuo.debe)}
                </span>
              </div>
              <div className="rounded-lg border border-border/60 p-2.5 bg-background">
                <span className="text-muted-foreground text-[11px] block uppercase">Total Abonos (Haber)</span>
                <span className="text-sm font-semibold font-mono text-foreground">
                  {formatoMoneda(totalesLibroContinuo.haber)}
                </span>
              </div>
              <div className="rounded-lg border border-border/60 p-2.5 bg-background">
                <span className="text-muted-foreground text-[11px] block uppercase">Cuadre Global</span>
                <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {totalesLibroContinuo.debe === totalesLibroContinuo.haber ? "Cuadrado (D == H)" : "Diferencia"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Listado secuencial de cada cuenta con su tabla de movimientos */}
          {libroContinuoData.length === 0 ? (
            <Card className="border-border shadow-xs p-12 text-center">
              <ClipboardList className="mx-auto size-9 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-semibold text-muted-foreground">
                No hay movimientos registrados en este período.
              </p>
            </Card>
          ) : (
            libroContinuoData.map(({ cuenta, movimientos: movs, saldoInicial, totalDebe: tDebe, totalHaber: tHaber, saldoFinal: sFinal }) => {
              const esAnomalo = sFinal < 0
              const tagNat = sFinal >= 0 ? (cuenta.naturaleza === "deudora" ? "D" : "A") : (cuenta.naturaleza === "deudora" ? "A" : "D")

              return (
                <div
                  key={cuenta.codigo}
                  className="rounded-xl border border-border bg-card shadow-xs overflow-hidden print:border print:border-foreground/30 print:shadow-none print:break-inside-avoid"
                >
                  {/* Cabecera de la cuenta */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 px-4 py-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs bg-background px-2 py-0.5 rounded border border-border">
                        {cuenta.codigo}
                      </span>
                      <h3 className="text-sm font-semibold text-foreground">
                        {cuenta.nombre}
                      </h3>
                      <span className="text-xs text-muted-foreground capitalize">
                        · {cuenta.tipo} ({cuenta.naturaleza})
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span className="text-muted-foreground">
                        Saldo Final: <strong className={esAnomalo ? "text-red-600" : "text-foreground"}>{formatoMoneda(Math.abs(sFinal))} ({tagNat})</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setCodigoSeleccionado(cuenta.codigo)
                          setModoVista("ficha")
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-sans text-primary hover:underline print:hidden"
                        title="Abrir en ficha individual"
                      >
                        <span>Ver Ficha</span>
                        <ArrowRight className="size-3" />
                      </button>
                    </div>
                  </div>

                  {/* Tabla de movimientos */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="border-b border-border bg-muted/20 text-muted-foreground uppercase font-semibold text-[10px]">
                        <tr>
                          <th className="py-2 px-3 whitespace-nowrap">Fecha</th>
                          <th className="py-2 px-2 text-center whitespace-nowrap">Partida</th>
                          <th className="py-2 px-2 whitespace-nowrap">Doc / Ref</th>
                          <th className="py-2 px-3">Concepto</th>
                          <th className="py-2 px-3 text-right whitespace-nowrap">Debe</th>
                          <th className="py-2 px-3 text-right whitespace-nowrap">Haber</th>
                          <th className="py-2 px-3 text-right whitespace-nowrap">Saldo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {mesFiltro !== "todos" && saldoInicial !== 0 && (
                          <tr className="bg-muted/20 italic text-muted-foreground">
                            <td className="py-1.5 px-3 font-mono">{`${ejercicioSeleccionado}-${mesFiltro.padStart(2, "0")}-01`}</td>
                            <td className="py-1.5 px-2 text-center font-mono">-</td>
                            <td className="py-1.5 px-2 font-mono text-[10px]">TRASLADO</td>
                            <td className="py-1.5 px-3">Saldo anterior acumulado trasladado</td>
                            <td className="py-1.5 px-3 text-right font-mono">-</td>
                            <td className="py-1.5 px-3 text-right font-mono">-</td>
                            <td className="py-1.5 px-3 text-right font-mono font-semibold">
                              {formatoMoneda(Math.abs(saldoInicial))}
                            </td>
                          </tr>
                        )}
                        {movs.map((m, mIdx) => (
                          <tr key={mIdx} className="hover:bg-muted/20">
                            <td className="py-1.5 px-3 font-mono text-muted-foreground whitespace-nowrap">{m.fecha}</td>
                            <td className="py-1.5 px-2 text-center whitespace-nowrap">
                              {m.asientoOriginal ? (
                                <button
                                  type="button"
                                  onClick={() => setPartidaDetalle(m.asientoOriginal!)}
                                  className="font-mono text-primary hover:underline"
                                >
                                  #{m.partidaNumero}
                                </button>
                              ) : (
                                <span className="font-mono text-muted-foreground">#{m.partidaNumero}</span>
                              )}
                            </td>
                            <td className="py-1.5 px-2 font-mono text-[10px] text-muted-foreground whitespace-nowrap">{m.referenciaDoc}</td>
                            <td className="py-1.5 px-3 text-foreground/90 max-w-sm truncate">{m.concepto}</td>
                            <td className="py-1.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                              {m.debe > 0 ? formatoMoneda(m.debe) : "-"}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                              {m.haber > 0 ? formatoMoneda(m.haber) : "-"}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono tabular-nums font-semibold whitespace-nowrap">
                              {formatoMoneda(Math.abs(m.saldo))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-border bg-muted/30 font-semibold text-[11px]">
                        <tr>
                          <td colSpan={4} className="py-2 px-3 uppercase text-muted-foreground">
                            Subtotal Cuenta {cuenta.codigo}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                            {formatoMoneda(tDebe)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                            {formatoMoneda(tHaber)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap">
                            {formatoMoneda(Math.abs(sFinal))} ({tagNat})
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )
            })
          )}

          {/* Gran Total del Libro Auxiliar al Final */}
          {libroContinuoData.length > 0 && (
            <div className="rounded-xl border-2 border-border bg-muted/40 p-4 font-mono shadow-xs text-xs flex flex-wrap items-center justify-between gap-4">
              <div className="font-sans">
                <span className="font-bold text-sm text-foreground block">
                  GRAN TOTAL DEL LIBRO AUXILIAR DE MAYOR
                </span>
                <span className="text-xs text-muted-foreground">
                  Suma acumulada de todas las cuentas analíticas en el período
                </span>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-xs font-sans text-muted-foreground block">Total Cargos</span>
                  <span className="font-bold text-foreground">{formatoMoneda(totalesLibroContinuo.debe)}</span>
                </div>
                <div>
                  <span className="text-xs font-sans text-muted-foreground block">Total Abonos</span>
                  <span className="font-bold text-foreground">{formatoMoneda(totalesLibroContinuo.haber)}</span>
                </div>
                <div>
                  <span className="text-xs font-sans text-muted-foreground block">Estado</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {totalesLibroContinuo.debe === totalesLibroContinuo.haber ? "CUADRADO (D == H)" : "DESCUADRADO"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
        </div>
      )}

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
      {/* 6. MODAL PARA REGISTRAR NUEVO MOVIMIENTO EN KARDEX       */}
      {/* ======================================================== */}
      {modalNuevoMovimiento && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setModalNuevoMovimiento(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-lg rounded-xl border border-border bg-card p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Package className="size-5 text-primary" />
                <h3 className="font-bold text-base text-foreground">
                  Registrar Movimiento en Kardex
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalNuevoMovimiento(false)}
                className="text-muted-foreground hover:text-foreground rounded-lg p-1"
                aria-label="Cerrar modal"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={agregarMovimientoKardex} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Tipo de Operación:</label>
                  <select
                    value={nuevoTipo}
                    onChange={(e) => {
                      const t = e.target.value as "ENTRADA" | "SALIDA" | "DEVOLUCION_COMPRA" | "DEVOLUCION_VENTA" | "AJUSTE"
                      setNuevoTipo(t)
                      if (t === "SALIDA") {
                        setNuevoCosto(totalesKardex.costoPromedioActual.toFixed(2))
                      }
                    }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-hidden"
                  >
                    <option value="ENTRADA">Entrada / Compra (CCF)</option>
                    <option value="SALIDA">Salida / Venta (Despacho)</option>
                    <option value="DEVOLUCION_COMPRA">Devolución sobre Compra</option>
                    <option value="DEVOLUCION_VENTA">Devolución sobre Venta</option>
                    <option value="AJUSTE">Ajuste por Toma Física / Merma</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-foreground">Fecha:</label>
                  <input
                    type="date"
                    value={nuevoFecha}
                    onChange={(e) => setNuevoFecha(e.target.value)}
                    required
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Comprobante / Referencia:</label>
                  <input
                    type="text"
                    placeholder="Ej. CCF-4091, FAC-102"
                    value={nuevoComprobante}
                    onChange={(e) => setNuevoComprobante(e.target.value)}
                    required
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-foreground">Unidades ({articuloActual.unidad}):</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={nuevoUnidades}
                    onChange={(e) => setNuevoUnidades(e.target.value)}
                    required
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-foreground">Concepto / Glosa:</label>
                <input
                  type="text"
                  placeholder="Detalle o descripción del movimiento"
                  value={nuevoConcepto}
                  onChange={(e) => setNuevoConcepto(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-foreground">
                    Costo Unitario ($):
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={nuevoCosto}
                    onChange={(e) => setNuevoCosto(e.target.value)}
                    disabled={nuevoTipo === "SALIDA"}
                    required
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono disabled:opacity-60 focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                  {nuevoTipo === "SALIDA" && (
                    <span className="text-[10px] text-muted-foreground block">
                      Valuado automáticamente al costo promedio ponderado ($
                      {totalesKardex.costoPromedioActual.toFixed(2)})
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-foreground">Total Valorado Estimado:</label>
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs font-mono font-bold text-foreground">
                    {formatoMoneda((Number(nuevoUnidades) || 0) * (Number(nuevoCosto) || 0))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalNuevoMovimiento(false)}
                  className="h-8 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                >
                  <CheckCircle2 className="size-3.5" />
                  Guardar en Kardex
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. PIE DE FIRMAS DE AUDITORÍA (IMPRESIÓN OFICIAL)        */}
      {/* ======================================================== */}
      <footer className="hidden border-t border-border pt-8 text-center text-xs text-muted-foreground print:block">
        <p className="font-semibold text-foreground">
          {pestañaPrincipal === "kardex_inventario"
            ? "Tarjeta de Control de Inventarios (Kardex Físico-Valorado) emitida oficialmente por el Sistema de Información Contable."
            : "Libro Auxiliar emitido oficialmente por el Sistema de Información Contable."}
        </p>
        <p className="mt-1">
          Certificación de saldos, existencias y operaciones según principios contables y normativa tributaria aplicable (Art. 143 C.T.).
        </p>
        <div className="mt-14 grid grid-cols-3 gap-10">
          <div className="border-t border-foreground/50 pt-2 font-medium">
            {pestañaPrincipal === "kardex_inventario" ? "Encargado de Bodega / Almacén" : "Elaboró (Auxiliar Contable)"}
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
