"use client"

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import {
  Search,
  X,
  Check,
  Zap,
  ArrowRight,
  CornerDownLeft,
  ChevronRight,
  Percent,
  Sliders,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Cuenta } from "@/lib/types"
import {
  formatoMoneda,
  redondear,
  formatearCuentaJerarquica,
  esCuentaSujetaAIVA,
  calcularIVAConModo,
  type ModoCalculoIVA,
} from "@/lib/contabilidad"
import {
  inferirImputacion,
  normalizarNaturaleza,
} from "@/lib/asientoInferenceEngine"
import { cn } from "@/lib/utils"

export interface ResultadoFinder {
  lineaPrincipal: {
    codigo: string
    monto: number
    operacion: "AUMENTA" | "DISMINUYE"
    debeDirecto?: number
    haberDirecto?: number
  }
  lineaIva?: {
    codigo: string
    monto: number
    operacion: "AUMENTA" | "DISMINUYE"
    debeDirecto?: number
    haberDirecto?: number
  }
}

interface CuentaFinderModalProps {
  isOpen: boolean
  onClose: () => void
  cuentas: Cuenta[]
  cuentasMap: Map<string, Cuenta>
  modoCaptura: "SMART" | "CLASICO"
  lineaEnEdicion?: {
    key?: string
    codigo: string
    monto: number | ""
    operacion: "AUMENTA" | "DISMINUYE"
    debeDirecto?: number | ""
    haberDirecto?: number | ""
  } | null
  sugerenciaFaltante?: {
    monto: number
    lado: "DEBE" | "HABER"
  } | null
  onConfirmar: (resultado: ResultadoFinder) => void
}

type CategoriaFiltro = "TODAS" | "ACTIVO" | "PASIVO" | "PATRIMONIO" | "GASTO" | "INGRESO"

export function CuentaFinderModal({
  isOpen,
  onClose,
  cuentas,
  cuentasMap,
  modoCaptura,
  lineaEnEdicion,
  sugerenciaFaltante,
  onConfirmar,
}: CuentaFinderModalProps) {
  const [busqueda, setBusqueda] = useState("")
  const [categoria, setCategoria] = useState<CategoriaFiltro>("TODAS")
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<Cuenta | null>(null)
  const [indiceResaltado, setIndiceResaltado] = useState(0)

  // Datos del paso 2: Monto y Movimiento
  const [montoInput, setMontoInput] = useState<string>("")
  const [operacionSmart, setOperacionSmart] = useState<"AUMENTA" | "DISMINUYE">("AUMENTA")
  const [ladoClasico, setLadoClasico] = useState<"DEBE" | "HABER">("DEBE")

  // Modal / paso secundario de IVA
  const [modoIVA, setModoIVA] = useState<ModoCalculoIVA>("NO")

  const searchInputRef = useRef<HTMLInputElement>(null)
  const montoInputRef = useRef<HTMLInputElement>(null)
  const listaResultadosRef = useRef<HTMLUListElement>(null)

  // Inicializar o resetear cuando se abre el modal
  useEffect(() => {
    if (!isOpen) return

    if (lineaEnEdicion && lineaEnEdicion.codigo) {
      const c = cuentasMap.get(lineaEnEdicion.codigo) || null
      setCuentaSeleccionada(c)
      const m =
        modoCaptura === "CLASICO"
          ? (Number(lineaEnEdicion.debeDirecto) || Number(lineaEnEdicion.haberDirecto) || "")
          : lineaEnEdicion.monto
      setMontoInput(m !== "" && m !== 0 ? String(m) : "")
      setOperacionSmart(lineaEnEdicion.operacion || "AUMENTA")
      if (lineaEnEdicion.haberDirecto && Number(lineaEnEdicion.haberDirecto) > 0) {
        setLadoClasico("HABER")
      } else {
        setLadoClasico("DEBE")
      }
      setModoIVA("NO")
      setTimeout(() => montoInputRef.current?.focus(), 80)
    } else {
      setCuentaSeleccionada(null)
      setBusqueda("")
      setCategoria("TODAS")
      setMontoInput(
        sugerenciaFaltante && sugerenciaFaltante.monto > 0
          ? String(sugerenciaFaltante.monto)
          : ""
      )
      setOperacionSmart("AUMENTA")
      setLadoClasico(sugerenciaFaltante?.lado === "HABER" ? "HABER" : "DEBE")
      setModoIVA("NO")
      setTimeout(() => searchInputRef.current?.focus(), 80)
    }
    setIndiceResaltado(0)
  }, [isOpen, lineaEnEdicion, cuentasMap, modoCaptura, sugerenciaFaltante])

  // Filtrado reactivo de cuentas
  const cuentasFiltradas = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return cuentas.filter((c) => {
      // Filtro por categoría rápida
      if (categoria === "ACTIVO" && !c.codigo.startsWith("1")) return false
      if (categoria === "PASIVO" && !c.codigo.startsWith("2")) return false
      if (categoria === "PATRIMONIO" && !c.codigo.startsWith("3")) return false
      if (categoria === "GASTO" && !(c.codigo.startsWith("4") || c.tipo === "gasto")) return false
      if (categoria === "INGRESO" && !(c.codigo.startsWith("5") || c.tipo === "ingreso")) return false

      if (!q) return true

      const j = formatearCuentaJerarquica(c, cuentasMap)
      return (
        c.codigo.toLowerCase().includes(q) ||
        c.nombre.toLowerCase().includes(q) ||
        j.principal.toLowerCase().includes(q)
      )
    })
  }, [cuentas, busqueda, categoria, cuentasMap])

  // Ajustar índice resaltado si cambia el filtro
  useEffect(() => {
    setIndiceResaltado(0)
  }, [cuentasFiltradas])

  // Auto-scroll del elemento resaltado en la lista
  useEffect(() => {
    if (!cuentaSeleccionada && listaResultadosRef.current) {
      const activeEl = listaResultadosRef.current.children[indiceResaltado] as HTMLElement
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" })
      }
    }
  }, [indiceResaltado, cuentaSeleccionada])

  // Selección de cuenta
  const handleSeleccionarCuenta = useCallback(
    (c: Cuenta) => {
      setCuentaSeleccionada(c)
      const nat = normalizarNaturaleza(c.naturaleza)

      // Sugerir operación según naturaleza y sugerencia de faltante
      const infoIva = esCuentaSujetaAIVA(c.codigo)
      if (sugerenciaFaltante) {
        if (modoCaptura === "SMART") {
          if (sugerenciaFaltante.lado === "DEBE") {
            setOperacionSmart(nat === "deudora" ? "AUMENTA" : "DISMINUYE")
          } else {
            setOperacionSmart(nat === "acreedora" ? "AUMENTA" : "DISMINUYE")
          }
        } else {
          setLadoClasico(sugerenciaFaltante.lado)
        }
      } else if (infoIva.esDevolucion) {
        setLadoClasico(infoIva.ladoCuentaPrincipal)
        setOperacionSmart("AUMENTA")
      } else {
        setOperacionSmart("AUMENTA")
        setLadoClasico(nat === "deudora" ? "DEBE" : "HABER")
      }

      // Si la cuenta es sujeta a IVA por defecto sugerir IVA Incluido o evaluarlo
      if (infoIva.esSujeta) {
        // Dejar listo para que el usuario elija "No", "Más IVA" o "IVA Incluido"
        setModoIVA("IVA_INCLUIDO")
      } else {
        setModoIVA("NO")
      }

      setTimeout(() => montoInputRef.current?.focus(), 60)
    },
    [sugerenciaFaltante, modoCaptura],
  )

  // Info de IVA para la cuenta seleccionada
  const infoIva = useMemo(() => {
    if (!cuentaSeleccionada) {
      return {
        esSujeta: false,
        tipo: null,
        esDevolucion: false,
        cuentaIvaCodigo: "",
        cuentaIvaNombre: "",
        impuestoNombre: "",
        ladoCuentaPrincipal: "DEBE" as const,
        ladoIva: "DEBE" as const,
        operacionIvaSmart: "AUMENTA" as const,
      }
    }
    return esCuentaSujetaAIVA(cuentaSeleccionada.codigo)
  }, [cuentaSeleccionada])

  // Cálculo de IVA reactivo
  const montoNumerico = parseFloat(montoInput) || 0
  const desgloseIVA = useMemo(() => {
    return calcularIVAConModo(montoNumerico, modoIVA)
  }, [montoNumerico, modoIVA])

  // Confirmar y aplicar línea al comprobante
  const handleConfirmar = useCallback(
    (e?: React.MouseEvent | React.KeyboardEvent) => {
      if (e) {
        e.preventDefault()
        e.stopPropagation()
      }
      if (!cuentaSeleccionada || montoNumerico <= 0) return

      const nat = normalizarNaturaleza(cuentaSeleccionada.naturaleza)
      const baseFinal = modoIVA === "NO" ? montoNumerico : desgloseIVA.base
      const ivaFinal = desgloseIVA.iva

      let debePrincipal = 0
      let haberPrincipal = 0
      let opPrincipal: "AUMENTA" | "DISMINUYE" = operacionSmart

      if (modoCaptura === "CLASICO") {
        if (ladoClasico === "DEBE") {
          debePrincipal = baseFinal
          opPrincipal = nat === "deudora" ? "AUMENTA" : "DISMINUYE"
        } else {
          haberPrincipal = baseFinal
          opPrincipal = nat === "acreedora" ? "AUMENTA" : "DISMINUYE"
        }
      } else {
        const imp = inferirImputacion(cuentaSeleccionada, baseFinal, operacionSmart)
        debePrincipal = imp.debe
        haberPrincipal = imp.haber
      }

      const resultado: ResultadoFinder = {
        lineaPrincipal: {
          codigo: cuentaSeleccionada.codigo,
          monto: baseFinal,
          operacion: opPrincipal,
          debeDirecto: debePrincipal > 0 ? debePrincipal : undefined,
          haberDirecto: haberPrincipal > 0 ? haberPrincipal : undefined,
        },
      }

      // Si la cuenta es sujeta a IVA y se seleccionó modo IVA distinto de NO
      // En compras regulares: 1105 al DEBE
      // En devoluciones sobre compra: 1105 disminuye al HABER
      // En ventas regulares: 2103 al HABER
      // En devoluciones sobre venta: 2103 se debita al DEBE
      if (infoIva.esSujeta && modoIVA !== "NO" && ivaFinal > 0 && infoIva.cuentaIvaCodigo) {
        resultado.lineaIva = {
          codigo: infoIva.cuentaIvaCodigo,
          monto: ivaFinal,
          operacion: infoIva.operacionIvaSmart,
          debeDirecto: infoIva.ladoIva === "DEBE" ? ivaFinal : undefined,
          haberDirecto: infoIva.ladoIva === "HABER" ? ivaFinal : undefined,
        }
      }

      onConfirmar(resultado)
      onClose()
    },
    [
      cuentaSeleccionada,
      montoNumerico,
      modoIVA,
      desgloseIVA,
      modoCaptura,
      ladoClasico,
      operacionSmart,
      infoIva,
      onConfirmar,
      onClose,
    ],
  )

  // Atajos de teclado en el Finder (Spotlight / iOS Style)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      if (cuentaSeleccionada && !lineaEnEdicion) {
        // Volver a la búsqueda si estábamos en paso 2
        setCuentaSeleccionada(null)
        setTimeout(() => searchInputRef.current?.focus(), 50)
      } else {
        onClose()
      }
      return
    }

    // Si aún no hemos seleccionado cuenta
    if (!cuentaSeleccionada) {
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
          handleSeleccionarCuenta(target)
        }
      }
    } else {
      // Si ya hay cuenta seleccionada
      if (e.key === "Enter" && montoNumerico > 0) {
        e.preventDefault()
        e.stopPropagation()
        handleConfirmar(e)
      }
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xl flex items-start justify-center pt-[5vh] sm:pt-[9vh] p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-card/95 text-card-foreground border border-white/10 dark:border-white/15 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[88vh] backdrop-blur-2xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ===================================================================== */}
        {/* 1. FINDER HEADER: BARRA DE BÚSQUEDA TIPO SPOTLIGHT                    */}
        {/* ===================================================================== */}
        {!cuentaSeleccionada ? (
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
                placeholder="Buscar cuenta por código o nombre..."
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
              {(
                [
                  { id: "TODAS", label: "Todas" },
                  { id: "ACTIVO", label: "1. Activos" },
                  { id: "PASIVO", label: "2. Pasivos" },
                  { id: "PATRIMONIO", label: "3. Patrimonio" },
                  { id: "GASTO", label: "4. Costos/Gastos" },
                  { id: "INGRESO", label: "5. Ingresos" },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoria(cat.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-medium transition-all shrink-0 cursor-pointer",
                    categoria === cat.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Cabecera del paso 2: Cuenta seleccionada */
          <div className="p-4 border-b border-border/80 bg-muted/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-primary text-primary-foreground shrink-0 shadow-xs">
                {cuentaSeleccionada.codigo}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground truncate">
                    {cuentaSeleccionada.nombre}
                  </h3>
                  {infoIva.esSujeta && (
                    <Badge
                      variant="outline"
                      className="text-[9px] h-4.5 px-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400 font-mono shrink-0"
                    >
                      {infoIva.tipo === "COMPRA" ? "IVA Crédito" : "IVA Débito"}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  {formatearCuentaJerarquica(cuentaSeleccionada, cuentasMap).principal} · Naturaleza {cuentaSeleccionada.naturaleza}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {!lineaEnEdicion && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCuentaSeleccionada(null)}
                  className="text-xs h-7.5 px-2.5 cursor-pointer"
                >
                  Cambiar cuenta
                </Button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 2. FINDER BODY: LISTA DE RESULTADOS O CONFIGURACIÓN DE CIFRA          */}
        {/* ===================================================================== */}
        <div className="flex-1 overflow-y-auto">
          {!cuentaSeleccionada ? (
            /* PASO 1: Lista de Cuentas */
            <div className="p-2">
              {cuentasFiltradas.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs space-y-1">
                  <p className="font-medium text-foreground">No se encontraron cuentas contables</p>
                  <p>Intenta con otro término o código del catálogo.</p>
                </div>
              ) : (
                <ul ref={listaResultadosRef} className="space-y-1">
                  {cuentasFiltradas.map((c, index) => {
                    const esResaltado = index === indiceResaltado
                    const infoIvaCuenta = esCuentaSujetaAIVA(c.codigo)
                    const jerarquia = formatearCuentaJerarquica(c, cuentasMap)

                    return (
                      <li
                        key={c.codigo}
                        onClick={() => handleSeleccionarCuenta(c)}
                        onMouseEnter={() => setIndiceResaltado(index)}
                        className={cn(
                          "px-3.5 py-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 text-xs",
                          esResaltado
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "hover:bg-muted/40 text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={cn(
                              "font-mono text-xs font-semibold px-2 py-0.5 rounded-md shrink-0",
                              esResaltado
                                ? "bg-primary text-primary-foreground font-bold"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {c.codigo}
                          </span>
                          <div className="min-w-0">
                            <div className="font-medium text-foreground truncate flex items-center gap-1.5">
                              <span>{c.nombre}</span>
                              {infoIvaCuenta.esSujeta && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] h-4 px-1 border-amber-500/40 text-amber-600 dark:text-amber-400 font-mono"
                                >
                                  {infoIvaCuenta.tipo === "COMPRA" ? "IVA Crédito" : "IVA Débito"}
                                </Badge>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {jerarquia.principal}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="muted"
                            className="text-[9px] uppercase tracking-wider font-mono font-normal"
                          >
                            {c.naturaleza}
                          </Badge>
                          <ChevronRight
                            className={cn(
                              "size-3.5 transition-transform",
                              esResaltado ? "text-primary translate-x-0.5" : "text-muted-foreground"
                            )}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : (
            /* PASO 2: Configuración de Cifra, Movimiento y Modal Secundario de IVA */
            <div className="p-5 space-y-5">
              {/* Importe / Cifra */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Monto Contable ($ USD) *
                  </label>
                  {sugerenciaFaltante && sugerenciaFaltante.monto > 0 && (
                    <button
                      type="button"
                      onClick={() => setMontoInput(String(sugerenciaFaltante.monto))}
                      className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <Sparkles className="size-3" />
                      Faltante para cuadrar: {formatoMoneda(sugerenciaFaltante.monto)}
                    </button>
                  )}
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-mono text-muted-foreground font-bold">
                    $
                  </span>
                  <input
                    ref={montoInputRef}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={montoInput}
                    onChange={(e) => setMontoInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        e.stopPropagation()
                        if (montoNumerico > 0) {
                          handleConfirmar(e)
                        }
                      } else if (e.key === "Escape") {
                        e.preventDefault()
                        e.stopPropagation()
                        if (cuentaSeleccionada && !lineaEnEdicion) {
                          setCuentaSeleccionada(null)
                          setTimeout(() => searchInputRef.current?.focus(), 50)
                        } else {
                          onClose()
                        }
                      }
                    }}
                    className="w-full text-xl sm:text-2xl font-mono tabular-nums pl-9 pr-4 py-2.5 rounded-xl border border-input bg-background text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
                  />
                </div>
              </div>

              {/* Movimiento Contable (Smart vs Clásico) */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  {modoCaptura === "SMART"
                    ? "Movimiento de la Cuenta (Modo Smart +/-)"
                    : "Lado Contable (Modo Clásico)"}
                </label>

                {modoCaptura === "SMART" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setOperacionSmart("AUMENTA")}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all cursor-pointer space-y-1",
                        operacionSmart === "AUMENTA"
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/30"
                          : "border-border hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          + Aumenta
                        </span>
                        {operacionSmart === "AUMENTA" && <Check className="size-4 text-emerald-500" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {cuentaSeleccionada.naturaleza === "acreedora"
                          ? "Genera saldo al HABER (Crédito)"
                          : "Genera saldo al DEBE (Débito)"}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOperacionSmart("DISMINUYE")}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all cursor-pointer space-y-1",
                        operacionSmart === "DISMINUYE"
                          ? "border-blue-500 bg-blue-500/10 text-blue-950 dark:text-blue-100 ring-2 ring-blue-500/30"
                          : "border-border hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                          - Disminuye
                        </span>
                        {operacionSmart === "DISMINUYE" && <Check className="size-4 text-blue-500" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {cuentaSeleccionada.naturaleza === "acreedora"
                          ? "Genera saldo al DEBE (Débito)"
                          : "Genera saldo al HABER (Crédito)"}
                      </p>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setLadoClasico("DEBE")}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all cursor-pointer space-y-1",
                        ladoClasico === "DEBE"
                          ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/30"
                          : "border-border hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary">DEBE (Cargo)</span>
                        {ladoClasico === "DEBE" && <Check className="size-4 text-primary" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Imputación en columna deudora
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLadoClasico("HABER")}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all cursor-pointer space-y-1",
                        ladoClasico === "HABER"
                          ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/30"
                          : "border-border hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary">HABER (Abono)</span>
                        {ladoClasico === "HABER" && <Check className="size-4 text-primary" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Imputación en columna acreedora
                      </p>
                    </button>
                  </div>
                )}
              </div>

              {/* =================================================================== */}
              {/* MODAL / SECCIÓN SECUNDARIA DE IVA (Crédito / Débito Fiscal)          */}
              {/* Solo se muestra si la cuenta contable seleccionada está sujeta a IVA  */}
              {/* =================================================================== */}
              {infoIva.esSujeta && (
                <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 space-y-3 animate-in fade-in-50 duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="size-4 text-amber-500 shrink-0" />
                      <div>
                        <h4 className="text-xs font-bold text-foreground">
                          Asistente de IVA 13% ({infoIva.cuentaIvaNombre})
                        </h4>
                        <p className="text-[10px] text-muted-foreground">
                          {infoIva.esDevolucion
                            ? infoIva.tipo === "DEVOLUCION_COMPRA"
                              ? "Devolución s/Compra: IVA Crédito Fiscal (1105) disminuye al HABER"
                              : "Devolución s/Venta: IVA Débito Fiscal (2103) se debita al DEBE"
                            : infoIva.tipo === "COMPRA"
                              ? "Adquisiciones y gastos aplican automáticamente a IVA Crédito Fiscal (1105 al DEBE)"
                              : "Ventas e ingresos aplican automáticamente a IVA Débito Fiscal (2103 al HABER)"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 3 Opciones requeridas: No, Más IVA, IVA Incluido */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setModoIVA("NO")}
                      className={cn(
                        "py-2 px-3 rounded-lg border text-center font-medium transition-all text-xs cursor-pointer",
                        modoIVA === "NO"
                          ? "bg-card border-foreground/30 text-foreground shadow-xs font-bold"
                          : "border-border/60 hover:bg-muted/50 text-muted-foreground"
                      )}
                    >
                      No
                    </button>

                    <button
                      type="button"
                      onClick={() => setModoIVA("MAS_IVA")}
                      className={cn(
                        "py-2 px-3 rounded-lg border text-center font-medium transition-all text-xs cursor-pointer",
                        modoIVA === "MAS_IVA"
                          ? "bg-amber-500 text-white border-amber-600 shadow-xs font-bold"
                          : "border-border/60 hover:bg-muted/50 text-muted-foreground"
                      )}
                    >
                      MÁS IVA (+13%)
                    </button>

                    <button
                      type="button"
                      onClick={() => setModoIVA("IVA_INCLUIDO")}
                      className={cn(
                        "py-2 px-3 rounded-lg border text-center font-medium transition-all text-xs cursor-pointer",
                        modoIVA === "IVA_INCLUIDO"
                          ? "bg-amber-500 text-white border-amber-600 shadow-xs font-bold"
                          : "border-border/60 hover:bg-muted/50 text-muted-foreground"
                      )}
                    >
                      IVA INCLUIDO
                    </button>
                  </div>

                  {/* Vista previa matemática de las cifras */}
                  {modoIVA !== "NO" && montoNumerico > 0 && (
                    <div className="rounded-lg bg-background/80 border border-border p-2.5 text-xs font-mono tabular-nums space-y-1">
                      <div className="flex justify-between text-muted-foreground text-[11px]">
                        <span>Base Neta ({cuentaSeleccionada.nombre}) [{infoIva.ladoCuentaPrincipal}]:</span>
                        <strong className="text-foreground">{formatoMoneda(desgloseIVA.base)}</strong>
                      </div>
                      <div className="flex justify-between text-amber-600 dark:text-amber-400 text-[11px]">
                        <span>
                          + {infoIva.cuentaIvaNombre} ({infoIva.cuentaIvaCodigo}) [{infoIva.ladoIva}]:
                        </span>
                        <strong>{formatoMoneda(desgloseIVA.iva)}</strong>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-border font-bold text-foreground">
                        <span>Total Liquidación:</span>
                        <span className="text-primary">{formatoMoneda(desgloseIVA.total)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ===================================================================== */}
        {/* 3. FINDER FOOTER: BOTÓN DE ACCIÓN Y ATAJO                             */}
        {/* ===================================================================== */}
        {cuentaSeleccionada && (
          <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (lineaEnEdicion) {
                  onClose()
                } else {
                  setCuentaSeleccionada(null)
                  setTimeout(() => searchInputRef.current?.focus(), 50)
                }
              }}
              className="text-xs h-9 cursor-pointer"
            >
              Volver
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleConfirmar(e)
              }}
              disabled={montoNumerico <= 0}
              className="text-xs h-9 px-4 gap-2 font-semibold cursor-pointer shadow-xs"
            >
              <span>Aplicar al Comprobante</span>
              <CornerDownLeft className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
