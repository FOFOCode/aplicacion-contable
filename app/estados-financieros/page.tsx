"use client"

import { useState } from "react"
import {
  CircleCheck,
  FileDown,
  RotateCcw,
  TriangleAlert,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

import { useContabilidad } from "@/components/contabilidad-provider"

import {
  formatoMoneda,
  type LineaReporte,
} from "@/lib/contabilidad"

// ============================================================
// LISTADO DE CUENTAS
// ============================================================

function Renglones({
  items,
  signo,
}: {
  items: LineaReporte[]
  signo?: string
}) {
  if (items.length === 0) {
    return (
      <p className="px-1 py-2 text-sm text-muted-foreground">
        Sin movimientos.
      </p>
    )
  }

  return (
    <div className="divide-y divide-border">
      {items.map((it) => (
        <div
          key={it.cuenta.codigo}
          className="flex items-center justify-between gap-4 px-1 py-2 text-sm"
        >
          <span className="min-w-0">
            {signo && (
              <span className="mr-2 font-medium text-muted-foreground">
                {signo}
              </span>
            )}

            <span className="mr-2 text-muted-foreground">
              {it.cuenta.codigo}
            </span>

            {it.cuenta.nombre}
          </span>

          <span className="shrink-0 tabular-nums">
            {formatoMoneda(it.monto)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// FILA DE TOTAL
// ============================================================

function TotalRow({
  label,
  valor,
  fuerte,
  destacado,
}: {
  label: string
  valor: number
  fuerte?: boolean
  destacado?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 border-t border-border px-1 py-2 text-sm ${
        fuerte ? "font-bold" : "font-semibold"
      } ${
        destacado
          ? "mt-2 rounded-md bg-muted/40 px-3"
          : ""
      }`}
    >
      <span>{label}</span>

      <span className="tabular-nums">
        {formatoMoneda(valor)}
      </span>
    </div>
  )
}

// ============================================================
// TÍTULO DE SUBSECCIÓN
// ============================================================

function Subtitulo({
  titulo,
  codigo,
}: {
  titulo: string
  codigo?: string
}) {
  return (
    <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
      {titulo}

      {codigo && (
        <Badge variant="muted">
          Código {codigo}
        </Badge>
      )}
    </h3>
  )
}

// ============================================================
// PÁGINA
// ============================================================

export default function EstadosFinancierosPage() {
  const {
    estadoResultados: er,
    balanceGeneral: bg,
    cerrarCicloContable,
    asientos,
  } = useContabilidad()

  const [mostrarCierre, setMostrarCierre] =
    useState(false)

  const [cerrando, setCerrando] =
    useState(false)

  // ==========================================================
  // EXPORTAR / IMPRIMIR PDF
  // ==========================================================

  function exportarPdf() {
    const previousTitle =
      document.title

    document.title =
      "Reporte de Estados Financieros"

    window.print()

    window.setTimeout(() => {
      document.title =
        previousTitle
    }, 500)
  }

  // ==========================================================
  // CERRAR EJERCICIO
  // ==========================================================

  function abrirCierre() {
    setMostrarCierre(true)
  }

  async function confirmarCierre() {
    setCerrando(true)

    try {
      await cerrarCicloContable()
      setMostrarCierre(false)
    } finally {
      setCerrando(false)
    }
  }

  return (
    <div className="space-y-8 report-page">
      {/* ==================================================== */}
      {/* ENCABEZADO */}
      {/* ==================================================== */}

      <header className="space-y-3 report-header">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">
              Reportes contables
            </p>

            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Reporte de Estados Financieros
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Corte del ejercicio contable · Expresado en dólares de los Estados Unidos de América
            </p>
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              type="button"
              variant="outline"
              onClick={exportarPdf}
            >
              <FileDown className="size-4" />
              Exportar PDF
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={abrirCierre}
              disabled={!asientos.length}
              className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
            >
              <RotateCcw className="size-4" />
              Cerrar ejercicio
            </Button>
          </div>
        </div>

        <p className="max-w-3xl text-sm text-muted-foreground">
          Información preparada automáticamente a partir de los asientos registrados y clasificada por el catálogo de cuentas.
        </p>
      </header>

      {/* ==================================================== */}
      {/* ESTADO DE RESULTADOS */}
      {/* ==================================================== */}

      <Card className="report-card">
        <CardHeader>
          <CardTitle>
            Estado de Resultados
          </CardTitle>

          <CardDescription>
            Determinación de ventas netas, costo de venta, utilidad bruta,
            gastos de operación, resultado financiero y utilidad del ejercicio.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-7">
          {/* ================================================= */}
          {/* VENTAS */}
          {/* ================================================= */}

          <section>
            <Subtitulo
              titulo="Ventas"
              codigo="5"
            />

            <Renglones
              items={er.ventas}
            />

            <TotalRow
              label="Ventas brutas"
              valor={er.totalVentasBrutas}
            />

            <div className="mt-3">
              <p className="mb-1 text-sm font-medium">
                (-) Devoluciones sobre ventas
              </p>

              <Renglones
                items={er.devolucionesVentas}
                signo="(-)"
              />
            </div>

            <TotalRow
              label="Ventas netas"
              valor={er.totalVentas}
              fuerte
              destacado
            />
          </section>

          {/* ================================================= */}
          {/* COSTO DE VENTA */}
          {/* ================================================= */}

          <section className="border-t border-border pt-6">
            <Subtitulo
              titulo="Costo de venta"
              codigo="41"
            />

            {er.usaDetalleCompras ? (
              <div className="space-y-4">
                {/* COMPRAS */}

                <div>
                  <p className="mb-1 text-sm font-medium">
                    Compras
                  </p>

                  <Renglones
                    items={er.compras}
                  />

                  <TotalRow
                    label="Compras"
                    valor={er.totalCompras}
                  />
                </div>

                {/* GASTOS SOBRE COMPRAS */}

                <div>
                  <p className="mb-1 text-sm font-medium">
                    (+) Gastos sobre compras
                  </p>

                  <Renglones
                    items={er.gastosCompras}
                    signo="(+)"
                  />

                  <TotalRow
                    label="Gastos sobre compras"
                    valor={er.totalGastosCompras}
                  />
                </div>

                <TotalRow
                  label="Compras totales"
                  valor={er.comprasTotales}
                  fuerte
                />

                {/* DEVOLUCIONES SOBRE COMPRAS */}

                <div>
                  <p className="mb-1 text-sm font-medium">
                    (-) Devoluciones sobre compras
                  </p>

                  <Renglones
                    items={er.devolucionesCompras}
                    signo="(-)"
                  />
                </div>

                <TotalRow
                  label="Compras netas"
                  valor={er.comprasNetas}
                  fuerte
                />

                <TotalRow
                  label="Costo de venta"
                  valor={er.totalCostoVentas}
                  fuerte
                  destacado
                />
              </div>
            ) : (
              <div>
                <Renglones
                  items={er.costoVentas}
                />

                <TotalRow
                  label="Costo de venta"
                  valor={er.totalCostoVentas}
                  fuerte
                  destacado
                />
              </div>
            )}
          </section>

          {/* ================================================= */}
          {/* UTILIDAD BRUTA */}
          {/* ================================================= */}

          <div className="flex items-center justify-between rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
            <span className="font-semibold">
              Utilidad bruta
            </span>

            <span className="text-lg font-bold tabular-nums">
              {formatoMoneda(
                er.utilidadBruta
              )}
            </span>
          </div>

          {/* ================================================= */}
          {/* OTROS INGRESOS OPERATIVOS */}
          {/* ================================================= */}

          {er.otrosIngresosOperativos.length > 0 && (
            <section>
              <Subtitulo
                titulo="Otros ingresos operativos"
              />

              <Renglones
                items={
                  er.otrosIngresosOperativos
                }
              />

              <TotalRow
                label="Total otros ingresos operativos"
                valor={
                  er.totalOtrosIngresosOperativos
                }
              />
            </section>
          )}

          {/* ================================================= */}
          {/* GASTOS DE OPERACIÓN */}
          {/* ================================================= */}

          <section>
            <Subtitulo
              titulo="(-) Gastos de operación"
              codigo="42"
            />

            <Renglones
              items={
                er.gastosOperacion
              }
            />

            <TotalRow
              label="Total gastos de operación"
              valor={
                er.totalGastosOperacion
              }
            />
          </section>

          {/* ================================================= */}
          {/* UTILIDAD DE OPERACIÓN */}
          {/* ================================================= */}

          <TotalRow
            label="Utilidad de operación"
            valor={
              er.utilidadOperacion
            }
            fuerte
            destacado
          />

          {/* ================================================= */}
          {/* RESULTADO FINANCIERO */}
          {/* ================================================= */}

          <div className="grid gap-6 border-t border-border pt-6 md:grid-cols-2">
            <section>
              <Subtitulo
                titulo="Ingresos financieros"
                codigo="52"
              />

              <Renglones
                items={
                  er.ingresosFinancieros
                }
              />

              <TotalRow
                label="Total ingresos financieros"
                valor={
                  er.totalIngresosFinancieros
                }
              />
            </section>

            <section>
              <Subtitulo
                titulo="(-) Gastos financieros"
                codigo="43"
              />

              <Renglones
                items={
                  er.gastosFinancieros
                }
              />

              <TotalRow
                label="Total gastos financieros"
                valor={
                  er.totalGastosFinancieros
                }
              />
            </section>
          </div>

          <TotalRow
            label="Resultado financiero"
            valor={
              er.resultadoFinanciero
            }
            fuerte
          />

          {/* ================================================= */}
          {/* UTILIDAD ANTES DE IMPUESTOS */}
          {/* ================================================= */}

          <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <span className="font-semibold">
              Utilidad antes de impuestos
            </span>

            <span className="text-lg font-bold tabular-nums">
              {formatoMoneda(
                er.utilidadAntesImpuestos
              )}
            </span>
          </div>

          {/* ================================================= */}
          {/* RESULTADO DEL EJERCICIO */}
          {/* ================================================= */}

          <div
            className={`flex items-center justify-between rounded-lg border p-4 ${
              er.utilidad >= 0
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-red-500/30 bg-red-500/10"
            }`}
          >
            <span className="font-semibold">
              {er.utilidad >= 0
                ? "Utilidad del ejercicio"
                : "Pérdida del ejercicio"}
            </span>

            <span className="text-xl font-bold tabular-nums">
              {formatoMoneda(
                er.utilidad
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ==================================================== */}
      {/* BALANCE GENERAL */}
      {/* ==================================================== */}

      <Card className="report-card">
        <CardHeader>
          <CardTitle>
            Balance General
          </CardTitle>

          <CardDescription>
            Clasificación automática del activo y pasivo en corriente y no corriente según el código de cada cuenta.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-10 md:grid-cols-2">
          {/* ================================================= */}
          {/* ACTIVO */}
          {/* ================================================= */}

          <div className="space-y-7">
            <div>
              <h2 className="mb-4 text-base font-bold">
                ACTIVO
              </h2>

              {/* ACTIVO CORRIENTE */}

              <section>
                <Subtitulo
                  titulo="Activo corriente"
                  codigo="11"
                />

                <Renglones
                  items={
                    bg.activosCorrientes
                  }
                />

                <TotalRow
                  label="Total activo corriente"
                  valor={
                    bg.totalActivoCorriente
                  }
                  fuerte
                />
              </section>

              {/* ACTIVO NO CORRIENTE */}

              <section className="mt-6">
                <Subtitulo
                  titulo="Activo no corriente"
                  codigo="12"
                />

                <Renglones
                  items={
                    bg.activosNoCorrientes
                  }
                />

                <TotalRow
                  label="Total activo no corriente"
                  valor={
                    bg.totalActivoNoCorriente
                  }
                  fuerte
                />
              </section>
            </div>

            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold">
                  TOTAL ACTIVO
                </span>

                <span className="text-lg font-bold tabular-nums">
                  {formatoMoneda(
                    bg.totalActivo
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* ================================================= */}
          {/* PASIVO Y CAPITAL */}
          {/* ================================================= */}

          <div className="space-y-7">
            <div>
              <h2 className="mb-4 text-base font-bold">
                PASIVO
              </h2>

              {/* PASIVO CORRIENTE */}

              <section>
                <Subtitulo
                  titulo="Pasivo corriente"
                  codigo="21"
                />

                <Renglones
                  items={
                    bg.pasivosCorrientes
                  }
                />

                <TotalRow
                  label="Total pasivo corriente"
                  valor={
                    bg.totalPasivoCorriente
                  }
                  fuerte
                />
              </section>

              {/* PASIVO NO CORRIENTE */}

              <section className="mt-6">
                <Subtitulo
                  titulo="Pasivo no corriente"
                  codigo="22"
                />

                <Renglones
                  items={
                    bg.pasivosNoCorrientes
                  }
                />

                <TotalRow
                  label="Total pasivo no corriente"
                  valor={
                    bg.totalPasivoNoCorriente
                  }
                  fuerte
                />
              </section>

              <TotalRow
                label="TOTAL PASIVO"
                valor={
                  bg.totalPasivo
                }
                fuerte
                destacado
              />
            </div>

            {/* CAPITAL */}

            <div className="border-t border-border pt-6">
              <h2 className="mb-4 text-base font-bold">
                CAPITAL CONTABLE
              </h2>

              <Subtitulo
                titulo="Capital social y contable"
                codigo="3"
              />

              <Renglones
                items={bg.capital}
              />

              <div className="flex items-center justify-between gap-4 px-1 py-2 text-sm">
                <span className="text-muted-foreground">
                  Utilidad del ejercicio
                </span>

                <span className="tabular-nums">
                  {formatoMoneda(
                    bg.utilidadEjercicio
                  )}
                </span>
              </div>

              <TotalRow
                label="Total capital contable"
                valor={
                  bg.totalCapitalContable
                }
                fuerte
              />
            </div>

            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="font-bold">
                  TOTAL PASIVO + CAPITAL
                </span>

                <span className="text-lg font-bold tabular-nums">
                  {formatoMoneda(
                    bg.totalPasivoMasCapital
                  )}
                </span>
              </div>
            </div>
          </div>
        </CardContent>

        {/* ================================================== */}
        {/* COMPROBACIÓN */}
        {/* ================================================== */}

        <CardContent className="pt-2">
          <div
            className={`flex items-center gap-3 rounded-lg border p-4 text-sm ${
              bg.cuadra
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-red-500/30 bg-red-500/10"
            }`}
          >
            {bg.cuadra ? (
              <CircleCheck className="size-5 shrink-0 text-emerald-600" />
            ) : (
              <TriangleAlert className="size-5 shrink-0 text-red-600" />
            )}

            <span className="font-medium">
              {bg.cuadra
                ? `Balance cuadrado: ${formatoMoneda(
                    bg.totalActivo
                  )} = ${formatoMoneda(
                    bg.totalPasivoMasCapital
                  )}`
                : `El balance no cuadra: Activo ${formatoMoneda(
                    bg.totalActivo
                  )} ≠ Pasivo + Capital ${formatoMoneda(
                    bg.totalPasivoMasCapital
                  )}`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ==================================================== */}
      {/* PIE DEL REPORTE */}
      {/* ==================================================== */}

      <footer className="hidden border-t border-border pt-8 text-center text-xs text-muted-foreground print:block">
        <p>
          Las notas son parte integrante de los estados financieros.
        </p>

        <div className="mt-12 grid grid-cols-3 gap-10">
          <div className="border-t border-foreground/50 pt-2">
            Representante legal
          </div>

          <div className="border-t border-foreground/50 pt-2">
            Contador
          </div>

          <div className="border-t border-foreground/50 pt-2">
            Auditor externo
          </div>
        </div>
      </footer>

      {/* ==================================================== */}
      {/* MODAL CERRAR EJERCICIO */}
      {/* ==================================================== */}

      {mostrarCierre && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm print:hidden"
          onClick={() => {
            if (!cerrando) {
              setMostrarCierre(false)
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-cierre"
            className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
                <TriangleAlert className="size-6 text-amber-500" />
              </div>

              <div>
                <h2
                  id="titulo-cierre"
                  className="text-lg font-semibold"
                >
                  Cerrar ejercicio contable
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Confirma el cierre antes de continuar.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-sm leading-6">
                El sistema cerrará las cuentas de ingresos y gastos y trasladará el resultado del ejercicio a la cuenta de capital correspondiente.
              </p>
            </div>

            <div className="mt-4 rounded-lg border border-border bg-background/50 p-4">
              <p className="text-sm text-muted-foreground">
                Los asientos contables anteriores no serán eliminados. El historial permanecerá registrado para consulta y auditoría.
              </p>
            </div>

            <div className="mt-4 flex items-start gap-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />

              <p className="text-sm text-muted-foreground">
                Verifica que todas las operaciones del ejercicio estén registradas correctamente antes de continuar.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={cerrando}
                onClick={() =>
                  setMostrarCierre(false)
                }
              >
                Cancelar
              </Button>

              <Button
                type="button"
                disabled={cerrando}
                onClick={
                  confirmarCierre
                }
                className="border border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-300"
              >
                <RotateCcw className="size-4" />

                {cerrando
                  ? "Cerrando..."
                  : "Cerrar ejercicio"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}