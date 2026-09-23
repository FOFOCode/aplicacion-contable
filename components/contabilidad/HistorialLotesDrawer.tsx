"use client"

import React, { useState, useMemo, useEffect } from "react"
import {
  X,
  Search,
  Calendar,
  Lock,
  FileText,
  Download,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Printer,
  History,
  Archive,
  Hash,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LoteContable, Asiento, Cuenta } from "@/lib/types"
import { formatoMoneda, totalesAsiento } from "@/lib/contabilidad"

interface HistorialLotesDrawerProps {
  isOpen: boolean
  onClose: () => void
  lotes: LoteContable[]
  asientos: Asiento[]
  cuentas: Cuenta[]
}

export function HistorialLotesDrawer({
  isOpen,
  onClose,
  lotes,
  asientos,
  cuentas,
}: HistorialLotesDrawerProps) {
  const [busqueda, setBusqueda] = useState("")
  const [filtroEstado, setFiltroEstado] = useState<"TODOS" | "CERRADO" | "ANULADO">("TODOS")
  const [lotesExpandidos, setLotesExpandidos] = useState<Record<string, boolean>>({})

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

  const toggleExpand = (loteId: string) => {
    setLotesExpandidos((prev) => ({
      ...prev,
      [loteId]: !prev[loteId],
    }))
  }

  // Filtrado reactivo de lotes y partidas
  const lotesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()

    return lotes.filter((lote) => {
      if (filtroEstado !== "TODOS" && lote.estado !== filtroEstado) {
        return false
      }

      if (!q) return true

      const coincideLote =
        `lote #${lote.numero}`.toLowerCase().includes(q) ||
        lote.mes.toLowerCase().includes(q) ||
        (lote.observaciones && lote.observaciones.toLowerCase().includes(q))

      if (coincideLote) return true

      // Buscar si alguna de sus partidas coincide
      const partidasDelLote = asientos.filter(
        (a) => a.lote_id === lote.id || a.lote_numero === lote.numero,
      )

      return partidasDelLote.some(
        (a) =>
          a.concepto.toLowerCase().includes(q) ||
          (a.correlativo_global && String(a.correlativo_global).includes(q)) ||
          (a.documento_soporte && a.documento_soporte.toLowerCase().includes(q)) ||
          a.lineas.some((l) => l.codigo.includes(q)),
      )
    })
  }, [lotes, asientos, busqueda, filtroEstado])

  const buscarNombre = (codigo: string) => {
    return cuentas.find((c) => c.codigo === codigo)?.nombre || `Cuenta ${codigo}`
  }

  const handleImprimirLote = (lote: LoteContable, partidas: Asiento[]) => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const htmlContent = `
      <html>
        <head>
          <title>Lote #${lote.numero} - ${lote.mes}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; font-size: 12px; }
            h1 { font-size: 16px; margin-bottom: 4px; }
            .meta { color: #666; margin-bottom: 20px; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
            th { background-color: #f4f4f4; }
            .text-right { text-align: right; }
            .font-mono { font-family: monospace; }
            .header-partida { background-color: #fafafa; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Comprobante de Diario · Lote #${lote.numero} (${lote.mes})</h1>
          <div class="meta">Fecha de cierre: ${lote.fecha_cierre || lote.fecha_apertura} · Total débitos: $${lote.total_debe.toFixed(2)} · Partidas: ${partidas.length}</div>
          ${partidas
            .map(
              (p) => `
            <div>
              <p><strong>Partida #${p.numero}</strong> | Folio Global #${p.correlativo_global || p.numero} | Fecha: ${p.fecha}</p>
              <p><em>${p.concepto}</em></p>
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Cuenta</th>
                    <th class="text-right">Debe ($)</th>
                    <th class="text-right">Haber ($)</th>
                  </tr>
                </thead>
                <tbody>
                  ${p.lineas
                    .map(
                      (l) => `
                    <tr>
                      <td class="font-mono">${l.codigo}</td>
                      <td>${buscarNombre(l.codigo)}</td>
                      <td class="text-right font-mono">${Number(l.debe) > 0 ? Number(l.debe).toFixed(2) : "-"}</td>
                      <td class="text-right font-mono">${Number(l.haber) > 0 ? Number(l.haber).toFixed(2) : "-"}</td>
                    </tr>
                  `,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          `,
            )
            .join("")}
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `
    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-Over Panel */}
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-border bg-card shadow-2xl">
        {/* Header del Drawer */}
        <div className="flex items-center justify-between border-b border-border p-4 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Archive className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                Historial de Lotes y Partidas Foliadas
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {lotes.length} lotes
                </Badge>
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Consulta y reimpresión de sesiones cerradas sin alterar la mesa de captura.
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

        {/* Barra de Filtros y Búsqueda */}
        <div className="p-4 border-b border-border space-y-3 bg-background">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por lote, folio #, concepto o código de cuenta..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setFiltroEstado("TODOS")}
                className={`px-3 py-1 rounded-md transition-all ${
                  filtroEstado === "TODOS"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Todos ({lotes.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado("CERRADO")}
                className={`px-3 py-1 rounded-md transition-all ${
                  filtroEstado === "CERRADO"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Cerrados
              </button>
            </div>

            <span className="text-[10px] text-muted-foreground">
              Mostrando {lotesFiltrados.length} lote(s)
            </span>
          </div>
        </div>

        {/* Lista de Lotes Históricos */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {lotesFiltrados.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <History className="size-8 text-muted-foreground mx-auto opacity-50" />
              <p className="text-xs font-semibold text-foreground">No se encontraron lotes históricos</p>
              <p className="text-[11px] text-muted-foreground">
                Los lotes cerrados con el botón "Cerrar y Foliar Lote" se archivan aquí.
              </p>
            </div>
          ) : (
            lotesFiltrados.map((lote) => {
              const expandido = Boolean(lotesExpandidos[lote.id])
              const partidasDelLote = asientos.filter(
                (a) => a.lote_id === lote.id || a.lote_numero === lote.numero,
              )

              return (
                <Card key={lote.id} className="border-border shadow-xs overflow-hidden">
                  <CardHeader className="p-3.5 bg-muted/30 border-b border-border/80">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] font-bold bg-primary/5 text-primary border-primary/20"
                        >
                          LOTE #{lote.numero}
                        </Badge>
                        <span className="text-xs font-semibold text-foreground">{lote.mes}</span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          <CheckCircle2 className="size-2.5" />
                          {lote.estado}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleImprimirLote(lote, partidasDelLote)}
                          className="h-6 text-[10px] gap-1 px-2 font-medium"
                          title="Imprimir o exportar comprobantes del lote"
                        >
                          <Printer className="size-3" />
                          Imprimir
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(lote.id)}
                          className="size-6 p-0 text-muted-foreground hover:text-foreground"
                          title={expandido ? "Ocultar partidas" : "Ver partidas foliadas"}
                        >
                          {expandido ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 text-[11px] text-muted-foreground">
                      <span>Cerrado: {lote.fecha_cierre?.slice(0, 10) || lote.fecha_apertura}</span>
                      <span className="font-mono font-medium text-foreground">
                        {partidasDelLote.length} partidas · Total: {formatoMoneda(lote.total_debe)}
                      </span>
                    </div>

                    {lote.observaciones && (
                      <p className="text-[10px] text-muted-foreground italic pt-1">
                        Nota: {lote.observaciones}
                      </p>
                    )}
                  </CardHeader>

                  {/* Partidas Desplegables del Lote */}
                  {expandido && (
                    <CardContent className="p-3 bg-background space-y-3">
                      {partidasDelLote.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-2">
                          Sin partidas detalladas en este lote.
                        </p>
                      ) : (
                        partidasDelLote.map((asiento) => {
                          const { debe, haber } = totalesAsiento(asiento.lineas)
                          return (
                            <div
                              key={asiento.id}
                              className="rounded-lg border border-border/80 bg-muted/10 p-2.5 space-y-2 text-xs"
                            >
                              <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-primary text-[11px]">
                                    Folio Global #{asiento.correlativo_global || asiento.numero}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    (Asiento #{asiento.numero})
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground font-medium">
                                  {asiento.fecha}
                                </span>
                              </div>

                              <p className="text-[11px] text-foreground font-medium leading-snug">
                                {asiento.concepto}
                              </p>

                              {/* Mini tabla de renglones */}
                              <div className="rounded border border-border/60 overflow-hidden font-mono text-[10px]">
                                <table className="w-full">
                                  <tbody className="divide-y divide-border/40">
                                    {asiento.lineas.map((linea, idx) => (
                                      <tr key={idx} className="hover:bg-muted/30">
                                        <td className="py-1 px-2 text-muted-foreground w-16">
                                          {linea.codigo}
                                        </td>
                                        <td className="py-1 px-2 font-sans text-foreground">
                                          {buscarNombre(linea.codigo)}
                                        </td>
                                        <td className="py-1 px-2 text-right w-20">
                                          {Number(linea.debe) > 0 ? formatoMoneda(Number(linea.debe)) : "-"}
                                        </td>
                                        <td className="py-1 px-2 text-right w-20">
                                          {Number(linea.haber) > 0 ? formatoMoneda(Number(linea.haber)) : "-"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot className="bg-muted/40 font-bold border-t border-border/60">
                                    <tr>
                                      <td colSpan={2} className="py-1 px-2 font-sans text-[10px]">
                                        Sumas Iguales
                                      </td>
                                      <td className="py-1 px-2 text-right">{formatoMoneda(debe)}</td>
                                      <td className="py-1 px-2 text-right">{formatoMoneda(haber)}</td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </CardContent>
                  )}
                </Card>
              )
            })
          )}
        </div>
      </aside>
    </>
  )
}
