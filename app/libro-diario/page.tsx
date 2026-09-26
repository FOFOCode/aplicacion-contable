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
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Search,
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
import { CuentaFinderModal, type ResultadoFinder } from "@/components/contabilidad/CuentaFinderModal"
import { ModalAjusteContable } from "@/components/contabilidad/ModalAjusteContable"
import { useContableKeyboard } from "@/hooks/useContableKeyboard"
import { exportarFolioPDF, exportarFolioCSV } from "@/lib/exportFolio"
import { cn } from "@/lib/utils"

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
  const { cuentas, recargarAsientos } = useContabilidad()

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
  const [lineas, setLineas] = useState<LineaCaptura[]>([])
  const [guardandoPartida, setGuardandoPartida] = useState<boolean>(false)
  const [partidaEnEdicion, setPartidaEnEdicion] = useState<{
    id: string
    numero: number
  } | null>(null)

  // Modal de captura
  const [modalCapturaOpen, setModalCapturaOpen] = useState(false)

  // Finder de Cuentas estilo iOS / Spotlight
  const [finderOpen, setFinderOpen] = useState(false)
  const [lineaEnEdicionParaFinder, setLineaEnEdicionParaFinder] = useState<LineaCaptura | null>(null)

  // Modal de Ajuste Contable (Principio de Inmutabilidad y Auditoría)
  const [modalAjusteState, setModalAjusteState] = useState<{
    isOpen: boolean
    modo: "MODIFICAR" | "ANULAR"
    partida: any
  }>({
    isOpen: false,
    modo: "MODIFICAR",
    partida: null,
  })

  // Menú de exportación desplegable
  const [menuExportarOpen, setMenuExportarOpen] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  // Modales
  const [modalCierreOpen, setModalCierreOpen] = useState(false)
  const [cerrandoFolio, setCerrandoFolio] = useState(false)
  const [modalReabrirOpen, setModalReabrirOpen] = useState(false)
  const [motivoReapertura, setMotivoReapertura] = useState("")
  const [reabriendoFolio, setReabriendoFolio] = useState(false)

  // Partidas colapsadas
  const [partidasColapsadas, setPartidasColapsadas] = useState<Set<string>>(new Set())

  // Notificaciones flotantes con auto-dismiss
  const [notificacion, setNotificacion] = useState<{
    tipo: "exito" | "error"
    titulo?: string
    mensaje: string
  } | null>(null)

  // Auto-cerrar menú exportar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setMenuExportarOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Auto-dismiss para notificaciones flotantes (4 segundos)
  useEffect(() => {
    if (!notificacion) return
    const timer = setTimeout(() => {
      setNotificacion(null)
    }, 4000)
    return () => clearTimeout(timer)
  }, [notificacion])

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
        titulo: "Error de Conexión",
        mensaje: "Error de conexión al cargar el folio diario.",
      })
    } finally {
      setCargandoFolio(false)
    }
  }, [])

  useEffect(() => {
    cargarFolioFecha(fechaSeleccionada)
  }, [fechaSeleccionada, cargarFolioFecha])

  // Sincronización automática de folios en segundo plano y al regresar a la pestaña
  useEffect(() => {
    const sincronizarFolio = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        cargarFolioFecha(fechaSeleccionada)
      }
    }

    window.addEventListener("focus", sincronizarFolio)
    document.addEventListener("visibilitychange", sincronizarFolio)
    const timer = setInterval(sincronizarFolio, 20000)

    return () => {
      window.removeEventListener("focus", sincronizarFolio)
      document.removeEventListener("visibilitychange", sincronizarFolio)
      clearInterval(timer)
    }
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
        titulo: "Folio Aperturado",
        mensaje: `Folio diario para el día ${fechaSeleccionada} aperturado exitosamente.`,
      })
      await cargarFolioFecha(fechaSeleccionada)
      await recargarAsientos()
    } catch (e: unknown) {
      setNotificacion({
        tipo: "error",
        titulo: "Error al Iniciar",
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
        titulo: "Jornada Cerrada",
        mensaje: `Folio N° ${data.folio?.numero_folio} sellado e inmutable legalmente.`,
      })
      setModalCierreOpen(false)
      await cargarFolioFecha(fechaSeleccionada)
      await recargarAsientos()
    } catch (e: unknown) {
      setNotificacion({
        tipo: "error",
        titulo: "Error de Cierre",
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
        titulo: "Justificación Requerida",
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
        titulo: "Folio Reabierto",
        mensaje: "Folio habilitado para modificaciones autorizadas de auditoría.",
      })
      setModalReabrirOpen(false)
      setMotivoReapertura("")
      await cargarFolioFecha(fechaSeleccionada)
      await recargarAsientos()
    } catch (e: unknown) {
      setNotificacion({
        tipo: "error",
        titulo: "Error al Reabrir",
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

  // Abrir Finder para agregar nueva línea
  const handleAbrirFinderParaNuevaLinea = useCallback(() => {
    setLineaEnEdicionParaFinder(null)
    setFinderOpen(true)
  }, [])

  // Abrir Finder para editar línea existente
  const handleAbrirFinderParaEditarLinea = useCallback((linea: LineaCaptura) => {
    setLineaEnEdicionParaFinder(linea)
    setFinderOpen(true)
  }, [])

  // Atajo legacy para teclados
  const handleAddLinea = useCallback(() => {
    handleAbrirFinderParaNuevaLinea()
  }, [handleAbrirFinderParaNuevaLinea])

  // Eliminar línea del comprobante
  const handleRemoveLinea = (key: string) => {
    setLineas((prev) => prev.filter((l) => l.key !== key))
  }

  // Sugerencia de faltante para auto-cuadrar
  const sugerenciaFaltanteParaFinder = useMemo(() => {
    if (totalesPartidaEnCurso.diferencia <= 0) return null
    return {
      monto: totalesPartidaEnCurso.diferencia,
      lado: totalesPartidaEnCurso.diferenciaConSigno > 0 ? ("HABER" as const) : ("DEBE" as const),
    }
  }, [totalesPartidaEnCurso])

  // Confirmar y aplicar resultado del Finder
  const handleConfirmarFinder = useCallback(
    (resultado: ResultadoFinder) => {
      setLineas((prev) => {
        if (lineaEnEdicionParaFinder) {
          const idx = prev.findIndex((l) => l.key === lineaEnEdicionParaFinder.key)
          if (idx !== -1) {
            const updated = [...prev]
            updated[idx] = {
              ...updated[idx],
              codigo: resultado.lineaPrincipal.codigo,
              monto: resultado.lineaPrincipal.monto,
              operacion: resultado.lineaPrincipal.operacion,
              debeDirecto: resultado.lineaPrincipal.debeDirecto ?? "",
              haberDirecto: resultado.lineaPrincipal.haberDirecto ?? "",
            }
            if (resultado.lineaIva) {
              const ivaCod = resultado.lineaIva.codigo
              const ivaIdx = updated.findIndex((l, i) => i !== idx && l.codigo === ivaCod)
              const nuevaLineaIva: LineaCaptura = {
                key: ivaIdx !== -1 ? updated[ivaIdx].key : String(Date.now() + Math.random()),
                codigo: ivaCod,
                monto: resultado.lineaIva.monto,
                operacion: resultado.lineaIva.operacion,
                debeDirecto: resultado.lineaIva.debeDirecto ?? "",
                haberDirecto: resultado.lineaIva.haberDirecto ?? "",
              }
              if (ivaIdx !== -1) {
                updated[ivaIdx] = nuevaLineaIva
              } else {
                updated.splice(idx + 1, 0, nuevaLineaIva)
              }
            }
            return updated
          }
        }

        // Nueva línea
        const lineasExistentes = prev.filter((l) => l.codigo || l.monto || l.debeDirecto || l.haberDirecto)
        const nuevaLinea: LineaCaptura = {
          key: String(Date.now() + Math.random()),
          codigo: resultado.lineaPrincipal.codigo,
          monto: resultado.lineaPrincipal.monto,
          operacion: resultado.lineaPrincipal.operacion,
          debeDirecto: resultado.lineaPrincipal.debeDirecto ?? "",
          haberDirecto: resultado.lineaPrincipal.haberDirecto ?? "",
        }
        const nuevoArray = [...lineasExistentes, nuevaLinea]
        if (resultado.lineaIva) {
          const nuevaLineaIva: LineaCaptura = {
            key: String(Date.now() + Math.random() + 1),
            codigo: resultado.lineaIva.codigo,
            monto: resultado.lineaIva.monto,
            operacion: resultado.lineaIva.operacion,
            debeDirecto: resultado.lineaIva.debeDirecto ?? "",
            haberDirecto: resultado.lineaIva.haberDirecto ?? "",
          }
          nuevoArray.push(nuevaLineaIva)
        }
        return nuevoArray
      })
      setLineaEnEdicionParaFinder(null)
    },
    [lineaEnEdicionParaFinder]
  )

  // Auto-cuadrar partida abriendo el finder para seleccionar la cuenta contrapartida con el faltante
  const handleAutoCuadrar = useCallback(() => {
    if (totalesPartidaEnCurso.cuadrado) {
      setNotificacion({
        tipo: "exito",
        titulo: "Partida Cuadrada",
        mensaje: "La partida ya se encuentra perfectamente balanceada.",
      })
      return
    }

    if (totalesPartidaEnCurso.diferencia <= 0) {
      setNotificacion({
        tipo: "error",
        titulo: "Sin Importes",
        mensaje: "Agregue al menos una cuenta con monto antes de auto-cuadrar.",
      })
      return
    }

    const faltante = totalesPartidaEnCurso.diferencia
    const ladoNecesario = totalesPartidaEnCurso.diferenciaConSigno > 0 ? "HABER" : "DEBE"

    setLineaEnEdicionParaFinder(null)
    setFinderOpen(true)

    setNotificacion({
      tipo: "exito",
      titulo: "Asistente de Cuadratura",
      mensaje: `Selecciona la contrapartida en el Finder. Monto sugerido: ${formatoMoneda(faltante)} al ${ladoNecesario}.`,
    })
  }, [totalesPartidaEnCurso])

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
            titulo: "IVA 13% Aplicado",
            mensaje: `Base imponible: ${formatoMoneda(base)} · ${infoIva.impuestoNombre}: ${formatoMoneda(iva)} (Total: ${formatoMoneda(total)})`,
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
    setLineas([])
  }

  // Iniciar Modificación mediante Asiento de Ajuste (Modal con Nota Contable)
  const handleIniciarAjusteModificar = (partida: {
    id: string
    numero: number
    concepto: string
    fecha: string
    lineas: Array<{ codigo: string; debe: number; haber: number }>
  }) => {
    setModalAjusteState({
      isOpen: true,
      modo: "MODIFICAR",
      partida,
    })
  }

  // Iniciar Anulación mediante Asiento de Ajuste de Reversión (Modal con Nota Contable)
  const handleIniciarAjusteAnular = (partida: {
    id: string
    numero: number
    concepto: string
    fecha: string
    lineas: Array<{ codigo: string; debe: number; haber: number }>
  }) => {
    setModalAjusteState({
      isOpen: true,
      modo: "ANULAR",
      partida,
    })
  }

  // Confirmar Modificación creando un Asiento de Ajuste formal (Principio de Inmutabilidad)
  const handleConfirmarModificarConAjuste = (
    partidaOriginal: {
      id: string
      numero: number
      concepto: string
      lineas: Array<{ codigo: string; debe: number; haber: number }>
    },
    notaValida: string
  ) => {
    setPartidaEnEdicion(null)
    setTipoPartida("AJUSTE")
    setDocumentoSoporte(`Ajuste P-${partidaOriginal.numero}`)
    setConcepto(`Ajuste a Partida #${partidaOriginal.numero}: ${notaValida}`)
    setModoCaptura("CLASICO")

    const nuevasLineas: LineaCaptura[] = partidaOriginal.lineas.map((l, idx) => {
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
    setModalCapturaOpen(true)
    setNotificacion({
      tipo: "exito",
      titulo: "Asiento de Ajuste Preparado",
      mensaje: `Se ha abierto el comprobante de ajuste para la Partida #${partidaOriginal.numero}. Realice los ajustes necesarios y guárdelo.`,
    })
  }

  // Confirmar Anulación creando automáticamente un Asiento de Ajuste por Contrasiento (Reversión)
  const handleConfirmarAnularRevertirConAjuste = async (
    partidaOriginal: {
      id: string
      numero: number
      lineas: Array<{ codigo: string; debe: number; haber: number }>
    },
    notaValida: string
  ) => {
    // Invertir cargos y abonos para el asiento de ajuste
    const lineasRevertidas = partidaOriginal.lineas.map((l) => ({
      codigo: l.codigo,
      debe: Number(l.haber) || 0,
      haber: Number(l.debe) || 0,
    }))

    // 1. Crear Asiento de Ajuste de Reversión
    const payloadAjuste = {
      fecha: fechaSeleccionada,
      concepto: `Reversión contable de Partida #${partidaOriginal.numero}: ${notaValida}`,
      tipo: "AJUSTE",
      documento_soporte: `Reversión P-${partidaOriginal.numero}`,
      folio_diario_id: datosFolio?.folio?.id,
      lineas: lineasRevertidas,
    }

    const resAjuste = await fetch("/api/asientos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadAjuste),
    })

    if (!resAjuste.ok) {
      const err = await resAjuste.json().catch(() => ({}))
      throw new Error(err.error || "No se pudo registrar el asiento de reversión")
    }

    // 2. Marcar la partida original como anulada con el motivo contable
    const resAnular = await fetch(`/api/asientos/${partidaOriginal.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        motivo: `Anulada mediante Asiento de Ajuste de Reversión: ${notaValida}`,
      }),
    })

    if (!resAnular.ok) {
      const err = await resAnular.json().catch(() => ({}))
      throw new Error(err.error || "No se pudo marcar la partida como anulada")
    }

    setNotificacion({
      tipo: "exito",
      titulo: "Asiento de Reversión Creado",
      mensaje: `Partida #${partidaOriginal.numero} saldada a cero mediante Asiento de Ajuste por Contrasiento.`,
    })

    await Promise.all([cargarFolioFecha(fechaSeleccionada), recargarAsientos()])
  }



  // Guardar Partida en el Folio Abierto (POST o PUT)
  const handleGuardarPartida = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault()
      setNotificacion(null)

      if (!concepto.trim()) {
        setNotificacion({
          tipo: "error",
          titulo: "Campo Requerido",
          mensaje: "Ingrese el concepto o glosa de la partida.",
        })
        return
      }

      if (!totalesPartidaEnCurso.cuadrado) {
        setNotificacion({
          tipo: "error",
          titulo: "Diferencia Contable",
          mensaje: `La partida no cuadra. Diferencia: ${formatoMoneda(totalesPartidaEnCurso.diferencia)}`,
        })
        return
      }

      const lineasValidas = lineasProcesadas.filter(
        (l) => l.cuentaValida && (l.debe > 0 || l.haber > 0),
      )
      if (lineasValidas.length < 2) {
        setNotificacion({
          tipo: "error",
          titulo: "Renglones Insuficientes",
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
          titulo: isEditing ? "Partida Actualizada" : "Partida Guardada",
          mensaje: isEditing
            ? `Partida #${partidaEnEdicion.numero} actualizada con éxito.`
            : "Partida guardada exitosamente en el folio de hoy.",
        })

        handleLimpiarFormulario()
        setModalCapturaOpen(false)
        await Promise.all([cargarFolioFecha(fechaSeleccionada), recargarAsientos()])
      } catch (e: unknown) {
        setNotificacion({
          tipo: "error",
          titulo: "Error al Procesar",
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
      recargarAsientos,
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
      setModalCapturaOpen(false)
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

  // Toggle colapsar partida
  const toggleColapsarPartida = (id: string) => {
    setPartidasColapsadas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Colapsar/Expandir todas
  const handleColapsarTodas = () => {
    if (partidasColapsadas.size === partidasFolio.length) {
      setPartidasColapsadas(new Set())
    } else {
      setPartidasColapsadas(new Set(partidasFolio.map((p) => p.id)))
    }
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

  // =========================================================================
  // RENDER: Formulario de captura (reutilizado en modal)
  // =========================================================================
  const renderFormularioCaptura = () => (
    <form onSubmit={handleGuardarPartida} className="space-y-5">
      {/* Banner de Modo Ajuste Contable */}
      {tipoPartida === "AJUSTE" && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <Sliders className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Asiento de Ajuste Contable formal en folio abierto (con trazabilidad de auditoría).</span>
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

      {/* Selector de Modo de Captura (Segmented Tabs) y Botón Buscar Cuenta */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 rounded-lg bg-muted/40 p-1 border border-border">
          <button
            type="button"
            onClick={() => handleCambiarModoCaptura("SMART")}
            className={cn(
              "py-1.5 px-4 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer",
              modoCaptura === "SMART"
                ? "bg-card text-foreground shadow-xs border border-border/50"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Zap className="size-3 text-amber-500" />
            <span>SMART (+/-)</span>
          </button>
          <button
            type="button"
            onClick={() => handleCambiarModoCaptura("CLASICO")}
            className={cn(
              "py-1.5 px-4 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer",
              modoCaptura === "CLASICO"
                ? "bg-card text-foreground shadow-xs border border-border/50"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Sliders className="size-3 text-primary" />
            <span>CLÁSICO (D/H)</span>
          </button>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={handleAbrirFinderParaNuevaLinea}
          className="text-xs h-8 gap-1.5 font-medium cursor-pointer shadow-xs"
        >
          <Search className="size-3.5" />
          <span>Buscar Cuenta</span>
        </Button>
      </div>

      {/* Metadatos: Doc Soporte + Tipo de Asiento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="doc-soporte" className="text-[11px] font-medium text-muted-foreground">
            Doc. Soporte / Factura
          </Label>
          <Input
            id="doc-soporte"
            placeholder="Ej: F-102, CCF-45..."
            value={documentoSoporte}
            onChange={(e) => setDocumentoSoporte(e.target.value)}
            className="text-xs h-9 font-mono mt-1"
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
            className="w-full text-xs h-9 px-3 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring mt-1 cursor-pointer font-medium"
          >
            <option value="OPERACION">Operación</option>
            <option value="AJUSTE">Ajuste</option>
            <option value="CIERRE">Cierre</option>
          </select>
        </div>
      </div>

      {/* Concepto / Glosa */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="concepto-modal" className="text-[11px] font-medium text-foreground">
            Concepto o Glosa *
          </Label>
          <span className="text-[10px] text-muted-foreground">Sistema Analítico</span>
        </div>
        <textarea
          id="concepto-modal"
          rows={2}
          required
          placeholder="Ej: Compra de mercadería al contado según factura..."
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          className="w-full text-xs p-3 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
        />
        {/* Sugerencias rápidas */}
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

      {/* Renglones Contables: Visualización Pura sin Inputs */}
      <div className="space-y-2 pt-3 border-t border-border">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            Renglones Contables
            <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 font-mono">
              {lineasProcesadas.filter((l) => l.cuentaValida).length}
            </Badge>
          </span>
          <span className="text-[11px] text-muted-foreground font-mono">
            {modoCaptura === "SMART" ? "Modo Asistido (+/-)" : "Modo Clásico (D/H)"}
          </span>
        </div>

        {lineasProcesadas.filter((l) => l.cuentaValida).length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-3 bg-muted/10">
            <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Search className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">
                No hay cuentas contables agregadas
              </p>
              <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                Haz clic en el buscador para seleccionar cuentas, definir montos y aplicar IVA automáticamente.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleAbrirFinderParaNuevaLinea}
              className="text-xs h-8 gap-1.5 font-medium cursor-pointer shadow-xs"
            >
              <Search className="size-3.5" />
              <span>Abrir Buscador de Cuentas</span>
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-muted-foreground text-[11px] font-medium">
                  <th className="py-2 px-3 text-left w-10 font-mono">#</th>
                  <th className="py-2 px-3 text-left">Cuenta Contable</th>
                  <th className="py-2 px-3 text-center w-28">Movimiento</th>
                  <th className="py-2 px-3 text-right w-28 font-mono">Debe</th>
                  <th className="py-2 px-3 text-right w-28 font-mono">Haber</th>
                  <th className="py-2 px-3 text-right w-20">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono tabular-nums">
                {lineasProcesadas.map((linea, index) => {
                  if (!linea.cuentaValida) return null
                  const c = linea.cuenta
                  const esDebe = linea.debe > 0
                  const esHaber = linea.haber > 0

                  return (
                    <tr key={linea.key} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3 text-muted-foreground font-bold">
                        {index + 1}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-primary font-bold text-xs">
                              {linea.codigo}
                            </span>
                            <span className="text-foreground font-medium truncate max-w-[180px] sm:max-w-[260px]">
                              {c ? c.nombre : getNombreCuenta(linea.codigo)}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground truncate">
                            {c ? formatearCuentaJerarquica(c, cuentasMap).principal : ""}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        {modoCaptura === "SMART" ? (
                          <Badge
                            variant={linea.operacion === "AUMENTA" ? "default" : "muted"}
                            className="text-[10px] px-2 py-0.5 font-normal"
                          >
                            {linea.operacion === "AUMENTA" ? "+ Aumenta" : "- Disminuye"}
                          </Badge>
                        ) : (
                          <Badge
                            variant={esDebe ? "default" : "muted"}
                            className="text-[10px] px-2 py-0.5 font-normal"
                          >
                            {esDebe ? "Debe (Cargo)" : "Haber (Abono)"}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-foreground">
                        {esDebe ? formatoMoneda(linea.debe) : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-foreground">
                        {esHaber ? formatoMoneda(linea.haber) : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-sans">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleAbrirFinderParaEditarLinea(linea)}
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title="Editar renglón en Finder"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveLinea(linea.key)}
                            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Eliminar renglón"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Botones de Acción de Renglones */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAbrirFinderParaNuevaLinea}
            className="text-xs h-8 gap-1.5 flex-1 cursor-pointer font-medium"
          >
            <Search className="size-3.5 text-primary" />
            <span>Buscar Cuenta</span>
            <kbd className="text-[10px] font-mono text-muted-foreground">Alt+A</kbd>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAutoCuadrar}
            className="text-xs h-8 gap-1.5 flex-1 cursor-pointer hover:border-amber-500/50 hover:bg-amber-500/10 font-medium"
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
      <div className="pt-3 border-t border-border flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-4 font-mono text-xs tabular-nums">
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
          className="text-xs h-10 px-5 font-semibold gap-1.5 shadow-xs cursor-pointer"
          title="Guardar partida (Alt + G)"
        >
          {guardandoPartida ? (
            "Guardando..."
          ) : tipoPartida === "AJUSTE" ? (
            "Guardar Asiento de Ajuste"
          ) : (
            "Guardar en Folio"
          )}
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </form>
  )

  return (
    <div className="space-y-4">
      <div className="print:hidden space-y-4">
        {/* ========================================================================= */}
        {/* 1. PANEL DE CONTROL SUPERIOR                                               */}
        {/* ========================================================================= */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs transition-all">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Izquierda: Fecha, Folio y Altura Jerárquica */}
            <div className="space-y-1">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground capitalize">
                {fechaLegible}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {folioActual
                    ? `Folio Diario N° ${String(folioActual.numero_folio).padStart(3, "0")}`
                    : "Libro Diario General"}
                </span>
                {estadoFolio === "ABIERTO" && (
                  <Badge variant="success" className="gap-1.5 py-0.5 px-2.5 font-medium shadow-xs">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    EN PROCESO
                  </Badge>
                )}
                {estadoFolio === "CERRADO" && (
                  <Badge variant="muted" className="gap-1 py-0.5 px-2.5 font-medium shadow-xs">
                    <Lock className="size-3 text-muted-foreground" />
                    FOLIADO Y CERRADO
                  </Badge>
                )}
                {estadoFolio === "NO_INICIADO" && (
                  <Badge variant="warning" className="py-0.5 px-2.5 font-medium shadow-xs">
                    NO INICIADO
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground font-medium">
                Altura jerárquica: A1-R (Día) · A1-R (Guardia) · A1-A (Guardia)
              </p>
            </div>

            {/* Derecha: 2 Niveles Ordenados (Navegación / Exportar y Acciones Principales) */}
            <div className="flex flex-col sm:items-end gap-2.5">
              {/* Nivel 1: Selector de Fecha + Folios Anteriores + Menú Desplegable Exportar */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Selector de fecha con atajos Hoy/Ayer */}
                <div className="flex items-center rounded-lg border border-border bg-muted/40 p-1 text-xs shadow-xs">
                  <button
                    type="button"
                    onClick={handleSetHoy}
                    className="rounded px-2 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-card transition-colors cursor-pointer"
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={handleSetAyer}
                    className="rounded px-2 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-card transition-colors cursor-pointer"
                  >
                    Ayer
                  </button>
                  <div className="mx-1 h-3.5 w-px bg-border" />
                  <div className="flex items-center gap-1.5 px-1.5">
                    <Calendar className="size-3.5 text-muted-foreground shrink-0" />
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
                  className="text-xs h-8 gap-1.5 cursor-pointer bg-card/60 hover:bg-muted"
                  title="Ver folios anteriores (Alt + H)"
                >
                  <FolderOpen className="size-3.5 text-muted-foreground" />
                  <span className="hidden sm:inline">Folios Anteriores</span>
                </Button>

                {/* Menú Desplegable Exportar / Imprimir */}
                {folioActual && (
                  <div ref={exportMenuRef} className="relative">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMenuExportarOpen((prev) => !prev)}
                      className="text-xs h-8 px-2.5 gap-1.5 cursor-pointer bg-card/60 hover:bg-muted"
                      title="Opciones de exportación e impresión"
                    >
                      <FileDown className="size-3.5 text-primary" />
                      <span>Exportar</span>
                      <ChevronDown
                        className={cn(
                          "size-3 text-muted-foreground transition-transform duration-150",
                          menuExportarOpen && "rotate-180",
                        )}
                      />
                    </Button>

                    {menuExportarOpen && (
                      <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-border bg-popover/95 p-1 text-popover-foreground shadow-2xl backdrop-blur-md z-50 animate-in fade-in zoom-in-95 duration-100">
                        <button
                          type="button"
                          onClick={() => {
                            setMenuExportarOpen(false)
                            handleExportPDF()
                          }}
                          className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-muted transition-colors cursor-pointer text-left"
                        >
                          <FileDown className="size-4 text-primary" />
                          <div>
                            <p className="font-semibold text-foreground">Descargar PDF</p>
                            <p className="text-[10px] text-muted-foreground">Comprobante legal con firmas</p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setMenuExportarOpen(false)
                            handleExportCSV()
                          }}
                          className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-muted transition-colors cursor-pointer text-left"
                        >
                          <Table className="size-4 text-emerald-500" />
                          <div>
                            <p className="font-semibold text-foreground">Exportar CSV</p>
                            <p className="text-[10px] text-muted-foreground">Compatible con Excel</p>
                          </div>
                        </button>

                        <div className="my-1 h-px bg-border" />

                        <button
                          type="button"
                          onClick={() => {
                            setMenuExportarOpen(false)
                            window.print()
                          }}
                          className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-muted transition-colors cursor-pointer text-left"
                        >
                          <Printer className="size-4 text-muted-foreground" />
                          <div>
                            <p className="font-semibold text-foreground">Imprimir Folio</p>
                            <p className="text-[10px] text-muted-foreground">Vista oficial de imprenta</p>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Nivel 2: Acciones Principales (Agregar Partida + Cerrar Folio / Reapertura) */}
              <div className="flex items-center gap-2 justify-end w-full sm:w-auto">
                {estadoFolio === "ABIERTO" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => {
                        handleLimpiarFormulario()
                        setModalCapturaOpen(true)
                      }}
                      className="text-xs h-9 px-4 gap-2 font-semibold cursor-pointer shadow-xs"
                    >
                      <Plus className="size-3.5" />
                      <span>Agregar partida</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setModalCierreOpen(true)}
                      disabled={totalesFolio.totalPartidas === 0 || !totalesFolio.cuadrado}
                      className="text-xs h-9 px-3.5 gap-2 font-medium cursor-pointer border-border bg-card/60 hover:bg-muted text-foreground disabled:opacity-40"
                      title={
                        totalesFolio.totalPartidas === 0
                          ? "Requiere al menos una partida para cerrar"
                          : !totalesFolio.cuadrado
                          ? "El folio debe estar cuadrado para cerrar"
                          : "Cerrar y sellar jornada del día"
                      }
                    >
                      <Lock className="size-3.5 text-emerald-500" />
                      <span>Cerrar Folio del Día</span>
                    </Button>
                  </>
                )}

                {estadoFolio === "CERRADO" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setModalReabrirOpen(true)}
                    className="text-xs h-9 px-3.5 gap-1.5 text-amber-500 hover:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 cursor-pointer"
                  >
                    <Unlock className="size-3.5" />
                    <span>Reapertura de Auditoría</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. CONTENIDO PRINCIPAL SEGÚN EL ESTADO DEL FOLIO                          */}
        {/* ========================================================================= */}
        {cargandoFolio ? (
          <div className="py-24 text-center bg-card rounded-xl border border-border shadow-xs">
            <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">Verificando estado del folio contable...</p>
            <p className="text-xs text-muted-foreground mt-1">Conectando con base de datos PostgreSQL 16</p>
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
          /* CASO 2: FOLIO ABIERTO — VISTA FULL-WIDTH DE PARTIDAS                      */
          /* ========================================================================= */
          <div className="space-y-4">
            {/* KPI Strip compacto */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-card border border-border rounded-xl p-3.5 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Total Debe
                  </span>
                  <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <ArrowDownLeft className="size-3" />
                  </div>
                </div>
                <p className="text-lg font-black text-foreground font-mono tabular-nums">
                  {formatoMoneda(totalesFolio.totalDebe)}
                </p>
              </div>

              <div className="bg-card border border-border rounded-xl p-3.5 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Total Haber
                  </span>
                  <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <ArrowUpRight className="size-3" />
                  </div>
                </div>
                <p className="text-lg font-black text-foreground font-mono tabular-nums">
                  {formatoMoneda(totalesFolio.totalHaber)}
                </p>
              </div>

              <div className="bg-card border border-border rounded-xl p-3.5 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Partida Doble
                  </span>
                  <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <ShieldCheck className="size-3" />
                  </div>
                </div>
                <div className="mt-0.5">
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
              </div>

              <div className="bg-card border border-border rounded-xl p-3.5 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Comprobantes
                  </span>
                  <div className="size-6 rounded-md bg-muted text-muted-foreground flex items-center justify-center">
                    <FileText className="size-3" />
                  </div>
                </div>
                <p className="text-lg font-black text-foreground font-mono tabular-nums">
                  {totalesFolio.totalPartidas} {totalesFolio.totalPartidas === 1 ? "partida" : "partidas"}
                </p>
              </div>
            </div>

            {/* Full-Width Partidas Area */}
            <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
              {/* Header de la sección */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2.5">
                  <div className="size-6 rounded-md bg-muted flex items-center justify-center text-foreground">
                    <Layers className="size-3.5" />
                  </div>
                  <h2 className="text-sm font-bold text-foreground">
                    Comprobantes de la Jornada
                  </h2>
                  <Badge variant="outline" className="text-[10px] font-mono px-1.5">
                    {partidasFolio.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {partidasFolio.length > 1 && (
                    <button
                      type="button"
                      onClick={handleColapsarTodas}
                      className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <ChevronsUpDown className="size-3.5" />
                      {partidasColapsadas.size === partidasFolio.length ? "Expandir todas" : "Colapsar todas"}
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable partidas container */}
              {partidasFolio.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <BookOpen className="size-12 text-muted-foreground/60 mx-auto stroke-1" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-foreground">Aún no hay comprobantes registrados</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                      Haz clic en &ldquo;Agregar partida&rdquo; para registrar compras, ventas o gastos del día.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      handleLimpiarFormulario()
                      setModalCapturaOpen(true)
                    }}
                    className="text-xs h-9 gap-2 cursor-pointer mt-2"
                  >
                    <Plus className="size-3.5" />
                    Agregar primera partida
                  </Button>
                </div>
              ) : (
                <div className="max-h-[calc(100vh-22rem)] overflow-y-auto">
                  <div className="divide-y divide-border">
                    {partidasFolio.map((partida) => {
                      let pDebe = 0
                      let pHaber = 0
                      partida.lineas.forEach((l) => {
                        pDebe += Number(l.debe) || 0
                        pHaber += Number(l.haber) || 0
                      })
                      const esAnulado = partida.estado === "ANULADO"
                      const estaEditandoEsta = partidaEnEdicion?.id === partida.id
                      const estaColapsada = partidasColapsadas.has(partida.id)

                      return (
                        <div
                          key={partida.id}
                          className={cn(
                            "transition-all",
                            estaEditandoEsta
                              ? "bg-primary/5"
                              : esAnulado
                              ? "opacity-60 bg-red-500/5"
                              : "hover:bg-muted/20",
                          )}
                        >
                          {/* Partida Header Row — always visible, clickable to collapse */}
                          <div
                            className="flex items-center gap-3 px-5 py-3 cursor-pointer select-none"
                            onClick={() => toggleColapsarPartida(partida.id)}
                          >
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                            >
                              {estaColapsada ? (
                                <ChevronDown className="size-4" />
                              ) : (
                                <ChevronUp className="size-4" />
                              )}
                            </button>

                            <span className="font-mono text-xs font-bold text-foreground bg-muted px-2 py-0.5 rounded shrink-0">
                              #{partida.numero}
                            </span>

                            <p className={cn(
                              "text-xs font-medium text-foreground flex-1 min-w-0 truncate",
                              esAnulado && "line-through text-muted-foreground"
                            )}>
                              {partida.concepto}
                            </p>

                            <div className="flex items-center gap-2 shrink-0">
                              {partida.tipo && (
                                <Badge variant="outline" className="text-[10px] font-normal hidden sm:inline-flex">
                                  {partida.tipo}
                                </Badge>
                              )}
                              {partida.documento_soporte && (
                                <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">
                                  {partida.documento_soporte}
                                </span>
                              )}
                              {esAnulado && (
                                <Badge variant="warning" className="text-[10px]">
                                  ANULADO
                                </Badge>
                              )}
                              <span className="font-mono text-xs tabular-nums font-bold text-foreground w-24 text-right">
                                {formatoMoneda(pDebe)}
                              </span>
                              <span className="font-mono text-xs tabular-nums font-bold text-foreground w-24 text-right">
                                {formatoMoneda(pHaber)}
                              </span>

                              {/* Action buttons */}
                              {!esAnulado && estadoFolio === "ABIERTO" && (
                                <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => handleIniciarAjusteModificar(partida)}
                                    title="Modificar mediante Asiento de Ajuste"
                                    className="text-muted-foreground hover:text-foreground p-1.5 rounded transition-colors cursor-pointer hover:bg-muted"
                                  >
                                    <Pencil className="size-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleIniciarAjusteAnular(partida)}
                                    title="Anular mediante Asiento de Ajuste (Reversión)"
                                    className="text-muted-foreground hover:text-destructive p-1.5 rounded transition-colors cursor-pointer hover:bg-red-500/10"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Expandable detail — account lines table */}
                          {!estaColapsada && (
                            <div className="px-5 pb-3">
                              <div className="ml-9 rounded-lg border border-border overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-muted-foreground font-medium bg-muted/40 text-[11px]">
                                      <th className="text-left py-1.5 px-3 w-20">Código</th>
                                      <th className="text-left py-1.5 px-3">Cuenta</th>
                                      <th className="text-right py-1.5 px-3 w-28">Debe</th>
                                      <th className="text-right py-1.5 px-3 w-28">Haber</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border/60 font-mono tabular-nums text-xs">
                                    {partida.lineas.map((linea, idx) => (
                                      <tr key={idx} className="hover:bg-muted/20">
                                        <td className="py-1.5 px-3 text-primary font-medium">{linea.codigo}</td>
                                        <td className="py-1.5 px-3 text-foreground font-sans">
                                          {getNombreCuenta(linea.codigo)}
                                        </td>
                                        <td className="py-1.5 px-3 text-right text-foreground font-medium">
                                          {linea.debe > 0 ? formatoMoneda(linea.debe) : "—"}
                                        </td>
                                        <td className="py-1.5 px-3 text-right text-foreground font-medium">
                                          {linea.haber > 0 ? formatoMoneda(linea.haber) : "—"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Resumen Total al Pie */}
                  <div className="sticky bottom-0 bg-muted/80 backdrop-blur-sm border-t border-border px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono tabular-nums">
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
        ) : (
          /* ========================================================================= */
          /* CASO 3: FOLIO CERRADO (JORNADA SELLADA CON INMUTABILIDAD ESTRICTA)         */
          /* ========================================================================= */
          <div className="space-y-4">
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
            <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <FileCheck className="size-4 text-primary" />
                  Comprobantes Foliados en este Libro Diario
                </h3>
                {partidasFolio.length > 1 && (
                  <button
                    type="button"
                    onClick={handleColapsarTodas}
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <ChevronsUpDown className="size-3.5" />
                    {partidasColapsadas.size === partidasFolio.length ? "Expandir todas" : "Colapsar todas"}
                  </button>
                )}
              </div>

              <div className="max-h-[calc(100vh-24rem)] overflow-y-auto divide-y divide-border">
                {partidasFolio.map((partida) => {
                  let pDebe = 0
                  let pHaber = 0
                  partida.lineas.forEach((l) => {
                    pDebe += Number(l.debe) || 0
                    pHaber += Number(l.haber) || 0
                  })
                  const estaColapsada = partidasColapsadas.has(partida.id)

                  return (
                    <div key={partida.id} className="hover:bg-muted/10 transition-colors">
                      <div
                        className="flex items-center gap-3 px-5 py-3 cursor-pointer select-none"
                        onClick={() => toggleColapsarPartida(partida.id)}
                      >
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                        >
                          {estaColapsada ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronUp className="size-4" />
                          )}
                        </button>

                        <span className="font-mono text-xs font-bold text-foreground bg-muted px-2 py-0.5 rounded shrink-0">
                          #{partida.numero}
                        </span>

                        <p className="text-xs font-medium text-foreground flex-1 min-w-0 truncate">
                          {partida.concepto}
                        </p>

                        <div className="flex items-center gap-2 shrink-0">
                          {partida.documento_soporte && (
                            <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">
                              ({partida.documento_soporte})
                            </span>
                          )}
                          <span className="font-mono text-xs tabular-nums font-bold text-foreground w-24 text-right">
                            {formatoMoneda(pDebe)}
                          </span>
                          <span className="font-mono text-xs tabular-nums font-bold text-foreground w-24 text-right">
                            {formatoMoneda(pHaber)}
                          </span>
                        </div>
                      </div>

                      {!estaColapsada && (
                        <div className="px-5 pb-3">
                          <div className="ml-9 rounded-lg border border-border overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-muted-foreground font-medium bg-muted/40 text-[11px]">
                                  <th className="py-1.5 px-3 text-left w-24">Código</th>
                                  <th className="py-1.5 px-3 text-left">Cuenta</th>
                                  <th className="py-1.5 px-3 text-right w-28">Debe</th>
                                  <th className="py-1.5 px-3 text-right w-28">Haber</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border font-mono tabular-nums">
                                {partida.lineas.map((l, idx) => (
                                  <tr key={idx}>
                                    <td className="py-1.5 px-3 text-primary">{l.codigo}</td>
                                    <td className="py-1.5 px-3 text-foreground font-sans">{getNombreCuenta(l.codigo)}</td>
                                    <td className="py-1.5 px-3 text-right text-foreground font-medium">
                                      {l.debe > 0 ? formatoMoneda(l.debe) : "—"}
                                    </td>
                                    <td className="py-1.5 px-3 text-right text-foreground font-medium">
                                      {l.haber > 0 ? formatoMoneda(l.haber) : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Pie de Sumas Iguales Oficiales */}
              <div className="sticky bottom-0 bg-card border-t-2 border-foreground px-5 py-3 flex justify-between items-center text-xs font-mono tabular-nums font-bold text-foreground border-b-4 border-double">
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

      {/* ========================================================================= */}
      {/* MODAL: Registro de Comprobante (Agregar / Editar partida / Ajuste)        */}
      {/* ========================================================================= */}
      {modalCapturaOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-start justify-center p-4 pt-[4vh] overflow-y-auto">
          <div className="bg-card text-card-foreground rounded-2xl max-w-3xl w-full shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                  {tipoPartida === "AJUSTE" ? (
                    <Sliders className="size-4" />
                  ) : partidaEnEdicion ? (
                    <Pencil className="size-4" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">
                    {tipoPartida === "AJUSTE"
                      ? "Nuevo Asiento de Ajuste Contable"
                      : partidaEnEdicion
                      ? `Editando Partida #${partidaEnEdicion.numero}`
                      : "Registro de comprobante"}
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Folio #{String(folioActual?.numero_folio || 1).padStart(3, "0")} · {fechaLegible}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalCapturaOpen(false)
                  if (partidaEnEdicion) handleLimpiarFormulario()
                }}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5">
              {renderFormularioCaptura()}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FINDER DE CUENTAS ESTILO IOS / SPOTLIGHT (CON FONDO BLUR TOTAL)          */}
      {/* ========================================================================= */}
      <CuentaFinderModal
        isOpen={finderOpen}
        onClose={() => {
          setFinderOpen(false)
          setLineaEnEdicionParaFinder(null)
        }}
        cuentas={cuentas}
        cuentasMap={cuentasMap}
        modoCaptura={modoCaptura}
        lineaEnEdicion={lineaEnEdicionParaFinder}
        sugerenciaFaltante={sugerenciaFaltanteParaFinder}
        onConfirmar={handleConfirmarFinder}
      />

      {/* ========================================================================= */}
      {/* MODAL DE AJUSTE CONTABLE CON NOTA VÁLIDA (PRINCIPIO DE INMUTABILIDAD)     */}
      {/* ========================================================================= */}
      <ModalAjusteContable
        isOpen={modalAjusteState.isOpen}
        onClose={() => setModalAjusteState({ isOpen: false, modo: "MODIFICAR", partida: null })}
        modo={modalAjusteState.modo}
        partida={modalAjusteState.partida}
        onConfirmarModificar={handleConfirmarModificarConAjuste}
        onConfirmarAnularRevertir={handleConfirmarAnularRevertirConAjuste}
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

      {/* ========================================================================= */}
      {/* NOTIFICACIÓN EMERGENTE FLOTANTE (TOAST PROFESIONAL)                        */}
      {/* ========================================================================= */}
      {notificacion && (
        <div className="fixed bottom-6 right-6 z-[200] max-w-sm w-full animate-in fade-in slide-in-from-bottom-5 duration-200 pointer-events-auto">
          <div
            className={cn(
              "rounded-xl border p-3.5 shadow-2xl backdrop-blur-md flex items-start gap-3 bg-card/95 text-card-foreground",
              notificacion.tipo === "exito"
                ? "border-emerald-500/30"
                : "border-red-500/30",
            )}
          >
            <div
              className={cn(
                "size-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                notificacion.tipo === "exito"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-red-500/15 text-red-400",
              )}
            >
              {notificacion.tipo === "exito" ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <AlertCircle className="size-4" />
              )}
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <p className="text-xs font-bold text-foreground">
                {notificacion.titulo || (notificacion.tipo === "exito" ? "Operación Exitosa" : "Atención Requerida")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed break-words">
                {notificacion.mensaje}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setNotificacion(null)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors cursor-pointer shrink-0"
              title="Cerrar notificación"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
