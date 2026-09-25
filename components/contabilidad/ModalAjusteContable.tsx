"use client"

import React, { useState, useEffect } from "react"
import { AlertTriangle, Pencil, RotateCcw, X, ShieldAlert, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/field"
import { formatoMoneda } from "@/lib/contabilidad"

interface ModalAjusteContableProps {
  isOpen: boolean
  onClose: () => void
  modo: "MODIFICAR" | "ANULAR"
  partida: {
    id: string
    numero: number
    concepto: string
    fecha: string
    lineas: Array<{ codigo: string; debe: number; haber: number }>
  } | null
  onConfirmarModificar: (partida: any, notaValida: string) => void
  onConfirmarAnularRevertir: (partida: any, notaValida: string) => Promise<void>
}

export function ModalAjusteContable({
  isOpen,
  onClose,
  modo,
  partida,
  onConfirmarModificar,
  onConfirmarAnularRevertir,
  }: ModalAjusteContableProps) {
  const [nota, setNota] = useState("")
  const [procesando, setProcesando] = useState(false)
  const [errorNota, setErrorNota] = useState("")

  useEffect(() => {
    if (isOpen) {
      setNota("")
      setErrorNota("")
      setProcesando(false)
    }
  }, [isOpen])

  if (!isOpen || !partida) return null

  const totalDebe = partida.lineas.reduce((acc, l) => acc + (Number(l.debe) || 0), 0)
  const esModificacion = modo === "MODIFICAR"

  const handleProceder = async () => {
    const notaLimpia = nota.trim()
    if (!notaLimpia || notaLimpia.length < 5) {
      setErrorNota("Debe ingresar una nota o justificación válida de al menos 5 caracteres.")
      return
    }

    setErrorNota("")
    if (esModificacion) {
      onConfirmarModificar(partida, notaLimpia)
      onClose()
    } else {
      setProcesando(true)
      try {
        await onConfirmarAnularRevertir(partida, notaLimpia)
        onClose()
      } catch (err) {
        console.error(err)
      } finally {
        setProcesando(false)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-card text-card-foreground rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-border space-y-5 animate-in zoom-in-95 duration-150">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${
                esModificacion
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                  : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
              }`}
            >
              {esModificacion ? <Pencil className="size-5" /> : <RotateCcw className="size-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {esModificacion
                  ? `Ajuste Contable a Partida #${partida.numero}`
                  : `Anulación y Reversión de Partida #${partida.numero}`}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Principio Contable de Inmutabilidad y Auditoría
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-4.5" />
          </button>
        </div>

        {/* Explicación Técnica Legal */}
        <div className="p-3.5 rounded-xl border border-border/80 bg-muted/30 text-xs text-muted-foreground leading-relaxed space-y-1.5">
          <p className="text-foreground font-semibold flex items-center gap-1.5">
            <ShieldAlert className="size-3.5 text-primary" />
            {esModificacion
              ? "Los registros contables no se alteran directamente"
              : "Los asientos contables no se eliminan"}
          </p>
          <p>
            {esModificacion
              ? `Para corregir o reclasificar la Partida #${partida.numero}, se creará automáticamente un nuevo Asiento de Ajuste en el folio. La partida original permanecerá en los libros contables con su respectiva trazabilidad.`
              : `Para anular la Partida #${partida.numero}, se registrará automáticamente un Asiento de Ajuste de Reversión (Contrasiento) que saldará sus cargos y abonos a cero, conservando la estricta foliación legal.`}
          </p>
        </div>

        {/* Resumen de la Partida Original */}
        <div className="rounded-xl border border-border bg-background p-3 space-y-1 text-xs font-mono tabular-nums">
          <div className="flex justify-between text-muted-foreground text-[11px]">
            <span>Partida Original:</span>
            <span className="text-foreground font-bold font-sans">
              #{partida.numero} ({partida.fecha})
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground text-[11px]">
            <span>Glosa / Concepto:</span>
            <span className="text-foreground font-sans truncate max-w-[260px]">
              {partida.concepto}
            </span>
          </div>
          <div className="flex justify-between pt-1 border-t border-border font-bold">
            <span className="text-muted-foreground">Total Importe:</span>
            <span className="text-primary">{formatoMoneda(totalDebe)}</span>
          </div>
        </div>

        {/* Campo Obligatorio: Nota de Justificación */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="nota-ajuste" className="text-xs font-semibold text-foreground">
              Nota / Justificación Contable del Ajuste *
            </Label>
            <span className="text-[10px] text-muted-foreground">Requerida por auditoría</span>
          </div>
          <textarea
            id="nota-ajuste"
            rows={3}
            autoFocus
            value={nota}
            onChange={(e) => {
              setNota(e.target.value)
              if (errorNota) setErrorNota("")
            }}
            placeholder={
              esModificacion
                ? "Ej: Corrección de importe según nota de crédito recibida, se ajusta partida..."
                : "Ej: Factura anulada por proveedor según acuerdo comercial, se revierte asiento..."
            }
            className="w-full text-xs p-3 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none leading-relaxed"
          />
          {errorNota && (
            <p className="text-[11px] text-red-500 font-medium">{errorNota}</p>
          )}
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={procesando}
            className="text-xs h-9 cursor-pointer"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleProceder}
            disabled={procesando || nota.trim().length < 5}
            className={`text-xs h-9 px-4 font-semibold cursor-pointer shadow-xs gap-1.5 ${
              esModificacion
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-red-600 hover:bg-red-700 text-white"
            }`}
          >
            {procesando ? (
              "Procesando..."
            ) : esModificacion ? (
              "Abrir Asiento de Ajuste"
            ) : (
              "Generar Asiento de Reversión"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
