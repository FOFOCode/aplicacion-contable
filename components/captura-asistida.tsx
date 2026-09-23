"use client"

import React, { useState, useMemo, useEffect } from "react"
import { useForm, useFieldArray, Controller } from "react-hook-form"
import {
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Scale,
  ArrowRight,
  TrendingUp,
  ShoppingBag,
  RotateCcw,
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
  Info,
  Layers,
  HelpCircle,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input, Label } from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { Cuenta, AsientoLinea } from "@/lib/types"
import { formatoMoneda } from "@/lib/contabilidad"
import {
  inferirImputacion,
  calcularAutoBalance,
  type OperacionContable,
  type ResultadoImputacion,
} from "@/lib/asientoInferenceEngine"
import {
  PLANTILLAS_CONTABLES,
  type PlantillaAsiento,
  type CategoriaPlantilla,
} from "@/lib/templates.config"
import {
  generarAsientoDesdePlantilla,
  type AsientoPlantillaResultado,
} from "@/lib/asientoTemplateEngine"

export interface LineaSmartEntry {
  codigo: string
  monto: number
  operacion: "AUMENTA" | "DISMINUYE"
  concepto_linea?: string
}

export interface FormValuesSmartEntry {
  fecha: string
  tipo: "OPERACION" | "AJUSTE"
  documento_soporte: string
  concepto: string
  lineas: LineaSmartEntry[]
}

interface CapturaAsistidaProps {
  cuentas: Cuenta[]
  onAplicarAsiento: (datos: {
    fecha?: string
    tipo?: "OPERACION" | "AJUSTE"
    documento_soporte?: string
    concepto: string
    lineas: AsientoLinea[]
  }) => void
}

export function CapturaAsistida({ cuentas, onAplicarAsiento }: CapturaAsistidaProps) {
  const [modalidad, setModalidad] = useState<"plantillas" | "asistida">("plantillas")

  // ===========================================================================
  // ESTADO MODALIDAD 1: MODO GUIADO POR PLANTILLAS (QUICK ENTRY)
  // ===========================================================================
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas")
  const [plantillaSeleccionadaId, setPlantillaSeleccionadaId] = useState<string>("compra_mercaderia_contado")
  const [valoresPlantilla, setValoresPlantilla] = useState<Record<string, any>>({
    monto: 1000,
    aplicaIva: true,
    medioPago: "1101",
    proveedor: "Distribuidora Mayorista S.A.",
  })

  const plantillaActual = useMemo(() => {
    return PLANTILLAS_CONTABLES.find((p) => p.id === plantillaSeleccionadaId) || PLANTILLAS_CONTABLES[0]
  }, [plantillaSeleccionadaId])

  const resultadoPlantilla = useMemo<AsientoPlantillaResultado>(() => {
    return generarAsientoDesdePlantilla(plantillaSeleccionadaId, valoresPlantilla, cuentas)
  }, [plantillaSeleccionadaId, valoresPlantilla, cuentas])

  const plantillasFiltradas = useMemo(() => {
    if (categoriaFiltro === "todas") return PLANTILLAS_CONTABLES
    return PLANTILLAS_CONTABLES.filter((p) => p.categoria === categoriaFiltro)
  }, [categoriaFiltro])

  const handleSeleccionarPlantilla = (p: PlantillaAsiento) => {
    setPlantillaSeleccionadaId(p.id)
    const defaults: Record<string, any> = {}
    for (const c of p.campos) {
      defaults[c.id] = c.valorPorDefecto !== undefined ? c.valorPorDefecto : ""
    }
    setValoresPlantilla(defaults)
  }

  const handleAplicarDesdePlantilla = () => {
    if (!resultadoPlantilla.valido) return
    onAplicarAsiento({
      tipo: resultadoPlantilla.tipo,
      documento_soporte: resultadoPlantilla.documentoSoporte,
      concepto: resultadoPlantilla.glosa,
      lineas: resultadoPlantilla.lineas.map((l) => ({
        codigo: l.codigo,
        debe: l.debe,
        haber: l.haber,
      })),
    })
  }

  // ===========================================================================
  // ESTADO MODALIDAD 2: MODO ASISTIDO EN CAPTURA LIBRE (SMART ENTRY)
  // ===========================================================================
  const cuentasValidas = useMemo(() => {
    return cuentas.filter((c) => c.permite_movimiento !== false && c.activa)
  }, [cuentas])

  const { control, watch, setValue, getValues } = useForm<FormValuesSmartEntry>({
    defaultValues: {
      fecha: new Date().toISOString().slice(0, 10),
      tipo: "OPERACION",
      documento_soporte: "FAC-1001",
      concepto: "Registro contable con inferencia automática",
      lineas: [
        { codigo: "1101", monto: 1130, operacion: "AUMENTA" },
        { codigo: "5101", monto: 1000, operacion: "AUMENTA" },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lineas",
  })

  const watchedLineas = watch("lineas")

  // Cálculo en tiempo real de imputaciones inferidas
  const lineasInferidas = useMemo(() => {
    return watchedLineas.map((l) => {
      const cuentaObj = cuentas.find((c) => c.codigo === l.codigo)
      if (!cuentaObj) {
        return {
          cuenta: null,
          resultado: null,
          codigo: l.codigo,
          monto: Number(l.monto) || 0,
          operacion: l.operacion,
        }
      }
      const resultado = inferirImputacion(cuentaObj, Number(l.monto) || 0, l.operacion)
      return {
        cuenta: cuentaObj,
        resultado,
        codigo: l.codigo,
        monto: Number(l.monto) || 0,
        operacion: l.operacion,
      }
    })
  }, [watchedLineas, cuentas])

  // Cálculo de totales y recomendación de auto-balance
  const balanceState = useMemo(() => {
    const pares = lineasInferidas.map((item) => ({
      debe: item.resultado?.debe || 0,
      haber: item.resultado?.haber || 0,
    }))
    return calcularAutoBalance(pares)
  }, [lineasInferidas])

  // Acción de auto-balancear agregando renglón complementario
  const handleAutoBalancear = (codigoCuentaSugerida = "2103") => {
    if (!balanceState.hayDescuadre) return

    const cuentaElegida = cuentas.find((c) => c.codigo === codigoCuentaSugerida) || cuentasValidas[0]
    if (!cuentaElegida) return

    const sugerencia = balanceState.operacionSugeridaParaCuenta?.(cuentaElegida)
    append({
      codigo: cuentaElegida.codigo,
      monto: balanceState.montoFaltante,
      operacion: sugerencia?.operacion || "AUMENTA",
    })
  }

  const handleAplicarDesdeSmartEntry = () => {
    if (balanceState.hayDescuadre || lineasInferidas.length < 2) return
    const values = getValues()
    const lineasAsiento: AsientoLinea[] = lineasInferidas.map((l) => ({
      codigo: l.codigo,
      debe: l.resultado?.debe || 0,
      haber: l.resultado?.haber || 0,
    }))

    onAplicarAsiento({
      fecha: values.fecha,
      tipo: values.tipo,
      documento_soporte: values.documento_soporte,
      concepto: values.concepto,
      lineas: lineasAsiento,
    })
  }

  return (
    <div className="space-y-6">
      {/* SEGMENTED CONTROL: MODALIDAD DE CAPTURA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-muted/30 p-2 rounded-xl border border-border">
        <div className="inline-flex p-1 bg-background rounded-lg border border-border shadow-xs">
          <button
            type="button"
            onClick={() => setModalidad("plantillas")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all ${
              modalidad === "plantillas"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap className="size-3.5" />
            Modo Guiado por Plantillas (Quick Entry)
          </button>
          <button
            type="button"
            onClick={() => setModalidad("asistida")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all ${
              modalidad === "asistida"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="size-3.5" />
            Modo Asistido Libre (Smart Entry +/-)
          </button>
        </div>

        <div className="text-xs text-muted-foreground flex items-center gap-1.5 px-2">
          <Info className="size-3.5 text-primary" />
          <span>
            {modalidad === "plantillas"
              ? "Eventos de negocio con cálculo automático de IVA y cuentas analíticas"
              : "Deduce Debe/Haber según la regla contable (+ Aumenta / - Disminuye)"}
          </span>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODALIDAD 1: GUIADO POR PLANTILLAS (QUICK ENTRY)                      */}
      {/* ===================================================================== */}
      {modalidad === "plantillas" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Columna Izquierda: Selector de Evento y Formulario (7 columnas) */}
          <div className="lg:col-span-7 space-y-4">
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShoppingBag className="size-4 text-primary" />
                    Seleccionar Evento Comercial
                  </CardTitle>
                  {/* Filtro de Categoría */}
                  <div className="flex items-center gap-1 text-xs">
                    {(["todas", "compras", "ventas", "gastos", "devoluciones", "tesoreria"] as const).map(
                      (cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategoriaFiltro(cat)}
                          className={`px-2.5 py-1 rounded-md capitalize font-medium text-[11px] transition-colors ${
                            categoriaFiltro === cat
                              ? "bg-primary/10 text-primary font-bold"
                              : "text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {cat}
                        </button>
                      ),
                    )}
                  </div>
                </div>
                <CardDescription className="text-xs">
                  Selecciona la operación. Solo ingresa el importe base y el sistema armará el asiento foliado.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Grid de Plantillas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {plantillasFiltradas.map((p) => {
                    const activa = p.id === plantillaActual.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSeleccionarPlantilla(p)}
                        className={`text-left p-3 rounded-lg border transition-all flex flex-col justify-between gap-1 text-xs ${
                          activa
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "border-border hover:border-foreground/30 hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{p.nombre}</span>
                          <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-mono border ${p.colorBadge}`}>
                            {p.categoria}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {p.descripcion}
                        </p>
                      </button>
                    )
                  })}
                </div>

                {/* Formulario Dinámico de Parámetros */}
                <div className="pt-4 border-t border-border space-y-3 bg-muted/20 p-3.5 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Zap className="size-3.5 text-amber-500" />
                      Parámetros de la Operación: {plantillaActual.nombre}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      Tipo: {plantillaActual.defaultTipo}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {plantillaActual.campos.map((campo) => {
                      if (campo.tipo === "monto") {
                        return (
                          <div key={campo.id} className="space-y-1">
                            <Label className="text-xs font-semibold">{campo.label}</Label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                                $
                              </span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={valoresPlantilla[campo.id] ?? ""}
                                onChange={(e) =>
                                  setValoresPlantilla((prev) => ({
                                    ...prev,
                                    [campo.id]: parseFloat(e.target.value) || 0,
                                  }))
                                }
                                className="pl-6 font-mono font-medium text-xs h-8 text-right"
                              />
                            </div>
                            {campo.ayuda && (
                              <p className="text-[10px] text-muted-foreground">{campo.ayuda}</p>
                            )}
                          </div>
                        )
                      }

                      if (campo.tipo === "select") {
                        return (
                          <div key={campo.id} className="space-y-1">
                            <Label className="text-xs font-semibold">{campo.label}</Label>
                            <select
                              value={valoresPlantilla[campo.id] ?? ""}
                              onChange={(e) =>
                                setValoresPlantilla((prev) => ({
                                  ...prev,
                                  [campo.id]: e.target.value,
                                }))
                              }
                              className="w-full text-xs h-8 rounded-md border border-input bg-background px-2 font-medium"
                            >
                              {campo.opciones?.map((op) => (
                                <option key={op.valor} value={op.valor}>
                                  {op.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )
                      }

                      if (campo.tipo === "boolean") {
                        return (
                          <div key={campo.id} className="flex items-center gap-2 pt-5">
                            <input
                              type="checkbox"
                              id={campo.id}
                              checked={Boolean(valoresPlantilla[campo.id])}
                              onChange={(e) =>
                                setValoresPlantilla((prev) => ({
                                  ...prev,
                                  [campo.id]: e.target.checked,
                                }))
                              }
                              className="size-4 rounded border-input text-primary accent-primary"
                            />
                            <Label htmlFor={campo.id} className="text-xs font-semibold cursor-pointer">
                              {campo.label}
                            </Label>
                          </div>
                        )
                      }

                      return (
                        <div key={campo.id} className="space-y-1">
                          <Label className="text-xs font-semibold">{campo.label}</Label>
                          <Input
                            type="text"
                            placeholder={campo.placeholder}
                            value={valoresPlantilla[campo.id] ?? ""}
                            onChange={(e) =>
                              setValoresPlantilla((prev) => ({
                                ...prev,
                                [campo.id]: e.target.value,
                              }))
                            }
                            className="text-xs h-8"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Columna Derecha: Preview Contable Generado (5 columnas) */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-2.5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Scale className="size-4 text-emerald-500" />
                    Preview Contable Generado
                  </CardTitle>
                  <Badge
                    variant={resultadoPlantilla.cuadra ? "default" : "destructive"}
                    className="font-mono text-[10px]"
                  >
                    {resultadoPlantilla.cuadra ? "PARTIDA CUADRADA" : "DESCUADRE"}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Desglose tributario e imputación automática en Debe y Haber.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Desglose Monetario */}
                <div className="grid grid-cols-3 gap-2 bg-muted/40 p-2.5 rounded-lg border border-border text-center">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block font-semibold">
                      Base Neta
                    </span>
                    <span className="text-xs font-mono font-bold">
                      {formatoMoneda(resultadoPlantilla.baseImponible)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block font-semibold">
                      IVA (13%)
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-500">
                      {formatoMoneda(resultadoPlantilla.iva)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block font-semibold">
                      Total Factura
                    </span>
                    <span className="text-xs font-mono font-bold text-primary">
                      {formatoMoneda(resultadoPlantilla.total)}
                    </span>
                  </div>
                </div>

                {/* Glosa Generada */}
                <div className="bg-background p-2.5 rounded-md border border-border text-xs">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5">
                    Concepto / Glosa Automática:
                  </span>
                  <p className="font-medium text-foreground italic leading-snug">
                    {resultadoPlantilla.glosa}
                  </p>
                </div>

                {/* Tabla de Renglones Generados */}
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold text-[11px]">
                      <tr>
                        <th className="py-1.5 px-2 text-left">Cuenta</th>
                        <th className="py-1.5 px-2 text-right">Debe ($)</th>
                        <th className="py-1.5 px-2 text-right">Haber ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {resultadoPlantilla.lineas.map((linea, idx) => (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="py-2 px-2">
                            <span className="font-mono font-semibold text-primary block">
                              {linea.codigo}
                            </span>
                            <span className="text-[11px] text-foreground font-medium block">
                              {linea.nombreCuenta}
                            </span>
                            <span className="text-[9px] text-muted-foreground block italic">
                              {linea.justificacion}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-semibold text-foreground align-top">
                            {linea.debe > 0 ? formatoMoneda(linea.debe) : "-"}
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-semibold text-foreground align-top">
                            {linea.haber > 0 ? formatoMoneda(linea.haber) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/30 border-t-2 border-foreground/30 font-mono text-xs font-bold">
                      <tr>
                        <td className="py-2 px-2 text-left text-[11px] uppercase tracking-wider">
                          Sumas Iguales
                        </td>
                        <td className="py-2 px-2 text-right border-b-4 border-double border-foreground/40">
                          {formatoMoneda(resultadoPlantilla.totalDebe)}
                        </td>
                        <td className="py-2 px-2 text-right border-b-4 border-double border-foreground/40">
                          {formatoMoneda(resultadoPlantilla.totalHaber)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Botón de Inyección */}
                <Button
                  type="button"
                  onClick={handleAplicarDesdePlantilla}
                  disabled={!resultadoPlantilla.valido}
                  className="w-full text-xs font-semibold gap-2 py-2.5"
                >
                  <Check className="size-4" />
                  Transferir Asiento a la Mesa de Registro
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODALIDAD 2: MODO ASISTIDO EN CAPTURA LIBRE (SMART ENTRY)             */}
      {/* ===================================================================== */}
      {modalidad === "asistida" && (
        <div className="space-y-4">
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    Captura Asistida por Sentido Operativo (+ / -)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Indica si la cuenta <strong>Aumenta (+)</strong> o <strong>Disminuye (-)</strong>.
                    El motor deduce automáticamente el débito (Debe) o crédito (Haber).
                  </CardDescription>
                </div>

                {/* Banner de Auto-Balance */}
                {balanceState.hayDescuadre ? (
                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-lg text-xs">
                    <AlertCircle className="size-4" />
                    <span>
                      Faltan <strong>{formatoMoneda(balanceState.montoFaltante)}</strong> al{" "}
                      <strong>{balanceState.columnaFaltante}</strong>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleAutoBalancear()}
                      className="h-6 text-[10px] font-bold border-amber-500/40 hover:bg-amber-500/20"
                    >
                      <Zap className="size-3 mr-1" />
                      Auto-cuadrar
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-lg text-xs font-semibold">
                    <CheckCircle2 className="size-4" />
                    <span>Partida Doble Cuadrada</span>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Tabla de Renglones Asistidos */}
              <div className="border border-border rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold text-[11px]">
                    <tr>
                      <th className="py-2 px-3 text-left w-6">#</th>
                      <th className="py-2 px-3 text-left min-w-[280px]">Cuenta Contable & Naturaleza</th>
                      <th className="py-2 px-3 text-right w-36">Monto ($)</th>
                      <th className="py-2 px-3 text-center w-48">Operación</th>
                      <th className="py-2 px-3 text-center min-w-[200px]">Preview Contable Inferido</th>
                      <th className="py-2 px-3 text-center w-12">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {fields.map((field, index) => {
                      const inferencia = lineasInferidas[index]
                      const cuentaActual = inferencia?.cuenta
                      const res = inferencia?.resultado

                      return (
                        <tr key={field.id} className="hover:bg-muted/15 transition-colors">
                          <td className="py-2.5 px-3 text-muted-foreground font-mono text-[11px] align-middle">
                            {index + 1}
                          </td>

                          {/* Selector de Cuenta */}
                          <td className="py-2.5 px-3 align-middle">
                            <Controller
                              control={control}
                              name={`lineas.${index}.codigo`}
                              render={({ field: selectField }) => (
                                <div className="space-y-1">
                                  <select
                                    {...selectField}
                                    className="w-full text-xs h-8 rounded-md border border-input bg-background px-2 font-medium"
                                  >
                                    <option value="">-- Seleccionar cuenta --</option>
                                    {cuentasValidas.map((c) => (
                                      <option key={c.codigo} value={c.codigo}>
                                        {c.codigo} - {c.nombre} ({c.naturaleza.toUpperCase()})
                                      </option>
                                    ))}
                                  </select>
                                  {cuentaActual && (
                                    <div className="flex items-center gap-1.5 text-[10px]">
                                      <Badge
                                        variant="outline"
                                        className={`capitalize text-[9px] py-0 px-1.5 ${
                                          cuentaActual.naturaleza === "deudora"
                                            ? "border-blue-500/30 text-blue-500 bg-blue-500/5"
                                            : "border-purple-500/30 text-purple-500 bg-purple-500/5"
                                        }`}
                                      >
                                        {cuentaActual.tipo} • {cuentaActual.naturaleza}
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              )}
                            />
                          </td>

                          {/* Monto */}
                          <td className="py-2.5 px-3 align-middle">
                            <Controller
                              control={control}
                              name={`lineas.${index}.monto`}
                              render={({ field: inputField }) => (
                                <div className="relative">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                                    $
                                  </span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    {...inputField}
                                    onChange={(e) => inputField.onChange(parseFloat(e.target.value) || 0)}
                                    className="pl-6 font-mono text-xs text-right h-8 font-semibold"
                                  />
                                </div>
                              )}
                            />
                          </td>

                          {/* Selector de Operación (+ Aumenta / - Disminuye) */}
                          <td className="py-2.5 px-3 align-middle">
                            <Controller
                              control={control}
                              name={`lineas.${index}.operacion`}
                              render={({ field: opField }) => (
                                <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40 w-full justify-center">
                                  <button
                                    type="button"
                                    onClick={() => opField.onChange("AUMENTA")}
                                    className={`flex-1 py-1 px-2 rounded-md text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                                      opField.value === "AUMENTA"
                                        ? "bg-emerald-600 text-white shadow-xs"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                                  >
                                    <span>+</span> Aumenta
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => opField.onChange("DISMINUYE")}
                                    className={`flex-1 py-1 px-2 rounded-md text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                                      opField.value === "DISMINUYE"
                                        ? "bg-amber-600 text-white shadow-xs"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                                  >
                                    <span>-</span> Disminuye
                                  </button>
                                </div>
                              )}
                            />
                          </td>

                          {/* Preview Contable Inferido */}
                          <td className="py-2.5 px-3 align-middle text-center">
                            {res ? (
                              <div className="space-y-1">
                                <div className="flex items-center justify-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                                      res.imputacion === "DEBE"
                                        ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                                        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                    }`}
                                  >
                                    {res.imputacion}: {formatoMoneda(res.monto)}
                                  </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground italic leading-tight">
                                  {res.explicacion}
                                </p>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">
                                Selecciona una cuenta
                              </span>
                            )}
                          </td>

                          {/* Eliminar Fila */}
                          <td className="py-2.5 px-3 text-center align-middle">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => remove(index)}
                              disabled={fields.length <= 2}
                              className="size-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>

                  {/* Pie con Sumas Iguales Inferidas */}
                  <tfoot className="bg-muted/40 border-t-2 border-border font-mono text-xs">
                    <tr>
                      <td colSpan={2} className="py-2.5 px-3 text-left font-sans font-bold text-[11px] uppercase">
                        Totales Inferidos (Partida Doble)
                      </td>
                      <td colSpan={2} className="py-2.5 px-3 text-center">
                        <span className="text-[11px] font-sans font-semibold text-muted-foreground mr-2">
                          Debe:
                        </span>
                        <strong className="text-foreground">{formatoMoneda(balanceState.totalDebe)}</strong>
                        <span className="mx-2 text-muted-foreground">|</span>
                        <span className="text-[11px] font-sans font-semibold text-muted-foreground mr-2">
                          Haber:
                        </span>
                        <strong className="text-foreground">{formatoMoneda(balanceState.totalHaber)}</strong>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold">
                        {balanceState.hayDescuadre ? (
                          <span className="text-destructive text-[11px]">
                            Descuadre: {formatoMoneda(balanceState.diferencia)}
                          </span>
                        ) : (
                          <span className="text-emerald-500 text-[11px] flex items-center justify-center gap-1">
                            <CheckCircle2 className="size-3.5" /> Balanceado (0.00)
                          </span>
                        )}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Botones de Acción */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const defecto = cuentasValidas[0]
                    append({
                      codigo: defecto ? defecto.codigo : "",
                      monto: balanceState.hayDescuadre ? balanceState.montoFaltante : 0,
                      operacion: "AUMENTA",
                    })
                  }}
                  className="text-xs font-semibold gap-1.5"
                >
                  <Plus className="size-3.5" />
                  Agregar Renglón Asistido
                </Button>

                <Button
                  type="button"
                  onClick={handleAplicarDesdeSmartEntry}
                  disabled={balanceState.hayDescuadre || lineasInferidas.length < 2}
                  className="text-xs font-semibold gap-2 py-2 px-4"
                >
                  <Check className="size-4" />
                  Transferir a Comprobante de Diario
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
