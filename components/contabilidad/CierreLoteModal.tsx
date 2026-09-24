"use client"

import React, { useState } from "react"
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Lock,
  X,
  FileCheck2,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input, Label } from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"
import type { LoteContable, Asiento } from "@/lib/types"
import { formatoMoneda, type TotalesLoteResultado } from "@/lib/contabilidad"

interface CierreLoteModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirmar: (observaciones: string) => Promise<void> | void
  lote: LoteContable
  asientos: Asiento[]
  totales: TotalesLoteResultado
  isProcesando?: boolean
}

export function CierreLoteModal({
  isOpen,
  onClose,
  onConfirmar,
  lote,
  asientos,
  totales,
  isProcesando = false,
}: CierreLoteModalProps) {
  const [observaciones, setObservaciones] = useState("")

  if (!isOpen) return null

  const puedeCerrar = totales.cuadrado && asientos.length > 0 && totales.partidasConError === 0

  const handleConfirmar = async () => {
    if (!puedeCerrar || isProcesando) return
    await onConfirmar(observaciones.trim() || `Cierre formal de Lote #${lote.numero} - ${lote.mes}`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl transition-all">
        {/* Cabecera del modal */}
        <div className="flex items-start justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Lock className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                Cerrar y Foliar Lote #{lote.numero}
                <Badge variant="outline" className="text-[10px] font-mono">
                  {lote.mes}
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground">
                Consolidación formal y foliación inmutable de la sesión activa.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Resumen numérico */}
        <div className="my-4 grid grid-cols-3 gap-2 bg-muted/30 p-3 rounded-lg border border-border text-center text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Partidas
            </span>
            <span className="font-mono text-sm font-bold text-foreground">
              {totales.totalPartidas}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Total Débitos
            </span>
            <span className="font-mono text-sm font-bold text-foreground">
              {formatoMoneda(totales.totalDebe)}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Total Créditos
            </span>
            <span className="font-mono text-sm font-bold text-foreground">
              {formatoMoneda(totales.totalHaber)}
            </span>
          </div>
        </div>

        {/* Checklist de Validación Contable */}
        <div className="space-y-2 mb-4 bg-background p-3 rounded-lg border border-border text-xs">
          <span className="text-[11px] font-bold text-foreground uppercase tracking-wider block mb-1">
            Validación de Integridad Contable:
          </span>

          <div className="flex items-center gap-2">
            {totales.cuadrado ? (
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle className="size-4 text-red-500 shrink-0" />
            )}
            <span className={totales.cuadrado ? "text-foreground" : "text-red-500 font-semibold"}>
              Partida Doble global: {totales.cuadrado ? "Sumas Iguales verificadas a 0.00" : `Diferencia de ${formatoMoneda(totales.diferencia)}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {totales.partidasConError === 0 && asientos.length > 0 ? (
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle className="size-4 text-amber-500 shrink-0" />
            )}
            <span className={totales.partidasConError === 0 ? "text-foreground" : "text-amber-500 font-semibold"}>
              Partidas cuadradas individualmente: {totales.partidasValidas} de {totales.totalPartidas}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {asientos.length > 0 ? (
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle className="size-4 text-amber-500 shrink-0" />
            )}
            <span>Contiene al menos una partida ({asientos.length})</span>
          </div>
        </div>

        {/* Alerta de bloqueo si no cuadra */}
        {!puedeCerrar && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <p>
              {asientos.length === 0
                ? "El lote está vacío. Registra al menos un asiento antes de cerrarlo."
                : `No se puede cerrar el lote con descuadre contable ($${totales.diferencia.toFixed(2)}). Corrige o elimina los borradores inconsistentes.`}
            </p>
          </div>
        )}

        {/* Observaciones opcionales de auditoría */}
        <div className="space-y-1.5 mb-6">
          <Label htmlFor="obs" className="text-xs font-semibold">
            Nota de Cierre / Acta de Sesión <span className="text-muted-foreground font-normal">(Opcional)</span>
          </Label>
          <Input
            id="obs"
            placeholder="Ej. Cierre de operaciones del día 23 de septiembre por auditoría."
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="text-xs h-8"
          />
        </div>

        {/* Botones de acción */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isProcesando}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirmar}
            disabled={!puedeCerrar || isProcesando}
            className="gap-2 text-xs font-semibold"
          >
            <ShieldCheck className="size-4" />
            {isProcesando ? "Foliando..." : "Confirmar Cierre y Foliar Lote"}
          </Button>
        </div>
      </div>
    </div>
  )
}
