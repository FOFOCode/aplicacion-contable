"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode, useCallback } from "react"
import { CATALOGO_CUENTAS } from "@/lib/catalogo"
import {
  calcularBalanceGeneral,
  calcularEstadoResultados,
  calcularMayor,
} from "@/lib/contabilidad"
import type { Asiento, CierreContable, Cuenta, EjercicioFiscal, InventarioTomaFisica } from "@/lib/types"

const STORAGE_ASIENTOS = "modulo-contable:asientos"
const STORAGE_CUENTAS = "modulo-contable:cuentas"
const STORAGE_CIERRES = "modulo-contable:cierres"
const STORAGE_EJERCICIO = "modulo-contable:ejercicio_seleccionado"
const STORAGE_TOMA = "modulo-contable:toma_fisica"

const EJERCICIOS_DEFECTO: EjercicioFiscal[] = [
  {
    ejercicio: 2026,
    fecha_inicio: "2026-01-01",
    fecha_fin: "2026-12-31",
    ultimo_numero: 7,
    estado: "ABIERTO",
  },
]

const TOMA_FISICA_DEFECTO: InventarioTomaFisica = {
  ejercicio: 2026,
  fecha_toma: "2026-12-31",
  valor_inventario_final: 6500.0,
  responsable: "Comité de Auditoría y Control de Inventarios",
  observaciones: "Toma física de existencias y conteo al cierre del ejercicio 2026 (Método Analítico)",
}

const ASIENTOS_EJEMPLO: Asiento[] = [
  {
    id: "a1",
    ejercicio: 2026,
    numero: 1,
    fecha: "2026-01-02",
    concepto: "Aportación inicial de los socios en efectivo, banco e inventario inicial de mercaderías.",
    tipo: "APERTURA",
    estado: "APLICADO",
    lineas: [
      { codigo: "1101", debe: 10000, haber: 0 },
      { codigo: "1102", debe: 5000, haber: 0 },
      { codigo: "1104", debe: 5000, haber: 0 },
      { codigo: "3101", debe: 0, haber: 20000 },
    ],
  },
  {
    id: "a2",
    ejercicio: 2026,
    numero: 2,
    fecha: "2026-01-05",
    concepto: "Compra de mercadería al contado según factura (Método Analítico).",
    tipo: "OPERACION",
    estado: "APLICADO",
    lineas: [
      { codigo: "4101", debe: 4000, haber: 0 },
      { codigo: "1105", debe: 520, haber: 0 },
      { codigo: "1102", debe: 0, haber: 4520 },
    ],
  },
  {
    id: "a3",
    ejercicio: 2026,
    numero: 3,
    fecha: "2026-01-07",
    concepto: "Pago de fletes y transporte de mercadería comprada (Método Analítico).",
    tipo: "OPERACION",
    estado: "APLICADO",
    lineas: [
      { codigo: "4102", debe: 300, haber: 0 },
      { codigo: "1105", debe: 39, haber: 0 },
      { codigo: "1101", debe: 0, haber: 339 },
    ],
  },
  {
    id: "a4",
    ejercicio: 2026,
    numero: 4,
    fecha: "2026-01-09",
    concepto: "Devolución de mercadería dañada al proveedor según nota de crédito (Método Analítico).",
    tipo: "OPERACION",
    estado: "APLICADO",
    lineas: [
      { codigo: "1102", debe: 452, haber: 0 },
      { codigo: "5102", debe: 0, haber: 400 },
      { codigo: "1105", debe: 0, haber: 52 },
    ],
  },
  {
    id: "a5",
    ejercicio: 2026,
    numero: 5,
    fecha: "2026-01-12",
    concepto: "Venta de mercaderías al contado con IVA débito fiscal (Método Analítico).",
    tipo: "OPERACION",
    estado: "APLICADO",
    lineas: [
      { codigo: "1102", debe: 9040, haber: 0 },
      { codigo: "5101", debe: 0, haber: 8000 },
      { codigo: "2103", debe: 0, haber: 1040 },
    ],
  },
  {
    id: "a6",
    ejercicio: 2026,
    numero: 6,
    fecha: "2026-01-15",
    concepto: "Cliente devuelve mercadería por no cumplir especificaciones técnicas (Método Analítico).",
    tipo: "OPERACION",
    estado: "APLICADO",
    lineas: [
      { codigo: "4103", debe: 500, haber: 0 },
      { codigo: "2103", debe: 65, haber: 0 },
      { codigo: "1102", debe: 0, haber: 565 },
    ],
  },
  {
    id: "a7",
    ejercicio: 2026,
    numero: 7,
    fecha: "2026-01-20",
    concepto: "Pago de servicios contables y gastos administrativos con cheque.",
    tipo: "OPERACION",
    estado: "APLICADO",
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
  ejercicios: EjercicioFiscal[]
  ejercicioSeleccionado: number
  setEjercicioSeleccionado: (e: number) => void
  ejercicioActual: EjercicioFiscal | undefined
  esEjercicioCerrado: boolean
  tomaFisica: InventarioTomaFisica | null
  guardarTomaFisica: (toma: Partial<InventarioTomaFisica>) => Promise<boolean>
  cambiarEstadoEjercicio: (ejercicio: number, nuevoEstado: "ABIERTO" | "CERRADO" | "BLOQUEADO") => Promise<boolean>
  crearEjercicio: (ejercicio: number) => Promise<boolean>
  generarPartidaApertura: (origen: number, destino: number) => Promise<{ success: boolean; error?: string }>
  dbConnected: boolean
  cargando: boolean
  agregarAsiento: (a: Omit<Asiento, "id" | "numero">) => Promise<{ success: boolean; error?: string }>
  eliminarAsiento: (id: string, motivo?: string) => Promise<void>
  anularAsiento: (id: string, motivo?: string) => Promise<{ success: boolean; error?: string }>
  agregarCuenta: (c: Cuenta) => Promise<void>
  renombrarCuenta: (codigo: string, nombre: string) => Promise<void>
  eliminarCuenta: (codigo: string) => { softDeleted: boolean }
  reactivarCuenta: (codigo: string) => Promise<void>
  cuentaEnUso: (codigo: string) => boolean
  reiniciarEjemplo: () => void
  limpiarTodo: () => void
  cerrarCicloContable: (opciones?: { aperturarSiguiente?: boolean }) => Promise<{ success: boolean; error?: string; [key: string]: any } | void>
  recargarCierres: () => Promise<void>
  recargarAsientos: () => Promise<void>
  recargarTodo: () => Promise<void>
  mayor: ReturnType<typeof calcularMayor>
  estadoResultados: ReturnType<typeof calcularEstadoResultados>
  balanceGeneral: ReturnType<typeof calcularBalanceGeneral>
}

const ContabilidadContext = createContext<ContabilidadContextValue | null>(null)

export function ContabilidadProvider({ children }: { children: ReactNode }) {
  const [cuentas, setCuentas] = useState<Cuenta[]>(CATALOGO_CUENTAS)
  const [asientos, setAsientos] = useState<Asiento[]>(ASIENTOS_EJEMPLO)
  const [cierres, setCierres] = useState<CierreContable[]>([])
  const [ejercicios, setEjercicios] = useState<EjercicioFiscal[]>(EJERCICIOS_DEFECTO)
  const [ejercicioSeleccionado, setEjercicioSeleccionadoState] = useState<number>(2026)
  const [tomaFisica, setTomaFisica] = useState<InventarioTomaFisica | null>(TOMA_FISICA_DEFECTO)
  const [reporteAnaliticoSql, setReporteAnaliticoSql] = useState<Record<string, unknown> | null>(null)
  const [hidratado, setHidratado] = useState(false)
  const [dbConnected, setDbConnected] = useState(false)
  const [cargando, setCargando] = useState(true)

  const ejercicioActual = useMemo(() => {
    return ejercicios.find((e) => e.ejercicio === ejercicioSeleccionado) || {
      ejercicio: ejercicioSeleccionado,
      fecha_inicio: `${ejercicioSeleccionado}-01-01`,
      fecha_fin: `${ejercicioSeleccionado}-12-31`,
      ultimo_numero: 0,
      estado: "ABIERTO" as const,
    }
  }, [ejercicios, ejercicioSeleccionado])

  const esEjercicioCerrado = useMemo(() => {
    return ejercicioActual.estado !== "ABIERTO"
  }, [ejercicioActual])

  const setEjercicioSeleccionado = (ej: number) => {
    setEjercicioSeleccionadoState(ej)
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_EJERCICIO, ej.toString())
    }
  }

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

  const recargarAsientos = useCallback(async () => {
    if (!dbConnected) return
    try {
      const res = await fetch(`/api/asientos?ejercicio=${ejercicioSeleccionado}`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) setAsientos(data)
      }
    } catch (e) {
      console.error("Error al recargar asientos:", e)
    }
  }, [dbConnected, ejercicioSeleccionado])

  const recargarTodo = useCallback(async () => {
    await Promise.all([recargarAsientos(), recargarCierres()])
  }, [recargarAsientos, recargarCierres])

  const recargarTomaFisica = useCallback(async (ej: number) => {
    if (!dbConnected) return
    try {
      const res = await fetch(`/api/inventario?ejercicio=${ej}`)
      if (res.ok) {
        const data = await res.json()
        if (data && data.existe) {
          setTomaFisica(data)
        } else {
          setTomaFisica({
            ejercicio: ej,
            fecha_toma: `${ej}-12-31`,
            valor_inventario_final: 0,
            responsable: "",
            observaciones: "",
          })
        }
      }
    } catch (e) {
      console.error("Error al cargar toma física de inventarios:", e)
    }
  }, [dbConnected])

  const recargarReporteAnaliticoSql = useCallback(async (ej: number) => {
    if (!dbConnected) return
    try {
      const res = await fetch(`/api/reportes/analitico?ejercicio=${ej}`)
      if (res.ok) {
        const data = await res.json()
        setReporteAnaliticoSql(data)
      } else {
        setReporteAnaliticoSql(null)
      }
    } catch {
      setReporteAnaliticoSql(null)
    }
  }, [dbConnected])

  // Carga inicial sincronizada con la base de datos
  useEffect(() => {
    async function inicializar() {
      try {
        const resStatus = await fetch("/api/status").catch(() => null)
        const statusData = resStatus && resStatus.ok ? await resStatus.json() : null

        if (statusData?.connected) {
          setDbConnected(true)
          const [cRes, ejRes, cierresRes] = await Promise.all([
            fetch("/api/cuentas"),
            fetch("/api/ejercicios").catch(() => null),
            fetch("/api/cierres").catch(() => null),
          ])

          if (cRes.ok) {
            const dbCuentas = await cRes.json()
            if (Array.isArray(dbCuentas) && dbCuentas.length > 0) {
              setCuentas(dbCuentas)
            }
          }

          let ejActivo = 2026
          if (ejRes && ejRes.ok) {
            const dbEjercicios = await ejRes.json()
            if (Array.isArray(dbEjercicios) && dbEjercicios.length > 0) {
              setEjercicios(dbEjercicios)
              // Seleccionar el ejercicio guardado en localStorage o el primer ejercicio abierto
              const guardado = typeof window !== "undefined" ? localStorage.getItem(STORAGE_EJERCICIO) : null
              const parsedGuardado = guardado ? parseInt(guardado, 10) : null
              const encontrado = dbEjercicios.find((x: EjercicioFiscal) => x.ejercicio === parsedGuardado)
              if (encontrado) {
                ejActivo = encontrado.ejercicio
              } else {
                const abierto = dbEjercicios.find((x: EjercicioFiscal) => x.estado === "ABIERTO")
                ejActivo = abierto ? abierto.ejercicio : dbEjercicios[0].ejercicio
              }
              setEjercicioSeleccionadoState(ejActivo)
            }
          }

          // Cargar asientos, toma física y cálculo analítico SQL para el ejercicio seleccionado
          const [aRes, invRes, repSqlRes] = await Promise.all([
            fetch(`/api/asientos?ejercicio=${ejActivo}`),
            fetch(`/api/inventario?ejercicio=${ejActivo}`).catch(() => null),
            fetch(`/api/reportes/analitico?ejercicio=${ejActivo}`).catch(() => null),
          ])

          if (aRes.ok) {
            const dbAsientos = await aRes.json()
            if (Array.isArray(dbAsientos)) setAsientos(dbAsientos)
          }

          if (invRes && invRes.ok) {
            const dbToma = await invRes.json()
            if (dbToma && dbToma.existe) setTomaFisica(dbToma)
          }

          if (repSqlRes && repSqlRes.ok) {
            const repData = await repSqlRes.json()
            setReporteAnaliticoSql(repData)
          }

          if (cierresRes && cierresRes.ok) {
            const dbCierres = await cierresRes.json()
            if (Array.isArray(dbCierres)) setCierres(dbCierres)
          }
        } else {
          // Fallback a localStorage si la base de datos no está disponible
          setDbConnected(false)
          const rawA = localStorage.getItem(STORAGE_ASIENTOS)
          const rawC = localStorage.getItem(STORAGE_CUENTAS)
          const rawCierres = localStorage.getItem(STORAGE_CIERRES)
          const rawToma = localStorage.getItem(STORAGE_TOMA)
          if (rawA) setAsientos(JSON.parse(rawA))
          if (rawC) setCuentas(JSON.parse(rawC))
          if (rawCierres) setCierres(JSON.parse(rawCierres))
          if (rawToma) setTomaFisica(JSON.parse(rawToma))
        }
      } catch (err) {
        console.error("Error durante inicialización contable:", err)
        setDbConnected(false)
      } finally {
        setHidratado(true)
        setCargando(false)
      }
    }

    inicializar()
  }, [])

  // Al cambiar de ejercicio fiscal, sincronizar asientos, toma física y reporte SQL
  useEffect(() => {
    if (!hidratado) return
    if (dbConnected) {
      recargarAsientos()
      recargarTomaFisica(ejercicioSeleccionado)
      recargarReporteAnaliticoSql(ejercicioSeleccionado)
    }
  }, [ejercicioSeleccionado, dbConnected, hidratado, recargarAsientos, recargarTomaFisica, recargarReporteAnaliticoSql])

  // Persistir en local storage si no hay base de datos conectada
  useEffect(() => {
    if (!hidratado || dbConnected) return
    localStorage.setItem(STORAGE_ASIENTOS, JSON.stringify(asientos))
    localStorage.setItem(STORAGE_CUENTAS, JSON.stringify(cuentas))
    localStorage.setItem(STORAGE_CIERRES, JSON.stringify(cierres))
    if (tomaFisica) localStorage.setItem(STORAGE_TOMA, JSON.stringify(tomaFisica))
  }, [asientos, cuentas, cierres, tomaFisica, hidratado, dbConnected])

  const guardarTomaFisica = async (toma: Partial<InventarioTomaFisica>): Promise<boolean> => {
    const nuevaToma: InventarioTomaFisica = {
      ejercicio: toma.ejercicio || ejercicioSeleccionado,
      fecha_toma: toma.fecha_toma || new Date().toISOString().slice(0, 10),
      valor_inventario_final: Number(toma.valor_inventario_final) || 0,
      responsable: toma.responsable || "Auditoría Interna",
      observaciones: toma.observaciones || "Toma física de existencias",
    }

    if (dbConnected) {
      try {
        const res = await fetch("/api/inventario", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nuevaToma),
        })
        if (res.ok) {
          const guardada = await res.json()
          setTomaFisica(guardada)
          await recargarReporteAnaliticoSql(nuevaToma.ejercicio)
          return true
        }
        return false
      } catch (e) {
        console.error("Error al guardar toma física en base de datos:", e)
        return false
      }
    }

    setTomaFisica(nuevaToma)
    return true
  }

  const cambiarEstadoEjercicio = async (
    ejercicio: number,
    nuevoEstado: "ABIERTO" | "CERRADO" | "BLOQUEADO"
  ): Promise<boolean> => {
    if (dbConnected) {
      try {
        const res = await fetch("/api/ejercicios", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ejercicio, estado: nuevoEstado }),
        })
        if (res.ok) {
          const actualizado = await res.json()
          setEjercicios((prev) =>
            prev.map((e) => (e.ejercicio === ejercicio ? { ...e, ...actualizado } : e))
          )
          return true
        }
        return false
      } catch (e) {
        console.error("Error al actualizar ejercicio:", e)
        return false
      }
    }

    setEjercicios((prev) =>
      prev.map((e) => (e.ejercicio === ejercicio ? { ...e, estado: nuevoEstado } : e))
    )
    return true
  }

  const crearEjercicio = async (ejercicio: number): Promise<boolean> => {
    if (dbConnected) {
      try {
        const res = await fetch("/api/ejercicios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ejercicio }),
        })
        if (res.ok) {
          const nuevo = await res.json()
          setEjercicios((prev) => [nuevo, ...prev.filter((e) => e.ejercicio !== ejercicio)])
          setEjercicioSeleccionado(ejercicio)
          return true
        }
        return false
      } catch (e) {
        console.error("Error al crear ejercicio:", e)
        return false
      }
    }

    const nuevo: EjercicioFiscal = {
      ejercicio,
      fecha_inicio: `${ejercicio}-01-01`,
      fecha_fin: `${ejercicio}-12-31`,
      ultimo_numero: 0,
      estado: "ABIERTO",
    }
    setEjercicios((prev) => [nuevo, ...prev.filter((e) => e.ejercicio !== ejercicio)])
    setEjercicioSeleccionado(ejercicio)
    return true
  }

  const generarPartidaApertura = async (
    origen: number,
    destino: number
  ): Promise<{ success: boolean; error?: string }> => {
    if (!dbConnected) {
      return { success: false, error: "La generación de apertura requiere conexión activa a la base de datos." }
    }
    try {
      const res = await fetch("/api/ejercicios/apertura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ejercicio_origen: origen, ejercicio_destino: destino }),
      })
      if (res.ok) {
        const ejRes = await fetch("/api/ejercicios")
        if (ejRes.ok) {
          setEjercicios(await ejRes.json())
        }
        setEjercicioSeleccionado(destino)
        return { success: true }
      }
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.error || "Error al generar partida de apertura" }
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : "Error inesperado de red" }
    }
  }

  const agregarAsiento = async (a: Omit<Asiento, "id" | "numero">): Promise<{ success: boolean; error?: string }> => {
    if (esEjercicioCerrado) {
      return { success: false, error: `El ejercicio fiscal ${ejercicioSeleccionado} está CERRADO o BLOQUEADO. No se admiten nuevas partidas.` }
    }

    if (dbConnected) {
      try {
        const res = await fetch("/api/asientos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...a, usuario_email: "admin@contable.sv" }),
        })
        if (res.ok) {
          await recargarAsientos()
          await recargarReporteAnaliticoSql(ejercicioSeleccionado)
          return { success: true }
        }
        const errJson = await res.json().catch(() => null)
        return { success: false, error: errJson?.error || "Error al registrar asiento" }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error al guardar asiento en base de datos"
        return { success: false, error: msg }
      }
    }

    setAsientos((prev) => {
      const ej = a.fecha ? new Date(a.fecha).getFullYear() : ejercicioSeleccionado
      const asientosDelAnio = prev.filter(
        (x) => (x.ejercicio || (x.fecha ? new Date(x.fecha).getFullYear() : ej)) === ej
      )
      const numero = asientosDelAnio.reduce((max, x) => Math.max(max, x.numero), 0) + 1
      const correlativo_global = prev.reduce((max, x) => Math.max(max, x.correlativo_global || 0), 0) + 1
      return [
        {
          ...a,
          id: crypto.randomUUID(),
          correlativo_global,
          ejercicio: ej,
          numero,
          estado: "APLICADO",
        },
        ...prev,
      ]
    })
    return { success: true }
  }

  const anularAsiento = async (
    id: string,
    motivo: string = "Anulación contable por corrección/auditoría"
  ): Promise<{ success: boolean; error?: string }> => {
    if (esEjercicioCerrado) {
      return { success: false, error: `No es posible anular partidas en el ejercicio fiscal ${ejercicioSeleccionado} porque está CERRADO o BLOQUEADO.` }
    }

    if (dbConnected) {
      try {
        const res = await fetch(`/api/asientos/${id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivo, usuario_email: "admin@contable.sv" }),
        })
        if (res.ok) {
          await recargarAsientos()
          await recargarReporteAnaliticoSql(ejercicioSeleccionado)
          return { success: true }
        }
        const errJson = await res.json().catch(() => null)
        return { success: false, error: errJson?.error || "Error al anular partida" }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error al anular partida en base de datos"
        return { success: false, error: msg }
      }
    }

    // En memoria / localStorage: Marcar como ANULADO preservando los renglones (sin DELETE en cascada)
    setAsientos((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              estado: "ANULADO",
              anulado_en: new Date().toISOString(),
              motivo_anulacion: motivo,
            }
          : a
      )
    )
    return { success: true }
  }

  const eliminarAsiento = async (id: string, motivo?: string) => {
    await anularAsiento(id, motivo)
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
    setTomaFisica(TOMA_FISICA_DEFECTO)
  }

  const limpiarTodo = () => setAsientos([])

  const cerrarCicloContable = async (opciones?: { aperturarSiguiente?: boolean }) => {
    if (dbConnected) {
      try {
        const res = await fetch("/api/cierre", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ejercicio: ejercicioSeleccionado,
            aperturar_siguiente: Boolean(opciones?.aperturarSiguiente),
          }),
        })
        if (res.ok) {
          const data = await res.json()
          const ejRes = await fetch("/api/ejercicios")
          if (ejRes.ok) {
            const list = await ejRes.json()
            setEjercicios(list)
          }
          if (opciones?.aperturarSiguiente && data.siguienteEjercicio) {
            setEjercicioSeleccionado(data.siguienteEjercicio)
          } else {
            await Promise.all([
              recargarAsientos(),
              recargarCierres(),
              recargarReporteAnaliticoSql(ejercicioSeleccionado),
            ])
          }
          return { success: true, ...data }
        } else {
          const err = await res.json().catch(() => ({}))
          return { success: false, error: err.error || "Error al liquidar ejercicio" }
        }
      } catch (e) {
        console.error("Error al invocar cierre contable en base de datos:", e)
        return { success: false, error: "Error de red o conexión" }
      }
    }

    // Modo local / Fallback
    const m = calcularMayor(cuentas, asientos, ejercicioSeleccionado, false)
    const er = calcularEstadoResultados(m, tomaFisica?.valor_inventario_final)
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
      ejercicio: ejercicioSeleccionado,
      numero: nextNum,
      fecha: new Date().toISOString().slice(0, 10),
      concepto: "Asiento de liquidación y cierre del ejercicio contable",
      tipo: "CIERRE",
      estado: "APLICADO",
      lineas: lineasCierre,
    }

    const nuevoCierre: CierreContable = {
      id: crypto.randomUUID(),
      ejercicio: ejercicioSeleccionado,
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

  // Cálculos contables sincronizados con aislamiento de ejercicio y exclusión de partida de cierre
  const mayor = useMemo(
    () => calcularMayor(cuentas, asientos, ejercicioSeleccionado, false),
    [cuentas, asientos, ejercicioSeleccionado]
  )

  const estadoResultados = useMemo(() => {
    const baseEr = calcularEstadoResultados(
      mayor,
      tomaFisica?.valor_inventario_final,
      tomaFisica ? { fecha: tomaFisica.fecha_toma, responsable: tomaFisica.responsable } : undefined
    )

    if (
      dbConnected &&
      reporteAnaliticoSql &&
      Number(reporteAnaliticoSql.ejercicio) === ejercicioSeleccionado
    ) {
      const sql = reporteAnaliticoSql as {
        ejercicio: number
        ventasTotales: number
        devolucionesSobreVentas: number
        rebajasSobreVentas: number
        ventasNetas: number
        inventarioInicial: number
        compras: number
        gastosSobreCompras: number
        comprasTotales: number
        devolucionesSobreCompras: number
        rebajasSobreCompras: number
        comprasNetas: number
        totalMercancias: number
        inventarioFinal: number
        fechaInventarioFinal: string | null
        costoVentas: number
        utilidadBruta: number
        gastosOperacion: number
        utilidadOperacion: number
        productosFinancieros: number
        gastosFinancieros: number
        otrosIngresos: number
        utilidadNeta: number
      }

      return {
        ...baseEr,
        calculadoPorSql: true,
        totalVentas: sql.ventasNetas,
        totalCostoVentas: sql.costoVentas,
        utilidadBruta: sql.utilidadBruta,
        totalGastosOperacion: sql.gastosOperacion,
        utilidadOperacion: sql.utilidadOperacion,
        totalIngresosFinancieros: sql.productosFinancieros || 0,
        totalGastosFinancieros: sql.gastosFinancieros || 0,
        resultadoFinanciero: (sql.productosFinancieros || 0) - (sql.gastosFinancieros || 0),
        totalIngresos: sql.ventasNetas + (sql.productosFinancieros || 0) + (sql.otrosIngresos || 0),
        totalGastos: sql.costoVentas + sql.gastosOperacion + (sql.gastosFinancieros || 0),
        utilidad: sql.utilidadNeta,
        analitico: {
          ventasTotales: sql.ventasTotales,
          devolucionesSobreVentas: sql.devolucionesSobreVentas,
          rebajasSobreVentas: sql.rebajasSobreVentas,
          ventasNetas: sql.ventasNetas,
          inventarioInicial: sql.inventarioInicial,
          compras: sql.compras,
          gastosSobreCompras: sql.gastosSobreCompras,
          comprasTotales: sql.comprasTotales,
          devolucionesSobreCompras: sql.devolucionesSobreCompras,
          rebajasSobreCompras: sql.rebajasSobreCompras,
          comprasNetas: sql.comprasNetas,
          totalMercancias: sql.totalMercancias,
          inventarioFinalEstimado: sql.inventarioFinal,
          valorInventarioFinal: sql.inventarioFinal,
          fechaInventarioFinal: sql.fechaInventarioFinal || baseEr.analitico.fechaInventarioFinal,
          responsableInventarioFinal: baseEr.analitico.responsableInventarioFinal,
          costoVentas: sql.costoVentas,
          utilidadBruta: sql.utilidadBruta,
          gastosOperacion: sql.gastosOperacion,
          utilidadOperacion: sql.utilidadOperacion,
          totalIngresosFinancieros: sql.productosFinancieros || 0,
          totalGastosFinancieros: sql.gastosFinancieros || 0,
          otrosIngresos: sql.otrosIngresos || 0,
          utilidadNeta: sql.utilidadNeta,
        },
      }
    }

    return {
      ...baseEr,
      calculadoPorSql: false,
    }
  }, [mayor, tomaFisica, dbConnected, reporteAnaliticoSql, ejercicioSeleccionado])

  const balanceGeneral = useMemo(
    () =>
      calcularBalanceGeneral(
        mayor,
        estadoResultados.utilidad,
        estadoResultados.analitico.valorInventarioFinal
      ),
    [mayor, estadoResultados.utilidad, estadoResultados.analitico.valorInventarioFinal]
  )

  const value: ContabilidadContextValue = {
    cuentas,
    asientos,
    cierres,
    ejercicios,
    ejercicioSeleccionado,
    setEjercicioSeleccionado,
    ejercicioActual,
    esEjercicioCerrado,
    tomaFisica,
    guardarTomaFisica,
    cambiarEstadoEjercicio,
    crearEjercicio,
    generarPartidaApertura,
    dbConnected,
    cargando,
    agregarAsiento,
    eliminarAsiento,
    anularAsiento,
    agregarCuenta,
    renombrarCuenta,
    eliminarCuenta,
    reactivarCuenta,
    cuentaEnUso,
    reiniciarEjemplo,
    limpiarTodo,
    cerrarCicloContable,
    recargarCierres,
    recargarAsientos,
    recargarTodo,
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
