"use client"

import { useMemo, useState } from "react"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  FileDown,
  FileSpreadsheet,
  Info,
  Layers,
  Search,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/field"
import { useContabilidad } from "@/components/contabilidad-provider"
import { formatoMoneda, redondear } from "@/lib/contabilidad"
import { exportarLibroExcel } from "@/lib/excel"
import type { Asiento, Cuenta } from "@/lib/types"

interface MovimientoKardex {
  fecha: string
  partidaNumero: number
  correlativoGlobal?: number
  tipoPartida: string
  concepto: string
  debe: number
  haber: number
  saldo: number
  asientoOriginal: Asiento
}

const CUENTAS_RAPIDAS = [
  { codigo: "1104", nombre: "Inventario Inicial (Analítico)" },
  { codigo: "1101", nombre: "Caja general" },
  { codigo: "1102", nombre: "Bancos" },
  { codigo: "4101", nombre: "Compras" },
  { codigo: "4102", nombre: "Gastos s/compras" },
  { codigo: "5101", nombre: "Ventas" },
  { codigo: "5102", nombre: "Dev. s/compras" },
  { codigo: "4103", nombre: "Dev. s/ventas" },
]

const MESES = [
  { valor: "todos", label: "Todo el año" },
  { valor: "1", label: "Enero" },
  { valor: "2", label: "Febrero" },
  { valor: "3", label: "Marzo" },
  { valor: "4", label: "Abril" },
  { valor: "5", label: "Mayo" },
  { valor: "6", label: "Junio" },
  { valor: "7", label: "Julio" },
  { valor: "8", label: "Agosto" },
  { valor: "9", label: "Septiembre" },
  { valor: "10", label: "Octubre" },
  { valor: "11", label: "Noviembre" },
  { valor: "12", label: "Diciembre" },
]

export default function KardexPage() {
  const { cuentas, asientos, ejercicioSeleccionado } = useContabilidad()
  const [codigoSeleccionado, setCodigoSeleccionado] = useState<string>("1104")
  const [busqueda, setBusqueda] = useState("")
  const [mesFiltro, setMesFiltro] = useState<string>("todos")
  const [partidaDetalle, setPartidaDetalle] = useState<Asiento | null>(null)

  const cuentasActivas = useMemo(() => cuentas.filter((c) => c.activa), [cuentas])

  const indiceActual = useMemo(
    () => cuentasActivas.findIndex((c) => c.codigo === codigoSeleccionado),
    [cuentasActivas, codigoSeleccionado]
  )

  const cuentaActual: Cuenta | undefined = useMemo(() => {
    return cuentasActivas.find((c) => c.codigo === codigoSeleccionado) || cuentasActivas[0]
  }, [cuentasActivas, codigoSeleccionado])

  const cuentaAnterior = () => {
    if (indiceActual > 0) {
      setCodigoSeleccionado(cuentasActivas[indiceActual - 1].codigo)
    }
  }

  const cuentaSiguiente = () => {
    if (indiceActual < cuentasActivas.length - 1) {
      setCodigoSeleccionado(cuentasActivas[indiceActual + 1].codigo)
    }
  }

  const cuentasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return cuentasActivas
    return cuentasActivas.filter(
      (c) => c.codigo.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q)
    )
  }, [cuentasActivas, busqueda])

  // Movimientos cronológicos y saldo progresivo
  const todosMovimientos: MovimientoKardex[] = useMemo(() => {
    if (!cuentaActual) return []

    const asientosDelEjercicio = asientos
      .filter((a) => {
        if (a.estado === "ANULADO") return false
        const ej = a.ejercicio || (a.fecha ? new Date(a.fecha).getFullYear() : undefined)
        if (ej !== undefined && ej !== ejercicioSeleccionado) return false
        return true
      })
      .slice()
      .sort((a, b) => {
        const fComp = (a.fecha || "").localeCompare(b.fecha || "")
        if (fComp !== 0) return fComp
        return a.numero - b.numero
      })

    const lista: MovimientoKardex[] = []
    let saldoAcumulado = 0

    for (const a of asientosDelEjercicio) {
      for (const linea of a.lineas) {
        if (linea.codigo === cuentaActual.codigo) {
          const debe = Number(linea.debe) || 0
          const haber = Number(linea.haber) || 0

          if (cuentaActual.naturaleza === "deudora") {
            saldoAcumulado = redondear(saldoAcumulado + debe - haber)
          } else {
            saldoAcumulado = redondear(saldoAcumulado + haber - debe)
          }

          lista.push({
            fecha: a.fecha,
            partidaNumero: a.numero,
            correlativoGlobal: a.correlativo_global,
            tipoPartida: a.tipo || "OPERACION",
            concepto: a.concepto,
            debe,
            haber,
            saldo: saldoAcumulado,
            asientoOriginal: a,
          })
        }
      }
    }

    return lista
  }, [asientos, cuentaActual, ejercicioSeleccionado])

  // Filtrado temporal
  const movimientos = useMemo(() => {
    if (mesFiltro === "todos") return todosMovimientos
    const mesNum = Number(mesFiltro)
    return todosMovimientos.filter((m) => {
      const fecha = new Date(m.fecha + "T00:00:00")
      return fecha.getMonth() + 1 === mesNum
    })
  }, [todosMovimientos, mesFiltro])

  const totalDebe = useMemo(
    () => redondear(movimientos.reduce((acc, m) => acc + m.debe, 0)),
    [movimientos]
  )
  const totalHaber = useMemo(
    () => redondear(movimientos.reduce((acc, m) => acc + m.haber, 0)),
    [movimientos]
  )
  const saldoFinal = useMemo(() => {
    if (!cuentaActual || movimientos.length === 0) return 0
    return movimientos[movimientos.length - 1].saldo
  }, [movimientos, cuentaActual])

  function exportarPdf() {
    const previousTitle = document.title
    document.title = `Libro_Auxiliar_${cuentaActual?.codigo || "cuenta"}_${ejercicioSeleccionado}`
    window.print()
    window.setTimeout(() => {
      document.title = previousTitle
    }, 500)
  }

  function exportarExcel() {
    if (!cuentaActual) return

    const filas: (string | number | null | undefined)[][] = [
      ["SISTEMA CONTABLE AUTOMATIZADO - LIBRO AUXILIAR DE CUENTAS"],
      [`Ejercicio fiscal: ${ejercicioSeleccionado}`],
      [`Cuenta: ${cuentaActual.codigo} - ${cuentaActual.nombre}`],
      [`Tipo: ${cuentaActual.tipo} | Naturaleza: ${cuentaActual.naturaleza}`],
      [`Filtro aplicado: ${MESES.find((m) => m.valor === mesFiltro)?.label || "Todo el año"}`],
      [`Fecha de emisión: ${new Date().toLocaleDateString("es-SV")}`],
      [],
      ["Fecha", "Partida #", "Correlativo", "Tipo", "Concepto / Glosa", "Debe (Cargos)", "Haber (Abonos)", "Saldo Progresivo"],
    ]

    for (const m of movimientos) {
      filas.push([
        m.fecha,
        m.partidaNumero,
        m.correlativoGlobal ?? "-",
        m.tipoPartida,
        m.concepto,
        m.debe,
        m.haber,
        m.saldo,
      ])
    }

    filas.push([])
    filas.push([
      "TOTALES DEL PERIODO",
      "",
      "",
      "",
      "",
      totalDebe,
      totalHaber,
      saldoFinal,
    ])

    exportarLibroExcel(`Libro_Auxiliar_${cuentaActual.codigo}_${cuentaActual.nombre.replace(/\s+/g, "_")}`, [
      {
        nombre: `Auxiliar ${cuentaActual.codigo}`,
        filas,
      },
    ])
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-primary">Libros Contables</p>
              <Badge variant="default" className="text-xs">
                Extracto Auxiliar · Mayor Analítico
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Kardex / Libro Auxiliar
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Auditoría cronológica de movimientos contables en dólares (USD) y cálculo de saldos progresivos cuenta por cuenta para el ejercicio {ejercicioSeleccionado}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              type="button"
              variant="outline"
              onClick={exportarPdf}
              className="border-border text-foreground hover:bg-muted"
            >
              <FileDown className="size-4 mr-1.5" />
              Imprimir / PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={exportarExcel}
              className="border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/20"
            >
              <FileSpreadsheet className="size-4 text-emerald-600 mr-1.5" />
              Exportar Excel
            </Button>
          </div>
        </div>
      </header>

      {/* SELECTOR DE CUENTAS ERGONÓMICO */}
      <Card className="print:hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              Selección y Navegación de Cuentas
            </CardTitle>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={cuentaAnterior}
                disabled={indiceActual <= 0}
                className="h-8 px-2 text-xs"
                title="Cuenta anterior (alfabéticamente)"
              >
                <ChevronLeft className="size-4 mr-1" />
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground font-mono px-1">
                {indiceActual + 1} de {cuentasActivas.length}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={cuentaSiguiente}
                disabled={indiceActual >= cuentasActivas.length - 1}
                className="h-8 px-2 text-xs"
                title="Siguiente cuenta (alfabéticamente)"
              >
                Siguiente
                <ChevronRight className="size-4 ml-1" />
              </Button>
            </div>
          </div>
          <CardDescription>
            Busca cualquier cuenta del catálogo o navega correlativamente entre ellas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Accesos rápidos */}
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-muted-foreground self-center mr-1">Cuentas frecuentes:</span>
            {CUENTAS_RAPIDAS.map((c) => {
              const activa = codigoSeleccionado === c.codigo
              return (
                <Button
                  key={c.codigo}
                  type="button"
                  size="sm"
                  variant={activa ? "default" : "outline"}
                  onClick={() => setCodigoSeleccionado(c.codigo)}
                  className="h-7 text-xs px-2.5"
                >
                  <span className="font-mono mr-1 opacity-70">{c.codigo}</span> {c.nombre}
                </Button>
              )
            })}
          </div>

          {/* Barra de Búsqueda y Selector Reactivo */}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="relative">
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono font-medium"
                value={codigoSeleccionado}
                onChange={(e) => setCodigoSeleccionado(e.target.value)}
                aria-label="Seleccionar cuenta del catálogo"
              >
                {cuentasFiltradas.map((c) => (
                  <option key={c.codigo} value={c.codigo}>
                    {c.codigo} — {c.nombre} ({c.tipo}, {c.naturaleza})
                  </option>
                ))}
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filtrar lista de cuentas..."
                value={busqueda}
                onChange={(e) => {
                  const val = e.target.value
                  setBusqueda(val)
                  // Si hay una coincidencia exacta de código, seleccionarla al instante
                  const matchExacto = cuentasActivas.find((c) => c.codigo === val.trim())
                  if (matchExacto) setCodigoSeleccionado(matchExacto.codigo)
                }}
                className="pl-9 h-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AVISO METODOLÓGICO PARA CUENTA 1104 */}
      {codigoSeleccionado === "1104" && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 text-xs text-blue-950 dark:text-blue-200">
          <div className="flex items-start gap-3">
            <Info className="size-5 shrink-0 text-blue-600 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-sm text-blue-900 dark:text-blue-100">
                Aviso: Cuenta 1104 bajo el Método Analítico o Pormenorizado
              </p>
              <p className="leading-relaxed">
                Bajo el <strong>Método Analítico</strong>, la cuenta <strong>1104 (Inventario de mercadería)</strong> permanece estática durante el ejercicio contable ({ejercicioSeleccionado}), reflejando el <em>Inventario Inicial</em>.
              </p>
              <p className="leading-relaxed">
                Para auditar el flujo operativo de compras y ventas, consulte las cuentas correspondientes: <strong>4101 (Compras)</strong>, <strong>4102 (Gastos s/compras)</strong>, <strong>5102 (Devoluciones s/compras)</strong> y <strong>5101 (Ventas)</strong>. La existencia física final se valida en la <em>Toma Física de Inventario</em> en Estados Financieros.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* RESUMEN DE LA CUENTA AUDITADA */}
      {cuentaActual && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Cuenta Contable
              </p>
              <div className="mt-1 flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold font-mono">{cuentaActual.codigo}</p>
                  <p className="text-sm font-medium text-foreground truncate max-w-[180px]">
                    {cuentaActual.nombre}
                  </p>
                </div>
                <Badge variant={cuentaActual.naturaleza === "deudora" ? "deudora" : "default"}>
                  {cuentaActual.naturaleza}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total Cargos (Debe)
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight font-mono text-foreground flex items-center gap-1.5">
                <ArrowDownLeft className="size-5 text-emerald-600" />
                {formatoMoneda(totalDebe)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total Abonos (Haber)
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight font-mono text-foreground flex items-center gap-1.5">
                <ArrowUpRight className="size-5 text-amber-600" />
                {formatoMoneda(totalHaber)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-primary/[0.02]">
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">
                Saldo Progresivo Actual
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight font-mono text-primary">
                {formatoMoneda(saldoFinal)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* EXTRACTO CRONOLÓGICO */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold">
                Extracto Cronológico y Auditoría de Partidas
              </CardTitle>
              <CardDescription>
                Historial cronológico de débitos, créditos y saldo acumulado. Haz clic en cualquier partida para ver el asiento completo.
              </CardDescription>
            </div>

            {/* Filtro por Mes */}
            <div className="flex items-center gap-2 print:hidden">
              <Calendar className="size-4 text-muted-foreground" />
              <select
                value={mesFiltro}
                onChange={(e) => setMesFiltro(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium"
              >
                {MESES.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.label}
                  </option>
                ))}
              </select>
              <Badge variant="muted" className="text-xs">
                {movimientos.length} {movimientos.length === 1 ? "registro" : "registros"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {movimientos.length === 0 ? (
            <div className="py-12 text-center">
              <ClipboardList className="mx-auto size-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No hay movimientos para la cuenta {cuentaActual?.codigo} - {cuentaActual?.nombre} {mesFiltro !== "todos" ? `en ${MESES.find((m) => m.valor === mesFiltro)?.label}` : ""}.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Selecciona otra cuenta arriba o cambia el filtro de período.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3 text-center">Partida #</th>
                    <th className="py-2.5 px-3 text-center">Tipo</th>
                    <th className="py-2.5 px-3">Concepto / Glosa</th>
                    <th className="py-2.5 px-3 text-right">Debe (Cargos)</th>
                    <th className="py-2.5 px-3 text-right">Haber (Abonos)</th>
                    <th className="py-2.5 px-3 text-right">Saldo Progresivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {movimientos.map((m, idx) => (
                    <tr key={idx} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 px-3 font-medium whitespace-nowrap font-mono text-xs">
                        {m.fecha}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setPartidaDetalle(m.asientoOriginal)}
                          className="inline-flex items-center gap-1 text-xs font-semibold font-mono text-primary hover:underline bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded transition-colors"
                          title="Hacer clic para ver la partida contable completa"
                        >
                          <Eye className="size-3" />
                          #{m.partidaNumero}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-muted">
                          {m.tipoPartida}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground max-w-sm text-xs">
                        {m.concepto}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {m.debe > 0 ? (
                          <span className="text-foreground font-semibold">{formatoMoneda(m.debe)}</span>
                        ) : (
                          <span className="text-muted-foreground/40">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {m.haber > 0 ? (
                          <span className="text-foreground font-semibold">{formatoMoneda(m.haber)}</span>
                        ) : (
                          <span className="text-muted-foreground/40">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-primary">
                        {formatoMoneda(m.saldo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/20 font-semibold">
                  <tr>
                    <td colSpan={4} className="py-2.5 px-3 text-xs uppercase tracking-wider">
                      Totales del período ({mesFiltro === "todos" ? "Año completo" : MESES.find((m) => m.valor === mesFiltro)?.label})
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">{formatoMoneda(totalDebe)}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{formatoMoneda(totalHaber)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-primary">
                      {formatoMoneda(saldoFinal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL DE DRILL-DOWN: VER PARTIDA CONTABLE COMPLETA */}
      {partidaDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-foreground">
                    Partida Contable #{partidaDetalle.numero}
                  </h3>
                  <Badge variant="default" className="text-xs">
                    {partidaDetalle.tipo || "OPERACIÓN"}
                  </Badge>
                  {partidaDetalle.estado === "ANULADO" && (
                    <Badge variant="warning" className="text-xs">
                      ANULADA
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Fecha: <strong>{partidaDetalle.fecha}</strong> · Correlativo global: <strong>{partidaDetalle.correlativo_global ?? "-"}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPartidaDetalle(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                Concepto / Glosa:
              </p>
              <p className="text-sm bg-muted/30 p-2.5 rounded-lg border border-border/60">
                {partidaDetalle.concepto}
              </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="py-2 px-3 text-left">Código</th>
                    <th className="py-2 px-3 text-left">Cuenta</th>
                    <th className="py-2 px-3 text-right">Debe</th>
                    <th className="py-2 px-3 text-right">Haber</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {partidaDetalle.lineas.map((l, i) => {
                    const c = cuentas.find((x) => x.codigo === l.codigo)
                    const esCuentaActual = l.codigo === cuentaActual?.codigo
                    return (
                      <tr
                        key={i}
                        className={esCuentaActual ? "bg-primary/10 font-semibold" : ""}
                      >
                        <td className="py-2 px-3 font-mono text-xs">{l.codigo}</td>
                        <td className="py-2 px-3">
                          {c?.nombre || "Cuenta desconocida"}
                          {esCuentaActual && (
                            <span className="ml-2 text-[10px] text-primary font-normal">
                              (Cuenta en consulta)
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {l.debe > 0 ? formatoMoneda(l.debe) : "-"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {l.haber > 0 ? formatoMoneda(l.haber) : "-"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-muted/30 font-bold border-t border-border">
                  <tr>
                    <td colSpan={2} className="py-2 px-3 text-xs uppercase">
                      Sumas Iguales
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      {formatoMoneda(
                        partidaDetalle.lineas.reduce((acc, l) => acc + (Number(l.debe) || 0), 0)
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      {formatoMoneda(
                        partidaDetalle.lineas.reduce((acc, l) => acc + (Number(l.haber) || 0), 0)
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPartidaDetalle(null)}
              >
                Cerrar Detalle
              </Button>
            </div>
          </div>
        </div>
      )}

      <footer className="hidden border-t border-border pt-8 text-center text-xs text-muted-foreground print:block">
        <p>Auxiliar oficial emitido por el Sistema Contable Automatizado.</p>
        <div className="mt-12 grid grid-cols-3 gap-10">
          <div className="border-t border-foreground/50 pt-2">Elaboró (Contador)</div>
          <div className="border-t border-foreground/50 pt-2">Revisó (Auditor)</div>
          <div className="border-t border-foreground/50 pt-2">Autorizó (Representante)</div>
        </div>
      </footer>
    </div>
  )
}
