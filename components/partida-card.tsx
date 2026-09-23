"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Ban, ShieldCheck, FileEdit, RotateCcw, Printer, Trash2, FileText, AlertTriangle } from "lucide-react"
import { formatoMoneda, totalesAsiento } from "@/lib/contabilidad"
import type { Asiento, Cuenta } from "@/lib/types"

interface PartidaCardProps {
  asiento: Asiento
  cuentas: Cuenta[]
  onAnular?: (id: string, motivo: string, generarReversion: boolean) => Promise<void> | void
}

export function PartidaCard({ asiento, cuentas, onAnular }: PartidaCardProps) {
  const [modalAbierto, setModalAbierto] = useState(false)
  const [motivo, setMotivo] = useState("")
  const [generarReversion, setGenerarReversion] = useState(false)
  const [procesando, setProcesando] = useState(false)

  const totales = totalesAsiento(asiento.lineas)
  const esAnulado = asiento.estado === "ANULADO"
  const esBorrador = asiento.estado === "BORRADOR"
  const anio = asiento.ejercicio || (asiento.fecha ? asiento.fecha.slice(0, 4) : 2026)

  const nombreCuenta = (codigo: string) =>
    cuentas.find((c) => c.codigo === codigo)?.nombre ?? "Cuenta no identificada"

  const handleImprimir = () => {
    window.print()
  }

  const handleConfirmarAnulacion = async () => {
    if (!motivo.trim() || !onAnular) return
    setProcesando(true)
    try {
      await onAnular(asiento.id, motivo.trim(), generarReversion)
      setModalAbierto(false)
    } finally {
      setProcesando(false)
    }
  }

  return (
    <>
      <Card
        className={`overflow-hidden border transition-all print:border-none print:shadow-none ${
          esAnulado
            ? "border-red-500/30 bg-muted/15 opacity-80"
            : esBorrador
            ? "border-amber-500/40 bg-amber-500/5"
            : "border-border hover:shadow-sm"
        }`}
      >
        {/* Cabecera del comprobante foliado */}
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b border-border/60 bg-muted/30 px-5 py-3.5">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-base font-bold text-primary">
                Partida #{asiento.numero} ({anio})
              </span>

              {asiento.correlativo_global && (
                <Badge variant="muted" className="font-mono text-[11px]">
                  Folio #{asiento.correlativo_global}
                </Badge>
              )}

              {asiento.documento_soporte && (
                <Badge variant="muted" className="flex items-center gap-1 text-[11px]">
                  <FileText className="size-3" />
                  {asiento.documento_soporte}
                </Badge>
              )}

              {/* Badges de estado */}
              {esAnulado ? (
                <Badge variant="warning" className="flex items-center gap-1 font-semibold">
                  <Ban className="size-3" />
                  ANULADA
                </Badge>
              ) : esBorrador ? (
                <Badge variant="acreedora" className="flex items-center gap-1 font-semibold">
                  <FileEdit className="size-3" />
                  BORRADOR
                </Badge>
              ) : (
                <Badge variant="success" className="flex items-center gap-1 font-semibold">
                  <ShieldCheck className="size-3" />
                  APLICADA
                </Badge>
              )}

              {asiento.tipo === "REVERSION" && (
                <Badge variant="default" className="flex items-center gap-1 font-mono text-[11px]">
                  <RotateCcw className="size-3" />
                  REVERSIÓN
                </Badge>
              )}

              <span className="text-xs font-medium text-muted-foreground">{asiento.fecha}</span>
            </div>

            {/* Glosa o Concepto */}
            <div className="border-l-2 border-primary/60 pl-2.5 py-0.5">
              <p className="text-sm font-medium text-foreground">{asiento.concepto}</p>
            </div>

            {/* Alerta de auditoría de anulación */}
            {esAnulado && (
              <div className="mt-1 flex items-start gap-1.5 rounded-md bg-red-500/10 p-2 text-xs font-medium text-red-700 dark:text-red-300">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Partida anulada en auditoría</p>
                  <p className="opacity-90">
                    Motivo: {asiento.motivo_anulacion || "Anulación contable por corrección"}
                    {asiento.anulado_en && ` · Registrado el ${asiento.anulado_en.slice(0, 10)}`}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Acciones de la partida */}
          <div className="flex items-center gap-1 print:hidden">
            <button
              onClick={handleImprimir}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Imprimir Póliza de Diario"
              aria-label="Imprimir póliza"
            >
              <Printer className="size-4" />
            </button>

            {!esAnulado && !esBorrador && onAnular && (
              <button
                onClick={() => setModalAbierto(true)}
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-600 transition-colors cursor-pointer"
                title="Anular Partida (Trazabilidad obligatoria)"
                aria-label="Anular partida"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        </CardHeader>

        {/* Tabla formal foliada de renglones */}
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-sm">
              <thead className="border-b border-border/80 bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-12 px-4 py-2 text-center">#</th>
                  <th className="w-28 px-4 py-2">Código</th>
                  <th className="px-4 py-2">Cuenta / Glosa de Renglón</th>
                  <th className="w-28 px-4 py-2 text-right">Parcial</th>
                  <th className="w-32 px-4 py-2 text-right">Debe</th>
                  <th className="w-32 px-4 py-2 text-right">Haber</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono text-xs">
                {asiento.lineas.map((l, i) => (
                  <tr
                    key={i}
                    className={`transition-colors hover:bg-muted/20 ${
                      esAnulado ? "line-through text-muted-foreground opacity-60" : ""
                    }`}
                  >
                    <td className="px-4 py-2 text-center text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2 font-bold text-foreground">{l.codigo}</td>
                    <td className="px-4 py-2 font-sans text-sm font-medium text-foreground">
                      {nombreCuenta(l.codigo)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                      {l.parcial && l.parcial > 0 ? formatoMoneda(l.parcial) : ""}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-foreground">
                      {l.debe > 0 ? formatoMoneda(l.debe) : ""}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-foreground">
                      {l.haber > 0 ? formatoMoneda(l.haber) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Pie de Sumas Iguales con subrayado contable doble */}
              <tfoot>
                <tr className="border-t-2 border-border/80 bg-muted/30 font-mono text-xs font-bold text-foreground">
                  <td colSpan={4} className="px-4 py-2 text-right uppercase tracking-wider font-sans text-[11px]">
                    Sumas Iguales:
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums border-b-4 border-double border-foreground/40 text-sm">
                    {formatoMoneda(totales.debe)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums border-b-4 border-double border-foreground/40 text-sm">
                    {formatoMoneda(totales.haber)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal formal de anulación segura */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="size-5" />
              <h3 className="text-lg font-bold">Anulación de Partida #{asiento.numero}</h3>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Por auditoría contable (NIIF para PYMES), no se eliminarán renglones físicos. La partida se marcará como
              anulada preservando la trazabilidad.
            </p>

            <div className="space-y-1.5">
              <label htmlFor="motivo-anulacion" className="text-xs font-semibold text-foreground">
                Motivo justificado de la anulación <span className="text-red-500">*</span>:
              </label>
              <textarea
                id="motivo-anulacion"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ejemplo: Error en el precio unitario pactado según factura del proveedor..."
                className="w-full rounded-md border border-input bg-background p-2.5 text-xs focus:outline-hidden focus:ring-2 focus:ring-ring"
                rows={3}
                required
              />
            </div>

            <div className="rounded-lg border border-border/80 bg-muted/40 p-3">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={generarReversion}
                  onChange={(e) => setGenerarReversion(e.target.checked)}
                  className="mt-0.5 rounded border-input"
                />
                <div>
                  <span className="font-semibold text-foreground">
                    Generar Asiento de Reversión Automático
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Crea inmediatamente una partida de contrapartida espejo (Debe al Haber y Haber al Debe) vinculada a
                    este folio.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                disabled={procesando}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarAnulacion}
                disabled={!motivo.trim() || procesando}
                className="rounded-md bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {procesando ? "Procesando..." : "Confirmar Anulación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
