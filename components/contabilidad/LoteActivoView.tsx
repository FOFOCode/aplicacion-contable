"use client"

import React, { useState, useMemo } from "react"
import Link from "next/link"
import {
  Layers,
  Scale,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Sparkles,
  ShoppingBag,
  TrendingUp,
  Building2,
  ArrowRight,
  Inbox,
  Filter,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { LoteContable, Asiento, Cuenta } from "@/lib/types"
import { formatoMoneda, type TotalesLoteResultado } from "@/lib/contabilidad"
import { PartidaLoteCard } from "./PartidaLoteCard"

interface LoteActivoViewProps {
  lote: LoteContable
  partidas: Asiento[]
  cuentas: Cuenta[]
  totales: TotalesLoteResultado
  onNuevaPartida: () => void
  onEditarPartida?: (asiento: Asiento) => void
  onDuplicarPartida?: (asiento: Asiento) => void
  onEliminarPartida?: (id: string) => void
}

export function LoteActivoView({
  lote,
  partidas,
  cuentas,
  totales,
  onNuevaPartida,
  onEditarPartida,
  onDuplicarPartida,
  onEliminarPartida,
}: LoteActivoViewProps) {
  const [busqueda, setBusqueda] = useState("")

  const partidasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return partidas

    return partidas.filter((p) => {
      return (
        p.concepto.toLowerCase().includes(q) ||
        String(p.numero).includes(q) ||
        (p.documento_soporte && p.documento_soporte.toLowerCase().includes(q)) ||
        p.lineas.some((l) => l.codigo.includes(q))
      )
    })
  }, [partidas, busqueda])

  return (
    <div className="space-y-6">
      {/* ===================================================================== */}
      {/* 1. TARJETAS DE RESUMEN DEL LOTE ACTIVO (KPIS COMPACTOS)               */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* KPI 1: Partidas en este lote */}
        <Card className="border-border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3.5 px-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Partidas en Lote #{lote.numero}
            </span>
            <Layers className="size-4 text-primary" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold tracking-tight text-foreground">
                {totales.totalPartidas}
              </span>
              <span className="text-xs text-muted-foreground">
                ({totales.partidasValidas} de {totales.totalPartidas} cuadradas)
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Sesión activa de captura ({lote.mes})
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Monto Total del Lote */}
        <Card className="border-border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3.5 px-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Monto Total del Lote
            </span>
            <span className="font-mono text-xs font-bold text-muted-foreground">USD</span>
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="font-mono text-2xl font-bold tracking-tight text-foreground">
              {formatoMoneda(totales.totalDebe)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Suma de débitos y créditos del lote en curso
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Estado de Cuadratura del Lote */}
        <Card
          className={`border shadow-xs transition-colors ${
            totales.cuadrado
              ? "border-emerald-500/20 bg-emerald-500/[0.02]"
              : "border-amber-500/30 bg-amber-500/[0.03]"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3.5 px-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Cuadratura del Lote
            </span>
            <Scale
              className={`size-4 ${
                totales.cuadrado ? "text-emerald-500" : "text-amber-500"
              }`}
            />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="flex items-center gap-1.5">
              {totales.cuadrado ? (
                <>
                  <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
                  <span className="font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    100% Cuadrado
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="size-5 text-amber-500 shrink-0" />
                  <span className="font-mono text-xl font-bold text-amber-600 dark:text-amber-400">
                    Dif: {formatoMoneda(totales.diferencia)}
                  </span>
                </>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {totales.cuadrado
                ? "Partida doble estricta sin diferencias"
                : `${totales.partidasConError} partida(s) con descuadre`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ===================================================================== */}
      {/* 2. BARRA DE CONTROL DEL LOTE ACTIVO                                   */}
      {/* ===================================================================== */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Filtrar partidas de este lote por glosa, número o cuenta..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-8 text-xs h-8"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={onNuevaPartida}
            className="text-xs font-semibold gap-1.5 h-8 cursor-pointer"
          >
            <Plus className="size-3.5" />
            + Nueva Partida <span className="opacity-70 text-[10px] font-mono hidden sm:inline">[Alt + N]</span>
          </Button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. LISTADO DE COMPROBANTES DEL LOTE EN CAPTURA                        */}
      {/* ===================================================================== */}
      {partidas.length === 0 ? (
        /* ESTADO VACÍO AMIGABLE */
        <Card className="border-dashed border-2 border-border/80 bg-muted/10">
          <CardContent className="py-16 text-center space-y-4 max-w-md mx-auto">
            <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto border border-primary/20">
              <Inbox className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">
                Lote #{lote.numero} en Blanco
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Este lote de trabajo aún no contiene partidas registradas. Empieza a registrar
                operaciones para este período contable ({lote.mes}).
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <Button
                type="button"
                onClick={onNuevaPartida}
                className="text-xs font-semibold gap-1.5 cursor-pointer"
              >
                <Plus className="size-3.5" />
                Registrar Primera Partida
              </Button>
            </div>

            {/* Accesos rápidos sugeridos */}
            <div className="pt-4 border-t border-border/60 text-left space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block text-center">
                O captura guiada con plantillas:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <Link
                  href="/libro-diario/nuevo"
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <ShoppingBag className="size-3.5 text-blue-500" />
                    Compra Mercadería
                  </span>
                  <ArrowRight className="size-3 text-muted-foreground" />
                </Link>
                <Link
                  href="/libro-diario/nuevo"
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <TrendingUp className="size-3.5 text-emerald-500" />
                    Venta al Contado
                  </span>
                  <ArrowRight className="size-3 text-muted-foreground" />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              Mostrando {partidasFiltradas.length} de {partidas.length} partidas en el lote activo
            </span>
            <span className="font-mono text-[11px]">
              Doble subrayado indica Sumas Iguales
            </span>
          </div>

          <div className="space-y-3">
            {partidasFiltradas.map((asiento, idx) => (
              <PartidaLoteCard
                key={asiento.id}
                asiento={asiento}
                posicionEnLote={idx + 1}
                cuentas={cuentas}
                onEditar={onEditarPartida}
                onDuplicar={onDuplicarPartida}
                onEliminar={onEliminarPartida}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
