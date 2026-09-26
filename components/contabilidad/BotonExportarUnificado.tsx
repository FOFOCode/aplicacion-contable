"use client"

import { useState, useRef, useEffect, ReactNode } from "react"
import { ChevronDown, FileDown, FileSpreadsheet, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface BotonExportarUnificadoProps {
  label?: string
  className?: string
  align?: "left" | "right"
  disabled?: boolean
  // PDF
  onExportarPdf?: () => void
  textoPdf?: string
  descPdf?: string
  iconoPdf?: ReactNode
  // Excel / CSV
  onExportarExcel?: () => void
  textoExcel?: string
  descExcel?: string
  iconoExcel?: ReactNode
  // Imprimir opcional
  onImprimir?: () => void
  textoImprimir?: string
  descImprimir?: string
}

export function BotonExportarUnificado({
  label = "Exportar",
  className,
  align = "right",
  disabled = false,
  onExportarPdf,
  textoPdf = "Descargar PDF",
  descPdf = "Documento formal para archivo",
  iconoPdf,
  onExportarExcel,
  textoExcel = "Exportar Excel",
  descExcel = "Hoja de cálculo editable",
  iconoExcel,
  onImprimir,
  textoImprimir = "Imprimir",
  descImprimir = "Vista oficial de imprenta",
}: BotonExportarUnificadoProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  return (
    <div ref={menuRef} className={cn("relative print:hidden", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="text-xs h-8 px-2.5 gap-1.5 cursor-pointer bg-card/80 hover:bg-muted font-medium border-border/80 shadow-2xs"
        title="Opciones de exportación e impresión"
      >
        <FileDown className="size-3.5 text-primary" />
        <span>{label}</span>
        <ChevronDown
          className={cn(
            "size-3 text-muted-foreground transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </Button>

      {open && (
        <div
          className={cn(
            "absolute top-full mt-1.5 w-56 rounded-xl border border-border bg-popover/95 p-1 text-popover-foreground shadow-2xl backdrop-blur-md z-50 animate-in fade-in zoom-in-95 duration-100",
            align === "left" ? "left-0" : "right-0"
          )}
        >
          {onExportarPdf && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onExportarPdf()
              }}
              className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-muted transition-colors cursor-pointer text-left"
            >
              {iconoPdf || <FileDown className="size-4 text-primary shrink-0" />}
              <div>
                <p className="font-semibold text-foreground">{textoPdf}</p>
                <p className="text-[10px] text-muted-foreground">{descPdf}</p>
              </div>
            </button>
          )}

          {onExportarExcel && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onExportarExcel()
              }}
              className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-muted transition-colors cursor-pointer text-left"
            >
              {iconoExcel || (
                <FileSpreadsheet className="size-4 text-emerald-500 shrink-0" />
              )}
              <div>
                <p className="font-semibold text-foreground">{textoExcel}</p>
                <p className="text-[10px] text-muted-foreground">{descExcel}</p>
              </div>
            </button>
          )}

          {onImprimir && (
            <>
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onImprimir()
                }}
                className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-muted transition-colors cursor-pointer text-left"
              >
                <Printer className="size-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">{textoImprimir}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {descImprimir}
                  </p>
                </div>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
