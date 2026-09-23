"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
  ArrowRight,
  BookOpenText,
  ClipboardList,
  FileSpreadsheet,
  Landmark,
  Library,
  ListTree,
  Plus,
  Receipt,
  Scale,
  Users,
  Wallet,
  History,
} from "lucide-react"
import { useContabilidad } from "@/components/contabilidad-provider"
import { formatoMoneda } from "@/lib/contabilidad"

export default function DashboardPage() {
  const {
    cuentas,
    asientos,
    mayor,
    estadoResultados,
    ejercicios,
    ejercicioSeleccionado,
    esEjercicioCerrado,
    cargando,
  } = useContabilidad()

  /* ── Asientos del ejercicio ── */
  const asientosEj = useMemo(
    () => asientos.filter((a) => !a.ejercicio || a.ejercicio === ejercicioSeleccionado),
    [asientos, ejercicioSeleccionado]
  )

  const proximoNumero = useMemo(() => {
    if (asientosEj.length === 0) return 1
    return Math.max(...asientosEj.map((a) => a.numero || 0)) + 1
  }, [asientosEj])

  const ultimas = useMemo(
    () => [...asientosEj].sort((a, b) => (b.numero || 0) - (a.numero || 0)).slice(0, 8),
    [asientosEj]
  )

  /* ── Saldos operativos que el contador necesita ── */
  const saldoRaw = (codigo: string) => {
    const m = mayor.find((x) => x.cuenta.codigo === codigo)
    if (!m) return 0
    return m.debe - m.haber
  }

  const caja = Math.max(0, saldoRaw("1101"))
  const bancosNeto = saldoRaw("1102")
  const bancoSobregirado = bancosNeto < 0
  const efectivo = caja + bancosNeto

  const cxc = Math.max(0, saldoRaw("1103"))       // Clientes por cobrar
  const cxp = Math.max(0, -saldoRaw("2101"))      // Proveedores por pagar (haber - debe)

  const ivaCF = Math.max(0, saldoRaw("1105"))     // Crédito fiscal
  const ivaDF = Math.max(0, -saldoRaw("2103"))    // Débito fiscal
  const ivaNeto = ivaDF - ivaCF
  const ivaAlDia = ivaDF === 0 && ivaCF === 0
  const ivaPorPagar = !ivaAlDia && ivaNeto > 0

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-sm text-muted-foreground">Cargando…</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">

      {/* ═══ 1. ACCIÓN PRINCIPAL ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Inicio · Ciclo {ejercicioSeleccionado}
            </h1>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                esEjercicioCerrado
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
              }`}
            >
              {esEjercicioCerrado ? "Solo Lectura" : "Abierto"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {asientosEj.filter((a) => a.estado !== "ANULADO").length} partidas registradas en el ciclo {ejercicioSeleccionado}
          </p>
        </div>
        {!esEjercicioCerrado && (
          <Link
            href="/libro-diario"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-xs whitespace-nowrap"
          >
            <Plus className="size-3.5" />
            <span>Registrar Partida (Póliza #{proximoNumero})</span>
          </Link>
        )}
      </div>

      {/* ═══ 2. SALDOS OPERATIVOS — Lo que el contador necesita ver ═══ */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">

        {/* Efectivo disponible */}
        <MetricCard
          href="/kardex?codigo=1102"
          icon={Wallet}
          label="Efectivo disponible"
          valor={efectivo}
          sub={
            bancoSobregirado
              ? `Banco: -${formatoMoneda(Math.abs(bancosNeto))} (Sobregiro) · Caja: ${formatoMoneda(caja)}`
              : `Banco: ${formatoMoneda(bancosNeto)} · Caja: ${formatoMoneda(caja)}`
          }
          negative={efectivo < 0 || bancoSobregirado}
        />

        {/* Clientes por cobrar */}
        <MetricCard
          href="/kardex?codigo=1103"
          icon={Users}
          label="Clientes por cobrar"
          valor={cxc}
          sub={cxc > 0 ? "Saldo pendiente 1103" : "Sin saldo pendiente"}
        />

        {/* Proveedores por pagar */}
        <MetricCard
          href="/kardex?codigo=2101"
          icon={Landmark}
          label="Proveedores por pagar"
          valor={cxp}
          sub={cxp > 0 ? "Saldo acumulado 2101" : "Al día"}
        />

        {/* IVA */}
        <MetricCard
          href="/libro-mayor?buscar=1105"
          icon={Receipt}
          label={ivaAlDia ? "IVA al día" : ivaPorPagar ? "IVA por pagar" : "IVA a favor"}
          valor={Math.abs(ivaNeto)}
          sub={ivaAlDia ? "Sin movimientos en ciclo" : `DF ${formatoMoneda(ivaDF)} · CF ${formatoMoneda(ivaCF)}`}
        />
      </div>

      {/* ═══ 3. RESUMEN FINANCIERO RÁPIDO ═══ */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-border/60 bg-muted/15 px-4 py-3 text-xs text-muted-foreground">
        <span>
          Ingresos{" "}
          <strong className="text-foreground font-mono">{formatoMoneda(estadoResultados.totalIngresos)}</strong>
        </span>
        <span>
          Gastos{" "}
          <strong className="text-foreground font-mono">{formatoMoneda(estadoResultados.totalGastos)}</strong>
        </span>
        <span>
          {estadoResultados.utilidad >= 0 ? "Utilidad" : "Pérdida"}{" "}
          <strong className={`font-mono ${estadoResultados.utilidad >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {formatoMoneda(Math.abs(estadoResultados.utilidad))}
          </strong>
        </span>
      </div>

      {/* ═══ 4. ÚLTIMAS PARTIDAS ═══ */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Últimas Partidas
          </h2>
          <Link href="/libro-diario" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            Ver todo <ArrowRight className="size-3" />
          </Link>
        </div>

        {ultimas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-8 text-center">
            <FileSpreadsheet className="mx-auto size-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium text-foreground">
              {esEjercicioCerrado ? "Ciclo cerrado sin partidas" : "Sin partidas todavía"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {esEjercicioCerrado
                ? "Este periodo está cerrado y en modo solo lectura."
                : "Registra la primera partida para comenzar."}
            </p>
            {!esEjercicioCerrado && (
              <Link href="/libro-diario" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition">
                <Plus className="size-3.5" /> Registrar
              </Link>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border/70 bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/50 bg-muted/30">
                  <tr className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 w-16">#</th>
                    <th className="px-3 py-2.5 w-20">Tipo</th>
                    <th className="px-3 py-2.5 w-24">Fecha</th>
                    <th className="px-4 py-2.5">Concepto</th>
                    <th className="px-4 py-2.5 text-right w-28">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {ultimas.map((a) => {
                    const total = (a.lineas || []).reduce((s, l) => s + (Number(l.debe) || 0), 0)
                    const tipo = a.tipo || "OPERACION"
                    const anulado = a.estado === "ANULADO"
                    const colors: Record<string, string> = {
                      APERTURA: "text-blue-700 dark:text-blue-400 bg-blue-500/10",
                      CIERRE: "text-amber-700 dark:text-amber-400 bg-amber-500/10",
                      AJUSTE: "text-purple-700 dark:text-purple-400 bg-purple-500/10",
                      OPERACION: "text-muted-foreground bg-muted/60",
                    }
                    return (
                      <tr key={a.id} className={`hover:bg-muted/20 transition ${anulado ? "opacity-45" : ""}`}>
                        <td className="px-4 py-2.5 font-mono font-semibold text-foreground">{a.numero}</td>
                        <td className="px-3 py-2.5">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${colors[tipo] || colors.OPERACION}`}>
                            {anulado ? "ANULADA" : tipo}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">{a.fecha}</td>
                        <td className="px-4 py-2.5 max-w-[260px] truncate">
                          <span className={anulado ? "line-through text-muted-foreground" : "text-foreground/90"}>{a.concepto}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-foreground whitespace-nowrap">{formatoMoneda(total)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ═══ 5. ACCESOS DIRECTOS ═══ */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Ir a
        </h2>
        <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { href: "/libro-diario", title: "Libro Diario", icon: BookOpenText, tag: `${asientosEj.length} partidas` },
            { href: "/libro-mayor", title: "Libro Mayor", icon: ListTree, tag: `${mayor.length} cuentas` },
            { href: "/kardex", title: "Kardex", icon: ClipboardList, tag: "Libro Auxiliar" },
            { href: "/estados-financieros", title: "Estados Financieros", icon: Scale, tag: "Balances y Cierre" },
            { href: "/ciclos", title: "Ciclos Contables", icon: History, tag: `${ejercicios.length} periodos` },
            { href: "/catalogo", title: "Catálogo", icon: Library, tag: `${cuentas.length} cuentas` },
          ].map((m) => {
            const Icon = m.icon
            return (
              <Link key={m.href} href={m.href} className="group rounded-xl border border-border/60 bg-card p-3 hover:border-primary/50 hover:bg-muted/30 transition shadow-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <Icon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <ArrowRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{m.title}</p>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{m.tag}</p>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

/* ── Tarjeta de métrica reutilizable ── */
function MetricCard({
  href,
  icon: Icon,
  label,
  valor,
  sub,
  negative,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  valor: number
  sub: string
  negative?: boolean
}) {
  return (
    <Link href={href} className="group rounded-xl border border-border/70 bg-card p-4 shadow-xs hover:border-primary/40 transition block">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className={`text-xl font-bold font-mono tracking-tight ${negative ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
        {formatoMoneda(valor)}
      </p>
      <p className="text-[10px] text-muted-foreground font-mono mt-1">{sub}</p>
    </Link>
  )
}
