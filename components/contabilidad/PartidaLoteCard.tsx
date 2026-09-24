"use client"

import React from "react"
import {
  FileText,
  Copy,
  Trash2,
  Edit2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Tag,
  Hash,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import type { Asiento, Cuenta } from "@/lib/types"
import { formatoMoneda, totalesAsiento } from "@/lib/contabilidad"

interface PartidaLoteCardProps {
  asiento: Asiento
  posicionEnLote: number
  cuentas: Cuenta[]
  onEditar?: (asiento: Asiento) => void
  onDuplicar?: (asiento: Asiento) => void
  onEliminar?: (id: string) => void
}

export function PartidaLoteCard({
  asiento,
  posicionEnLote,
  cuentas,
  onEditar,
  onDuplicar,
  onEliminar,
}: PartidaLoteCardProps) {
  const { debe, haber, diferencia } = totalesAsiento(asiento.lineas)
  const cuadrado = diferencia === 0 && debe > 0

  const buscarNombre = (codigo: string) => {
    const c = cuentas.find((item) => item.codigo === codigo)
    return c?.nombre || `Cuenta ${codigo}`
  }

  return (
    <Card className="border-border shadow-xs hover:border-foreground/20 transition-colors overflow-hidden">
      {/* Encabezado de la partida dentro del lote */}
      <CardHeader className="bg-muted/30 border-b border-border py-2.5 px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Identificación y Tipo */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center font-mono font-bold text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md">
              <Hash className="size-3 mr-0.5 inline" />
              {posicionEnLote}
            </span>

            <span className="text-xs font-semibold text-foreground flex items-center gap-1">
              <Calendar className="size-3 text-muted-foreground" />
              {asiento.fecha}
            </span>

            <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wider py-0 px-1.5">
              {asiento.tipo || "OPERACION"}
            </Badge>

            {asiento.documento_soporte && (
              <span className="text-[11px] font-mono text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border">
                Doc: {asiento.documento_soporte}
              </span>
            )}
          </div>

          {/* Estado de cuadre y Acciones Rápidas */}
          <div className="flex items-center gap-2">
            {cuadrado ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                <CheckCircle2 className="size-3" />
                Cuadrada
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md">
                <AlertCircle className="size-3" />
                Descuadre ({formatoMoneda(diferencia)})
              </span>
            )}

            <div className="h-4 w-px bg-border mx-1" />

            {/* Botones de acción */}
            {onDuplicar && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onDuplicar(asiento)}
                title="Duplicar asiento en este lote"
                className="size-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <Copy className="size-3.5" />
              </Button>
            )}

            {onEditar && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onEditar(asiento)}
                title="Editar datos de la partida"
                className="size-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <Edit2 className="size-3.5" />
              </Button>
            )}

            {onEliminar && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onEliminar(asiento.id)}
                title="Eliminar partida de este lote"
                className="size-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-500/10 cursor-pointer"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Concepto / Glosa */}
        <p className="text-xs text-foreground font-medium pt-1 leading-snug">
          {asiento.concepto}
        </p>
      </CardHeader>

      {/* Tabla de Renglones Contables */}
      <CardContent className="p-0">
        <table className="w-full text-xs">
          <thead className="bg-muted/20 border-b border-border/60 text-muted-foreground font-medium text-[11px]">
            <tr>
              <th className="py-1.5 px-4 text-left w-24">Código</th>
              <th className="py-1.5 px-3 text-left">Cuenta Contable</th>
              <th className="py-1.5 px-4 text-right w-32">Debe ($)</th>
              <th className="py-1.5 px-4 text-right w-32">Haber ($)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 font-mono">
            {asiento.lineas.map((linea, idx) => {
              const esAbono = Number(linea.haber) > 0 && Number(linea.debe) === 0
              return (
                <tr key={idx} className="hover:bg-muted/15 transition-colors">
                  <td className="py-1.5 px-4 text-primary font-semibold text-[11px] align-middle">
                    {linea.codigo}
                  </td>
                  <td className="py-1.5 px-3 text-foreground font-sans align-middle">
                    <span className={esAbono ? "pl-5 text-muted-foreground italic block" : "font-medium block"}>
                      {buscarNombre(linea.codigo)}
                    </span>
                  </td>
                  <td className="py-1.5 px-4 text-right tabular-nums text-foreground align-middle font-medium">
                    {Number(linea.debe) > 0 ? formatoMoneda(Number(linea.debe)) : "-"}
                  </td>
                  <td className="py-1.5 px-4 text-right tabular-nums text-foreground align-middle font-medium">
                    {Number(linea.haber) > 0 ? formatoMoneda(Number(linea.haber)) : "-"}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-muted/30 border-t border-border font-mono text-xs font-bold">
            <tr>
              <td colSpan={2} className="py-1.5 px-4 text-left font-sans text-[11px] text-muted-foreground uppercase tracking-wider">
                Sumas Iguales
              </td>
              <td className="py-1.5 px-4 text-right border-b-2 border-double border-foreground/40 tabular-nums">
                {formatoMoneda(debe)}
              </td>
              <td className="py-1.5 px-4 text-right border-b-2 border-double border-foreground/40 tabular-nums">
                {formatoMoneda(haber)}
              </td>
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  )
}
