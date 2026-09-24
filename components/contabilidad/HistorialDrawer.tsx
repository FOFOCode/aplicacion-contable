"use client"

import React, { useState, useMemo, useEffect } from "react"
import {
  X,
  Search,
  Calendar,
  Printer,
  Ban,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Hash,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"
import type { Asiento, Cuenta } from "@/lib/types"
import { formatoMoneda, totalesAsiento } from "@/lib/contabilidad"

interface HistorialDrawerProps {
  isOpen: boolean
  onClose: () => void
  asientos: Asiento[]
  cuentas: Cuenta[]
  onAnular?: (id: string, motivo: string) => void
}

export function HistorialDrawer({
  isOpen,
  onClose,
  asientos,
  cuentas,
  onAnular,
}: HistorialDrawerProps) {
  const [busqueda, setBusqueda] = useState("")
  const [filtroEstado, setFiltroEstado] = useState<"TODAS" | "APLICADAS" | "ANULADAS">("TODAS")
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})

  // Cerrar con Escape
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

  const buscarNombre = (codigo: string) => {
    return cuentas.find((c) => c.codigo === codigo)?.nombre || `Cuenta ${codigo}`
  }

  // Filtrado reactivo en memoria
  const asientosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()

    return [...asientos]
      .sort((a, b) => b.numero - a.numero)
      .filter((a) => {
        if (filtroEstado === "APLICADAS" && a.estado === "ANULADO") return false
        if (filtroEstado === "ANULADAS" && a.estado !== "ANULADO") return false

        if (!q) return true

        const matchNumero = String(a.numero).includes(q) || String(a.correlativo_global || "").includes(q)
        const matchConcepto = a.concepto.toLowerCase().includes(q)
        const matchFecha = a.fecha.includes(q)
        const matchDoc = a.documento_soporte ? a.documento_soporte.toLowerCase().includes(q) : false
        const matchCuentas = a.lineas.some(
          (l) => l.codigo.includes(q) || buscarNombre(l.codigo).toLowerCase().includes(q),
        )

        return matchNumero || matchConcepto || matchFecha || matchDoc || matchCuentas
      })
  }, [asientos, busqueda, filtroEstado, cuentas])

  const handleImprimir = (asiento: Asiento) => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const { debe, haber } = totalesAsiento(asiento.lineas)

    const htmlContent = `
      <html>
        <head>
          <title>Partida #${asiento.numero}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; font-size: 12px; color: #111; }
            h1 { font-size: 16px; margin-bottom: 2px; }
            .meta { color: #555; margin-bottom: 16px; font-size: 11px; }
            .concepto { font-weight: 500; margin-bottom: 16px; padding: 8px 12px; background: #f9f9f9; border-left: 3px solid #000; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border-bottom: 1px solid #e5e5e5; padding: 8px; text-align: left; }
            th { font-size: 10px; text-transform: uppercase; color: #666; background: #f5f5f5; }
            .text-right { text-align: right; }
            .font-mono { font-family: monospace; }
            .abono { padding-left: 20px; font-style: italic; color: #444; }
            .totales { font-weight: bold; border-top: 2px solid #000; border-bottom: 3px double #000; }
          </style>
        </head>
        <body>
          <h1>Comprobante de Diario · Partida #${asiento.numero}</h1>
          <div class="meta">
            Folio Global: #${asiento.correlativo_global || asiento.numero} · Fecha: ${asiento.fecha} · Estado: ${asiento.estado || "APLICADO"}
            ${asiento.documento_soporte ? `· Doc. Soporte: ${asiento.documento_soporte}` : ""}
          </div>
          <div class="concepto">${asiento.concepto}</div>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Cuenta Contable</th>
                <th class="text-right">Debe ($)</th>
                <th class="text-right">Haber ($)</th>
              </tr>
            </thead>
            <tbody>
              ${asiento.lineas
                .map((l) => {
                  const esAbono = Number(l.haber) > 0 && Number(l.debe) === 0
                  return `
                    <tr>
                      <td class="font-mono">${l.codigo}</td>
                      <td class="${esAbono ? "abono" : ""}">${buscarNombre(l.codigo)}</td>
                      <td class="text-right font-mono">${Number(l.debe) > 0 ? Number(l.debe).toFixed(2) : "-"}</td>
                      <td class="text-right font-mono">${Number(l.haber) > 0 ? Number(l.haber).toFixed(2) : "-"}</td>
                    </tr>
                  `
                })
                .join("")}
              <tr class="totales">
                <td colspan="2">SUMAS IGUALES</td>
                <td class="text-right font-mono">$${debe.toFixed(2)}</td>
                <td class="text-right font-mono">$${haber.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `
    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }

  const handleAnularPartida = (asiento: Asiento) => {
    if (asiento.estado === "ANULADO") return
    const motivo = window.prompt("Ingresa el motivo formal de anulación (mínimo 6 caracteres):")
    if (!motivo || motivo.trim().length < 6) {
      if (motivo) alert("El motivo debe tener al menos 6 caracteres.")
      return
    }
    onAnular?.(asiento.id, motivo.trim())
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      {/* Drawer Panel */}
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-border bg-card shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Cabecera Drawer */}
        <div className="flex items-center justify-between border-b border-border/80 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Clock className="size-4 text-muted-foreground" />
            <div>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                Historial de Partidas
                <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {asientos.length} registradas
                </span>
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Consulta foliada y reimpresión sin abandonar la hoja activa.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="size-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Buscador y Filtro Rápido */}
        <div className="border-b border-border/80 p-4 space-y-2.5 bg-muted/10">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por #, folio, concepto, cuenta o fecha..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-8 text-xs h-8 bg-background border-border/70"
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="inline-flex rounded-lg border border-border/60 p-0.5 bg-background text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setFiltroEstado("TODAS")}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  filtroEstado === "TODAS"
                    ? "bg-muted text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Todas ({asientos.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado("APLICADAS")}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  filtroEstado === "APLICADAS"
                    ? "bg-muted text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Válidas
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado("ANULADAS")}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  filtroEstado === "ANULADAS"
                    ? "bg-muted text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Anuladas
              </button>
            </div>

            <span className="text-[11px] text-muted-foreground">
              {asientosFiltrados.length} resultado(s)
            </span>
          </div>
        </div>

        {/* Lista Compacta en Acordeón */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {asientosFiltrados.length === 0 ? (
            <div className="py-16 text-center space-y-2 text-muted-foreground">
              <FileText className="size-8 mx-auto opacity-40" />
              <p className="text-xs font-medium">No se encontraron partidas</p>
              <p className="text-[11px]">Prueba con otro término de búsqueda.</p>
            </div>
          ) : (
            asientosFiltrados.map((asiento) => {
              const expandido = Boolean(expandidos[asiento.id])
              const { debe, haber } = totalesAsiento(asiento.lineas)
              const esAnulado = asiento.estado === "ANULADO"

              return (
                <div
                  key={asiento.id}
                  className={`rounded-lg border transition-all text-xs overflow-hidden ${
                    esAnulado
                      ? "border-red-500/20 bg-red-500/[0.02]"
                      : expandido
                      ? "border-primary/40 bg-muted/20"
                      : "border-border/70 bg-card hover:border-border"
                  }`}
                >
                  {/* Encabezado del Acordeón */}
                  <div
                    onClick={() => toggleExpand(asiento.id)}
                    className="flex items-center justify-between p-3 cursor-pointer select-none gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded border ${
                          esAnulado
                            ? "bg-red-500/10 text-red-500 border-red-500/20 line-through"
                            : "bg-muted text-foreground border-border"
                        }`}
                      >
                        #{asiento.numero}
                      </span>

                      {asiento.correlativo_global && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          F-{asiento.correlativo_global}
                        </span>
                      )}

                      <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                        {asiento.fecha}
                      </span>

                      <p className="truncate text-xs font-medium text-foreground">
                        {asiento.concepto}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="font-mono font-semibold text-foreground tabular-nums">
                        {formatoMoneda(debe)}
                      </span>

                      {esAnulado && (
                        <span className="text-[10px] text-red-500 font-bold bg-red-500/10 px-1.5 py-0.5 rounded">
                          ANULADO
                        </span>
                      )}

                      <span className="text-muted-foreground">
                        {expandido ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      </span>
                    </div>
                  </div>

                  {/* Detalle Desplegado de Renglones */}
                  {expandido && (
                    <div className="border-t border-border/60 bg-background/80 p-3 space-y-2.5 animate-in fade-in duration-150">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span>
                          {asiento.tipo || "OPERACION"} {asiento.documento_soporte ? `· Doc: ${asiento.documento_soporte}` : ""}
                        </span>
                        {asiento.motivo_anulacion && (
                          <span className="text-red-500 italic">
                            Motivo anulación: {asiento.motivo_anulacion}
                          </span>
                        )}
                      </div>

                      <div className="rounded border border-border/60 overflow-hidden font-mono text-[11px]">
                        <table className="w-full">
                          <thead className="bg-muted/40 text-muted-foreground text-[10px] uppercase">
                            <tr>
                              <th className="py-1 px-2.5 text-left">Código</th>
                              <th className="py-1 px-2 text-left">Cuenta</th>
                              <th className="py-1 px-2.5 text-right">Debe</th>
                              <th className="py-1 px-2.5 text-right">Haber</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {asiento.lineas.map((linea, idx) => {
                              const esAbono = Number(linea.haber) > 0 && Number(linea.debe) === 0
                              return (
                                <tr key={idx} className="hover:bg-muted/20">
                                  <td className="py-1 px-2.5 text-primary font-semibold">
                                    {linea.codigo}
                                  </td>
                                  <td className={`py-1 px-2 font-sans ${esAbono ? "pl-4 text-muted-foreground italic" : "text-foreground"}`}>
                                    {buscarNombre(linea.codigo)}
                                  </td>
                                  <td className="py-1 px-2.5 text-right tabular-nums">
                                    {Number(linea.debe) > 0 ? formatoMoneda(Number(linea.debe)) : "-"}
                                  </td>
                                  <td className="py-1 px-2.5 text-right tabular-nums">
                                    {Number(linea.haber) > 0 ? formatoMoneda(Number(linea.haber)) : "-"}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot className="bg-muted/30 font-bold border-t border-border/60">
                            <tr>
                              <td colSpan={2} className="py-1 px-2.5 font-sans text-[10px] uppercase">
                                Sumas Iguales
                              </td>
                              <td className="py-1 px-2.5 text-right tabular-nums">{formatoMoneda(debe)}</td>
                              <td className="py-1 px-2.5 text-right tabular-nums">{formatoMoneda(haber)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Botones de acción del comprobante */}
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleImprimir(asiento)}
                          className="h-7 text-[11px] gap-1.5 cursor-pointer font-medium"
                        >
                          <Printer className="size-3 text-muted-foreground" />
                          Imprimir Comprobante
                        </Button>

                        {!esAnulado && onAnular && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAnularPartida(asiento)}
                            className="h-7 text-[11px] gap-1.5 cursor-pointer text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                          >
                            <Ban className="size-3" />
                            Anular
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </aside>
    </>
  )
}
