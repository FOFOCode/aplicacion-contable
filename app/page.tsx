"use client"

import Link from "next/link"
import {
  ArrowLeftRight,
  BookOpenText,
  CircleCheck,
  ListTree,
  Scale,
  TriangleAlert,
  Wallet,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useContabilidad } from "@/components/contabilidad-provider"
import { formatoMoneda } from "@/lib/contabilidad"

export default function DashboardPage() {
  const { asientos, mayor, estadoResultados, balanceGeneral } = useContabilidad()

  const totalDebe = asientos.reduce(
    (s, a) => s + a.lineas.reduce((x, l) => x + (Number(l.debe) || 0), 0),
    0,
  )

  const stats = [
    {
      label: "Asientos registrados",
      valor: String(asientos.length),
      icon: BookOpenText,
      hint: "Libro Diario",
    },
    {
      label: "Movimiento total (Debe)",
      valor: formatoMoneda(totalDebe),
      icon: ArrowLeftRight,
      hint: "Cargos acumulados",
    },
    {
      label: "Cuentas con saldo",
      valor: String(mayor.length),
      icon: ListTree,
      hint: "Libro Mayor",
    },
    {
      label: "Utilidad del ejercicio",
      valor: formatoMoneda(estadoResultados.utilidad),
      icon: Wallet,
      hint: "Estado de Resultados",
    },
  ]

  const accesos = [
    {
      href: "/libro-diario",
      title: "Libro Diario",
      desc: "Registra asientos con validación obligatoria de la Partida Doble.",
      icon: BookOpenText,
    },
    {
      href: "/libro-mayor",
      title: "Libro Mayor",
      desc: "Mayorización automática en tiempo real de débitos y créditos.",
      icon: ListTree,
    },
    {
      href: "/estados-financieros",
      title: "Estados Financieros",
      desc: "Balance General y Estado de Resultados generados dinámicamente.",
      icon: Scale,
    },
  ]

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">Ciclo contable automático</p>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Panel principal</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Sistema para desarrollar el ciclo contable de forma automática, garantizando la Partida
          Doble y la generación dinámica de Estados Financieros a partir del código de cada cuenta.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {s.hint}
                  </span>
                  <Icon className="size-4 text-primary" />
                </div>
                <p className="mt-3 text-2xl font-bold tracking-tight">{s.valor}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <section>
        <Card className={balanceGeneral.cuadra ? "border-emerald-500/30" : "border-red-500/30"}>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              {balanceGeneral.cuadra ? (
                <CircleCheck className="size-8 text-emerald-600" />
              ) : (
                <TriangleAlert className="size-8 text-red-600" />
              )}
              <div>
                <p className="font-semibold">
                  {balanceGeneral.cuadra
                    ? "La ecuación contable está balanceada"
                    : "La ecuación contable no cuadra"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Activo = Pasivo + Capital contable
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div>
                <p className="text-muted-foreground">Activo</p>
                <p className="font-semibold">{formatoMoneda(balanceGeneral.totalActivo)}</p>
              </div>
              <span className="text-muted-foreground">=</span>
              <div>
                <p className="text-muted-foreground">Pasivo + Capital</p>
                <p className="font-semibold">
                  {formatoMoneda(balanceGeneral.totalPasivoMasCapital)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {accesos.map((a) => {
          const Icon = a.icon
          return (
            <Link key={a.href} href={a.href} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/40">
                <CardHeader>
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="mt-2">{a.title}</CardTitle>
                  <CardDescription>{a.desc}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          )
        })}
      </section>

    </div>
  )
}
