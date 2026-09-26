"use client"

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import {
  Search,
  X,
  Check,
  ChevronRight,
  RotateCcw,
  BookOpen,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Equal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatoMoneda } from "@/lib/contabilidad"
import { ETIQUETA_TIPO, type Cuenta, type TipoCuenta } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface CuentaMayorItem {
  cuenta: Cuenta
  debe: number
  haber: number
  saldo: number
  naturalezaSaldo: "deudora" | "acreedora" | null
}

interface CuentaMayorFinderModalProps {
  isOpen: boolean
  onClose: () => void
  cuentasMayor: CuentaMayorItem[]
  cuentaFiltroCodigo: string | null
  busquedaTexto: string
  categoriaFiltro: string
  onSeleccionarCuenta: (codigo: string | null) => void
  onAplicarFiltroTexto: (busqueda: string, categoria: string) => void
  onLimpiarFiltros: () => void
}

const CATEGORIAS: { valor: string; label: string }[] = [
  { valor: "todas", label: "Todas" },
  { valor: "activo", label: "1. Activos" },
  { valor: "pasivo", label: "2. Pasivos" },
  { valor: "capital", label: "3. Capital" },
  { valor: "gasto", label: "4. Gastos" },
  { valor: "ingreso", label: "5. Ingresos" },
]

export function CuentaMayorFinderModal({
  isOpen,
  onClose,
  cuentasMayor,
  cuentaFiltroCodigo,
  busquedaTexto,
  categoriaFiltro,
  onSeleccionarCuenta,
  onAplicarFiltroTexto,
  onLimpiarFiltros,
}: CuentaMayorFinderModalProps) {
  const [busqueda, setBusqueda] = useState(busquedaTexto || "")
  const [categoria, setCategoria] = useState(categoriaFiltro || "todas")
  const [indiceResaltado, setIndiceResaltado] = useState(0)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const listaResultadosRef = useRef<HTMLUListElement>(null)

  // Sincronizar estado cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setBusqueda(busquedaTexto || "")
      setCategoria(categoriaFiltro || "todas")
      setIndiceResaltado(0)
      setTimeout(() => {
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }, 60)
    }
  }, [isOpen, busquedaTexto, categoriaFiltro])

  // Filtrar cuentas según la búsqueda y categoría interna del modal
  const cuentasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return cuentasMayor.filter((m) => {
      if (categoria !== "todas" && m.cuenta.tipo !== categoria) return false
      if (!q) return true
      return (
        m.cuenta.codigo.toLowerCase().includes(q) ||
        m.cuenta.nombre.toLowerCase().includes(q)
      )
    })
  }, [cuentasMayor, busqueda, categoria])

  useEffect(() => {
    setIndiceResaltado(0)
  }, [cuentasFiltradas])

  // Auto-scroll del elemento seleccionado con el teclado
  useEffect(() => {
    if (listaResultadosRef.current && listaResultadosRef.current.children[indiceResaltado]) {
      const activeEl = listaResultadosRef.current.children[indiceResaltado] as HTMLElement
      activeEl.scrollIntoView({ block: "nearest" })
    }
  }, [indiceResaltado])

  const handleSeleccionarIndividual = useCallback(
    (codigo: string) => {
      onSeleccionarCuenta(codigo)
      onClose()
    },
    [onSeleccionarCuenta, onClose]
  )

  const handleAplicarBusquedaGlobal = useCallback(() => {
    onAplicarFiltroTexto(busqueda.trim(), categoria)
    onClose()
  }, [busqueda, categoria, onAplicarFiltroTexto, onClose])

  const handleVerTodas = useCallback(() => {
    onLimpiarFiltros()
    onClose()
  }, [onLimpiarFiltros, onClose])

  // Manejo de teclado estilo Spotlight (Flechas, Enter, Escape)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      onClose()
      return
    }

    if (e.key === "ArrowDown") {
      e.preventDefault()
      e.stopPropagation()
      setIndiceResaltado((prev) =>
        prev < cuentasFiltradas.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      e.stopPropagation()
      setIndiceResaltado((prev) =>
        prev > 0 ? prev - 1 : cuentasFiltradas.length - 1
      )
    } else if (e.key === "Enter") {
      e.preventDefault()
      e.stopPropagation()
      const target = cuentasFiltradas[indiceResaltado]
      if (target) {
        handleSeleccionarIndividual(target.cuenta.codigo)
      } else if (busqueda.trim() || categoria !== "todas") {
        handleAplicarBusquedaGlobal()
      }
    }
  }

  if (!isOpen) return null

  const hayFiltroActivo = Boolean(cuentaFiltroCodigo || busquedaTexto || categoriaFiltro !== "todas")

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xl flex items-start justify-center pt-[5vh] sm:pt-[9vh] p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-card text-card-foreground border border-border/80 dark:border-white/15 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ===================================================================== */}
        {/* 1. HEADER: BARRA DE BÚSQUEDA TIPO SPOTLIGHT                           */}
        {/* ===================================================================== */}
        <div className="p-4 border-b border-border/80 bg-muted/20 space-y-3">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Search className="size-4.5" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar cuenta por código o nombre en el Libro Mayor..."
              className="w-full text-base sm:text-lg bg-transparent border-0 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 font-medium"
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-muted text-muted-foreground border border-border">
                ESC
              </kbd>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Cerrar buscador"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Chips de Categorías Rápidas */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs pt-1">
            {CATEGORIAS.map((cat) => (
              <button
                key={cat.valor}
                type="button"
                onClick={() => setCategoria(cat.valor)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-medium transition-all shrink-0 cursor-pointer",
                  categoria === cat.valor
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 2. BARRA DE ACCIÓN RÁPIDA / STATUS DEL FILTRO                         */}
        {/* ===================================================================== */}
        <div className="px-4 py-2 border-b border-border/60 bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>
              Mostrando <strong>{cuentasFiltradas.length}</strong> de {cuentasMayor.length} cuentas
            </span>
            {busqueda && (
              <button
                type="button"
                onClick={handleAplicarBusquedaGlobal}
                className="text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>Filtrar todas las coincidentes</span>
                <ArrowRight className="size-3" />
              </button>
            )}
          </div>

          {hayFiltroActivo && (
            <button
              type="button"
              onClick={handleVerTodas}
              className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
            >
              <RotateCcw className="size-3" />
              <span>Ver todas las cuentas</span>
            </button>
          )}
        </div>

        {/* ===================================================================== */}
        {/* 3. LISTADO DE CUENTAS MAYORIZADAS CON CIFRAS Y SALDOS                 */}
        {/* ===================================================================== */}
        <div className="flex-1 overflow-y-auto p-2">
          {cuentasFiltradas.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs space-y-1">
              <BookOpen className="mx-auto size-8 text-muted-foreground/40 mb-2" />
              <p className="font-semibold text-foreground">No se encontraron cuentas en el Libro Mayor</p>
              <p>Ninguna cuenta mayorizada coincide con los criterios de búsqueda.</p>
              {hayFiltroActivo && (
                <div className="pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleVerTodas}
                    className="text-xs h-8"
                  >
                    Restablecer y ver todas las cuentas
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <ul ref={listaResultadosRef} className="space-y-1">
              {cuentasFiltradas.map((m, index) => {
                const esResaltado = index === indiceResaltado
                const esSeleccionada = cuentaFiltroCodigo === m.cuenta.codigo
                const saldoCero = m.saldo === 0
                const contradiceNaturaleza =
                  m.cuenta.naturaleza === "deudora" ? m.saldo < 0 : m.saldo > 0
                const sobregirada = m.cuenta.tipo === "activo" && contradiceNaturaleza

                return (
                  <li
                    key={m.cuenta.codigo}
                    onClick={() => handleSeleccionarIndividual(m.cuenta.codigo)}
                    onMouseEnter={() => setIndiceResaltado(index)}
                    className={cn(
                      "px-3.5 py-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 text-xs border",
                      esSeleccionada
                        ? "bg-primary/15 border-primary/40 text-foreground"
                        : esResaltado
                        ? "bg-primary/10 border-primary/20 text-foreground"
                        : "border-transparent hover:bg-muted/40 text-foreground"
                    )}
                  >
                    {/* Código, Nombre y Categoría */}
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={cn(
                          "font-mono text-xs font-bold px-2 py-0.5 rounded-md shrink-0 shadow-2xs",
                          esSeleccionada || esResaltado
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        )}
                      >
                        {m.cuenta.codigo}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground truncate flex items-center gap-1.5">
                          <span>{m.cuenta.nombre}</span>
                          {esSeleccionada && (
                            <Badge variant="default" className="text-[9px] h-4 px-1.5 bg-primary/20 text-primary border-none">
                              En pantalla
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {ETIQUETA_TIPO[m.cuenta.tipo]} · Naturaleza {m.cuenta.naturaleza}
                        </p>
                      </div>
                    </div>

                    {/* Debe, Haber, Saldo y Badge */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right hidden sm:block">
                        <div className="text-[10px] text-muted-foreground font-mono">
                          D: {formatoMoneda(m.debe)} · H: {formatoMoneda(m.haber)}
                        </div>
                        <div className="font-mono font-bold text-xs text-foreground">
                          {formatoMoneda(Math.abs(m.saldo))}
                        </div>
                      </div>

                      {/* Badge de Estado del Saldo */}
                      <div>
                        {sobregirada ? (
                          <Badge variant="warning" className="text-[9px] h-5 px-1.5 font-bold">
                            Sobregiro
                          </Badge>
                        ) : saldoCero ? (
                          <Badge variant="muted" className="text-[9px] h-5 px-1.5">
                            Saldada
                          </Badge>
                        ) : m.naturalezaSaldo === "deudora" ? (
                          <Badge variant="deudora" className="text-[9px] h-5 px-1.5">
                            Deudor
                          </Badge>
                        ) : (
                          <Badge
                            variant="default"
                            className="text-[9px] h-5 px-1.5 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                          >
                            Acreedor
                          </Badge>
                        )}
                      </div>

                      <ChevronRight
                        className={cn(
                          "size-4 transition-transform",
                          esResaltado ? "text-primary translate-x-0.5" : "text-muted-foreground/60"
                        )}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* ===================================================================== */}
        {/* 4. FOOTER: ATAJOS DE TECLADO Y BOTÓN DE ACCIÓN                        */}
        {/* ===================================================================== */}
        <div className="p-3 border-t border-border/80 bg-muted/20 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="hidden sm:flex items-center gap-3 text-[11px]">
            <span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-muted text-muted-foreground border border-border">
                ↑
              </kbd>{" "}
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-muted text-muted-foreground border border-border">
                ↓
              </kbd>{" "}
              Navegar
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-muted text-muted-foreground border border-border">
                ↵
              </kbd>{" "}
              Seleccionar cuenta
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {hayFiltroActivo && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleVerTodas}
                className="text-xs h-8 cursor-pointer"
              >
                Ver todas las cuentas
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleAplicarBusquedaGlobal}
              className="text-xs h-8 px-3.5 font-semibold cursor-pointer"
            >
              <span>Aplicar</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
