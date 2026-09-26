"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Calculator,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  ClipboardCheck,
  Edit3,
  FileDown,
  FileSpreadsheet,
  History,
  Layers,
  Lock,
  RotateCcw,
  Save,
  Scale,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  X,
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
import { Input, Label } from "@/components/ui/field"

import { useContabilidad } from "@/components/contabilidad-provider"
import { cn } from "@/lib/utils"

import {
  formatoMoneda,
  type LineaReporte,
} from "@/lib/contabilidad"

import { exportarLibroExcel } from "@/lib/excel"
import { BotonExportarUnificado } from "@/components/contabilidad/BotonExportarUnificado"

// ============================================================
// RENGLONES DE REPORTE
// ============================================================

function Renglones({
  items,
}: {
  items: LineaReporte[]
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
            <span className="mr-2 text-muted-foreground">
              {it.cuenta.codigo}
            </span>

            {it.cuenta.nombre}
          </span>

          <span className="shrink-0 font-mono tabular-nums">
            {formatoMoneda(it.monto)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// FILA TOTAL
// ============================================================

function TotalRow({
  label,
  valor,
  fuerte,
}: {
  label: string
  valor: number
  fuerte?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 border-t border-border px-1 pt-2 text-sm ${
        fuerte
          ? "font-bold"
          : "font-semibold"
      }`}
    >
      <span>{label}</span>

      <span className="font-mono tabular-nums">
        {formatoMoneda(valor)}
      </span>
    </div>
  )
}

// ============================================================
// SECCIÓN GENERAL
// ============================================================

function ReportSection({
  title,
  code,
  items,
  totalLabel,
  total,
}: {
  title: string
  code: string
  items: LineaReporte[]
  totalLabel: string
  total: number
}) {
  return (
    <div>
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        {title}

        <Badge variant="muted">
          Código {code}
        </Badge>
      </h3>

      <Renglones items={items} />

      <TotalRow
        label={totalLabel}
        valor={total}
      />
    </div>
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
    generarPartidaApertura,

    asientos,
    cierres,

    tomaFisica,
    guardarTomaFisica,

    esEjercicioCerrado,
    ejercicioSeleccionado,
    dbConnected,
  } = useContabilidad()

  const [
    modoVista,
    setModoVista,
  ] = useState<
    "analitico" |
    "general"
  >("analitico")

  const [
    tabEstado,
    setTabEstado,
  ] = useState<
    "resultados" |
    "balance" |
    "cierre"
  >("resultados")

  const [erExpandido, setErExpandido] = useState(false)
  const [bgExpandido, setBgExpandido] = useState(false)

  // ============================================================
  // TOMA FÍSICA
  // ============================================================

  const [
    modalTomaAbierto,
    setModalTomaAbierto,
  ] = useState(false)

  const [
    valorToma,
    setValorToma,
  ] = useState<string>(
    (
      tomaFisica
        ?.valor_inventario_final ??
      er.analitico
        .valorInventarioFinal
    ).toString()
  )

  const [
    fechaToma,
    setFechaToma,
  ] = useState<string>(
    tomaFisica
      ?.fecha_toma ||
      `${ejercicioSeleccionado}-12-31`
  )

  const [
    responsableToma,
    setResponsableToma,
  ] = useState<string>(
    tomaFisica
      ?.responsable ||
      "Comité de Auditoría y Control de Inventarios"
  )

  const [
    observacionesToma,
    setObservacionesToma,
  ] = useState<string>(
    tomaFisica
      ?.observaciones ||
      "Toma física de existencias y conteo al cierre del ejercicio"
  )

  const [
    guardandoToma,
    setGuardandoToma,
  ] = useState(false)

  const [
    mensajeExitoToma,
    setMensajeExitoToma,
  ] = useState(false)

  // ============================================================
  // PDF
  // ============================================================

  function exportarPdf() {
    const previousTitle =
      document.title

    document.title =
      `Reporte de Estados Financieros - Ejercicio ${ejercicioSeleccionado}`

    window.print()

    window.setTimeout(
      () => {
        document.title =
          previousTitle
      },
      500
    )
  }

  // ============================================================
  // EXCEL
  // ============================================================

  function exportarExcel() {
    const filasER: (
      | string
      | number
      | null
      | undefined
    )[][] = [
      [
        "ESTADO DE RESULTADOS - MÉTODO ANALÍTICO O PORMENORIZADO",
      ],
      [
        "Expresado en dólares de los Estados Unidos de América (USD)",
      ],
      [
        `Ejercicio fiscal: ${ejercicioSeleccionado}`,
      ],
      [
        `Origen de datos: ${
          er.calculadoPorSql
            ? "Motor Central Validado"
            : "Motor Local (Modo Offline)"
        }`,
      ],
      [
        `Fecha de emisión: ${new Date().toLocaleDateString(
          "es-SV"
        )}`,
      ],
      [],
      [
        "1. DETERMINACIÓN DE VENTAS NETAS",
        "",
      ],
      [
        "Ventas totales (5101)",
        er.analitico
          .ventasTotales,
      ],
      [
        "(-) Menos: Devoluciones sobre ventas (4103)",
        er.analitico
          .devolucionesSobreVentas,
      ],
      [
        "(-) Menos: Rebajas y descuentos sobre ventas (4104)",
        er.analitico
          .rebajasSobreVentas,
      ],
      [
        "(=) VENTAS NETAS",
        er.analitico
          .ventasNetas,
      ],
      [],
      [
        "2. DETERMINACIÓN DE COMPRAS NETAS Y TOTAL DE MERCANCÍAS",
        "",
      ],
      [
        "Compras (4101)",
        er.analitico.compras,
      ],
      [
        "(+) Más: Gastos sobre compras (4102)",
        er.analitico
          .gastosSobreCompras,
      ],
      [
        "(=) Compras Totales",
        er.analitico
          .comprasTotales,
      ],
      [
        "(-) Menos: Devoluciones sobre compras (5102)",
        er.analitico
          .devolucionesSobreCompras,
      ],
      [
        "(-) Menos: Rebajas y descuentos sobre compras (5103)",
        er.analitico
          .rebajasSobreCompras,
      ],
      [
        "(=) COMPRAS NETAS",
        er.analitico
          .comprasNetas,
      ],
      [
        "(+) Más: Inventario Inicial de Mercaderías (1104)",
        er.analitico
          .inventarioInicial,
      ],
      [
        "(=) TOTAL DE MERCANCÍAS DISPONIBLES",
        er.analitico
          .totalMercancias,
      ],
      [
        `(-) Menos: Inventario Final de Mercaderías (Toma física al ${
          er.analitico
            .fechaInventarioFinal ||
          "cierre"
        })`,
        er.analitico
          .valorInventarioFinal,
      ],
      [
        `Responsable de toma física: ${
          er.analitico
            .responsableInventarioFinal ||
          "N/A"
        }`,
      ],
      [
        "(=) COSTO DE LO VENDIDO (Costo de Ventas)",
        er.analitico
          .costoVentas,
      ],
      [],
      [
        "3. UTILIDAD BRUTA",
        "",
      ],
      [
        "(=) UTILIDAD BRUTA (Ventas Netas - Costo de Ventas)",
        er.analitico
          .utilidadBruta,
      ],
      [],
      [
        "4. GASTOS DE OPERACIÓN",
        "",
      ],
    ]

    for (
      const gasto
      of er.gastosOperacion
    ) {
      filasER.push([
        `${gasto.cuenta.codigo} - ${gasto.cuenta.nombre}`,
        gasto.monto,
      ])
    }

    filasER.push([
      "(=) TOTAL GASTOS DE OPERACIÓN",
      er.totalGastosOperacion,
    ])

    filasER.push([
      "(=) UTILIDAD DE OPERACIÓN",
      er.analitico
        .utilidadOperacion,
    ])

    filasER.push([])

    if (
      er.totalIngresosFinancieros >
        0 ||
      er.totalGastosFinancieros >
        0 ||
      er.analitico
        .otrosIngresos >
        0
    ) {
      filasER.push([
        "5. PRODUCTOS Y GASTOS FINANCIEROS / OTROS",
        "",
      ])

      if (
        er.analitico
          .otrosIngresos >
        0
      ) {
        filasER.push([
          "(+) Otros ingresos operativos (5104)",
          er.analitico
            .otrosIngresos,
        ])
      }

      if (
        er.totalIngresosFinancieros >
        0
      ) {
        filasER.push([
          "(+) Productos financieros (52)",
          er.totalIngresosFinancieros,
        ])
      }

      if (
        er.totalGastosFinancieros >
        0
      ) {
        filasER.push([
          "(-) Gastos financieros (43)",
          er.totalGastosFinancieros,
        ])
      }

      filasER.push([])
    }

    filasER.push([
      "RESULTADO FINAL",
      "",
    ])

    filasER.push([
      er.utilidad >= 0
        ? "UTILIDAD NETA DEL EJERCICIO"
        : "PÉRDIDA NETA DEL EJERCICIO",

      er.utilidad,
    ])

    const filasBG: (
      | string
      | number
      | null
      | undefined
    )[][] = [
      [
        "BALANCE GENERAL",
      ],
      [
        "Ecuación Contable: Activo = Pasivo + Capital Contable",
      ],
      [
        `Ejercicio fiscal: ${ejercicioSeleccionado}`,
      ],
      [
        `Fecha de corte: ${new Date().toLocaleDateString(
          "es-SV"
        )}`,
      ],
      [],
      [
        "ACTIVO (Código 1)",
        "",
      ],
    ]

    for (
      const activo
      of bg.activos
    ) {
      filasBG.push([
        `${activo.cuenta.codigo} - ${activo.cuenta.nombre}`,
        activo.monto,
      ])
    }

    filasBG.push([
      "TOTAL ACTIVO",
      bg.totalActivo,
    ])

    filasBG.push([])

    filasBG.push([
      "PASIVO (Código 2)",
      "",
    ])

    for (
      const pasivo
      of bg.pasivos
    ) {
      filasBG.push([
        `${pasivo.cuenta.codigo} - ${pasivo.cuenta.nombre}`,
        pasivo.monto,
      ])
    }

    filasBG.push([
      "TOTAL PASIVO",
      bg.totalPasivo,
    ])

    filasBG.push([])

    filasBG.push([
      "CAPITAL CONTABLE (Código 3)",
      "",
    ])

    for (
      const capital
      of bg.capital
    ) {
      filasBG.push([
        `${capital.cuenta.codigo} - ${capital.cuenta.nombre}`,
        capital.monto,
      ])
    }

    filasBG.push([
      "Utilidad neta del ejercicio",
      bg.utilidadEjercicio,
    ])

    filasBG.push([
      "TOTAL CAPITAL CONTABLE",
      bg.totalCapitalContable,
    ])

    filasBG.push([])

    filasBG.push([
      "TOTAL PASIVO + CAPITAL",
      bg.totalPasivoMasCapital,
    ])

    filasBG.push([
      "ESTADO DE CUADRE",
      bg.cuadra
        ? "CUADRADO AL CENTAVO"
        : "DESCUADRADO",
    ])

    exportarLibroExcel(
      `Estados_Financieros_Ejercicio_${ejercicioSeleccionado}`,
      [
        {
          nombre:
            "Estado de Resultados",
          filas:
            filasER,
        },
        {
          nombre:
            "Balance General",
          filas:
            filasBG,
        },
      ]
    )
  }

  // ============================================================
  // CIERRE
  // ============================================================

  const [
    modalCierreAbierto,
    setModalCierreAbierto,
  ] = useState(false)

  const [
    cierreConfirmadoCheckbox,
    setCierreConfirmadoCheckbox,
  ] = useState(false)

  const [
    aperturarSiguienteCheckbox,
    setAperturarSiguienteCheckbox,
  ] = useState(true)

  const [
    ejecutandoCierre,
    setEjecutandoCierre,
  ] = useState(false)

  const [
    aperturandoSiguiente,
    setAperturandoSiguiente,
  ] = useState(false)

  function abrirModalCierre() {
    if (
      esEjercicioCerrado
    ) {
      alert(
        "Este ejercicio fiscal ya se encuentra cerrado o bloqueado."
      )

      return
    }

    setCierreConfirmadoCheckbox(
      false
    )

    setAperturarSiguienteCheckbox(
      true
    )

    setModalCierreAbierto(
      true
    )
  }

  async function ejecutarCierreSeguro() {
    setEjecutandoCierre(
      true
    )

    try {
      await cerrarCicloContable({
        aperturarSiguiente:
          aperturarSiguienteCheckbox,
      })

      setModalCierreAbierto(
        false
      )
    } finally {
      setEjecutandoCierre(
        false
      )
    }
  }

  // ============================================================
  // GUARDAR TOMA FÍSICA
  // ============================================================

  async function guardarTomaFormulario(
    event: React.FormEvent
  ) {
    event.preventDefault()

    setGuardandoToma(
      true
    )

    const exito =
      await guardarTomaFisica({
        ejercicio:
          ejercicioSeleccionado,

        fecha_toma:
          fechaToma,

        valor_inventario_final:
          Number.parseFloat(
            valorToma
          ) || 0,

        responsable:
          responsableToma,

        observaciones:
          observacionesToma,
      })

    setGuardandoToma(
      false
    )

    if (exito) {
      setMensajeExitoToma(
        true
      )

      setTimeout(
        () => {
          setMensajeExitoToma(
            false
          )

          setModalTomaAbierto(
            false
          )
        },
        1000
      )
    }
  }

  return (
    <div className="space-y-8 report-page">
      {/* ====================================================== */}
      {/* ENCABEZADO Y ACCIONES (POSICIONES EXACTAS DEL MOCKUP) */}
      {/* ====================================================== */}
      <header className="space-y-3.5 print:hidden">
        {/* Fila 1: Título con badge de ciclo a la izquierda | Botones de acción a la derecha */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Estados financieros
            </h1>
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-muted text-foreground border border-border/80 shadow-2xs">
              Ciclo Fiscal {ejercicioSeleccionado}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <BotonExportarUnificado
              onExportarPdf={exportarPdf}
              textoPdf="Descargar PDF"
              descPdf="Estados financieros oficiales"
              onExportarExcel={exportarExcel}
              textoExcel="Exportar Excel"
              descExcel="Balance y Resultados (.xlsx)"
              onImprimir={() => window.print()}
              textoImprimir="Imprimir Estados"
              descImprimir="Vista oficial de imprenta"
            />

            <Link
              href="/ciclos"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border/80 bg-card hover:bg-muted text-xs font-medium text-foreground shadow-2xs transition-colors"
            >
              <History className="size-3.5 text-primary" />
              <span>Historial de Ciclos</span>
            </Link>
          </div>
        </div>

        {/* Fila 2: Tarjeta compacta de Toma Física a la izquierda con botón de actualizar a su lado */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border/80 bg-card px-3.5 py-2 shadow-2xs text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">
                Toma Física Oficial de Inventario:
              </span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {formatoMoneda(er.analitico.valorInventarioFinal)}
              </span>
              {dbConnected && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  Sincronizado en Libros
                </span>
              )}
            </div>

            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <span>
                Fecha de Conteo:{" "}
                <strong className="text-foreground/80 font-mono">
                  {er.analitico.fechaInventarioFinal || `${ejercicioSeleccionado}-12-31`}
                </strong>
              </span>
              <span>·</span>
              <span>
                Responsable:{" "}
                <strong className="text-foreground/80">
                  {er.analitico.responsableInventarioFinal || "Control de Almacén y Auditoría"}
                </strong>
              </span>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setValorToma(
                (
                  tomaFisica?.valor_inventario_final ??
                  er.analitico.valorInventarioFinal
                ).toString()
              )
              setFechaToma(
                tomaFisica?.fecha_toma ||
                `${ejercicioSeleccionado}-12-31`
              )
              setResponsableToma(
                tomaFisica?.responsable ||
                "Control de Almacén y Auditoría"
              )
              setObservacionesToma(
                tomaFisica?.observaciones ||
                ""
              )
              setModalTomaAbierto(true)
            }}
            disabled={esEjercicioCerrado}
            className="h-8 rounded-xl border-border/80 bg-card hover:bg-muted font-medium text-xs shadow-2xs gap-1.5 text-foreground cursor-pointer"
          >
            <Edit3 className="size-3.5 text-muted-foreground" />
            <span>Actualizar Toma Física</span>
          </Button>
        </div>
      </header>

      {/* ENCABEZADO EXCLUSIVO PARA IMPRESIÓN OFICIAL */}
      <div className="hidden print:block mb-4 border-b border-border pb-3">
        <h1 className="text-xl font-bold uppercase tracking-tight text-foreground">
          Reporte Oficial de Estados Financieros
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ciclo Fiscal: {ejercicioSeleccionado} · Expresado en USD · Fecha de emisión: {new Date().toLocaleDateString("es-SV")}
        </p>
      </div>

      {/* ====================================================== */}
      {/* MODAL TOMA FÍSICA */}
      {/* ====================================================== */}

      {modalTomaAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="size-5 text-primary" />

                <h3 className="text-base font-semibold text-foreground">
                  Registrar Toma
                  Física de
                  Inventario Final
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setModalTomaAbierto(
                    false
                  )
                }
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <form
              onSubmit={
                guardarTomaFormulario
              }
              className="space-y-4 text-sm"
            >
              <p className="text-xs text-muted-foreground">
                El Inventario
                Final valorado
                determina
                directamente el
                Costo de Ventas y
                la Utilidad Bruta
                del ejercicio{" "}
                {
                  ejercicioSeleccionado
                }
                .
              </p>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="valor_inventario">
                    Valor del
                    Inventario
                    Final ($ USD):
                  </Label>

                  <button
                    type="button"
                    onClick={
                      async () => {
                        try {
                          const response =
                            await fetch(
                              `/api/kardex?ejercicio=${ejercicioSeleccionado}`
                            )

                          if (
                            response.ok
                          ) {
                            const data =
                              await response.json()

                            if (
                              data.totalInventarioValorado !==
                                undefined &&
                              data.totalInventarioValorado >
                                0
                            ) {
                              setValorToma(
                                Number(
                                  data.totalInventarioValorado
                                ).toFixed(
                                  2
                                )
                              )

                              setObservacionesToma(
                                `Conteo conciliado con saldo de Kardex CPP ($${Number(
                                  data.totalInventarioValorado
                                ).toFixed(
                                  2
                                )})`
                              )
                            }
                          }
                        } catch (
                          error
                        ) {
                          console.error(
                            error
                          )
                        }
                      }
                    }
                    className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    <Layers className="size-3" />

                    Cargar saldo
                    actual de
                    Kardex
                  </button>
                </div>

                <Input
                  id="valor_inventario"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={
                    valorToma
                  }
                  onChange={(
                    event
                  ) =>
                    setValorToma(
                      event
                        .target
                        .value
                    )
                  }
                  className="font-mono text-base font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fecha_toma">
                    Fecha de
                    Conteo Físico:
                  </Label>

                  <Input
                    id="fecha_toma"
                    type="date"
                    required
                    value={
                      fechaToma
                    }
                    onChange={(
                      event
                    ) =>
                      setFechaToma(
                        event
                          .target
                          .value
                      )
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="responsable_toma">
                    Auditor /
                    Responsable:
                  </Label>

                  <Input
                    id="responsable_toma"
                    type="text"
                    required
                    value={
                      responsableToma
                    }
                    onChange={(
                      event
                    ) =>
                      setResponsableToma(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="Ej. Comité de Inventarios"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="obs_toma">
                  Observaciones de
                  Auditoría:
                </Label>

                <Input
                  id="obs_toma"
                  type="text"
                  value={
                    observacionesToma
                  }
                  onChange={(
                    event
                  ) =>
                    setObservacionesToma(
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="Observaciones de conteo físico..."
                />
              </div>

              {mensajeExitoToma && (
                <div className="flex items-center gap-2 rounded bg-emerald-50 p-2 text-xs font-semibold text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" />

                  Toma física
                  guardada y
                  sincronizada
                  correctamente
                  en los registros
                  contables.
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-border pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setModalTomaAbierto(
                      false
                    )
                  }
                  disabled={
                    guardandoToma
                  }
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  disabled={
                    guardandoToma
                  }
                >
                  <Save className="mr-1.5 size-4" />

                  {guardandoToma
                    ? "Guardando..."
                    : "Guardar en Base de Datos"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================== */}
      {/* SECCIÓN PRINCIPAL: ESTADOS                             */}
      {/* ====================================================== */}
      <section className="space-y-4">
        {/* NAVEGACIÓN ENTRE ESTADOS (SEGMENTED CONTROL MINIMALISTA) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3 print:hidden">
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/60">
            <button
              type="button"
              onClick={() => setTabEstado("resultados")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                tabEstado === "resultados"
                  ? "bg-card text-foreground shadow-2xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <Calculator className="size-3.5 text-primary" />
              <span>Estado de Resultados</span>
            </button>

            <button
              type="button"
              onClick={() => setTabEstado("balance")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                tabEstado === "balance"
                  ? "bg-card text-foreground shadow-2xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <Scale className="size-3.5 text-primary" />
              <span>Balance General</span>
            </button>

            <button
              type="button"
              onClick={() => setTabEstado("cierre")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                tabEstado === "cierre"
                  ? "bg-card text-foreground shadow-2xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <Lock className="size-3.5 text-primary" />
              <span>Cierre y Liquidación</span>
            </button>
          </div>
        </div>

        {/* ====================================================== */}
        {/* ESTADO DE RESULTADOS                                   */}
        {/* ====================================================== */}
        <div className={cn(
          tabEstado === "resultados" ? "block" : "hidden print:block"
        )}>
          <Card className="report-card">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold">
                    Estado de Resultados
                  </CardTitle>
                </div>

                <div className="flex flex-wrap items-center gap-2 print:hidden">
                  {erExpandido && (
                    <div className="flex items-center gap-1 p-0.5 rounded-xl bg-muted/60 border border-border/60 text-xs">
                      <button
                        type="button"
                        onClick={() => setModoVista("analitico")}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5",
                          modoVista === "analitico"
                            ? "bg-card text-foreground shadow-2xs border border-border/80"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Calculator className="size-3 text-primary" />
                        <span>Analítico</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setModoVista("general")}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5",
                          modoVista === "general"
                            ? "bg-card text-foreground shadow-2xs border border-border/80"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Layers className="size-3 text-primary" />
                        <span>Ver por Cuentas</span>
                      </button>
                    </div>
                  )}

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setErExpandido((prev) => !prev)}
                    className="h-8 px-3 rounded-xl border-border/80 bg-card hover:bg-muted font-semibold text-xs shadow-2xs gap-1.5 cursor-pointer shrink-0"
                  >
                    {erExpandido ? (
                      <>
                        <ChevronUp className="size-3.5 text-primary" />
                        <span>Contraer a resumen</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="size-3.5 text-primary" />
                        <span>Expandir detalle completo</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-5">
          {/* ========================================================= */}
          {/* RESUMEN EJECUTIVO (INFORMACIÓN CLAVE DE ACCESO RÁPIDO)    */}
          {/* ========================================================= */}
          <div className="space-y-3.5">
            {/* Fila principal: Resultado Neto */}
            <div
              className={cn(
                "flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border",
                er.utilidad >= 0
                  ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                  : "border-red-500/30 bg-red-500/[0.04]"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "size-10 rounded-xl flex items-center justify-center shrink-0",
                    er.utilidad >= 0
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/10 text-red-600 dark:text-red-400"
                  )}
                >
                  {er.utilidad >= 0 ? (
                    <TrendingUp className="size-5" />
                  ) : (
                    <TrendingDown className="size-5" />
                  )}
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                    Resultado Neto del Ejercicio
                  </span>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span
                      className={cn(
                        "font-mono text-2xl sm:text-3xl font-extrabold tabular-nums",
                        er.utilidad >= 0
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-red-700 dark:text-red-300"
                      )}
                    >
                      {formatoMoneda(er.utilidad)}
                    </span>
                    <Badge
                      variant={er.utilidad >= 0 ? "success" : "destructive"}
                      className="text-xs px-2 py-0.5 font-semibold"
                    >
                      {er.utilidad >= 0 ? "Utilidad Neta" : "Pérdida Neta"}
                    </Badge>
                  </div>
                </div>
              </div>

              {er.analitico.ventasNetas > 0 && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="text-right">
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground/70">
                      Margen Bruto
                    </span>
                    <span className="font-mono font-bold text-foreground text-sm">
                      {(
                        (er.analitico.utilidadBruta /
                          er.analitico.ventasNetas) *
                        100
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                  <div className="h-8 w-px bg-border/80" />
                  <div className="text-right">
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground/70">
                      Margen Neto
                    </span>
                    <span
                      className={cn(
                        "font-mono font-bold text-sm",
                        er.utilidad >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      )}
                    >
                      {(
                        (er.utilidad / er.analitico.ventasNetas) *
                        100
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Cuadrícula de 4 cifras clave */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                  1. Ventas Netas
                </span>
                <div className="font-mono text-base sm:text-lg font-bold text-foreground tabular-nums mt-1">
                  {formatoMoneda(er.analitico.ventasNetas)}
                </div>
                <span className="text-[11px] text-muted-foreground/80 mt-0.5 block truncate">
                  Ventas Brutas: {formatoMoneda(er.analitico.ventasTotales)}
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                  2. Costo de Ventas
                </span>
                <div className="font-mono text-base sm:text-lg font-bold text-foreground tabular-nums mt-1">
                  {formatoMoneda(er.analitico.costoVentas)}
                </div>
                <span className="text-[11px] text-muted-foreground/80 mt-0.5 block truncate">
                  Inv. Final: {formatoMoneda(er.analitico.valorInventarioFinal)}
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                  3. Utilidad Bruta
                </span>
                <div className="font-mono text-base sm:text-lg font-bold text-foreground tabular-nums mt-1">
                  {formatoMoneda(er.analitico.utilidadBruta)}
                </div>
                <span className="text-[11px] text-muted-foreground/80 mt-0.5 block truncate">
                  Ventas Netas - Costo
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                  4. Gastos de Operación
                </span>
                <div className="font-mono text-base sm:text-lg font-bold text-foreground tabular-nums mt-1">
                  {formatoMoneda(er.totalGastosOperacion)}
                </div>
                <span className="text-[11px] text-muted-foreground/80 mt-0.5 block truncate">
                  {er.gastosOperacion.length}{" "}
                  {er.gastosOperacion.length === 1 ? "cuenta" : "cuentas"} operativas
                </span>
              </div>
            </div>

          </div>

          {/* ========================================================= */}
          {/* DETALLE COMPLETO (EXPANDIDO O AL IMPRIMIR)                */}
          {/* ========================================================= */}
          <div className={cn(erExpandido ? "block space-y-4 pt-2" : "hidden print:block", "print:pt-0")}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4 print:hidden">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Modo de Vista:
                </span>
                <div className="flex items-center gap-1 p-0.5 rounded-xl bg-muted/60 border border-border/60 text-xs">
                  <button
                    type="button"
                    onClick={() => setModoVista("analitico")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5",
                      modoVista === "analitico"
                        ? "bg-card text-foreground shadow-2xs border border-border/80"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Calculator className="size-3 text-primary" />
                    <span>Analítico</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoVista("general")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5",
                      modoVista === "general"
                        ? "bg-card text-foreground shadow-2xs border border-border/80"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Layers className="size-3 text-primary" />
                    <span>Ver por Cuentas</span>
                  </button>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setErExpandido(false)}
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <ChevronUp className="size-3.5" />
                <span>Ocultar desglose</span>
              </Button>
            </div>

          {modoVista ===
          "analitico" ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border/60">

                  <tr className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <td
                      colSpan={2}
                      className="px-3 py-2.5"
                    >
                      1.
                      Determinación
                      de Ventas
                      Netas
                    </td>
                  </tr>

                  <tr>
                    <td className="px-3 py-2">
                      Ventas
                      totales{" "}
                      <span className="text-xs text-muted-foreground">
                        (5101)
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right font-mono">
                      {formatoMoneda(
                        er
                          .analitico
                          .ventasTotales
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td className="px-3 py-2 pl-6 text-muted-foreground">
                      (-) Menos:
                      Devoluciones
                      sobre ventas{" "}

                      <span className="text-xs text-muted-foreground/80">
                        (4103)
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                      {formatoMoneda(
                        er
                          .analitico
                          .devolucionesSobreVentas
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td className="px-3 py-2 pl-6 text-muted-foreground">
                      (-) Menos:
                      Rebajas y
                      descuentos
                      sobre ventas{" "}

                      <span className="text-xs text-muted-foreground/80">
                        (4104)
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                      {formatoMoneda(
                        er
                          .analitico
                          .rebajasSobreVentas
                      )}
                    </td>
                  </tr>

                  <tr className="bg-muted/20 font-semibold">
                    <td className="px-3 py-2.5">
                      (=) Ventas
                      Netas
                    </td>

                    <td className="px-3 py-2.5 text-right font-mono font-semibold">
                      {formatoMoneda(
                        er
                          .analitico
                          .ventasNetas
                      )}
                    </td>
                  </tr>

                  <tr className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <td
                      colSpan={2}
                      className="px-3 py-2.5"
                    >
                      2.
                      Determinación
                      de Compras
                      Netas y
                      Mercancías
                    </td>
                  </tr>

                  <tr>
                    <td className="px-3 py-2">
                      Compras{" "}

                      <span className="text-xs text-muted-foreground">
                        (4101)
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right font-mono">
                      {formatoMoneda(
                        er
                          .analitico
                          .compras
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td className="px-3 py-2 pl-6 text-muted-foreground">
                      (+) Más:
                      Gastos sobre
                      compras{" "}

                      <span className="text-xs text-muted-foreground/80">
                        (4102)
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                      {formatoMoneda(
                        er
                          .analitico
                          .gastosSobreCompras
                      )}
                    </td>
                  </tr>

                  <tr className="text-muted-foreground">
                    <td className="px-3 py-2 font-medium">
                      (=) Compras
                      Totales
                    </td>

                    <td className="px-3 py-2 text-right font-mono font-medium">
                      {formatoMoneda(
                        er
                          .analitico
                          .comprasTotales
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td className="px-3 py-2 pl-6 text-muted-foreground">
                      (-) Menos:
                      Devoluciones
                      sobre compras{" "}

                      <span className="text-xs text-muted-foreground/80">
                        (5102)
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                      {formatoMoneda(
                        er
                          .analitico
                          .devolucionesSobreCompras
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td className="px-3 py-2 pl-6 text-muted-foreground">
                      (-) Menos:
                      Rebajas y
                      descuentos
                      sobre compras{" "}

                      <span className="text-xs text-muted-foreground/80">
                        (5103)
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                      {formatoMoneda(
                        er
                          .analitico
                          .rebajasSobreCompras
                      )}
                    </td>
                  </tr>

                  <tr className="bg-muted/20 font-semibold">
                    <td className="px-3 py-2.5">
                      (=) Compras
                      Netas
                    </td>

                    <td className="px-3 py-2.5 text-right font-mono font-semibold">
                      {formatoMoneda(
                        er
                          .analitico
                          .comprasNetas
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td className="px-3 py-2">
                      (+)
                      Inventario
                      Inicial de
                      Mercaderías{" "}

                      <span className="text-xs text-muted-foreground">
                        (1104)
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right font-mono">
                      {formatoMoneda(
                        er
                          .analitico
                          .inventarioInicial
                      )}
                    </td>
                  </tr>

                  <tr className="font-semibold">
                    <td className="px-3 py-2.5">
                      (=) Total de
                      Mercancías
                      Disponibles
                    </td>

                    <td className="px-3 py-2.5 text-right font-mono font-semibold">
                      {formatoMoneda(
                        er
                          .analitico
                          .totalMercancias
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td className="px-3 py-2 pl-6 text-muted-foreground">
                      (-) Menos:
                      Inventario
                      Final de
                      Mercaderías{" "}

                      {er
                        .analitico
                        .fechaInventarioFinal && (
                        <span className="text-xs font-normal text-muted-foreground/80">
                          (Toma
                          física al{" "}
                          {
                            er
                              .analitico
                              .fechaInventarioFinal
                          }
                          )
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2 text-right font-mono font-medium text-emerald-700 dark:text-emerald-400">
                      {formatoMoneda(
                        er
                          .analitico
                          .valorInventarioFinal
                      )}
                    </td>
                  </tr>

                  <tr className="bg-muted/20 font-semibold">
                    <td className="px-3 py-2.5">
                      (=) Costo de
                      lo Vendido
                      (Costo de
                      Ventas)
                    </td>

                    <td className="px-3 py-2.5 text-right font-mono font-semibold">
                      {formatoMoneda(
                        er
                          .analitico
                          .costoVentas
                      )}
                    </td>
                  </tr>

                  <tr className="border-y-2 border-primary/20 bg-primary/5 font-bold">
                    <td className="px-3 py-3 text-primary">
                      (=) Utilidad
                      Bruta (Ventas
                      Netas - Costo
                      de Ventas)
                    </td>

                    <td className="px-3 py-3 text-right font-mono font-bold text-primary">
                      {formatoMoneda(
                        er
                          .analitico
                          .utilidadBruta
                      )}
                    </td>
                  </tr>

                  <tr className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <td
                      colSpan={2}
                      className="px-3 py-2.5"
                    >
                      4. Gastos de
                      Operación
                    </td>
                  </tr>

                  {er.gastosOperacion.map(
                    (gasto) => (
                      <tr
                        key={
                          gasto
                            .cuenta
                            .codigo
                        }
                      >
                        <td className="px-3 py-2 pl-6 text-muted-foreground">
                          {
                            gasto
                              .cuenta
                              .nombre
                          }{" "}

                          <span className="text-xs">
                            (
                            {
                              gasto
                                .cuenta
                                .codigo
                            }
                            )
                          </span>
                        </td>

                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                          {formatoMoneda(
                            gasto.monto
                          )}
                        </td>
                      </tr>
                    )
                  )}

                  {er
                    .gastosOperacion
                    .length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={
                          2
                        }
                        className="px-3 py-2 pl-6 text-xs italic text-muted-foreground"
                      >
                        Sin gastos
                        operativos
                        registrados.
                      </td>
                    </tr>
                  )}

                  <tr className="bg-muted/20 font-semibold">
                    <td className="px-3 py-2.5">
                      (=) Total
                      Gastos de
                      Operación
                    </td>

                    <td className="px-3 py-2.5 text-right font-mono font-semibold">
                      {formatoMoneda(
                        er.totalGastosOperacion
                      )}
                    </td>
                  </tr>

                  <tr className="font-semibold">
                    <td className="px-3 py-2.5">
                      (=) Utilidad
                      de Operación
                    </td>

                    <td className="px-3 py-2.5 text-right font-mono font-semibold">
                      {formatoMoneda(
                        er
                          .analitico
                          .utilidadOperacion
                      )}
                    </td>
                  </tr>

                  {(er.totalIngresosFinancieros >
                    0 ||
                    er.totalGastosFinancieros >
                      0 ||
                    er
                      .analitico
                      .otrosIngresos >
                      0) && (
                    <>
                      <tr className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <td
                          colSpan={
                            2
                          }
                          className="px-3 py-2.5"
                        >
                          5.
                          Productos y
                          Gastos
                          Financieros
                          / Otros
                        </td>
                      </tr>

                      {er
                        .analitico
                        .otrosIngresos >
                        0 && (
                        <tr>
                          <td className="px-3 py-2 pl-6 text-muted-foreground">
                            (+) Otros
                            ingresos
                            operativos
                            (5104)
                          </td>

                          <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                            {formatoMoneda(
                              er
                                .analitico
                                .otrosIngresos
                            )}
                          </td>
                        </tr>
                      )}

                      {er.totalIngresosFinancieros >
                        0 && (
                        <tr>
                          <td className="px-3 py-2 pl-6 text-muted-foreground">
                            (+)
                            Productos
                            financieros
                            (52)
                          </td>

                          <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                            {formatoMoneda(
                              er.totalIngresosFinancieros
                            )}
                          </td>
                        </tr>
                      )}

                      {er.totalGastosFinancieros >
                        0 && (
                        <tr>
                          <td className="px-3 py-2 pl-6 text-muted-foreground">
                            (-) Gastos
                            financieros
                            (43)
                          </td>

                          <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                            {formatoMoneda(
                              er.totalGastosFinancieros
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  )}

                  <tr
                    className={`border-t-2 text-base font-bold ${
                      er.utilidad >=
                      0
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                        : "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300"
                    }`}
                  >
                    <td className="px-3 py-3">
                      {er.utilidad >=
                      0
                        ? "(=) Utilidad Neta del Ejercicio"
                        : "(=) Pérdida Neta del Ejercicio"}
                    </td>

                    <td className="px-3 py-3 text-right font-mono text-lg font-bold">
                      {formatoMoneda(
                        er.utilidad
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <ReportSection
                title="Ingresos"
                code="5"
                items={
                  er.ingresos
                }
                totalLabel="Total ingresos"
                total={
                  er.totalIngresos
                }
              />

              <ReportSection
                title="Costos y gastos"
                code="4"
                items={
                  er.gastos
                }
                totalLabel="Total costos y gastos"
                total={
                  er.totalGastos
                }
              />
            </div>
          )}

            {/* Botón inferior para contraer a resumen */}
            <div className="flex justify-end pt-2 print:hidden">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setErExpandido(false)}
                className="h-8 px-3 rounded-xl border-border/80 bg-card hover:bg-muted font-medium text-xs shadow-2xs gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <ChevronUp className="size-3.5" />
                <span>Contraer a resumen</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    {/* ====================================================== */}
    {/* BALANCE GENERAL                                        */}
    {/* ====================================================== */}
    <div className={cn(
      tabEstado === "balance" ? "block" : "hidden print:block"
    )}>
      <Card className="report-card">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold">
                Balance General
              </CardTitle>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBgExpandido(!bgExpandido)}
              className="h-8 px-3 rounded-xl border-border/80 bg-card hover:bg-muted font-medium text-xs shadow-2xs gap-1.5 cursor-pointer print:hidden"
            >
              {bgExpandido ? (
                <>
                  <ChevronUp className="size-3.5 text-muted-foreground" />
                  <span>Contraer a resumen</span>
                </>
              ) : (
                <>
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                  <span>Expandir detalle completo</span>
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ========================================================= */}
          {/* RESUMEN EJECUTIVO / ACCESO RÁPIDO (SIEMPRE VISIBLE)       */}
          {/* ========================================================= */}
          <div className="space-y-4">
            {/* Ecuación Fundamental Centrada y en Grande */}
            <div className="flex items-center justify-center p-4 sm:p-5 rounded-2xl border border-border/80 bg-card shadow-2xs">
              <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 font-mono tabular-nums text-center">
                <div className="flex flex-col items-center">
                  <span className="text-muted-foreground block text-[11px] uppercase font-semibold tracking-wider">
                    Total Activo
                  </span>
                  <span className="font-mono text-2xl sm:text-3xl font-extrabold text-foreground mt-1">
                    {formatoMoneda(bg.totalActivo)}
                  </span>
                </div>

                <span className="text-muted-foreground/80 text-2xl sm:text-3xl font-bold pb-0.5 select-none">
                  =
                </span>

                <div className="flex flex-col items-center">
                  <span className="text-muted-foreground block text-[11px] uppercase font-semibold tracking-wider">
                    Pasivo + Capital
                  </span>
                  <span className="font-mono text-2xl sm:text-3xl font-extrabold text-foreground mt-1">
                    {formatoMoneda(bg.totalPasivoMasCapital)}
                  </span>
                </div>
              </div>
            </div>

            {/* Cuadrícula de 3 pilares patrimoniales + 1 de Capital de Trabajo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Tarjeta 1: Total Activo */}
              <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/[0.03] shadow-2xs">
                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase block">
                  1. Total Activo
                </span>
                <div className="font-mono text-base sm:text-lg font-bold text-foreground tabular-nums mt-1">
                  {formatoMoneda(bg.totalActivo)}
                </div>
                <div className="text-[11px] text-muted-foreground/90 mt-1 space-y-0.5">
                  <div className="flex justify-between">
                    <span>Corriente:</span>
                    <span className="font-mono font-medium">{formatoMoneda(bg.totalActivoCorriente)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>No Corriente:</span>
                    <span className="font-mono font-medium">{formatoMoneda(bg.totalActivoNoCorriente)}</span>
                  </div>
                </div>
              </div>

              {/* Tarjeta 2: Total Pasivo */}
              <div className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                  2. Total Pasivo
                </span>
                <div className="font-mono text-base sm:text-lg font-bold text-foreground tabular-nums mt-1">
                  {formatoMoneda(bg.totalPasivo)}
                </div>
                <div className="text-[11px] text-muted-foreground/90 mt-1 space-y-0.5">
                  <div className="flex justify-between">
                    <span>Corriente:</span>
                    <span className="font-mono font-medium">{formatoMoneda(bg.totalPasivoCorriente)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>No Corriente:</span>
                    <span className="font-mono font-medium">{formatoMoneda(bg.totalPasivoNoCorriente)}</span>
                  </div>
                </div>
              </div>

              {/* Tarjeta 3: Capital Contable */}
              <div className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                  3. Capital Contable
                </span>
                <div className="font-mono text-base sm:text-lg font-bold text-foreground tabular-nums mt-1">
                  {formatoMoneda(bg.totalCapitalContable)}
                </div>
                <div className="text-[11px] text-muted-foreground/90 mt-1 space-y-0.5">
                  <div className="flex justify-between">
                    <span>Utilidad Ejercicio:</span>
                    <span className={cn("font-mono font-medium", bg.utilidadEjercicio >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                      {formatoMoneda(bg.utilidadEjercicio)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Patrimonio:</span>
                    <span className="font-mono font-medium">{formatoMoneda(bg.totalCapitalCuentas ?? (bg.totalCapitalContable - bg.utilidadEjercicio))}</span>
                  </div>
                </div>
              </div>

              {/* Tarjeta 4: Capital de Trabajo */}
              <div className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                  4. Capital de Trabajo
                </span>
                <div className="font-mono text-base sm:text-lg font-bold text-foreground tabular-nums mt-1">
                  {formatoMoneda(bg.totalActivoCorriente - bg.totalPasivoCorriente)}
                </div>
                <div className="text-[11px] text-muted-foreground/90 mt-1 space-y-0.5">
                  <div className="flex justify-between">
                    <span>Razón Corriente:</span>
                    <span className="font-mono font-medium">
                      {bg.totalPasivoCorriente > 0
                        ? `${(bg.totalActivoCorriente / bg.totalPasivoCorriente).toFixed(2)}x`
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Endeudamiento:</span>
                    <span className="font-mono font-medium">
                      {bg.totalActivo > 0
                        ? `${((bg.totalPasivo / bg.totalActivo) * 100).toFixed(1)}%`
                        : "0%"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ========================================================= */}
          {/* DETALLE COMPLETO (EXPANDIDO O AL IMPRIMIR)                */}
          {/* ========================================================= */}
          <div className={cn(bgExpandido ? "block space-y-6 pt-2" : "hidden print:block", "print:pt-0")}>
            <div className="flex items-center justify-between border-t border-border/60 pt-4 print:hidden">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Desglose Detallado de Cuentas
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setBgExpandido(false)}
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <ChevronUp className="size-3.5" />
                <span>Ocultar desglose</span>
              </Button>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              {/* ACTIVO */}

              <div className="space-y-6">
                <div>
                  <h2 className="mb-4 text-base font-bold">
                    ACTIVO
                  </h2>

                  <section>
                    <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                      Activo
                      corriente

                      <Badge variant="muted">
                        Código 11
                      </Badge>
                    </h3>

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

                  <section className="mt-6">
                    <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                      Activo no
                      corriente

                      <Badge variant="muted">
                        Código 12
                      </Badge>
                    </h3>

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

                    <span className="font-mono text-lg font-bold tabular-nums">
                      {formatoMoneda(
                        bg.totalActivo
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* PASIVO + CAPITAL */}

              <div className="space-y-6">
                <div>
                  <h2 className="mb-4 text-base font-bold">
                    PASIVO
                  </h2>

                  <section>
                    <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                      Pasivo
                      corriente

                      <Badge variant="muted">
                        Código 21
                      </Badge>
                    </h3>

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

                  <section className="mt-6">
                    <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                      Pasivo no
                      corriente

                      <Badge variant="muted">
                        Código 22
                      </Badge>
                    </h3>

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

                  <div className="mt-6">
                    <TotalRow
                      label="TOTAL PASIVO"
                      valor={
                        bg.totalPasivo
                      }
                      fuerte
                    />
                  </div>
                </div>

                <div className="border-t border-border pt-6">
                  <h2 className="mb-4 text-base font-bold">
                    CAPITAL
                    CONTABLE
                  </h2>

                  <Renglones
                    items={
                      bg.capital
                    }
                  />

                  <div className="flex items-center justify-between gap-4 px-1 py-2 text-sm">
                    <span className="text-muted-foreground">
                      Utilidad del
                      ejercicio
                    </span>

                    <span className="font-mono tabular-nums">
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
                      TOTAL PASIVO +
                      CAPITAL
                    </span>

                    <span className="font-mono text-lg font-bold tabular-nums">
                      {formatoMoneda(
                        bg.totalPasivoMasCapital
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ESTADO DE BALANCE CON BADGE LIMPIO */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border border-border/80 bg-card shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Estado de Balance
                </span>
                <Badge
                  variant={bg.cuadra ? "success" : "warning"}
                  className="font-mono text-xs px-2.5 py-0.5"
                >
                  {bg.cuadra ? "Cuadrado" : "Diferencia detectada"}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-muted-foreground">
                <span>Activo: <strong className="text-foreground">{formatoMoneda(bg.totalActivo)}</strong></span>
                <span>·</span>
                <span>Pasivo + Capital: <strong className="text-foreground">{formatoMoneda(bg.totalPasivoMasCapital)}</strong></span>
              </div>
            </div>

            {/* Botón inferior para contraer a resumen */}
            <div className="flex justify-end pt-2 print:hidden">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBgExpandido(false)}
                className="h-8 px-3 rounded-xl border-border/80 bg-card hover:bg-muted font-medium text-xs shadow-2xs gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <ChevronUp className="size-3.5" />
                <span>Contraer a resumen</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    {/* ====================================================== */}
    {/* CIERRE Y LIQUIDACIÓN DEL CICLO                         */}
    {/* ====================================================== */}
    <div className={cn(
      tabEstado === "cierre" ? "block space-y-6" : "hidden"
    )}>
      {/* ADMINISTRACIÓN DEL CICLO */}
      <Card className="report-card border-amber-500/30 bg-amber-500/[0.02] print:hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">
                  Administración
                  y Cierre del
                  Ciclo{" "}
                  {
                    ejercicioSeleccionado
                  }
                </CardTitle>

                <Badge
                  variant={
                    esEjercicioCerrado
                      ? "muted"
                      : "default"
                  }
                  className="text-xs"
                >
                  {esEjercicioCerrado
                    ? "Ciclo Cerrado"
                    : "Abierto para Operación"}
                </Badge>
              </div>

              <CardDescription className="mt-1 text-xs">
                {esEjercicioCerrado
                  ? "Este ejercicio ha sido liquidado formalmente. Sus cuentas de resultados están en $0.00 y sus cifras finales están protegidas."
                  : "La liquidación de fin de año cancela las cuentas de resultados e imputa la utilidad o pérdida a Capital Contable."}
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {esEjercicioCerrado ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    aperturandoSiguiente
                  }
                  onClick={
                    async () => {
                      setAperturandoSiguiente(
                        true
                      )

                      const resultado =
                        await generarPartidaApertura(
                          ejercicioSeleccionado,
                          ejercicioSeleccionado +
                            1
                        )

                      setAperturandoSiguiente(
                        false
                      )

                      if (
                        !resultado.success
                      ) {
                        alert(
                          resultado.error ||
                            "No se pudo generar la partida de apertura."
                        )
                      }
                    }
                  }
                  className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                >
                  <CalendarPlus className="mr-1.5 size-3.5" />

                  {aperturandoSiguiente
                    ? "Generando..."
                    : `Generar Partida de Apertura para ${
                        ejercicioSeleccionado +
                        1
                      }`}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={
                    abrirModalCierre
                  }
                  disabled={
                    !asientos.length
                  }
                  className="bg-amber-600 text-white hover:bg-amber-700"
                >
                  <RotateCcw className="mr-1.5 size-3.5" />

                  Proceder al
                  Cierre Contable
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* ====================================================== */}
      {/* MODAL CIERRE */}
      {/* ====================================================== */}

      {modalCierreAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="size-5 text-amber-600" />

                <h3 className="text-base font-bold text-foreground">
                  Liquidación y
                  Cierre Fiscal{" "}
                  {
                    ejercicioSeleccionado
                  }
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setModalCierreAbierto(
                    false
                  )
                }
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <p className="text-muted-foreground">
                Revise el
                resumen
                preliminar de las
                cuentas que se
                cancelarán antes
                de asentar la
                partida
                definitiva de
                cierre.
              </p>

              <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Total
                    Ingresos a
                    liquidar:
                  </span>

                  <span className="font-bold text-foreground">
                    {formatoMoneda(
                      er.totalIngresos
                    )}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Total Gastos
                    y Costos a
                    liquidar:
                  </span>

                  <span className="font-bold text-foreground">
                    {formatoMoneda(
                      er.totalGastos
                    )}
                  </span>
                </div>

                <div className="flex justify-between border-t border-border/80 pt-1.5 text-sm font-bold">
                  <span>
                    Resultado
                    Neto (
                    {er.utilidad >=
                    0
                      ? "Utilidad"
                      : "Pérdida"}
                    ):
                  </span>

                  <span
                    className={
                      er.utilidad >=
                      0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600"
                    }
                  >
                    {formatoMoneda(
                      er.utilidad
                    )}
                  </span>
                </div>

                <div className="pt-1 font-sans text-[11px] text-muted-foreground">
                  Destino:
                  Transferencia
                  automática a
                  cuenta{" "}

                  <strong>
                    3102
                    (Utilidades
                    acumuladas)
                  </strong>
                  .
                </div>
              </div>

              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-950 dark:text-amber-200">
                <strong>
                  Aviso de
                  Auditoría:
                </strong>{" "}

                Al cerrar el
                ejercicio, las
                cuentas de
                ingresos y
                gastos quedarán
                en $0.00 y no se
                admitirán nuevas
                partidas ni
                anulaciones en
                el ejercicio{" "}
                {
                  ejercicioSeleccionado
                }
                .
              </div>

              <label className="flex cursor-pointer select-none items-start gap-2 pt-1 text-xs">
                <input
                  type="checkbox"
                  checked={
                    cierreConfirmadoCheckbox
                  }
                  onChange={(
                    event
                  ) =>
                    setCierreConfirmadoCheckbox(
                      event
                        .target
                        .checked
                    )
                  }
                  className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary"
                />

                <span>
                  He revisado la
                  toma física de
                  inventario y
                  confirmo la
                  liquidación del
                  año{" "}
                  {
                    ejercicioSeleccionado
                  }
                  .
                </span>
              </label>

              <label className="flex cursor-pointer select-none items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 p-2.5 pt-1 text-xs">
                <input
                  type="checkbox"
                  checked={
                    aperturarSiguienteCheckbox
                  }
                  onChange={(
                    event
                  ) =>
                    setAperturarSiguienteCheckbox(
                      event
                        .target
                        .checked
                    )
                  }
                  className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary"
                />

                <span className="leading-snug">
                  <strong className="text-foreground">
                    Transición
                    Contable
                    Automática:
                  </strong>{" "}

                  Crear el
                  ejercicio
                  fiscal{" "}

                  <strong>
                    {ejercicioSeleccionado +
                      1}
                  </strong>{" "}

                  y generar su{" "}

                  <strong>
                    Partida #1 de
                    Apertura
                  </strong>{" "}

                  con los saldos
                  de balance y
                  el inventario
                  final contado.
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setModalCierreAbierto(
                    false
                  )
                }
                disabled={
                  ejecutandoCierre
                }
              >
                Cancelar
              </Button>

              <Button
                type="button"
                onClick={
                  ejecutarCierreSeguro
                }
                disabled={
                  !cierreConfirmadoCheckbox ||
                  ejecutandoCierre
                }
                className="bg-amber-600 text-white hover:bg-amber-700"
              >
                {ejecutandoCierre
                  ? "Procesando Cierre..."
                  : "Confirmar y Cerrar Ejercicio"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================== */}
      {/* HISTORIAL DE CIERRES */}
      {/* ====================================================== */}

      <Card className="report-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="size-5 text-primary" />

                Historial de
                Cierres
                Contables
              </CardTitle>

              <CardDescription>
                Registro
                auditable e
                inmutable de los
                cierres de
                ejercicio y
                liquidación de
                cuentas
                nominales.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="muted">
                {cierres.length}{" "}
                {cierres.length ===
                1
                  ? "cierre registrado"
                  : "cierres registrados"}
              </Badge>

              <Link
                href="/ciclos"
                className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
              >
                <span>
                  Ver pantalla
                  de Ciclos
                </span>

                <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {cierres.length ===
          0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Aún no se han
              ejecutado cierres
              contables.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">
                      Fecha
                    </th>

                    <th className="px-3 py-2">
                      Ejercicio
                    </th>

                    <th className="px-3 py-2">
                      Concepto
                    </th>

                    <th className="px-3 py-2 text-right">
                      Ingresos
                    </th>

                    <th className="px-3 py-2 text-right">
                      Gastos
                    </th>

                    <th className="px-3 py-2 text-right">
                      Resultado
                    </th>

                    <th className="px-3 py-2 text-center">
                      Partida #
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border">
                  {cierres.map(
                    (
                      cierre
                    ) => (
                      <tr
                        key={
                          cierre.id
                        }
                        className="transition-colors hover:bg-muted/50"
                      >
                        <td className="px-3 py-2.5 font-medium">
                          {
                            cierre.fecha_cierre
                          }
                        </td>

                        <td className="px-3 py-2.5">
                          {
                            cierre.ejercicio
                          }
                        </td>

                        <td className="max-w-xs truncate px-3 py-2.5 text-muted-foreground">
                          {
                            cierre.concepto
                          }
                        </td>

                        <td className="px-3 py-2.5 text-right font-mono">
                          {formatoMoneda(
                            Number(
                              cierre.total_ingresos
                            )
                          )}
                        </td>

                        <td className="px-3 py-2.5 text-right font-mono">
                          {formatoMoneda(
                            Number(
                              cierre.total_gastos
                            )
                          )}
                        </td>

                        <td
                          className={`px-3 py-2.5 text-right font-mono font-semibold ${
                            Number(
                              cierre.utilidad
                            ) >=
                            0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {formatoMoneda(
                            Number(
                              cierre.utilidad
                            )
                          )}
                        </td>

                        <td className="px-3 py-2.5 text-center">
                          <Badge variant="muted">
                            #
                            {cierre.asiento_numero ??
                              "-"}
                          </Badge>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  </section>

      {/* ====================================================== */}
      {/* PIE PARA IMPRESIÓN */}
      {/* ====================================================== */}

      <footer className="hidden border-t border-border pt-8 text-center text-xs text-muted-foreground print:block">
        <p>
          Las notas son parte
          integrante de los
          estados financieros.
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
    </div>
  )
}