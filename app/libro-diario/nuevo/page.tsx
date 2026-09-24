"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Plus,
  Trash2,
  Scale,
  CheckCircle2,
  AlertCircle,
  Save,
  FileEdit,
  History,
  Sparkles,
  Search,
  BookOpen,
  CornerDownLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input, Label } from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useContabilidad } from "@/components/contabilidad-provider"
import { formatoMoneda, totalesAsiento } from "@/lib/contabilidad"
import { CapturaAsistida } from "@/components/captura-asistida"
import type { Asiento, AsientoLinea, Cuenta } from "@/lib/types"

interface LineaCaptura extends AsientoLinea {
  key: string
  concepto_linea?: string
}

interface BorradorLocal {
  id: string
  guardadoEn: string
  fecha: string
  concepto: string
  documento_soporte: string
  tipo: Asiento["tipo"]
  lineas: LineaCaptura[]
}

const STORAGE_BORRADORES_KEY = "contable_libro_diario_borradores"

const GLOSAS_SUGERIDAS = [
  "Compra de mercaderías al contado según factura de proveedor (Método Analítico).",
  "Pago de fletes y transporte de mercadería adquirida según comprobante.",
  "Venta de mercaderías al contado con IVA débito fiscal (Método Analítico).",
  "Devolución de mercadería sobre compras según nota de crédito bancaria.",
  "Cliente devuelve mercadería por no cumplir especificaciones técnicas.",
  "Pago de servicios contables y gastos administrativos con cheque.",
]

const CUENTAS_FRECUENTES_ANALITICAS = [
  { codigo: "4101", nombre: "Compras" },
  { codigo: "1105", nombre: "IVA crédito fiscal" },
  { codigo: "5101", nombre: "Ventas" },
  { codigo: "2103", nombre: "IVA débito fiscal" },
  { codigo: "1102", nombre: "Bancos" },
  { codigo: "1101", nombre: "Caja general" },
  { codigo: "4102", nombre: "Gastos sobre compras" },
  { codigo: "5102", nombre: "Devoluciones sobre compras" },
  { codigo: "4103", nombre: "Devoluciones sobre ventas" },
]

export default function NuevaPartidaPage() {
  const router = useRouter()
  const { cuentas, asientos, agregarAsiento } = useContabilidad()

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [tipo, setTipo] = useState<NonNullable<Asiento["tipo"]>>("OPERACION")
  const [documento, setDocumento] = useState("")
  const [concepto, setConcepto] = useState("")
  const [lineas, setLineas] = useState<LineaCaptura[]>([
    { key: "1", codigo: "", debe: 0, haber: 0 },
    { key: "2", codigo: "", debe: 0, haber: 0 },
  ])

  const [borradores, setBorradores] = useState<BorradorLocal[]>([])
  const [guardando, setGuardando] = useState(false)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [mensajeError, setMensajeError] = useState<string | null>(null)
  const [modoCaptura, setModoCaptura] = useState<"asistida" | "directa">("asistida")

  const handleAplicarDesdeAsistente = (datos: {
    fecha?: string
    tipo?: "OPERACION" | "AJUSTE"
    documento_soporte?: string
    concepto: string
    lineas: AsientoLinea[]
  }) => {
    if (datos.fecha) setFecha(datos.fecha)
    if (datos.tipo) setTipo(datos.tipo)
    if (datos.documento_soporte) setDocumento(datos.documento_soporte)
    if (datos.concepto) setConcepto(datos.concepto)

    setLineas(
      datos.lineas.map((l, i) => ({
        key: `asistido-${i}-${Date.now()}`,
        codigo: l.codigo,
        debe: Number(l.debe) || 0,
        haber: Number(l.haber) || 0,
      }))
    )
    setModoCaptura("directa")
    setMensajeExito("¡Asiento transferido a la mesa de trabajo! Revisa los renglones y haz clic en 'Registrar y Aprobar Partida'.")
  }

  // Referencias para autofoco dinámico
  const accountSelectRefs = useRef<Map<string, HTMLSelectElement>>(new Map())

  // Cuentas válidas con movimiento
  const cuentasTransaccionales = useMemo(
    () => cuentas.filter((c) => c.activa && c.permite_movimiento !== false),
    [cuentas]
  )

  // Cargar borradores locales al montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_BORRADORES_KEY)
      if (raw) setBorradores(JSON.parse(raw))
    } catch {
      // Ignorar errores de parseo
    }
  }, [])

  // Guardar borradores locales en localStorage
  const persistirBorradores = (nuevos: BorradorLocal[]) => {
    setBorradores(nuevos)
    try {
      localStorage.setItem(STORAGE_BORRADORES_KEY, JSON.stringify(nuevos))
    } catch {
      // Storage lleno
    }
  }

  // Atajo de teclado global: Alt + C para auto-cuadrar
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.altKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault()
        handleAutoBalancear()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  })

  // Cálculo seguro en centavos enteros para eliminar error flotante IEEE 754
  const { totalDebe, totalHaber, diferencia, balanceado } = useMemo(() => {
    let dCents = 0
    let hCents = 0
    for (const l of lineas) {
      dCents += Math.round((Number(l.debe) || 0) * 100)
      hCents += Math.round((Number(l.haber) || 0) * 100)
    }
    const diffCents = dCents - hCents
    const lineasConCuenta = lineas.filter((l) => l.codigo && (l.debe > 0 || l.haber > 0))

    return {
      totalDebe: dCents / 100,
      totalHaber: hCents / 100,
      diferencia: Math.abs(diffCents) / 100,
      balanceado: diffCents === 0 && dCents > 0 && lineasConCuenta.length >= 2,
    }
  }, [lineas])

  // Última partida registrada
  const ultimaPartida = useMemo(() => {
    if (!asientos || asientos.length === 0) return null
    return [...asientos].sort((a, b) => b.numero - a.numero)[0]
  }, [asientos])

  // Exclusividad reactiva de Debe y Haber
  const actualizarCampoLinea = (key: string, campo: "codigo" | "debe" | "haber" | "concepto_linea", valor: string) => {
    setMensajeExito(null)
    setMensajeError(null)
    setLineas((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l
        if (campo === "codigo") return { ...l, codigo: valor }
        if (campo === "concepto_linea") return { ...l, concepto_linea: valor }

        const num = valor === "" ? 0 : Math.max(0, Number(valor) || 0)
        // Regla: si se digita Debe, Haber pasa a 0; y viceversa
        if (campo === "debe") {
          return { ...l, debe: num, haber: num > 0 ? 0 : l.haber }
        }
        return { ...l, haber: num, debe: num > 0 ? 0 : l.debe }
      })
    )
  }

  const agregarFila = (codigoInicial = "") => {
    const nuevaKey = crypto.randomUUID()
    setLineas((prev) => [...prev, { key: nuevaKey, codigo: codigoInicial, debe: 0, haber: 0 }])
    setTimeout(() => {
      const el = accountSelectRefs.current.get(nuevaKey)
      if (el) el.focus()
    }, 50)
  }

  const eliminarFila = (key: string) => {
    if (lineas.length <= 2) {
      alert("Un asiento contable debe tener al menos dos líneas.")
      return
    }
    setLineas((prev) => prev.filter((l) => l.key !== key))
  }

  // Auto-cuadrar la partida automáticamente en la última línea
  const handleAutoBalancear = () => {
    const dCents = Math.round(totalDebe * 100)
    const hCents = Math.round(totalHaber * 100)
    const diff = Math.abs(dCents - hCents) / 100
    if (diff === 0) return

    setLineas((prev) => {
      const copia = [...prev]
      const ultimaIdx = copia.length - 1
      const ultima = copia[ultimaIdx]

      if (dCents > hCents) {
        // Falta en el Haber
        copia[ultimaIdx] = { ...ultima, haber: diff, debe: 0 }
      } else {
        // Falta en el Debe
        copia[ultimaIdx] = { ...ultima, debe: diff, haber: 0 }
      }
      return copia
    })
  }

  // Guardar como Borrador en LocalStorage
  const handleGuardarBorrador = () => {
    const nuevoBorrador: BorradorLocal = {
      id: crypto.randomUUID(),
      guardadoEn: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      fecha,
      concepto: concepto.trim() || "Borrador sin concepto",
      documento_soporte: documento.trim(),
      tipo,
      lineas,
    }
    persistirBorradores([nuevoBorrador, ...borradores])
    setMensajeExito("Borrador guardado localmente.")
  }

  // Restaurar Borrador
  const handleCargarBorrador = (b: BorradorLocal) => {
    setFecha(b.fecha)
    setConcepto(b.concepto)
    setDocumento(b.documento_soporte)
    setTipo(b.tipo || "OPERACION")
    setLineas(b.lineas)
    setMensajeExito("Borrador cargado a la mesa de trabajo.")
  }

  // Eliminar Borrador
  const handleEliminarBorrador = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    persistirBorradores(borradores.filter((b) => b.id !== id))
  }

  // Asentar y Foliar Partida Formal
  const handleAsentarPartida = async () => {
    setMensajeError(null)
    setMensajeExito(null)

    if (!concepto.trim()) {
      setMensajeError("Debe ingresar el concepto o glosa de la partida.")
      return
    }

    const lineasValidas = lineas.filter((l) => l.codigo && (l.debe > 0 || l.haber > 0))
    if (lineasValidas.length < 2) {
      setMensajeError("El asiento debe tener al menos dos cuentas con importes registrados.")
      return
    }

    if (!balanceado) {
      setMensajeError(`La partida está descuadrada por ${formatoMoneda(diferencia)}.`)
      return
    }

    setGuardando(true)
    try {
      await agregarAsiento({
        fecha,
        concepto: concepto.trim(),
        tipo,
        documento_soporte: documento.trim() || undefined,
        lineas: lineasValidas.map((l) => ({
          codigo: l.codigo,
          debe: Number(l.debe) || 0,
          haber: Number(l.haber) || 0,
        })),
      })

      setMensajeExito("¡Partida registrada y foliada con éxito!")
      // Limpiar mesa de trabajo
      setConcepto("")
      setDocumento("")
      setLineas([
        { key: crypto.randomUUID(), codigo: "", debe: 0, haber: 0 },
        { key: crypto.randomUUID(), codigo: "", debe: 0, haber: 0 },
      ])

      // Redirigir suavemente tras 1.2 segundos
      setTimeout(() => {
        router.push("/libro-diario")
      }, 1200)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al registrar asiento"
      setMensajeError(msg)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Barra superior de navegación */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/libro-diario"
            className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            title="Volver a la consulta foliada"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl flex items-center gap-2">
              Mesa de Trabajo: Captura de Asiento
            </h1>
            <p className="text-xs text-muted-foreground">
              Digitación asistida, balance en tiempo real y foliación formal inmutable.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleGuardarBorrador} className="cursor-pointer">
            <FileEdit className="mr-1.5 size-3.5" />
            Guardar Borrador
          </Button>
        </div>
      </div>

      {/* Alertas informativas */}
      {mensajeExito && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-4 shrink-0" />
          {mensajeExito}
        </div>
      )}
      {mensajeError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs font-semibold text-red-700 dark:text-red-300">
          <AlertCircle className="size-4 shrink-0" />
          {mensajeError}
        </div>
      )}

      {/* Layout Asimétrico: 75% Lienzo / 25% Barra Lateral */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ============================================================== */}
        {/* LIENZO DE CAPTURA PRINCIPAL (8 o 9 cols de 12 ~ 75%) */}
        {/* ============================================================== */}
        <section className="space-y-5 lg:col-span-8 xl:col-span-9">
          {/* Selector de Modalidad: Asistido Inteligente vs Mesa Directa */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-2 rounded-xl border border-border shadow-xs">
            <div className="inline-flex p-1 bg-muted/60 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setModoCaptura("asistida")}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  modoCaptura === "asistida"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="size-3.5 text-amber-400" />
                Captura Asistida (Plantillas & Smart +/-)
              </button>
              <button
                type="button"
                onClick={() => setModoCaptura("directa")}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  modoCaptura === "directa"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BookOpen className="size-3.5" />
                Mesa Clásica (Debe / Haber Directo)
              </button>
            </div>

            <span className="text-[11px] text-muted-foreground hidden sm:inline px-2">
              {modoCaptura === "asistida"
                ? "Plantillas guiadas y deducción automática según regla contable"
                : "Captura directa con teclado numérico"}
            </span>
          </div>

          {modoCaptura === "asistida" ? (
            <CapturaAsistida cuentas={cuentas} onAplicarAsiento={handleAplicarDesdeAsistente} />
          ) : (
            <>
              {/* Cabecera del asiento */}
              <Card className="border-border shadow-xs">
            <CardContent className="space-y-4 pt-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="fecha" className="text-xs font-semibold">
                    Fecha de Registro
                  </Label>
                  <Input
                    id="fecha"
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="tipo" className="text-xs font-semibold">
                    Tipo de Partida
                  </Label>
                  <select
                    id="tipo"
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as NonNullable<Asiento["tipo"]>)}
                    className="w-full rounded-md border border-input bg-background p-2 text-xs font-medium focus:ring-2 focus:ring-ring"
                  >
                    <option value="OPERACION">OPERACIÓN (Diaria)</option>
                    <option value="APERTURA">APERTURA (Inicio de Ejercicio)</option>
                    <option value="AJUSTE">AJUSTE (Cierre / Analítico)</option>
                    <option value="CIERRE">CIERRE (Liquidación Final)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="documento" className="text-xs font-semibold">
                    Doc. Soporte / Factura <span className="text-muted-foreground font-normal">(Opcional)</span>
                  </Label>
                  <Input
                    id="documento"
                    placeholder="Ej. Factura #A-1024, CCF #99"
                    value={documento}
                    onChange={(e) => setDocumento(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>
              </div>

              {/* Glosa o Concepto con Chips de sugerencia rápida */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="concepto" className="text-xs font-semibold">
                    Concepto / Glosa Oficial <span className="text-red-500">*</span>
                  </Label>
                  <span className="text-[11px] text-muted-foreground">Mínimo explicativo contable</span>
                </div>
                <textarea
                  id="concepto"
                  rows={2}
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                  placeholder="Describe la naturaleza comercial, personas involucradas y condiciones del hecho económico..."
                  className="w-full rounded-md border border-input bg-background p-2.5 text-xs focus:ring-2 focus:ring-ring"
                />

                {/* Glosas frecuentes */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Sparkles className="size-3 text-amber-500" /> Glosas frecuentes:
                  </span>
                  {GLOSAS_SUGERIDAS.slice(0, 3).map((g, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setConcepto(g)}
                      className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                    >
                      {g.slice(0, 38)}...
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de Renglones de Detalle */}
          <Card className="border-border shadow-xs overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border bg-muted/30 px-5 py-3">
              <div className="space-y-0.5">
                <CardTitle className="text-sm font-bold">Renglones Contables (Partida Doble)</CardTitle>
                <CardDescription className="text-xs">
                  {lineas.length} cuentas imputadas · Presiona <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">Enter</kbd> para agregar fila.
                </CardDescription>
              </div>

              <Button variant="outline" size="sm" onClick={() => agregarFila()} className="text-xs cursor-pointer">
                <Plus className="mr-1 size-3.5" /> Agregar Fila
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-sans text-xs">
                  <thead className="border-b border-border bg-muted/50 font-semibold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="w-10 px-3 py-2 text-center">#</th>
                      <th className="px-3 py-2 min-w-[260px]">Cuenta Contable (Permite Movimiento)</th>
                      <th className="w-36 px-3 py-2 text-right">Debe ($)</th>
                      <th className="w-36 px-3 py-2 text-right">Haber ($)</th>
                      <th className="w-10 px-2 py-2 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {lineas.map((linea, index) => (
                      <tr key={linea.key} className="hover:bg-muted/15 transition-colors">
                        <td className="px-3 py-2 text-center font-mono text-muted-foreground">{index + 1}</td>

                        {/* Selector de cuenta con typeahead predictivo */}
                        <td className="px-3 py-2">
                          <select
                            ref={(el) => {
                              if (el) accountSelectRefs.current.set(linea.key, el)
                              else accountSelectRefs.current.delete(linea.key)
                            }}
                            value={linea.codigo}
                            onChange={(e) => actualizarCampoLinea(linea.key, "codigo", e.target.value)}
                            className="w-full rounded-md border border-input bg-background p-1.5 font-mono text-xs focus:ring-2 focus:ring-ring"
                          >
                            <option value="">Seleccione cuenta transaccional...</option>
                            {cuentasTransaccionales.map((c) => (
                              <option key={c.codigo} value={c.codigo}>
                                {c.codigo} — {c.nombre} ({c.naturaleza})
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Campo Debe con exclusividad reactiva */}
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={linea.debe || ""}
                            onChange={(e) => actualizarCampoLinea(linea.key, "debe", e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                agregarFila()
                              }
                            }}
                            className="w-full rounded-md border border-input bg-background p-1.5 text-right font-mono text-xs font-semibold tabular-nums focus:ring-2 focus:ring-ring"
                          />
                        </td>

                        {/* Campo Haber con exclusividad reactiva */}
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={linea.haber || ""}
                            onChange={(e) => actualizarCampoLinea(linea.key, "haber", e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                agregarFila()
                              }
                            }}
                            className="w-full rounded-md border border-input bg-background p-1.5 text-right font-mono text-xs font-semibold tabular-nums focus:ring-2 focus:ring-ring"
                          />
                        </td>

                        {/* Eliminar fila */}
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => eliminarFila(linea.key)}
                            className="rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-600 transition-colors cursor-pointer"
                            title="Eliminar renglón"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Barra inferior de la tabla para agregar rápido */}
              <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2">
                <button
                  type="button"
                  onClick={() => agregarFila()}
                  className="flex items-center gap-1 text-xs text-primary font-medium hover:underline cursor-pointer"
                >
                  <Plus className="size-3.5" /> Agregar otro renglón
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    Atajo: Presiona <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">Alt + C</kbd> para auto-cuadrar
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAutoBalancear}
                    disabled={balanceado || diferencia === 0}
                    className="h-7 text-xs font-semibold cursor-pointer"
                  >
                    <Scale className="mr-1 size-3 text-amber-500" />
                    Auto-Cuadrar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
            </>
          )}
        </section>

        {/* ============================================================== */}
        {/* BARRA LATERAL DE CONTEXTO (4 o 3 cols de 12 ~ 25%) */}
        {/* ============================================================== */}
        <aside className="space-y-5 lg:col-span-4 xl:col-span-3">
          {/* Tarjeta: Última Partida Registrada */}
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-2.5 pt-4">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <History className="size-3.5 text-primary" />
                Última Partida Registrada
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {ultimaPartida ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-primary">
                      Partida #{ultimaPartida.numero} ({ultimaPartida.ejercicio || 2026})
                    </span>
                    <Badge variant="muted" className="font-mono text-[10px]">
                      Folio #{ultimaPartida.correlativo_global || ultimaPartida.numero}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-muted-foreground font-medium">
                    {ultimaPartida.concepto}
                  </p>
                  <div className="border-t border-border pt-2 text-[11px] text-muted-foreground flex justify-between">
                    <span>Fecha: {ultimaPartida.fecha}</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatoMoneda(totalesAsiento(ultimaPartida.lineas).debe)}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground italic">No hay partidas registradas aún.</p>
              )}
            </CardContent>
          </Card>

          {/* Tarjeta: Caja de Borradores Locales */}
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-2.5 pt-4 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileEdit className="size-3.5 text-amber-500" />
                Borradores Pendientes ({borradores.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {borradores.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No tienes borradores guardados.</p>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {borradores.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => handleCargarBorrador(b)}
                      className="group flex cursor-pointer items-start justify-between rounded-lg border border-border/70 p-2 hover:bg-muted/40 transition-colors"
                      title="Clic para restaurar en la mesa de trabajo"
                    >
                      <div className="space-y-0.5 overflow-hidden">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {b.concepto || "Sin concepto"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {b.fecha} · Guardado {b.guardadoEn}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleEliminarBorrador(b.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-600 transition-opacity p-1 cursor-pointer"
                        title="Descartar borrador"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tarjeta: Cuentas Analíticas Frecuentes */}
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <BookOpen className="size-3.5 text-sky-500" />
                Cuentas del Sistema Analítico
              </CardTitle>
              <CardDescription className="text-[11px]">
                Clic para insertar renglón con la cuenta preseleccionada:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <div className="grid grid-cols-1 gap-1.5">
                {CUENTAS_FRECUENTES_ANALITICAS.map((c) => (
                  <button
                    key={c.codigo}
                    type="button"
                    onClick={() => agregarFila(c.codigo)}
                    className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1 text-left text-xs hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
                  >
                    <span className="font-mono font-bold text-foreground text-[11px]">{c.codigo}</span>
                    <span className="truncate text-[11px] text-muted-foreground pl-2">{c.nombre}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* ============================================================== */}
      {/* BARRA INFERIOR FLOTANTE DE CUADRATURA Y ENVÍO (STICKY FOOTER) */}
      {/* ============================================================== */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md px-6 py-3 shadow-lg">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          {/* Totales Debe y Haber */}
          <div className="flex items-center gap-6">
            <div className="text-xs">
              <span className="text-muted-foreground">Total Debe:</span>
              <p className="font-mono text-base font-bold text-foreground tabular-nums">
                {formatoMoneda(totalDebe)}
              </p>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground">Total Haber:</span>
              <p className="font-mono text-base font-bold text-foreground tabular-nums">
                {formatoMoneda(totalHaber)}
              </p>
            </div>

            {/* Badge dinámico de cuadratura */}
            <div
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                balanceado
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
              }`}
            >
              {balanceado ? (
                <>
                  <CheckCircle2 className="size-4" />
                  <span>Partida Cuadrada</span>
                </>
              ) : (
                <>
                  <AlertCircle className="size-4" />
                  <span>Descuadrada por {formatoMoneda(diferencia)}</span>
                </>
              )}
            </div>
          </div>

          {/* Botones de acción final */}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutoBalancear}
              disabled={balanceado || diferencia === 0}
              className="hidden sm:inline-flex cursor-pointer"
            >
              <Scale className="mr-1.5 size-3.5 text-amber-500" />
              Auto-Cuadrar (Alt+C)
            </Button>

            <Button
              type="button"
              disabled={!balanceado || guardando}
              onClick={handleAsentarPartida}
              className="bg-primary text-primary-foreground font-bold shadow-xs hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
            >
              <Save className="mr-1.5 size-4" />
              {guardando ? "Foliando..." : "Guardar y Foliar Partida"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
