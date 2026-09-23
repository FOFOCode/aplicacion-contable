"use client"

import React, { useState, useMemo, useEffect } from "react"
import {
  X,
  Search,
  Calendar,
  Printer,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  CheckCircle2,
  Lock,
  Unlock,
  Layers,
  Sparkles,
  FileDown,
  Table,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"
import type { Cuenta } from "@/lib/types"
import { formatoMoneda } from "@/lib/contabilidad"
import { exportarFolioPDF, exportarFolioCSV } from "@/lib/exportFolio"

export interface FolioHistorialItem {
  id: string
  ejercicio: number
  numero_folio: number
  fecha: string
  estado: "ABIERTO" | "CERRADO"
  total_debe: number
  total_haber: number
  cerrado_en?: string | null
  cerrado_por?: string | null
  creado_en?: string
  cantidad_partidas?: number
  partidas?: Array<{
    id: string
    folio_diario_id: string
    numero: number
    correlativo_global?: number
    fecha: string
    concepto: string
    tipo?: string
    estado?: string
    documento_soporte?: string
    lineas: Array<{
      codigo: string
      debe: number
      haber: number
    }>
  }>
}

interface HistorialFoliosDrawerProps {
  isOpen: boolean
  onClose: () => void
  cuentas: Cuenta[]
  onSelectFolio?: (folio: FolioHistorialItem) => void
  onSelectFecha?: (fecha: string) => void
  onReabrirFolio?: (folioId: string) => void
}

export function HistorialFoliosDrawer({
  isOpen,
  onClose,
  cuentas,
  onSelectFolio,
  onSelectFecha,
  onReabrirFolio,
}: HistorialFoliosDrawerProps) {
  const [folios, setFolios] = useState<FolioHistorialItem[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [busqueda, setBusqueda] = useState("")
  const [filtroMes, setFiltroMes] = useState<string>("TODOS")
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})

  // Cargar folios al abrir
  const fetchFolios = async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch("/api/folios")
      if (!res.ok) throw new Error("No se pudo cargar el historial de folios")
      const data = await res.json()
      setFolios(Array.isArray(data) ? data : [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchFolios()
    }
  }, [isOpen])

  // Cerrar con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  const toggleExpand = (id: string) => {
    setExpandidos((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const getNombreCuenta = (codigo: string) => {
    return cuentas.find((c) => c.codigo === codigo)?.nombre || `Cuenta ${codigo}`
  }

  // Filtrado de folios
  const foliosFiltrados = useMemo(() => {
    return folios.filter((f) => {
      // Filtro de mes
      if (filtroMes !== "TODOS") {
        const mesFolio = f.fecha.slice(0, 7) // YYYY-MM
        if (mesFolio !== filtroMes) return false
      }

      // Filtro de búsqueda
      if (!busqueda.trim()) return true
      const q = busqueda.toLowerCase()
      const matchNum = `folio ${f.numero_folio}`.toLowerCase().includes(q)
      const matchFecha = f.fecha.toLowerCase().includes(q)
      const matchPartidas = f.partidas?.some(
        (p) =>
          p.concepto.toLowerCase().includes(q) ||
          p.lineas.some((l) => l.codigo.includes(q) || getNombreCuenta(l.codigo).toLowerCase().includes(q)),
      )
      return matchNum || matchFecha || !!matchPartidas
    })
  }, [folios, busqueda, filtroMes, cuentas])

  // Meses disponibles para filtrar
  const mesesDisponibles = useMemo(() => {
    const setM = new Set<string>()
    for (const f of folios) {
      if (f.fecha) setM.add(f.fecha.slice(0, 7))
    }
    return Array.from(setM).sort().reverse()
  }, [folios])

  // Formato de fecha legible
  const formatoFecha = (fechaStr: string) => {
    try {
      const [y, m, d] = fechaStr.split("-")
      const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
      return `${parseInt(d, 10)} ${meses[parseInt(m, 10) - 1]} ${y}`
    } catch {
      return fechaStr
    }
  }

  // Exportar folio individual
  const handleExportPDF = (folio: FolioHistorialItem) => {
    exportarFolioPDF(
      {
        numero_folio: folio.numero_folio,
        fecha: folio.fecha,
        ejercicio: folio.ejercicio,
        estado: folio.estado,
        total_debe: Number(folio.total_debe) || 0,
        total_haber: Number(folio.total_haber) || 0,
        partidas: folio.partidas || [],
      },
      getNombreCuenta,
    )
  }

  const handleExportCSV = (folio: FolioHistorialItem) => {
    exportarFolioCSV(
      {
        numero_folio: folio.numero_folio,
        fecha: folio.fecha,
        ejercicio: folio.ejercicio,
        estado: folio.estado,
        total_debe: Number(folio.total_debe) || 0,
        total_haber: Number(folio.total_haber) || 0,
        partidas: folio.partidas || [],
      },
      getNombreCuenta,
    )
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-3xl bg-card text-card-foreground shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out border-l border-border">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-muted/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <FileText className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                Historial de Folios Diarios
                <Badge variant="outline" className="text-xs font-mono">
                  {foliosFiltrados.length} {foliosFiltrados.length === 1 ? "folio" : "folios"}
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground">
                Consulta foliada, inmutable y legal de jornadas contables
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Filtros */}
        <div className="p-4 border-b border-border bg-card grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-8 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por # folio, glosa, cuenta o fecha..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>
          <div className="sm:col-span-4">
            <select
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="w-full text-xs h-9 px-3 py-1.5 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="TODOS">Todos los periodos</option>
              {mesesDisponibles.map((m) => (
                <option key={m} value={m}>
                  Periodo {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Contenido / Lista de Folios */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {cargando && (
            <div className="py-16 text-center text-slate-500">
              <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium">Cargando folios contables...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <p className="font-semibold">Error al cargar:</p>
              <p className="text-xs">{error}</p>
            </div>
          )}

          {!cargando && foliosFiltrados.length === 0 && !error && (
            <div className="py-20 text-center text-slate-400">
              <FileText className="w-12 h-12 mx-auto stroke-1 mb-2 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No se encontraron folios registrados</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Los folios cerrados de cada jornada diaria aparecerán aquí con su respectiva foliatura e inmutabilidad legal.
              </p>
            </div>
          )}

          {!cargando &&
            foliosFiltrados.map((folio) => {
              const isExpanded = !!expandidos[folio.id]
              const totalDebe = Number(folio.total_debe) || 0
              const totalHaber = Number(folio.total_haber) || 0
              const cantPartidas = folio.partidas?.length ?? folio.cantidad_partidas ?? 0

              return (
                <div
                  key={folio.id}
                  className="border border-border rounded-xl bg-card shadow-xs overflow-hidden transition-all"
                >
                  {/* Tarjeta de Encabezado de Folio */}
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40">
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-primary uppercase tracking-wider">Folio</span>
                        <span className="text-sm font-bold text-primary font-mono tabular-nums">
                          #{String(folio.numero_folio).padStart(3, "0")}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground text-sm">
                            Jornada del {formatoFecha(folio.fecha)}
                          </h3>
                          {folio.estado === "CERRADO" ? (
                            <Badge variant="muted" className="text-[10px] gap-1 py-0.5">
                              <Lock className="w-3 h-3" /> FOLIADO
                            </Badge>
                          ) : (
                            <Badge variant="warning" className="text-[10px] py-0.5">
                              EN PROCESO
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 font-mono tabular-nums">
                          <span>{cantPartidas} {cantPartidas === 1 ? "comprobante" : "comprobantes"}</span>
                          <span>•</span>
                          <span>Sumas: {formatoMoneda(totalDebe)}</span>
                          {folio.cerrado_en && (
                            <>
                              <span>•</span>
                              <span className="text-[11px] text-muted-foreground">
                                Sellado: {new Date(folio.cerrado_en).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      {onSelectFecha && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            onSelectFecha(folio.fecha)
                            onClose()
                          }}
                          className="text-xs h-8 px-2 gap-1 cursor-pointer text-primary hover:bg-primary/10"
                          title="Cargar esta fecha en la mesa de trabajo"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Cargar Día</span>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExportPDF(folio)}
                        className="text-xs h-8 px-2 gap-1 cursor-pointer"
                        title="Exportar Folio a PDF"
                      >
                        <FileDown className="w-3.5 h-3.5 text-primary" />
                        <span className="hidden md:inline">PDF</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExportCSV(folio)}
                        className="text-xs h-8 px-2 gap-1 cursor-pointer"
                        title="Exportar Folio a CSV"
                      >
                        <Table className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="hidden md:inline">CSV</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleExpand(folio.id)}
                        className="text-xs h-8 gap-1 cursor-pointer"
                      >
                        {isExpanded ? (
                          <>
                            <span>Ocultar</span>
                            <ChevronUp className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            <span>Detalle</span>
                            <ChevronDown className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Detalle Desplegable con las Partidas */}
                  {isExpanded && (
                    <div className="border-t border-border p-4 bg-card space-y-3">
                      {(!folio.partidas || folio.partidas.length === 0) ? (
                        <p className="text-xs text-muted-foreground italic py-2">
                          No hay partidas registradas en este folio.
                        </p>
                      ) : (
                        folio.partidas.map((partida) => {
                          let pDebe = 0
                          let pHaber = 0
                          partida.lineas.forEach((l) => {
                            pDebe += Number(l.debe) || 0
                            pHaber += Number(l.haber) || 0
                          })

                          return (
                            <div
                              key={partida.id}
                              className="border border-border rounded-lg p-3 bg-muted/20 space-y-2 text-xs"
                            >
                              <div className="flex items-center justify-between font-semibold text-foreground">
                                <div className="flex items-center gap-2">
                                  <Badge variant="default" className="text-[11px] font-mono">
                                    Pta. #{partida.numero}
                                  </Badge>
                                  <span>{partida.concepto}</span>
                                  {partida.documento_soporte && (
                                    <span className="text-[10px] text-muted-foreground font-mono font-normal">
                                      [Doc: {partida.documento_soporte}]
                                    </span>
                                  )}
                                </div>
                                <div className="font-mono tabular-nums text-foreground text-[11px]">
                                  {formatoMoneda(pDebe)}
                                </div>
                              </div>

                              {/* Tabla de Renglones */}
                              <div className="overflow-x-auto rounded border border-border">
                                <table className="w-full text-[11px] text-left">
                                  <thead className="bg-muted/60 text-muted-foreground">
                                    <tr className="border-b border-border">
                                      <th className="px-2 py-1 font-medium w-24">Cuenta</th>
                                      <th className="px-2 py-1 font-medium">Descripción</th>
                                      <th className="px-2 py-1 font-medium text-right w-24">Debe</th>
                                      <th className="px-2 py-1 font-medium text-right w-24">Haber</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border font-mono tabular-nums">
                                    {partida.lineas.map((l, idx) => (
                                      <tr key={idx} className="hover:bg-muted/30">
                                        <td className="px-2 py-1 text-primary font-medium">{l.codigo}</td>
                                        <td className="px-2 py-1 text-foreground font-sans truncate max-w-[200px]">
                                          {getNombreCuenta(l.codigo)}
                                        </td>
                                        <td className="px-2 py-1 text-right text-foreground font-medium">
                                          {l.debe > 0 ? formatoMoneda(l.debe) : "—"}
                                        </td>
                                        <td className="px-2 py-1 text-right text-foreground font-medium">
                                          {l.haber > 0 ? formatoMoneda(l.haber) : "—"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )
                        })
                      )}

                      {/* Resumen del Folio */}
                      <div className="pt-2 flex justify-between items-center text-xs font-mono tabular-nums font-bold text-foreground border-t border-border">
                        <span>TOTALES DEL FOLIO #{String(folio.numero_folio).padStart(3, "0")}</span>
                        <div className="flex items-center gap-6">
                          <span className="text-slate-600">DEBE: {formatoMoneda(totalDebe)}</span>
                          <span className="text-slate-600">HABER: {formatoMoneda(totalHaber)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Sistema Analítico · Auditoría NIIF PYMES</span>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs cursor-pointer">
            Cerrar Historial
          </Button>
        </div>
      </div>
    </>
  )
}
