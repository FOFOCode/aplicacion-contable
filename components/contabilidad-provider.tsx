"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { CATALOGO_CUENTAS } from "@/lib/catalogo"
import {
  calcularBalanceGeneral,
  calcularEstadoResultados,
  calcularMayor,
} from "@/lib/contabilidad"
import type { Asiento, CierreContable, Cuenta } from "@/lib/types"

const STORAGE_ASIENTOS = "modulo-contable:asientos"
const STORAGE_CUENTAS = "modulo-contable:cuentas"
const STORAGE_CIERRES = "modulo-contable:cierres"

const ASIENTOS_EJEMPLO: Asiento[] = [
  {
    id: "a1",
    numero: 1,
    fecha: "2026-01-02",
    concepto: "Aportación inicial de los socios en efectivo y banco.",
    lineas: [
      { codigo: "1101", debe: 10000, haber: 0 },
      { codigo: "1102", debe: 5000, haber: 0 },
      { codigo: "3101", debe: 0, haber: 15000 },
    ],
  },
  {
    id: "a2",
    numero: 2,
    fecha: "2026-01-05",
    concepto: "Compra de mercadería al crédito fiscal, pagada con banco.",
    lineas: [
      { codigo: "1104", debe: 4000, haber: 0 },
      { codigo: "1105", debe: 520, haber: 0 },
      { codigo: "1102", debe: 0, haber: 4520 },
    ],
  },
  {
    id: "a3",
    numero: 3,
    fecha: "2026-01-12",
    concepto: "Venta de mercadería con IVA débito fiscal, cobrada en banco.",
    lineas: [
      { codigo: "1102", debe: 6780, haber: 0 },
      { codigo: "5101", debe: 0, haber: 6000 },
      { codigo: "2103", debe: 0, haber: 780 },
    ],
  },
  {
    id: "a4",
    numero: 4,
    fecha: "2026-01-12",
    concepto: "Registro del costo de la mercadería vendida.",
    lineas: [
      { codigo: "4101", debe: 3000, haber: 0 },
      { codigo: "1104", debe: 0, haber: 3000 },
    ],
  },
  {
    id: "a5",
    numero: 5,
    fecha: "2026-01-20",
    concepto: "Pago de gastos de administración con banco.",
    lineas: [
      { codigo: "4201", debe: 800, haber: 0 },
      { codigo: "1102", debe: 0, haber: 800 },
    ],
  },
]

interface ContabilidadContextValue {
  cuentas: Cuenta[]
  asientos: Asiento[]
  cierres: CierreContable[]
  dbConnected: boolean
  cargando: boolean
  agregarAsiento: (a: Omit<Asiento, "id" | "numero">) => void
  eliminarAsiento: (id: string) => void
  agregarCuenta: (c: Cuenta) => void
  renombrarCuenta: (codigo: string, nombre: string) => void
  /** Elimina una cuenta. Si tiene movimientos no se borra: se marca como eliminada (activa=false). */
  eliminarCuenta: (codigo: string) => { softDeleted: boolean }
  reactivarCuenta: (codigo: string) => void
  cuentaEnUso: (codigo: string) => boolean
  reiniciarEjemplo: () => void
  limpiarTodo: () => void
  cerrarCicloContable: () => void
  recargarCierres: () => Promise<void>
  mayor: ReturnType<typeof calcularMayor>
  estadoResultados: ReturnType<typeof calcularEstadoResultados>
  balanceGeneral: ReturnType<typeof calcularBalanceGeneral>
}

const ContabilidadContext = createContext<ContabilidadContextValue | null>(null)

export function ContabilidadProvider({ children }: { children: ReactNode }) {
  const [cuentas, setCuentas] = useState<Cuenta[]>(CATALOGO_CUENTAS)
  const [asientos, setAsientos] = useState<Asiento[]>(ASIENTOS_EJEMPLO)
  const [cierres, setCierres] = useState<CierreContable[]>([])
  const [hidratado, setHidratado] = useState(false)
  const [dbConnected, setDbConnected] = useState(false)
  const [cargando, setCargando] = useState(true)

  const recargarCierres = async () => {
    try {
      const res = await fetch("/api/cierres")
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) setCierres(data)
      }
    } catch (e) {
      console.error("Error al cargar cierres:", e)
    }
  }

  useEffect(() => {
    async function inicializar() {
      try {
        const resStatus = await fetch("/api/status").catch(() => null)
        const statusData = resStatus && resStatus.ok ? await resStatus.json() : null

        if (statusData?.connected) {
          setDbConnected(true)
          const [cRes, aRes, cierresRes] = await Promise.all([
            fetch("/api/cuentas"),
            fetch("/api/asientos"),
            fetch("/api/cierres").catch(() => null),
          ])
          if (cRes.ok && aRes.ok) {
            const dbCuentas = await cRes.json()
            const dbAsientos = await aRes.json()
            if (Array.isArray(dbCuentas) && dbCuentas.length > 0) {
              setCuentas(dbCuentas)
            }
            if (Array.isArray(dbAsientos)) {
              setAsientos(dbAsientos)
            }
          }
          if (cierresRes && cierresRes.ok) {
            const dbCierres = await cierresRes.json()
            if (Array.isArray(dbCierres)) {
              setCierres(dbCierres)
            }
          }
        } else {
          // Fallback a localStorage si la base de datos no está disponible
          setDbConnected(false)
          const rawA = localStorage.getItem(STORAGE_ASIENTOS)
          const rawC = localStorage.getItem(STORAGE_CUENTAS)
          const rawCierres = localStorage.getItem(STORAGE_CIERRES)
          if (rawA) setAsientos(JSON.parse(rawA))
          if (rawC) setCuentas(JSON.parse(rawC))
          if (rawCierres) setCierres(JSON.parse(rawCierres))
        }
      } catch {
        // En caso de error de red o timeout, usar fallback local
        setDbConnected(false)
        const rawA = localStorage.getItem(STORAGE_ASIENTOS)
        const rawC = localStorage.getItem(STORAGE_CUENTAS)
        const rawCierres = localStorage.getItem(STORAGE_CIERRES)
        if (rawA) setAsientos(JSON.parse(rawA))
        if (rawC) setCuentas(JSON.parse(rawC))
        if (rawCierres) setCierres(JSON.parse(rawCierres))
      } finally {
        setHidratado(true)
        setCargando(false)
      }
    }

    inicializar()
  }, [])

  useEffect(() => {
    if (!hidratado || dbConnected) return
    localStorage.setItem(STORAGE_ASIENTOS, JSON.stringify(asientos))
    localStorage.setItem(STORAGE_CUENTAS, JSON.stringify(cuentas))
    localStorage.setItem(STORAGE_CIERRES, JSON.stringify(cierres))
  }, [asientos, cuentas, cierres, hidratado, dbConnected])

  const agregarAsiento: ContabilidadContextValue["agregarAsiento"] = async (a) => {
    if (dbConnected) {
      try {
        const res = await fetch("/api/asientos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(a),
        })
        if (res.ok) {
          const { id, numero } = await res.json()
          setAsientos((prev) => [...prev, { ...a, id, numero }])
          return
        }
      } catch (e) {
        console.error("Error al guardar asiento en base de datos:", e)
      }
    }

    setAsientos((prev) => {
      const numero = prev.reduce((max, x) => Math.max(max, x.numero), 0) + 1
      return [...prev, { ...a, id: crypto.randomUUID(), numero }]
    })
  }

  const eliminarAsiento = async (id: string) => {
    if (dbConnected) {
      fetch(`/api/asientos/${id}`, { method: "DELETE" }).catch((e) =>
        console.error("Error al eliminar asiento en base de datos:", e)
      )
    }
    setAsientos((prev) => prev.filter((a) => a.id !== id))
  }

  const agregarCuenta = async (c: Cuenta) => {
    if (dbConnected) {
      fetch("/api/cuentas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
      }).catch((e) => console.error("Error al guardar cuenta en base de datos:", e))
    }
    setCuentas((prev) =>
      prev.some((x) => x.codigo === c.codigo)
        ? prev
        : [...prev, { ...c, activa: true }].sort((a, b) => a.codigo.localeCompare(b.codigo)),
    )
  }

  const cuentaEnUso = (codigo: string) =>
    asientos.some((a) => a.lineas.some((l) => l.codigo === codigo))

  const renombrarCuenta = async (codigo: string, nombre: string) => {
    if (dbConnected) {
      fetch(`/api/cuentas/${codigo}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre }),
      }).catch((e) => console.error("Error al renombrar cuenta en base de datos:", e))
    }
    setCuentas((prev) => prev.map((c) => (c.codigo === codigo ? { ...c, nombre } : c)))
  }

  const eliminarCuenta = (codigo: string) => {
    const enUso = asientos.some((a) => a.lineas.some((l) => l.codigo === codigo))
    if (dbConnected) {
      fetch(`/api/cuentas/${codigo}`, { method: "DELETE" }).catch((e) =>
        console.error("Error al eliminar cuenta en base de datos:", e)
      )
    }
    if (enUso) {
      setCuentas((prev) => prev.map((c) => (c.codigo === codigo ? { ...c, activa: false } : c)))
      return { softDeleted: true }
    }
    setCuentas((prev) => prev.filter((c) => c.codigo !== codigo))
    return { softDeleted: false }
  }

  const reactivarCuenta = async (codigo: string) => {
    if (dbConnected) {
      fetch(`/api/cuentas/${codigo}`, { method: "PATCH" }).catch((e) =>
        console.error("Error al reactivar cuenta en base de datos:", e)
      )
    }
    setCuentas((prev) => prev.map((c) => (c.codigo === codigo ? { ...c, activa: true } : c)))
  }

  const reiniciarEjemplo = () => {
    setCuentas(CATALOGO_CUENTAS)
    setAsientos(ASIENTOS_EJEMPLO)
  }

  const limpiarTodo = () => setAsientos([])

  const cerrarCicloContable = async () => {
    if (dbConnected) {
      try {
        const res = await fetch("/api/cierre", { method: "POST" })
        if (res.ok) {
          const [freshA, freshC] = await Promise.all([
            fetch("/api/asientos"),
            fetch("/api/cierres"),
          ])
          if (freshA.ok) setAsientos(await freshA.json())
          if (freshC.ok) setCierres(await freshC.json())
          return
        }
      } catch (e) {
        console.error("Error al invocar cierre contable en base de datos:", e)
      }
    }

    const m = calcularMayor(cuentas, asientos)
    const er = calcularEstadoResultados(m)
    const cuentaCapital =
      cuentas.find((cuenta) => cuenta.tipo === "capital" && cuenta.activa && cuenta.codigo === "3102") ||
      cuentas.find((cuenta) => cuenta.tipo === "capital" && cuenta.activa)

    if (!cuentaCapital) return

    const lineasCierre: Asiento["lineas"] = []
    // 1. Cancelar ingresos (cargos al Debe)
    for (const item of m.filter((s) => s.cuenta.tipo === "ingreso")) {
      const saldo = item.haber - item.debe
      if (saldo > 0) {
        lineasCierre.push({ codigo: item.cuenta.codigo, debe: saldo, haber: 0 })
      }
    }
    // 2. Cancelar gastos (abonos al Haber)
    for (const item of m.filter((s) => s.cuenta.tipo === "gasto")) {
      const saldo = item.debe - item.haber
      if (saldo > 0) {
        lineasCierre.push({ codigo: item.cuenta.codigo, debe: 0, haber: saldo })
      }
    }
    // 3. Imputar utilidad o pérdida a Capital
    if (er.utilidad > 0) {
      lineasCierre.push({ codigo: cuentaCapital.codigo, debe: 0, haber: er.utilidad })
    } else if (er.utilidad < 0) {
      lineasCierre.push({ codigo: cuentaCapital.codigo, debe: Math.abs(er.utilidad), haber: 0 })
    }

    if (lineasCierre.length === 0) return

    const nextNum = asientos.reduce((max, a) => Math.max(max, a.numero), 0) + 1
    const nuevoAsiento: Asiento = {
      id: crypto.randomUUID(),
      numero: nextNum,
      fecha: new Date().toISOString().slice(0, 10),
      concepto: "Asiento de liquidación y cierre del ejercicio contable",
      lineas: lineasCierre,
    }

    const nuevoCierre: CierreContable = {
      id: crypto.randomUUID(),
      ejercicio: new Date().getFullYear(),
      fecha_cierre: nuevoAsiento.fecha,
      concepto: nuevoAsiento.concepto,
      total_ingresos: er.totalIngresos,
      total_gastos: er.totalGastos,
      utilidad: er.utilidad,
      cuenta_capital_codigo: cuentaCapital.codigo,
      cuenta_capital_nombre: cuentaCapital.nombre,
      asiento_cierre_id: nuevoAsiento.id,
      asiento_numero: nuevoAsiento.numero,
      creado_en: new Date().toISOString(),
    }

    setAsientos((prev) => [...prev, nuevoAsiento])
    setCierres((prev) => [nuevoCierre, ...prev])
  }

  const mayor = useMemo(() => calcularMayor(cuentas, asientos), [cuentas, asientos])
  const estadoResultados = useMemo(() => calcularEstadoResultados(mayor), [mayor])
  const balanceGeneral = useMemo(
    () => calcularBalanceGeneral(mayor, estadoResultados.utilidad),
    [mayor, estadoResultados.utilidad],
  )

  const value: ContabilidadContextValue = {
    cuentas,
    asientos,
    cierres,
    dbConnected,
    cargando,
    agregarAsiento,
    eliminarAsiento,
    agregarCuenta,
    renombrarCuenta,
    eliminarCuenta,
    reactivarCuenta,
    cuentaEnUso,
    reiniciarEjemplo,
    limpiarTodo,
    cerrarCicloContable,
    recargarCierres,
    mayor,
    estadoResultados,
    balanceGeneral,
  }

  return <ContabilidadContext.Provider value={value}>{children}</ContabilidadContext.Provider>
}

export function useContabilidad() {
  const ctx = useContext(ContabilidadContext)
  if (!ctx) throw new Error("useContabilidad debe usarse dentro de ContabilidadProvider")
  return ctx
}
