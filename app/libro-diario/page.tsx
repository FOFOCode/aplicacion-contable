"use client"

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react"
import {
  FolderOpen,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Calendar,
  Lock,
  Unlock,
  Printer,
  BookOpen,
  Layers,
  Clock,
  ShieldCheck,
  AlertTriangle,
  X,
  FileCheck,
  Pencil,
  FileDown,
  Table,
  Sliders,
  Zap,
  ArrowDownLeft,
  ArrowUpRight,
  HelpCircle,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input, Label } from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"
import { useContabilidad } from "@/components/contabilidad-provider"
import type { Cuenta } from "@/lib/types"
import {
  formatoMoneda,
  redondear,
  formatearCuentaJerarquica,
  calcularDesgloseIVA,
  esCuentaSujetaAIVA,
} from "@/lib/contabilidad"
import {
  inferirImputacion,
  calcularAutoBalance,
  normalizarNaturaleza,
  type OperacionContable,
} from "@/lib/asientoInferenceEngine"
import { HistorialFoliosDrawer } from "@/components/contabilidad/HistorialFoliosDrawer"
import { CuentaCombobox } from "@/components/contabilidad/CuentaCombobox"
import { CapturaAsistida } from "@/components/captura-asistida"
import { useContableKeyboard } from "@/hooks/useContableKeyboard"
import { exportarFolioPDF, exportarFolioCSV } from "@/lib/exportFolio"
import { cn } from "@/lib/utils"
import type { AsientoLinea } from "@/lib/types"

interface LineaCaptura {
  key: string
  codigo: string
  monto: number | ""
  operacion: "AUMENTA" | "DISMINUYE"
  debeDirecto?: number | ""
  haberDirecto?: number | ""
}

interface FolioHoyData {
  estado: "NO_INICIADO" | "ABIERTO" | "CERRADO"
  folio: {
    id: string
    ejercicio: number
    numero_folio: number
    fecha: string
    estado: "ABIERTO" | "CERRADO"
    total_debe: number
    total_haber: number
    cerrado_en?: string | null
    cerrado_por?: string | null
    cantidad_partidas: number
  } | null
  partidas: Array<{
    id: string
    correlativo_global?: number
    ejercicio: number
    numero: number
    fecha: string
    concepto: string
    tipo?: string
    estado?: string
    documento_soporte?: string
    folio_diario_id?: string
    anulado_en?: string
    motivo_anulacion?: string
    lineas: Array<{
      codigo: string
      debe: number
      haber: number
    }>
  }>
  totales: {
    totalDebe: number
    totalHaber: number
    diferencia: number
    cuadrado: boolean
    partidasCuadradas: number
    totalPartidas: number
  }
}

type ModoCaptura = "SMART" | "CLASICO"

const GLOSAS_RAPIDAS = [
  "Compra de mercadería al contado según factura (Sistema Analítico)",
  "Venta de mercaderías al contado con IVA débito fiscal",
  "Pago de fletes y transporte de mercadería adquirida",
  "Devolución de mercadería a proveedor",
  "Pago de servicios públicos del periodo",
  "Abono de cliente recibido en transferencia bancaria",
]

export default function LibroDiarioPage() {
  const { cuentas, recargarAsientos, recargarReporteAnaliticoSql, ejercicioSeleccionado } = useContabilidad()

  // Refresca asientos y el Estado de Resultados (reporte analítico SQL) tras cualquier cambio
  const recargarDatosDespuesDeCambio = useCallback(async () => {
    await Promise.all([recargarAsientos(), recargarReporteAnaliticoSql(ejercicioSeleccionado)])
  }, [recargarAsientos, recargarReporteAnaliticoSql, ejercicioSeleccionado])

  // Estado del Folio Diario
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  )
  const [datosFolio, setDatosFolio] = useState<FolioHoyData | null>(null)
  const [cargandoFolio, setCargandoFolio] = useState<boolean>(true)
  const [iniciandoFolio, setIniciandoFolio] = useState<boolean>(false)
  const [isHistorialOpen, setIsHistorialOpen] = useState<boolean>(false)

  // Estado del Formulario de Captura
  const [modoCaptura, setModoCaptura] = useState<ModoCaptura>("SMART")
  const [concepto, setConcepto] = useState<string>("")
  const [documentoSoporte, setDocumentoSoporte] = useState<string>("")
  const [tipoPartida, setTipoPartida] = useState<string>("OPERACION")
  const [lineas, setLineas] = useState<LineaCaptura[]>([
    { key: "1", codigo: "", monto: "", operacion: "AUMENTA", debeDirecto: "", haberDirecto: "" },
    { key: "2", codigo: "", monto: "", operacion: "AUMENTA", debeDirecto: "", haberDirecto: "" },
  ])
  const [guardandoPartida, setGuardandoPartida] = useState<boolean>(false)
  const [partidaEnEdicion, setPartidaEnEdicion] = useState<{
    id: string
    numero: number
  } | null>(null)

  // Modales
  const [modalCierreOpen, setModalCierreOpen] = useState(false)
  const [cerrandoFolio, setCerrandoFolio] = useState(false)
  const [modalReabrirOpen, setModalReabrirOpen] = useState(false)
  const [motivoReapertura, setMotivoReapertura] = useState("")
  const [reabriendoFolio, setReabriendoFolio] = useState(false)
  const [mostrarAsistentePlantillas, setMostrarAsistentePlantillas] = useState(false)

  // Notificaciones
  const [notificacion, setNotificacion] = useState<{
    tipo: "exito" | "error"
    mensaje: string
  } | null>(null)

  // Carga del Folio según la fecha seleccionada
  const cargarFolioFecha = useCallback(async (fecha: string) => {
    setCargandoFolio(true)
    try {
      const res = await fetch(`/api/folios/hoy?fecha=${fecha}`, { cache: "no-store" })
      if (!res.ok) throw new Error("Error al obtener estado del folio")
      const data: FolioHoyData = await res.json()
      setDatosFolio(data)
    } catch (err: unknown) {
      console.error(err)
      setNotificacion({
        tipo: "error",
        mensaje: "Error de conexión al cargar el folio diario.",
      })
    } finally {
      setCargandoFolio(false)
    }
  }, [])

  useEffect(() => {
    cargarFolioFecha(fechaSeleccionada)
  }, [fechaSeleccionada, cargarFolioFecha])

  // Iniciar Folio de Hoy
  const handleIniciarFolio = async () => {
    setIniciandoFolio(true)
    setNotificacion(null)
    try {
      const res = await fetch("/api/folios/iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha: fechaSeleccionada }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "No se pudo iniciar el folio diario")
      }
      setNotificacion({
        tipo: "exito",
        mensaje: `Folio diario para el día ${fechaSeleccionada} aperturado exitosamente.`,
      })
      await cargarFolioFecha(fechaSeleccionada)
      await recargarDatosDespuesDeCambio()
    } catch (e: unknown) {
      setNotificacion({
        tipo: "error",
        mensaje: e instanceof Error ? e.message : "Error al iniciar folio",
      })
    } finally {
      setIniciandoFolio(false)
    }
  }

  // Cerrar Folio
  const handleCerrarFolio = async () => {
    if (!datosFolio?.folio?.id) return
    setCerrandoFolio(true)
    setNotificacion(null)
    try {
      const res = await fetch("/api/folios/cerrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folio_id: datosFolio.folio.id,
          cerrado_por: "CONTADOR_GENERAL",
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "No se pudo cerrar el folio")
      }
      const data = await res.json()
      setNotificacion({
        tipo: "exito",
        mensaje: `¡Jornada cerrada exitosamente! Folio N° ${data.folio?.numero_folio} sellado e inmutable.`,
      })
      setModalCierreOpen(false)
      await cargarFolioFecha(fechaSeleccionada)
      await recargarDatosDespuesDeCambio()
    } catch (e: unknown) {
      setNotificacion({
        tipo: "error",
        mensaje: e instanceof Error ? e.message : "Error al cerrar folio",
      })
    } finally {
      setCerrandoFolio(false)
    }
  }

  // Reapertura de Folio
  const handleReabrirFolio = async () => {
    if (!datosFolio?.folio?.id) return
    if (!motivoReapertura.trim()) {
      setNotificacion({
        tipo: "error",
        mensaje: "Debe ingresar una justificación obligatoria para la reapertura.",
      })
      return
    }
    setReabriendoFolio(true)
    setNotificacion(null)
    try {
      const res = await fetch("/api/folios/reabrir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folio_id: datosFolio.folio.id,
          motivo: motivoReapertura.trim(),
          autorizado_por: "AUDITOR_CONTABLE",
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "No se pudo reabrir el folio")
      }
      setNotificacion({
        tipo: "exito",
        mensaje: "Folio reabierto exitosamente para modificaciones autorizadas.",
      })
      setModalReabrirOpen(false)
      setMotivoReapertura("")
      await cargarFolioFecha(fechaSeleccionada)
      await recargarDatosDespuesDeCambio()
    } catch (e: unknown) {
      setNotificacion({
        tipo: "error",
        mensaje: e instanceof Error ? e.message : "Error al reabrir folio",
      })
    } finally {
      setReabriendoFolio(false)
    }
  }

  // Atajos rápidos de fecha
  const handleSetHoy = () => {
    setFechaSeleccionada(new Date().toISOString().slice(0, 10))
  }

  const handleSetAyer = () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    setFechaSeleccionada(d.toISOString().slice(0, 10))
  }

  // Cuentas map
  const cuentasMap = useMemo(() => {
    const map = new Map<string, Cuenta>()
    cuentas.forEach((c) => map.set(c.codigo, c))
    return map
  }, [cuentas])

  const getNombreCuenta = useCallback(
    (codigo: string) => {
      const c = cuentasMap.get(codigo)
      if (!c) return "Cuenta desconocida"
      return formatearCuentaJerarquica(c, cuentasMap).textoCompleto
    },
    [cuentasMap],
  )

  // Procesamiento de líneas de captura
  const lineasProcesadas = useMemo(() => {
    return lineas.map((linea) => {
      const c = cuentasMap.get(linea.codigo)
      let debe = 0
      let haber = 0
      let razon = ""

      if (modoCaptura === "CLASICO") {
        debe = Number(linea.debeDirecto) || 0
        haber = Number(linea.haberDirecto) || 0
        razon = "Entrada manual directa"
      } else {
        const montoNum = Number(linea.monto) || 0
        if (c && montoNum > 0) {
          const resultado = inferirImputacion(c, montoNum, linea.operacion)
          debe = resultado.debe
          haber = resultado.haber
          razon = resultado.explicacion
        }
      }

      return {
        ...linea,
        cuenta: c,
        debe,
        haber,
        razon,
        cuentaValida: !!c,
      }
    })
  }, [lineas, cuentasMap, modoCaptura])

  // Totales de la partida en curso
  const totalesPartidaEnCurso = useMemo(() => {
    let tDebe = 0
    let tHaber = 0
    lineasProcesadas.forEach((l) => {
      tDebe += l.debe
      tHaber += l.haber
    })
    const tDebeRed = redondear(tDebe)
    const tHaberRed = redondear(tHaber)
    const diff = redondear(Math.abs(tDebeRed - tHaberRed))
    return {
      totalDebe: tDebeRed,
      totalHaber: tHaberRed,
      diferencia: diff,
      cuadrado: diff === 0 && tDebeRed > 0,
      diferenciaConSigno: redondear(tDebeRed - tHaberRed),
    }
  }, [lineasProcesadas])

  // Modificar línea
  const handleUpdateLinea = (key: string, patch: Partial<LineaCaptura>) => {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  // Agregar nueva línea
  const handleAddLinea = useCallback(() => {
    const newKey = String(Date.now() + Math.random())
    setLineas((prev) => [
      ...prev,
      {
        key: newKey,
        codigo: "",
        monto: "",
        operacion: "AUMENTA",
        debeDirecto: "",
        haberDirecto: "",
      },
    ])
  }, [])

  // Eliminar línea
  const handleRemoveLinea = (key: string) => {
    if (lineas.length <= 2) {
      setNotificacion({
        tipo: "error",
        mensaje: "Una partida contable requiere como mínimo 2 renglones.",
      })
      return
    }
    setLineas((prev) => prev.filter((l) => l.key !== key))
  }

  // Auto-cuadrar partida con cálculo matemático exacto
  const handleAutoCuadrar = useCallback(() => {
    if (lineas.length < 2) return

    // 1. Detectar el renglón objetivo a auto-balancear:
    // Si hay algún renglón sin monto ingresado, usamos ese; de lo contrario, el último renglón.
    let targetIndex = lineas.length - 1
    const emptyIdx = lineas.findIndex((l) => {
      if (modoCaptura === "CLASICO") {
        return (l.debeDirecto === "" || l.debeDirecto === undefined) && (l.haberDirecto === "" || l.haberDirecto === undefined)
      } else {
        return l.monto === "" || l.monto === undefined || l.monto === 0
      }
    })
    if (emptyIdx !== -1) {
      targetIndex = emptyIdx
    }

    // 2. Sumar Debe y Haber de TODOS los demás renglones (excluyendo el renglón objetivo)
    let sumaDebeOtros = 0
    let sumaHaberOtros = 0

    lineasProcesadas.forEach((l, idx) => {
      if (idx !== targetIndex) {
        sumaDebeOtros += l.debe
        sumaHaberOtros += l.haber
      }
    })

    sumaDebeOtros = redondear(sumaDebeOtros)
    sumaHaberOtros = redondear(sumaHaberOtros)
    const diff = redondear(sumaDebeOtros - sumaHaberOtros)

    if (diff === 0 && sumaDebeOtros > 0) {
      setNotificacion({ tipo: "exito", mensaje: "La partida ya se encuentra perfectamente cuadrada." })
      return
    }

    const targetLinea = lineas[targetIndex]
    const faltante = Math.abs(diff)

    if (modoCaptura === "CLASICO") {
      if (diff > 0) {
        // Debe > Haber: la partida requiere abono al Haber
        const cuenta = cuentasMap.get(targetLinea.codigo)
        const nat = normalizarNaturaleza(cuenta?.naturaleza || "deudora")
        const op: "AUMENTA" | "DISMINUYE" = nat === "acreedora" ? "AUMENTA" : "DISMINUYE"
        handleUpdateLinea(targetLinea.key, {
          haberDirecto: faltante,
          debeDirecto: "",
          monto: faltante,
          operacion: op,
        })
      } else {
        // Haber > Debe: la partida requiere cargo al Debe
        const cuenta = cuentasMap.get(targetLinea.codigo)
        const nat = normalizarNaturaleza(cuenta?.naturaleza || "deudora")
        const op: "AUMENTA" | "DISMINUYE" = nat === "deudora" ? "AUMENTA" : "DISMINUYE"
        handleUpdateLinea(targetLinea.key, {
          debeDirecto: faltante,
          haberDirecto: "",
          monto: faltante,
          operacion: op,
        })
      }
    } else {
      // Modo Smart (+/-): Deducir operación (+ Aumenta / - Disminuye) según la naturaleza contable
      const cuenta = cuentasMap.get(targetLinea.codigo)
      const nat = normalizarNaturaleza(cuenta?.naturaleza || "deudora")

      if (diff > 0) {
        // Necesitamos saldo al HABER:
        // Cuenta Acreedora al Aumentar (+) genera Haber
        // Cuenta Deudora al Disminuir (-) genera Haber
        const op: "AUMENTA" | "DISMINUYE" = nat === "acreedora" ? "AUMENTA" : "DISMINUYE"
        handleUpdateLinea(targetLinea.key, {
          monto: faltante,
          operacion: op,
          haberDirecto: faltante,
          debeDirecto: "",
        })
      } else {
        // Necesitamos saldo al DEBE:
        // Cuenta Deudora al Aumentar (+) genera Debe
        // Cuenta Acreedora al Disminuir (-) genera Debe
        const op: "AUMENTA" | "DISMINUYE" = nat === "deudora" ? "AUMENTA" : "DISMINUYE"
        handleUpdateLinea(targetLinea.key, {
          monto: faltante,
          operacion: op,
          debeDirecto: faltante,
          haberDirecto: "",
        })
      }
    }

    setNotificacion({
      tipo: "exito",
      mensaje: `Renglón #${targetIndex + 1} auto-balanceado con ${formatoMoneda(faltante)}. Partida cuadrada.`,
    })
  }, [lineas, lineasProcesadas, modoCaptura, cuentasMap])

  // Desglose automático de IVA 13% para Compras, Activo Fijo (cómputo, carros, etc.) y Ventas
  // Fórmula: Base = $X / 1.13 -> IVA = Base * 0.13
  // Disminuye el renglón origen al monto neto y agrega/actualiza la cuenta de IVA correspondiente
  const handleDesglosarIVA = useCallback(
    (lineaKey: string, forzar = false, codigoOverride?: string) => {
      setLineas((prevLineas) => {
        const targetIndex = prevLineas.findIndex((l) => l.key === lineaKey)
        if (targetIndex === -1) return prevLineas

        const targetLinea = prevLineas[targetIndex]
        const codigo = codigoOverride || targetLinea.codigo
        const infoIva = esCuentaSujetaAIVA(codigo)
        if (!infoIva.esSujeta) return prevLineas

        // Obtener el importe bruto ingresado en la línea
        let montoBruto = 0
        if (modoCaptura === "CLASICO") {
          montoBruto =
            Number(targetLinea.debeDirecto) ||
            Number(targetLinea.haberDirecto) ||
            0
        } else {
          montoBruto = Number(targetLinea.monto) || 0
        }

        if (montoBruto <= 0) return prevLineas

        // Verificar si la línea ya fue desglosada previamente para no aplicar / 1.13 en bucle
        const ivaIndex = prevLineas.findIndex(
          (l, idx) => idx !== targetIndex && l.codigo === infoIva.cuentaIvaCodigo,
        )

        if (!forzar && ivaIndex !== -1) {
          const lineaIva = prevLineas[ivaIndex]
          const ivaActual =
            modoCaptura === "CLASICO"
              ? Number(lineaIva.debeDirecto) || Number(lineaIva.haberDirecto) || 0
              : Number(lineaIva.monto) || 0

          // Si el IVA actual coincide exactamente con montoBruto * 0.13 (+- $0.02),
          // significa que montoBruto YA es la base neta y el IVA ya está extraído.
          if (Math.abs(redondear(montoBruto * 0.13) - ivaActual) <= 0.02) {
            return prevLineas
          }
        }

        // Aplicar cálculo exacto:
        // Base = $X / 1.13 -> IVA = Base * 0.13
        const { base, iva, total } = calcularDesgloseIVA(montoBruto)
        const updated = [...prevLineas]
        const esCompraOActivo = infoIva.tipo === "COMPRA"

        // 1. Ajustar la línea de compra/activo/venta al monto neto (disminuido en el monto del IVA)
        // Mantener sincronizados AMBOS formatos (Smart y Clásico)
        updated[targetIndex] = {
          ...targetLinea,
          codigo,
          monto: base,
          operacion: "AUMENTA",
          debeDirecto: esCompraOActivo ? base : "",
          haberDirecto: esCompraOActivo ? "" : base,
        }

        // 2. Insertar o actualizar la línea de IVA correspondiente (1105 o 2103)
        if (ivaIndex !== -1) {
          updated[ivaIndex] = {
            ...updated[ivaIndex],
            codigo: infoIva.cuentaIvaCodigo,
            monto: iva,
            operacion: "AUMENTA",
            debeDirecto: esCompraOActivo ? iva : "",
            haberDirecto: esCompraOActivo ? "" : iva,
          }
        } else {
          // Si la línea siguiente está vacía, usarla; si no, insertar una nueva línea inmediatamente después
          const nextIdx = targetIndex + 1
          const nextLinea = updated[nextIdx]
          const nextEsVacia =
            nextLinea &&
            !nextLinea.codigo &&
            (!nextLinea.monto || nextLinea.monto === 0) &&
            (!nextLinea.debeDirecto || nextLinea.debeDirecto === 0) &&
            (!nextLinea.haberDirecto || nextLinea.haberDirecto === 0)

          const nuevaLineaIva: LineaCaptura = {
            key: nextEsVacia ? nextLinea.key : String(Date.now() + Math.random()),
            codigo: infoIva.cuentaIvaCodigo,
            monto: iva,
            operacion: "AUMENTA",
            debeDirecto: esCompraOActivo ? iva : "",
            haberDirecto: esCompraOActivo ? "" : iva,
          }

          if (nextEsVacia) {
            updated[nextIdx] = nuevaLineaIva
          } else {
            updated.splice(nextIdx, 0, nuevaLineaIva)
          }
        }

        // 3. Si no hay renglones vacíos disponibles para la contrapartida (Caja/Bancos), agregar uno
        // En compras/activos: se pagará salida de dinero (Caja/Banco DISMINUYE -> Haber)
        // En ventas: se cobrará entrada de dinero (Caja/Banco AUMENTA -> Debe)
        const hayRenglonVacio = updated.some(
          (l) => !l.codigo && !l.monto && !l.debeDirecto && !l.haberDirecto,
        )
        if (!hayRenglonVacio) {
          updated.push({
            key: String(Date.now() + Math.random() + 1),
            codigo: "",
            monto: "",
            operacion: esCompraOActivo ? "DISMINUYE" : "AUMENTA",
            debeDirecto: "",
            haberDirecto: "",
          })
        }

        setTimeout(() => {
          setNotificacion({
            tipo: "exito",
            mensaje: `⚡ IVA 13% calculado automáticamente: Total ${formatoMoneda(total)} desglosado en Base ${formatoMoneda(base)} + ${infoIva.cuentaIvaNombre} ${formatoMoneda(iva)}.`,
          })
        }, 50)

        return updated
      })
    },
    [modoCaptura],
  )

  // Agregar IVA 13% sobre base neta (Comprobante de Crédito Fiscal - CCF)
  // Mantiene intacta la base ingresada y agrega/actualiza la cuenta de IVA correspondiente
  const handleAgregarIVA_Neto = useCallback(
    (lineaKey: string, codigoOverride?: string) => {
      setLineas((prevLineas) => {
        const targetIndex = prevLineas.findIndex((l) => l.key === lineaKey)
        if (targetIndex === -1) return prevLineas

        const targetLinea = prevLineas[targetIndex]
        const codigo = codigoOverride || targetLinea.codigo
        const infoIva = esCuentaSujetaAIVA(codigo)
        if (!infoIva.esSujeta) return prevLineas

        let montoNeto = 0
        if (modoCaptura === "CLASICO") {
          montoNeto =
            Number(targetLinea.debeDirecto) ||
            Number(targetLinea.haberDirecto) ||
            0
        } else {
          montoNeto = Number(targetLinea.monto) || 0
        }

        if (montoNeto <= 0) return prevLineas

        const iva = redondear(montoNeto * 0.13)
        const updated = [...prevLineas]
        const esCompraOActivo = infoIva.tipo === "COMPRA"

        // Buscar si ya existe la línea de IVA correspondiente
        const ivaIndex = prevLineas.findIndex(
          (l, idx) => idx !== targetIndex && l.codigo === infoIva.cuentaIvaCodigo,
        )

        if (ivaIndex !== -1) {
          updated[ivaIndex] = {
            ...updated[ivaIndex],
            codigo: infoIva.cuentaIvaCodigo,
            monto: iva,
            operacion: "AUMENTA",
            debeDirecto: esCompraOActivo ? iva : "",
            haberDirecto: esCompraOActivo ? "" : iva,
          }
        } else {
          const nextIdx = targetIndex + 1
          const nextLinea = updated[nextIdx]
          const nextEsVacia =
            nextLinea &&
            !nextLinea.codigo &&
            (!nextLinea.monto || nextLinea.monto === 0) &&
            (!nextLinea.debeDirecto || nextLinea.debeDirecto === 0) &&
            (!nextLinea.haberDirecto || nextLinea.haberDirecto === 0)

          const nuevaLineaIva: LineaCaptura = {
            key: nextEsVacia ? nextLinea.key : String(Date.now() + Math.random()),
            codigo: infoIva.cuentaIvaCodigo,
            monto: iva,
            operacion: "AUMENTA",
            debeDirecto: esCompraOActivo ? iva : "",
            haberDirecto: esCompraOActivo ? "" : iva,
          }

          if (nextEsVacia) {
            updated[nextIdx] = nuevaLineaIva
          } else {
            updated.splice(nextIdx, 0, nuevaLineaIva)
          }
        }

        setTimeout(() => {
          setNotificacion({
            tipo: "exito",
            mensaje: `+ IVA 13% Crédito Fiscal: Base Neta ${formatoMoneda(montoNeto)} + ${infoIva.cuentaIvaNombre} ${formatoMoneda(iva)} = Total ${formatoMoneda(montoNeto + iva)}.`,
          })
        }, 50)

        return updated
      })
    },
    [modoCaptura],
  )

  // Conversión bidireccional limpia al alternar entre Modo Smart (+/-) y Modo Clásico (D/H)
  const handleCambiarModoCaptura = useCallback(
    (nuevoModo: ModoCaptura) => {
      if (nuevoModo === modoCaptura) return
      setModoCaptura(nuevoModo)
      setLineas((prev) =>
        prev.map((l) => {
          const c = cuentasMap.get(l.codigo)
          if (nuevoModo === "SMART") {
            const d = Number(l.debeDirecto) || 0
            const h = Number(l.haberDirecto) || 0
            if (d > 0 || h > 0) {
              const nat = normalizarNaturaleza(c?.naturaleza || "deudora")
              const monto = d > 0 ? d : h
              let operacion: "AUMENTA" | "DISMINUYE" = "AUMENTA"
              if (d > 0) {
                operacion = nat === "deudora" ? "AUMENTA" : "DISMINUYE"
              } else {
                operacion = nat === "acreedora" ? "AUMENTA" : "DISMINUYE"
              }
              return { ...l, monto, operacion }
            }
            return l
          } else {
            const m = Number(l.monto) || 0
            if (m > 0 && c) {
              const res = inferirImputacion(c, m, l.operacion)
              return {
                ...l,
                debeDirecto: res.debe > 0 ? res.debe : "",
                haberDirecto: res.haber > 0 ? res.haber : "",
              }
            }
            return l
          }
        }),
      )
    },
    [modoCaptura, cuentasMap],
  )

  // Limpiar Formulario
  const handleLimpiarFormulario = () => {
    setConcepto("")
    setDocumentoSoporte("")
    setPartidaEnEdicion(null)
    setLineas([
      { key: "1", codigo: "", monto: "", operacion: "AUMENTA", debeDirecto: "", haberDirecto: "" },
      { key: "2", codigo: "", monto: "", operacion: "AUMENTA", debeDirecto: "", haberDirecto: "" },
    ])
  }

  // Aplicar datos desde el Asistente de Plantillas
  const handleAplicarDesdeAsistente = useCallback((datos: {
    fecha?: string
    tipo?: "OPERACION" | "AJUSTE"
    documento_soporte?: string
    concepto: string
    lineas: AsientoLinea[]
  }) => {
    if (datos.concepto) setConcepto(datos.concepto)
    if (datos.documento_soporte) setDocumentoSoporte(datos.documento_soporte)
    if (datos.tipo) setTipoPartida(datos.tipo)
    if (datos.lineas && datos.lineas.length > 0) {
      setLineas(
        datos.lineas.map((l, i) => {
          const debe = Number(l.debe) || 0
          const haber = Number(l.haber) || 0
          const monto = debe > 0 ? debe : haber
          return {
            key: String(Date.now() + i),
            codigo: l.codigo,
            monto: monto > 0 ? monto : "",
            operacion: debe > 0 ? "AUMENTA" : "DISMINUYE",
            debeDirecto: debe > 0 ? debe : "",
            haberDirecto: haber > 0 ? haber : "",
          }
        }),
      )
    }
    setMostrarAsistentePlantillas(false)
    setNotificacion({
      tipo: "exito",
      mensaje: "Plantilla cargada exitosamente en la mesa de captura. Revisa las cuentas y pulsa Guardar Partida.",
    })
  }, [])

  // Cargar Partida para Edición In-situ
  const handleEditarPartida = (partida: {
    id: string
    numero: number
    concepto: string
    tipo?: string
    documento_soporte?: string
    lineas: Array<{ codigo: string; debe: number; haber: number }>
  }) => {
    setPartidaEnEdicion({ id: partida.id, numero: partida.numero })
    setConcepto(partida.concepto)
    setDocumentoSoporte(partida.documento_soporte || "")
    setTipoPartida(partida.tipo || "OPERACION")
    setModoCaptura("CLASICO")

    const nuevasLineas: LineaCaptura[] = partida.lineas.map((l, idx) => {
      const c = cuentasMap.get(l.codigo)
      const nat = normalizarNaturaleza(c?.naturaleza || "deudora")
      const monto = l.debe > 0 ? l.debe : l.haber
      let operacion: "AUMENTA" | "DISMINUYE" = "AUMENTA"
      if (l.debe > 0) {
        operacion = nat === "deudora" ? "AUMENTA" : "DISMINUYE"
      } else {
        operacion = nat === "acreedora" ? "AUMENTA" : "DISMINUYE"
      }
      return {
        key: String(idx + 1),
        codigo: l.codigo,
        monto,
        operacion,
        debeDirecto: l.debe > 0 ? l.debe : "",
        haberDirecto: l.haber > 0 ? l.haber : "",
      }
    })

    setLineas(nuevasLineas)
    setNotificacion({
      tipo: "exito",
      mensaje: `Cargada Partida #${partida.numero} en la mesa de trabajo para edición.`,
    })
  }

  // Anular Partida
  const handleAnularPartida = async (partida: { id: string; numero: number }) => {
    const motivo = window.prompt(
      `Ingrese el motivo contable de anulación para la Partida #${partida.numero}:`,
      "Error en registro contable",
    )
    if (!motivo) return

    try {
      const res = await fetch(`/api/asientos/${partida.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "No se pudo anular la partida")
      }
      setNotificacion({
        tipo: "exito",
        mensaje: `Partida #${partida.numero} anulada correctamente en el folio.`,
      })
      await Promise.all([cargarFolioFecha(fechaSeleccionada), recargarDatosDespuesDeCambio()])
    } catch (e: unknown) {
      setNotificacion({
        tipo: "error",
        mensaje: e instanceof Error ? e.message : "Error al anular partida",
      })
    }
  }



  // Guardar Partida en el Folio Abierto (POST o PUT)
  const handleGuardarPartida = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault()
      setNotificacion(null)

      if (!concepto.trim()) {
        setNotificacion({ tipo: "error", mensaje: "Ingrese el concepto o glosa de la partida." })
        return
      }

      if (!totalesPartidaEnCurso.cuadrado) {
        setNotificacion({
          tipo: "error",
          mensaje: `La partida no cumple la partida doble. Diferencia: ${formatoMoneda(totalesPartidaEnCurso.diferencia)}`,
        })
        return
      }

      const lineasValidas = lineasProcesadas.filter(
        (l) => l.cuentaValida && (l.debe > 0 || l.haber > 0),
      )
      if (lineasValidas.length < 2) {
        setNotificacion({
          tipo: "error",
          mensaje: "La partida requiere al menos 2 cuentas con montos válidos.",
        })
        return
      }

      setGuardandoPartida(true)
      try {
        const payload = {
          fecha: fechaSeleccionada,
          concepto: concepto.trim(),
          tipo: tipoPartida,
          documento_soporte: documentoSoporte.trim() || undefined,
          folio_diario_id: datosFolio?.folio?.id,
          lineas: lineasValidas.map((l) => ({
            codigo: l.codigo,
            debe: l.debe,
            haber: l.haber,
          })),
        }

        const isEditing = !!partidaEnEdicion
        const url = isEditing ? `/api/asientos/${partidaEnEdicion.id}` : "/api/asientos"
        const method = isEditing ? "PUT" : "POST"

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || "Error al procesar la partida")
        }

        setNotificacion({
          tipo: "exito",
          mensaje: isEditing
            ? `¡Partida #${partidaEnEdicion.numero} actualizada con éxito!`
            : "¡Partida guardada exitosamente en el folio de hoy!",
        })

        handleLimpiarFormulario()
        await Promise.all([cargarFolioFecha(fechaSeleccionada), recargarDatosDespuesDeCambio()])
      } catch (e: unknown) {
        setNotificacion({
          tipo: "error",
          mensaje: e instanceof Error ? e.message : "Error al procesar partida",
        })
      } finally {
        setGuardandoPartida(false)
      }
    },
    [
      concepto,
      totalesPartidaEnCurso,
      lineasProcesadas,
      tipoPartida,
      documentoSoporte,
      fechaSeleccionada,
      datosFolio?.folio?.id,
      partidaEnEdicion,
      cargarFolioFecha,
      recargarDatosDespuesDeCambio,
    ],
  )

  // Atajos de teclado globales
  useContableKeyboard({
    onAddRow: handleAddLinea,
    onAutoBalance: handleAutoCuadrar,
    onSave: () => {
      if (datosFolio?.estado === "ABIERTO") {
        handleGuardarPartida()
      }
    },
    onOpenHistorial: () => setIsHistorialOpen((prev) => !prev),
    onCancel: () => {
      setModalCierreOpen(false)
      setModalReabrirOpen(false)
      if (partidaEnEdicion) handleLimpiarFormulario()
    },
  })

  // Exportar PDF
  const handleExportPDF = () => {
    if (!datosFolio?.folio) return
    exportarFolioPDF(
      {
        numero_folio: datosFolio.folio.numero_folio,
        fecha: datosFolio.folio.fecha,
        ejercicio: datosFolio.folio.ejercicio,
        estado: datosFolio.folio.estado,
        total_debe: datosFolio.totales?.totalDebe || 0,
        total_haber: datosFolio.totales?.totalHaber || 0,
        partidas: datosFolio.partidas || [],
      },
      getNombreCuenta,
    )
  }

  // Exportar CSV
  const handleExportCSV = () => {
    if (!datosFolio?.folio) return
    exportarFolioCSV(
      {
        numero_folio: datosFolio.folio.numero_folio,
        fecha: datosFolio.folio.fecha,
        ejercicio: datosFolio.folio.ejercicio,
        estado: datosFolio.folio.estado,
        total_debe: datosFolio.totales?.totalDebe || 0,
        total_haber: datosFolio.totales?.totalHaber || 0,
        partidas: datosFolio.partidas || [],
      },
      getNombreCuenta,
    )
  }

  // Helpers
  const fechaLegible = useMemo(() => {
    if (!fechaSeleccionada) return ""
    const [y, m, d] = fechaSeleccionada.split("-").map(Number)
    return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }, [fechaSeleccionada])

  const estadoFolio = datosFolio?.estado ?? "NO_INICIADO"
  const folioActual = datosFolio?.folio ?? null
  const partidasFolio = useMemo(
    () => (datosFolio?.partidas ? [...datosFolio.partidas].sort((a, b) => a.numero - b.numero) : []),
    [datosFolio?.partidas],
  )
  const totalesFolio = datosFolio?.totales ?? {
    totalDebe: 0,
    totalHaber: 0,
    diferencia: 0,
    cuadrado: true,
    partidasCuadradas: 0,
    totalPartidas: 0,
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden space-y-6">
        {/* ========================================================================= */}
        {/* 1. PANEL DE CONTROL SUPERIOR (Sin blancos chillantes, usa bg-card / tokens) */}
        {/* ========================================================================= */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs transition-all">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Lado Izquierdo: Estado del Folio y Fecha */}
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground font-mono font-bold text-sm shadow-xs shrink-0">
                {folioActual ? `#${String(folioActual.numero_folio).padStart(2, "0")}` : "FD"}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight text-foreground">
                    {folioActual
                      ? `Folio Diario N° ${String(folioActual.numero_folio).padStart(3, "0")}`
                      : "Libro Diario General"}
                  </h1>
                  {estadoFolio === "ABIERTO" && (
                    <Badge variant="success" className="gap-1.5 py-0.5 px-2.5 font-medium shadow-xs">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      EN PROCESO
                    </Badge>
                  )}
                  {estadoFolio === "CERRADO" && (
                    <Badge variant="muted" className="gap-1 py-0.5 px-2.5 font-medium shadow-xs">
                      <Lock className="size-3" />
                      FOLIADO Y CERRADO
                    </Badge>
                  )}
                  {estadoFolio === "NO_INICIADO" && (
                    <Badge variant="warning" className="py-0.5 px-2.5 font-medium shadow-xs">
                      NO INICIADO
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{fechaLegible}</span>
                  <span>•</span>
                  <span>Sistema Analítico</span>
                  <span>•</span>
                  <span className="text-[11px]">
                    Atajos rápidos: Alt+A (fila) · Alt+C (cuadrar) · Alt+G (guardar)
                  </span>
                </div>
              </div>
            </div>

            {/* Lado Derecho: Navegador de Fecha y Acciones Globales */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Selector de fecha con atajos Hoy/Ayer */}
              <div className="flex items-center rounded-lg border border-border bg-muted/40 p-1 text-xs shadow-xs">
                <button
                  type="button"
                  onClick={handleSetHoy}
                  className="rounded px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-card transition-colors cursor-pointer"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={handleSetAyer}
                  className="rounded px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-card transition-colors cursor-pointer"
                >
                  Ayer
                </button>
                <div className="mx-1 h-3.5 w-px bg-border" />
                <div className="flex items-center gap-1.5 px-2">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  <input
                    type="date"
                    value={fechaSeleccionada}
                    onChange={(e) => setFechaSeleccionada(e.target.value)}
                    className="bg-transparent text-xs font-medium text-foreground focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Botón Drawer Historial */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsHistorialOpen(true)}
                className="text-xs h-9 gap-1.5 cursor-pointer"
                title="Ver folios anteriores (Alt + H)"
              >
                <FolderOpen className="size-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">Folios Anteriores</span>
              </Button>

              {/* Acciones de Exportación */}
              {folioActual && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportPDF}
                    className="text-xs h-9 px-2.5 cursor-pointer"
                    title="Descargar Comprobante Oficial en PDF con firmas"
                  >
                    <FileDown className="size-3.5 text-primary" />
                    <span className="hidden md:inline">PDF</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCSV}
                    className="text-xs h-9 px-2.5 cursor-pointer"
                    title="Exportar comprobantes a formato CSV para Excel"
                  >
                    <Table className="size-3.5 text-emerald-600" />
                    <span className="hidden md:inline">CSV</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.print()}
                    className="text-xs h-9 px-2.5 cursor-pointer"
                    title="Imprimir Libro Diario foliado"
                  >
                    <Printer className="size-3.5 text-muted-foreground" />
                  </Button>
                </div>
              )}

              {/* Botón de Cierre de Folio */}
              {estadoFolio === "ABIERTO" && (
                <Button
                  size="sm"
                  onClick={() => setModalCierreOpen(true)}
                  disabled={totalesFolio.totalPartidas === 0 || !totalesFolio.cuadrado}
                  className="text-xs h-9 px-4 gap-2 font-medium cursor-pointer shadow-xs"
                >
                  <Lock className="size-3.5 text-emerald-400" />
                  <span>Cerrar Folio del Día</span>
                </Button>
              )}

              {/* Botón de Reapertura */}
              {estadoFolio === "CERRADO" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModalReabrirOpen(true)}
                  className="text-xs h-9 gap-1.5 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 cursor-pointer"
                >
                  <Unlock className="size-3.5" />
                  <span>Reapertura</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Notificaciones */}
        {notificacion && (
          <div
            className={cn(
              "rounded-xl border px-4 py-3 flex items-center justify-between text-sm transition-all",
              notificacion.tipo === "exito"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                : "border-red-500/20 bg-red-500/10 text-red-800 dark:text-red-300",
            )}
          >
            <div className="flex items-center gap-2.5">
              {notificacion.tipo === "exito" ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="size-4 shrink-0 text-red-600 dark:text-red-400" />
              )}
              <span className="font-semibold text-xs">{notificacion.mensaje}</span>
            </div>
            <button
              onClick={() => setNotificacion(null)}
              className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. CONTENIDO PRINCIPAL SEGÚN EL ESTADO DEL FOLIO                          */}
        {/* ========================================================================= */}
        {cargandoFolio ? (
          <div className="py-24 text-center bg-card rounded-xl border border-border shadow-xs">
            <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">Verificando estado del folio contable...</p>
            <p className="text-xs text-muted-foreground mt-1">Cargando folios y registros contables...</p>
          </div>
        ) : estadoFolio === "NO_INICIADO" ? (
          /* ========================================================================= */
          /* CASO 1: FOLIO NO INICIADO (APERTURA LIMPIA DE JORNADA)                    */
          /* ========================================================================= */
          <div className="max-w-2xl mx-auto py-12">
            <div className="bg-card border border-border rounded-xl p-8 sm:p-12 shadow-xs text-center space-y-6">
              <div className="size-16 rounded-xl bg-muted/60 border border-border text-foreground flex items-center justify-center mx-auto shadow-xs">
                <BookOpen className="size-8 text-primary stroke-[1.5]" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Jornada Contable del {fechaLegible}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                  El Folio Diario para esta fecha aún no ha sido aperturado. Inicia la jornada de trabajo para
                  habilitar la captura de comprobantes, foliar los asientos y operar con rigor de partida doble.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Button
                  size="lg"
                  onClick={handleIniciarFolio}
                  disabled={iniciandoFolio}
                  className="w-full sm:w-auto text-sm px-6 h-11 gap-2 font-medium shadow-xs cursor-pointer"
                >
                  <Plus className="size-4" />
                  {iniciandoFolio ? "Aperturando Folio..." : "Iniciar Folio de Hoy"}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setIsHistorialOpen(true)}
                  className="w-full sm:w-auto text-sm px-5 h-11 gap-2 cursor-pointer"
                >
                  <FolderOpen className="size-4 text-muted-foreground" />
                  Consultar Folios Anteriores
                </Button>
              </div>

              <div className="pt-6 border-t border-border flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <ShieldCheck className="size-4 text-primary" /> Auditoría NIIF
                </span>
                <span>•</span>
                <span>Sistema Analítico</span>
                <span>•</span>
                <span>Consecutivo Anual Seguro</span>
              </div>
            </div>
          </div>
        ) : estadoFolio === "ABIERTO" ? (
          /* ========================================================================= */
          /* CASO 2: FOLIO ABIERTO (EN PROCESO: CAPTURA EN 2 COLUMNAS)                 */
          /* ========================================================================= */
          <div className="space-y-6">
            {/* KPI Strip de la Jornada en Curso */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Total Debe Jornada
                  </span>
                  <div className="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <ArrowDownLeft className="size-3.5" />
                  </div>
                </div>
                <p className="text-xl font-black text-foreground font-mono tabular-nums">
                  {formatoMoneda(totalesFolio.totalDebe)}
                </p>
                <span className="text-[11px] text-muted-foreground mt-0.5 block">Cargos acumulados hoy</span>
              </div>

              <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Total Haber Jornada
                  </span>
                  <div className="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <ArrowUpRight className="size-3.5" />
                  </div>
                </div>
                <p className="text-xl font-black text-foreground font-mono tabular-nums">
                  {formatoMoneda(totalesFolio.totalHaber)}
                </p>
                <span className="text-[11px] text-muted-foreground mt-0.5 block">Abonos acumulados hoy</span>
              </div>

              <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Partida Doble
                  </span>
                  <div className="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <ShieldCheck className="size-3.5" />
                  </div>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  {totalesFolio.cuadrado ? (
                    <Badge variant="success" className="text-xs">
                      Balance Exacto ($0.00)
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="text-xs tabular-nums">
                      Dif: {formatoMoneda(totalesFolio.diferencia)}
                    </Badge>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  {totalesFolio.cuadrado ? "Todas las partidas cuadradas" : "Requiere ajuste para cerrar"}
                </span>
              </div>

              <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Comprobantes
                  </span>
                  <div className="size-7 rounded-md bg-muted text-muted-foreground flex items-center justify-center">
                    <FileText className="size-3.5" />
                  </div>
                </div>
                <p className="text-xl font-black text-foreground font-mono tabular-nums">
                  {totalesFolio.totalPartidas} {totalesFolio.totalPartidas === 1 ? "partida" : "partidas"}
                </p>
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  Registradas en Folio #{String(folioActual?.numero_folio || 1).padStart(3, "0")}
                </span>
              </div>
            </div>

            {/* Layout en dos columnas: Captura a la izquierda, Hoja del día a la derecha */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* ================================================================= */}
              {/* COLUMNA IZQUIERDA: Formulario de Captura Multimodal (5 cols)     */}
              {/* ================================================================= */}
              <div className="lg:col-span-5 bg-card border border-border rounded-xl p-4.5 shadow-xs space-y-3.5">
                {/* Header de la Mesa de Captura y Segmented Tabs */}
                <div className="space-y-2.5 pb-2.5 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                        {partidaEnEdicion ? <Pencil className="size-3.5" /> : <Plus className="size-3.5" />}
                      </div>
                      <h2 className="text-sm font-bold text-foreground">
                        {partidaEnEdicion ? `Editando Partida #${partidaEnEdicion.numero}` : "Registrar Comprobante"}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2">
                      {partidaEnEdicion ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleLimpiarFormulario}
                          className="text-xs h-7 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          Cancelar Edición
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-[10px] font-mono border-border bg-muted/40">
                          Folio #{String(folioActual?.numero_folio || 1).padStart(3, "0")}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Banner de Modo Edición */}
                  {partidaEnEdicion && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Pencil className="size-3.5 text-amber-600 dark:text-amber-400" />
                        <span>Modificando partida guardada en folio abierto.</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleLimpiarFormulario}
                        className="text-xs hover:underline cursor-pointer"
                      >
                        Descartar
                      </button>
                    </div>
                  )}

                  {/* Selector de Modo de Captura y Acceso Rápido a Plantillas */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/40 p-1 border border-border flex-1">
                      <button
                        type="button"
                        onClick={() => handleCambiarModoCaptura("SMART")}
                        className={cn(
                          "py-1 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                          modoCaptura === "SMART"
                            ? "bg-card text-foreground shadow-xs border border-border/50"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Zap className="size-3 text-amber-500" />
                        <span>Smart (+/-)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCambiarModoCaptura("CLASICO")}
                        className={cn(
                          "py-1 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                          modoCaptura === "CLASICO"
                            ? "bg-card text-foreground shadow-xs border border-border/50"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Sliders className="size-3 text-primary" />
                        <span>Clásico (D/H)</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMostrarAsistentePlantillas(true)}
                      className="py-1 px-2.5 text-xs font-semibold rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 h-8"
                      title="Cargar asiento preconfigurado desde plantilla de compras, ventas o sueldos"
                    >
                      <Sparkles className="size-3.5 text-primary" />
                      <span>Plantillas</span>
                    </button>
                  </div>
                </div>

                {/* Formulario de Captura Directo (Smart y Clásico) */}
                <form onSubmit={handleGuardarPartida} className="space-y-3.5">
                  {/* Metadatos: Doc Soporte + Tipo de Asiento en fila limpia */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <Label htmlFor="doc-soporte" className="text-[11px] font-medium text-muted-foreground">
                          Doc. Soporte / Factura
                        </Label>
                        <Input
                          id="doc-soporte"
                          placeholder="Ej: F-102, CH-45..."
                          value={documentoSoporte}
                          onChange={(e) => setDocumentoSoporte(e.target.value)}
                          className="text-xs h-8 font-mono mt-0.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="tipo-asiento" className="text-[11px] font-medium text-muted-foreground">
                          Tipo de Asiento
                        </Label>
                        <select
                          id="tipo-asiento"
                          value={tipoPartida}
                          onChange={(e) => setTipoPartida(e.target.value)}
                          className="w-full text-xs h-8 px-2.5 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring mt-0.5 cursor-pointer font-medium"
                        >
                          <option value="OPERACION">Operación</option>
                          <option value="AJUSTE">Ajuste</option>
                          <option value="CIERRE">Cierre</option>
                        </select>
                      </div>
                    </div>

                    {/* Campo Concepto / Glosa con micro-chips integrados */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="concepto" className="text-[11px] font-medium text-foreground">
                          Concepto o Glosa *
                        </Label>
                        <span className="text-[10px] text-muted-foreground">Sistema Analítico</span>
                      </div>
                      <textarea
                        id="concepto"
                        rows={2}
                        required
                        placeholder="Ej: Compra de mercadería al contado según factura..."
                        value={concepto}
                        onChange={(e) => setConcepto(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
                      />
                      {/* Micro-chips de sugerencias con scroll horizontal suave */}
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-[10px]">
                        <span className="text-muted-foreground shrink-0 font-medium">Sugerir:</span>
                        {GLOSAS_RAPIDAS.map((g, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setConcepto(g)}
                            className="shrink-0 rounded-full border border-border/70 bg-muted/30 px-2 py-0.5 text-muted-foreground hover:text-foreground hover:bg-muted hover:border-border transition-colors cursor-pointer truncate max-w-[150px]"
                            title={g}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Renglones Contables */}
                    <div className="space-y-2 pt-1 border-t border-border">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          Renglones Contables
                          <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 font-mono">
                            {lineas.length}
                          </Badge>
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {modoCaptura === "SMART" ? "Modo Asistido (+/-)" : "Modo Clásico (D/H)"}
                        </span>
                      </div>

                      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5">
                        {lineasProcesadas.map((linea, index) => (
                          <div
                            key={linea.key}
                            className="p-2.5 rounded-lg border border-border bg-card/60 hover:bg-muted/20 transition-colors space-y-2"
                          >
                            {/* Fila superior: Índice + Selector de Cuenta + Eliminar */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono font-bold text-muted-foreground size-5 rounded bg-muted/60 flex items-center justify-center shrink-0">
                                {index + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <CuentaCombobox
                                  cuentas={cuentas}
                                  value={linea.codigo}
                                  onChange={(cod) => {
                                    const c = cuentasMap.get(cod)
                                    let opSugerida: "AUMENTA" | "DISMINUYE" = linea.operacion

                                    if (modoCaptura === "SMART" && c) {
                                      // Si la partida ya tiene otras líneas que suman al Debe más que al Haber,
                                      // deducir inteligentemente qué operación necesita esta nueva cuenta para equilibrar
                                      let sumaDebeOtros = 0
                                      let sumaHaberOtros = 0
                                      lineasProcesadas.forEach((lp) => {
                                        if (lp.key !== linea.key) {
                                          sumaDebeOtros += lp.debe
                                          sumaHaberOtros += lp.haber
                                        }
                                      })
                                      const diff = redondear(sumaDebeOtros - sumaHaberOtros)
                                      const nat = normalizarNaturaleza(c.naturaleza)

                                      if (diff > 0) {
                                        // Debe > Haber: la partida necesita abonar al HABER
                                        opSugerida = nat === "acreedora" ? "AUMENTA" : "DISMINUYE"
                                      } else if (diff < 0) {
                                        // Haber > Debe: la partida necesita cargar al DEBE
                                        opSugerida = nat === "deudora" ? "AUMENTA" : "DISMINUYE"
                                      }
                                    }

                                    handleUpdateLinea(linea.key, { codigo: cod, operacion: opSugerida })
                                    if (esCuentaSujetaAIVA(cod).esSujeta) {
                                      const monto =
                                        modoCaptura === "CLASICO"
                                          ? Number(linea.debeDirecto) || Number(linea.haberDirecto) || 0
                                          : Number(linea.monto) || 0
                                      if (monto > 0) {
                                        handleDesglosarIVA(linea.key, false, cod)
                                      }
                                    }
                                  }}
                                  placeholder="Seleccionar cuenta contable..."
                                />
                                {linea.codigo && cuentasMap.get(linea.codigo) && (
                                  <div className="mt-1 flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground truncate">
                                    <span className="text-primary font-semibold">
                                      {formatearCuentaJerarquica(cuentasMap.get(linea.codigo)!, cuentasMap).principal}
                                    </span>
                                    <span>—</span>
                                    <span className="text-foreground">
                                      {cuentasMap.get(linea.codigo)!.nombre}
                                    </span>
                                  </div>
                                )}
                                {linea.codigo && esCuentaSujetaAIVA(linea.codigo).esSujeta && (() => {
                                  const info = esCuentaSujetaAIVA(linea.codigo)
                                  const montoActual =
                                    modoCaptura === "CLASICO"
                                      ? Number(linea.debeDirecto) || Number(linea.haberDirecto) || 0
                                      : Number(linea.monto) || 0

                                  const lineaIva = lineas.find((l, idx) => idx !== index && l.codigo === info.cuentaIvaCodigo)
                                  const ivaMonto = lineaIva
                                    ? modoCaptura === "CLASICO"
                                      ? Number(lineaIva.debeDirecto) || Number(lineaIva.haberDirecto) || 0
                                      : Number(lineaIva.monto) || 0
                                    : 0

                                  const yaDesglosado =
                                    montoActual > 0 &&
                                    ivaMonto > 0 &&
                                    Math.abs(redondear(montoActual * 0.13) - ivaMonto) <= 0.02
                                  const totalEstimado = redondear(montoActual + ivaMonto)

                                  return (
                                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5 text-[10px] font-mono bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 rounded px-2 py-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-400">
                                          <Zap className="size-3 text-amber-500" />
                                          {info.impuestoNombre}
                                        </span>
                                        {yaDesglosado ? (
                                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                            ✓ Base: {formatoMoneda(montoActual)} + IVA: {formatoMoneda(ivaMonto)} = Total: {formatoMoneda(totalEstimado)}
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground">
                                            (Auto-desglose: Base = $X / 1.13 · IVA = Base × 0.13)
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => handleAgregarIVA_Neto(linea.key)}
                                          disabled={montoActual <= 0}
                                          className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-200 hover:text-emerald-950 dark:hover:text-white bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-40 px-2 py-0.5 rounded transition-colors cursor-pointer"
                                          title="Agregar 13% de IVA manteniendo la base neta (Comprobante de Crédito Fiscal - CCF)"
                                        >
                                          + IVA 13% (Neto CCF)
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDesglosarIVA(linea.key, true)}
                                          disabled={montoActual <= 0}
                                          className="text-[10px] font-semibold text-amber-800 dark:text-amber-200 hover:text-amber-950 dark:hover:text-white bg-amber-500/25 hover:bg-amber-500/35 disabled:opacity-40 px-2 py-0.5 rounded transition-colors cursor-pointer"
                                          title="Desglosar IVA dividiendo entre 1.13 (Factura Consumidor Final)"
                                        >
                                          ⚡ Desglosar / 1.13
                                        </button>
                                      </div>
                                    </div>
                                  )
                                })()}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveLinea(linea.key)}
                                disabled={lineas.length <= 2}
                                className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors disabled:opacity-20 cursor-pointer shrink-0"
                                title="Eliminar renglón"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>

                            {/* Controles de Importe según Modo */}
                            {modoCaptura === "SMART" ? (
                              <div className="grid grid-cols-12 gap-2 items-center pl-7">
                                <div className="col-span-5">
                                  <select
                                    value={linea.operacion}
                                    onChange={(e) => {
                                      const op = e.target.value as "AUMENTA" | "DISMINUYE"
                                      const c = cuentasMap.get(linea.codigo)
                                      const m = Number(linea.monto) || 0
                                      if (c && m > 0) {
                                        const res = inferirImputacion(c, m, op)
                                        handleUpdateLinea(linea.key, {
                                          operacion: op,
                                          debeDirecto: res.debe > 0 ? res.debe : "",
                                          haberDirecto: res.haber > 0 ? res.haber : "",
                                        })
                                      } else {
                                        handleUpdateLinea(linea.key, { operacion: op })
                                      }
                                    }}
                                    className="w-full text-xs h-8 px-2 rounded-md border border-input bg-background text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring font-medium"
                                  >
                                    <option value="AUMENTA">
                                      {linea.cuenta
                                        ? linea.cuenta.naturaleza === "acreedora"
                                          ? "+ Aumenta (Abono / Haber)"
                                          : "+ Aumenta (Cargo / Debe)"
                                        : "+ Aumenta"}
                                    </option>
                                    <option value="DISMINUYE">
                                      {linea.cuenta
                                        ? linea.cuenta.naturaleza === "acreedora"
                                          ? "- Disminuye (Cargo / Debe)"
                                          : "- Disminuye (Abono / Haber)"
                                        : "- Disminuye"}
                                    </option>
                                  </select>
                                </div>
                                <div className="col-span-4 relative">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={linea.monto}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value)
                                      const c = cuentasMap.get(linea.codigo)
                                      if (c && typeof val === "number" && val > 0) {
                                        const res = inferirImputacion(c, val, linea.operacion)
                                        handleUpdateLinea(linea.key, {
                                          monto: val,
                                          debeDirecto: res.debe > 0 ? res.debe : "",
                                          haberDirecto: res.haber > 0 ? res.haber : "",
                                        })
                                      } else {
                                        handleUpdateLinea(linea.key, {
                                          monto: val,
                                          debeDirecto: "",
                                          haberDirecto: "",
                                        })
                                      }
                                    }}
                                    className="w-full text-xs h-8 pl-6 pr-2 rounded-md border border-input bg-background text-foreground font-mono tabular-nums text-right focus:outline-none focus:ring-1 focus:ring-ring"
                                  />
                                </div>
                                <div className="col-span-3 text-right">
                                  {linea.debe > 0 && (
                                    <Badge variant="default" className="text-[10px] font-mono px-1.5 py-0.5">
                                      D: {formatoMoneda(linea.debe)}
                                    </Badge>
                                  )}
                                  {linea.haber > 0 && (
                                    <Badge variant="muted" className="text-[10px] font-mono px-1.5 py-0.5">
                                      H: {formatoMoneda(linea.haber)}
                                    </Badge>
                                  )}
                                  {linea.debe === 0 && linea.haber === 0 && (
                                    <span className="text-[10px] text-muted-foreground font-mono">—</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-2 pl-7">
                                <div className="relative">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono font-bold text-muted-foreground">D$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="Debe 0.00"
                                    value={linea.debeDirecto ?? ""}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value)
                                      const c = cuentasMap.get(linea.codigo)
                                      const nat = normalizarNaturaleza(c?.naturaleza || "deudora")
                                      const op: "AUMENTA" | "DISMINUYE" = nat === "deudora" ? "AUMENTA" : "DISMINUYE"
                                      handleUpdateLinea(linea.key, {
                                        debeDirecto: val,
                                        haberDirecto: val !== "" ? "" : linea.haberDirecto,
                                        monto: val,
                                        operacion: op,
                                      })
                                    }}
                                    className="w-full text-xs h-8 pl-7 pr-2 rounded-md border border-input bg-background text-foreground font-mono tabular-nums text-right focus:outline-none focus:ring-1 focus:ring-ring"
                                  />
                                </div>
                                <div className="relative">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono font-bold text-muted-foreground">H$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="Haber 0.00"
                                    value={linea.haberDirecto ?? ""}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value)
                                      const c = cuentasMap.get(linea.codigo)
                                      const nat = normalizarNaturaleza(c?.naturaleza || "deudora")
                                      const op: "AUMENTA" | "DISMINUYE" = nat === "acreedora" ? "AUMENTA" : "DISMINUYE"
                                      handleUpdateLinea(linea.key, {
                                        haberDirecto: val,
                                        debeDirecto: val !== "" ? "" : linea.debeDirecto,
                                        monto: val,
                                        operacion: op,
                                      })
                                    }}
                                    className="w-full text-xs h-8 pl-7 pr-2 rounded-md border border-input bg-background text-foreground font-mono tabular-nums text-right focus:outline-none focus:ring-1 focus:ring-ring"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Botones de Acción de Renglones */}
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddLinea}
                          className="text-xs h-8 gap-1.5 flex-1 cursor-pointer"
                        >
                          <Plus className="size-3.5" />
                          <span>Renglón</span>
                          <kbd className="text-[10px] font-mono text-muted-foreground">Alt+A</kbd>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAutoCuadrar}
                          className="text-xs h-8 gap-1.5 flex-1 cursor-pointer hover:border-amber-500/50 hover:bg-amber-500/10"
                          title="Calcular y asignar la contrapartida exacta para cuadrar la partida"
                        >
                          <Sliders className="size-3.5 text-amber-500" />
                          <span>Auto-Cuadrar</span>
                          <kbd className="text-[10px] font-mono text-muted-foreground">Alt+C</kbd>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleLimpiarFormulario}
                          className="text-xs h-8 text-muted-foreground hover:text-foreground cursor-pointer px-2.5"
                        >
                          Limpiar
                        </Button>
                      </div>
                    </div>

                    {/* Resumen de Cuadratura y Guardar */}
                    <div className="pt-2.5 border-t border-border flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
                          <span>D: <strong className="text-foreground">{formatoMoneda(totalesPartidaEnCurso.totalDebe)}</strong></span>
                          <span>H: <strong className="text-foreground">{formatoMoneda(totalesPartidaEnCurso.totalHaber)}</strong></span>
                        </div>
                        <div>
                          {totalesPartidaEnCurso.cuadrado ? (
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="size-3.5" /> Partida Cuadrada
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 tabular-nums">
                              <AlertCircle className="size-3.5" /> Dif: {formatoMoneda(totalesPartidaEnCurso.diferencia)}
                            </span>
                          )}
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={guardandoPartida || !totalesPartidaEnCurso.cuadrado}
                        className="text-xs h-9 px-4 font-semibold gap-1.5 shadow-xs cursor-pointer"
                        title="Guardar partida (Alt + G)"
                      >
                        {guardandoPartida ? (
                          "Guardando..."
                        ) : partidaEnEdicion ? (
                          "Guardar Cambios"
                        ) : (
                          "Guardar en Folio"
                        )}
                        <ArrowRight className="size-3.5" />
                      </Button>
                    </div>
                  </form>
              </div>

              {/* ================================================================= */}
              {/* COLUMNA DERECHA: La Hoja del Día (Partidas en Curso) (7 cols)     */}
              {/* ================================================================= */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-md bg-muted flex items-center justify-center text-foreground">
                      <Layers className="size-3.5" />
                    </div>
                    <h2 className="text-sm font-bold text-foreground">
                      Comprobantes de la Jornada ({partidasFolio.length})
                    </h2>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {fechaLegible}
                  </span>
                </div>

                {partidasFolio.length === 0 ? (
                  <div className="border-2 border-dashed border-border rounded-xl p-12 text-center bg-card/60 space-y-3">
                    <BookOpen className="size-12 text-muted-foreground/60 mx-auto stroke-1" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-foreground">Aún no hay comprobantes registrados en este folio</p>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                        Utiliza el formulario de la izquierda para registrar compras, ventas o gastos del día. Las partidas se
                        acumularán en esta hoja antes del cierre definitivo de jornada.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {partidasFolio.map((partida) => {
                      let pDebe = 0
                      let pHaber = 0
                      partida.lineas.forEach((l) => {
                        pDebe += Number(l.debe) || 0
                        pHaber += Number(l.haber) || 0
                      })
                      const esAnulado = partida.estado === "ANULADO"
                      const estaEditandoEsta = partidaEnEdicion?.id === partida.id

                      return (
                        <div
                          key={partida.id}
                          className={cn(
                            "border rounded-xl bg-card p-4 shadow-xs transition-all",
                            estaEditandoEsta
                              ? "ring-2 ring-primary border-transparent bg-muted/30"
                              : esAnulado
                              ? "opacity-60 border-red-500/20 bg-red-500/5"
                              : "border-border hover:border-border/80",
                          )}
                        >
                          {/* Encabezado de la Partida */}
                          <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-border">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs font-bold text-foreground bg-muted px-2 py-0.5 rounded">
                                  Partida #{partida.numero}
                                </span>
                                {partida.tipo && (
                                  <Badge variant="outline" className="text-[10px] font-normal">
                                    {partida.tipo}
                                  </Badge>
                                )}
                                {partida.documento_soporte && (
                                  <span className="text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded border border-border font-mono">
                                    Doc: {partida.documento_soporte}
                                  </span>
                                )}
                                {esAnulado && (
                                  <Badge variant="warning" className="text-[10px]">
                                    ANULADO
                                  </Badge>
                                )}
                              </div>
                              <p className={cn("text-xs font-medium text-foreground", esAnulado && "line-through text-muted-foreground")}>
                                {partida.concepto}
                              </p>
                            </div>

                            {!esAnulado && estadoFolio === "ABIERTO" && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleEditarPartida(partida)}
                                  title="Editar comprobante en folio abierto"
                                  className="text-muted-foreground hover:text-foreground p-1.5 rounded transition-colors cursor-pointer hover:bg-muted"
                                >
                                  <Pencil className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAnularPartida(partida)}
                                  title="Anular comprobante del folio"
                                  className="text-muted-foreground hover:text-destructive p-1.5 rounded transition-colors cursor-pointer hover:bg-red-500/10"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Tabla de Renglones */}
                          <div className="pt-2 overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-muted-foreground font-medium border-b border-border text-[11px]">
                                  <th className="text-left py-1 w-20">Código</th>
                                  <th className="text-left py-1">Cuenta</th>
                                  <th className="text-right py-1 w-24">Debe</th>
                                  <th className="text-right py-1 w-24">Haber</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/60 font-mono tabular-nums text-xs">
                                {partida.lineas.map((linea, idx) => (
                                  <tr key={idx} className="hover:bg-muted/30">
                                    <td className="py-1.5 text-primary font-medium">{linea.codigo}</td>
                                    <td className="py-1.5 text-foreground font-sans truncate max-w-[200px]">
                                      {getNombreCuenta(linea.codigo)}
                                    </td>
                                    <td className="py-1.5 text-right text-foreground font-medium">
                                      {linea.debe > 0 ? formatoMoneda(linea.debe) : "—"}
                                    </td>
                                    <td className="py-1.5 text-right text-foreground font-medium">
                                      {linea.haber > 0 ? formatoMoneda(linea.haber) : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Pie de Partida */}
                          <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-xs font-mono tabular-nums text-muted-foreground">
                            <span>Sumas Partida:</span>
                            <div className="flex gap-4 font-bold text-foreground">
                              <span>D: {formatoMoneda(pDebe)}</span>
                              <span>H: {formatoMoneda(pHaber)}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {/* Resumen Total al Pie de la Hoja del Día */}
                    <div className="bg-muted/80 border border-border rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono tabular-nums">
                      <div>
                        <span className="font-sans font-bold text-sm block text-foreground">
                          TOTALES DEL FOLIO #{String(folioActual?.numero_folio || 1).padStart(3, "0")}
                        </span>
                        <span className="text-muted-foreground font-sans text-xs">
                          {totalesFolio.totalPartidas} {totalesFolio.totalPartidas === 1 ? "partida registrada" : "partidas registradas"} · Partida Doble Verificada
                        </span>
                      </div>
                      <div className="flex items-center gap-8 text-sm">
                        <div>
                          <span className="text-[10px] text-muted-foreground block font-sans uppercase tracking-wider">Total Debe</span>
                          <strong className="text-base text-primary">{formatoMoneda(totalesFolio.totalDebe)}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block font-sans uppercase tracking-wider">Total Haber</span>
                          <strong className="text-base text-foreground">{formatoMoneda(totalesFolio.totalHaber)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* CASO 3: FOLIO CERRADO (JORNADA SELLADA CON INMUTABILIDAD ESTRICTA)         */
          /* ========================================================================= */
          <div className="space-y-6">
            {/* Banner de Jornada Cerrada */}
            <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="size-14 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 shadow-xs">
                    <ShieldCheck className="size-7" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                        Folio Diario N° {String(folioActual?.numero_folio).padStart(3, "0")} — Sellado Legalmente
                      </h2>
                      <Badge variant="muted" className="text-xs">
                        INMUTABLE
                      </Badge>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
                      La jornada contable del {fechaLegible} ha sido cerrada de forma definitiva. Todos los comprobantes
                      han sido foliados e inmovilizados por el trigger de base de datos bajo estrictos estándares de auditoría fiscal y mercantil.
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums text-muted-foreground pt-2">
                      <span>Cerrado en: {folioActual?.cerrado_en ? new Date(folioActual.cerrado_en).toLocaleString() : "Cierre formal"}</span>
                      <span>•</span>
                      <span>Total Asientos: {partidasFolio.length}</span>
                      <span>•</span>
                      <span>Sumas Iguales: {formatoMoneda(totalesFolio.totalDebe)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-row md:flex-col gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => window.print()}
                    className="text-xs h-9 gap-2 font-medium cursor-pointer shadow-xs"
                  >
                    <Printer className="size-3.5" />
                    Imprimir Comprobante Diario
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportPDF}
                    className="text-xs h-9 gap-1.5 cursor-pointer"
                  >
                    <FileDown className="size-3.5 text-primary" />
                    Descargar PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setModalReabrirOpen(true)}
                    className="text-xs h-9 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 gap-1.5 cursor-pointer"
                  >
                    <Unlock className="size-3.5" />
                    Reapertura de Auditoría
                  </Button>
                </div>
              </div>
            </div>

            {/* Hoja de Consulta de Partidas Cerradas */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <FileCheck className="size-4 text-primary" />
                Comprobantes Foliados en este Libro Diario
              </h3>

              <div className="space-y-4">
                {partidasFolio.map((partida) => {
                  let pDebe = 0
                  let pHaber = 0
                  partida.lineas.forEach((l) => {
                    pDebe += Number(l.debe) || 0
                    pHaber += Number(l.haber) || 0
                  })

                  return (
                    <div
                      key={partida.id}
                      className="border border-border rounded-lg p-4 bg-muted/20 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="font-mono bg-background border border-border px-2 py-0.5 rounded text-[11px]">
                            Partida #{partida.numero}
                          </span>
                          <span>{partida.concepto}</span>
                          {partida.documento_soporte && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              (Doc: {partida.documento_soporte})
                            </span>
                          )}
                        </div>
                        <div className="font-mono tabular-nums text-xs text-foreground">
                          {formatoMoneda(pDebe)}
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground border-b border-border text-[11px]">
                              <th className="py-1 text-left w-24">Código</th>
                              <th className="py-1 text-left">Cuenta</th>
                              <th className="py-1 text-right w-24">Debe</th>
                              <th className="py-1 text-right w-24">Haber</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border font-mono tabular-nums">
                            {partida.lineas.map((l, idx) => (
                              <tr key={idx}>
                                <td className="py-1 text-primary">{l.codigo}</td>
                                <td className="py-1 text-foreground font-sans">{getNombreCuenta(l.codigo)}</td>
                                <td className="py-1 text-right text-foreground font-medium">
                                  {l.debe > 0 ? formatoMoneda(l.debe) : "—"}
                                </td>
                                <td className="py-1 text-right text-foreground font-medium">
                                  {l.haber > 0 ? formatoMoneda(l.haber) : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Pie de Sumas Iguales Oficiales */}
              <div className="pt-4 border-t-2 border-foreground flex justify-between items-center text-xs font-mono tabular-nums font-bold text-foreground border-b-4 border-double pb-2">
                <span>SUMAS IGUALES DEL FOLIO N° {String(folioActual?.numero_folio).padStart(3, "0")}</span>
                <div className="flex gap-8">
                  <span>DEBE: {formatoMoneda(totalesFolio.totalDebe)}</span>
                  <span>HABER: {formatoMoneda(totalesFolio.totalHaber)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. VISTA EXCLUSIVA PARA IMPRESIÓN (@media print)                          */}
      {/* ========================================================================= */}
      <div className="hidden print:block fixed inset-0 bg-white p-8 z-[99999] text-black text-xs font-mono">
        <div className="text-center pb-3 border-b border-black space-y-1">
          <h1 className="text-base font-bold tracking-wider uppercase">EMPRESA COMERCIAL S.A. DE C.V.</h1>
          <p className="text-xs">LIBRO DIARIO GENERAL — SISTEMA ANALÍTICO O PORMENORIZADO</p>
          <p className="text-[11px]">
            Folio Oficial N° {String(folioActual?.numero_folio || 1).padStart(6, "0")} · Jornada: {fechaLegible}
          </p>
        </div>

        <div className="mt-4 space-y-6">
          {partidasFolio.map((partida) => {
            let pDebe = 0
            let pHaber = 0
            partida.lineas.forEach((l) => {
              pDebe += Number(l.debe) || 0
              pHaber += Number(l.haber) || 0
            })

            return (
              <div key={partida.id} className="break-inside-avoid border-b border-dashed border-slate-300 pb-3">
                <div className="flex justify-between font-bold text-xs mb-1">
                  <span>PARTIDA #{partida.numero} — {partida.concepto}</span>
                  <span>{partida.fecha}</span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-black text-[10px] uppercase">
                      <th className="text-left py-1 w-20">CÓDIGO</th>
                      <th className="text-left py-1">CONCEPTO / CUENTA</th>
                      <th className="text-right py-1 w-28">DEBE</th>
                      <th className="text-right py-1 w-28">HABER</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {partida.lineas.map((linea, idx) => (
                      <tr key={idx}>
                        <td className="py-1">{linea.codigo}</td>
                        <td className="py-1">{getNombreCuenta(linea.codigo)}</td>
                        <td className="py-1 text-right">{linea.debe > 0 ? formatoMoneda(linea.debe) : ""}</td>
                        <td className="py-1 text-right">{linea.haber > 0 ? formatoMoneda(linea.haber) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold border-t border-black">
                      <td colSpan={2} className="py-1 text-right">Sumas Partida #{partida.numero}:</td>
                      <td className="py-1 text-right">{formatoMoneda(pDebe)}</td>
                      <td className="py-1 text-right">{formatoMoneda(pHaber)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          })}
        </div>

        <div className="mt-6 pt-2 border-t-2 border-black flex justify-between text-xs font-bold tabular-nums border-b-4 border-double pb-1">
          <span>TOTALES SUMAS IGUALES DEL FOLIO:</span>
          <div className="flex gap-8">
            <span>DEBE: {formatoMoneda(totalesFolio.totalDebe)}</span>
            <span>HABER: {formatoMoneda(totalesFolio.totalHaber)}</span>
          </div>
        </div>

        <div className="mt-14 grid grid-cols-3 gap-8 text-center pt-4 border-t border-slate-300 break-inside-avoid">
          <div>
            <div className="border-t border-black pt-1">CONTADOR GENERAL</div>
          </div>
          <div>
            <div className="border-t border-black pt-1">AUDITOR INTERNO</div>
          </div>
          <div>
            <div className="border-t border-black pt-1">REPRESENTANTE LEGAL</div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. COMPONENTES GLOBALES (DRAWER Y MODALES)                                */}
      {/* ========================================================================= */}
      <HistorialFoliosDrawer
        isOpen={isHistorialOpen}
        onClose={() => setIsHistorialOpen(false)}
        cuentas={cuentas}
        onSelectFecha={(f) => {
          setFechaSeleccionada(f)
          setIsHistorialOpen(false)
        }}
      />

      {/* Modal Cierre */}
      {modalCierreOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground rounded-xl max-w-lg w-full p-6 shadow-2xl border border-border space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Lock className="size-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">
                  Cierre Formal y Foliación de Jornada Contable
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Esta acción congela permanentemente el Folio Diario N°{" "}
                  <strong>{String(folioActual?.numero_folio || 1).padStart(3, "0")}</strong> correspondiente al{" "}
                  <strong>{fechaLegible}</strong>.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2 text-xs font-mono tabular-nums">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Partidas a Foliar:</span>
                <span className="font-bold text-foreground">{totalesFolio.totalPartidas}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Débitos (Debe):</span>
                <span className="font-bold text-foreground">{formatoMoneda(totalesFolio.totalDebe)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Créditos (Haber):</span>
                <span className="font-bold text-foreground">{formatoMoneda(totalesFolio.totalHaber)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-border">
                <span className="text-muted-foreground">Estado Partida Doble:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Cuadrada ($0.00)</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalCierreOpen(false)}
                disabled={cerrandoFolio}
                className="text-xs h-9 cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleCerrarFolio}
                disabled={cerrandoFolio}
                className="text-xs h-9 px-4 gap-1.5 font-medium cursor-pointer shadow-xs"
              >
                {cerrandoFolio ? "Sellando Jornada..." : "Confirmar Cierre Legal"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reapertura */}
      {modalReabrirOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground rounded-xl max-w-lg w-full p-6 shadow-2xl border border-border space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Unlock className="size-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">
                  Reapertura Extraordinaria de Auditoría
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Para modificar o adicionar asientos a un folio cerrado se requiere registrar una justificación fiscal
                  u operativa en la bitácora de auditoría.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="motivo-reapertura" className="text-xs font-semibold text-foreground">
                Motivo / Justificación de Auditoría *
              </Label>
              <textarea
                id="motivo-reapertura"
                rows={3}
                required
                placeholder="Ej: Corrección de importe según nota de crédito recibida posteriormente..."
                value={motivoReapertura}
                onChange={(e) => setMotivoReapertura(e.target.value)}
                className="w-full text-xs p-2.5 rounded-md border border-input bg-background text-foreground mt-1 focus:ring-1 focus:ring-ring resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setModalReabrirOpen(false)
                  setMotivoReapertura("")
                }}
                disabled={reabriendoFolio}
                className="text-xs h-9 cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleReabrirFolio}
                disabled={reabriendoFolio || !motivoReapertura.trim()}
                className="text-xs h-9 px-4 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium cursor-pointer shadow-xs"
              >
                {reabriendoFolio ? "Reabriendo..." : "Autorizar Reapertura"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Asistente de Plantillas Rápidas */}
      {mostrarAsistentePlantillas && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-card text-card-foreground rounded-2xl max-w-4xl w-full p-5 sm:p-7 shadow-2xl border border-border space-y-4 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Sparkles className="size-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Asistente de Plantillas Contables
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Selecciona una operación preconfigurada para cargar automáticamente las cuentas y fórmulas de partida doble.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMostrarAsistentePlantillas(false)}
                className="size-8 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <CapturaAsistida
              cuentas={cuentas}
              onAplicarAsiento={handleAplicarDesdeAsistente}
            />
          </div>
        </div>
      )}
    </div>
  )
}
