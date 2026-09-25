"use client"

import { Fragment, useEffect, useMemo, useState } from "react"

import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

import {
  Archive,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  FileDown,
  FileSpreadsheet,
  Filter,
  Loader2,
  Search,
  ShieldCheck,
  TrendingUp,
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

// ============================================================
// TIPOS
// ============================================================

type EstadoEjercicio =
  | "ABIERTO"
  | "CERRADO"
  | "BLOQUEADO"

type TabActiva =
  | "resumen"
  | "diario"
  | "mayor"
  | "resultados"
  | "balance"

type LineaDiario = {
  numero: number
  codigo: string
  nombre: string
  debe: number
  haber: number
}

type AsientoDiario = {
  id: string
  numero: number
  fecha: string
  concepto: string
  tipo?: string
  estado?: string
  lineas: LineaDiario[]
}

type Cuenta = {
  codigo: string
  nombre: string
  tipo: string
  naturaleza: string
  activa?: boolean
}

type LineaMayor = {
  cuenta: Cuenta
  debe: number
  haber: number
  saldo: number
  naturalezaSaldo?: string | null
}

type LineaReporte = {
  cuenta: Cuenta
  monto: number
}

type EstadoResultados = {
  ventas?: LineaReporte[]
  devolucionesVentas?: LineaReporte[]
  otrosIngresosOperativos?: LineaReporte[]

  compras?: LineaReporte[]
  gastosCompras?: LineaReporte[]
  devolucionesCompras?: LineaReporte[]
  costoVentas?: LineaReporte[]

  gastosOperacion?: LineaReporte[]
  ingresosFinancieros?: LineaReporte[]
  gastosFinancieros?: LineaReporte[]

  totalVentasBrutas?: number
  totalDevolucionesVentas?: number
  totalVentas?: number

  totalCompras?: number
  totalGastosCompras?: number
  comprasTotales?: number
  totalDevolucionesCompras?: number
  comprasNetas?: number

  totalCostoVentas?: number
  usaDetalleCompras?: boolean

  utilidadBruta?: number
  totalOtrosIngresosOperativos?: number
  totalGastosOperacion?: number
  utilidadOperacion?: number

  totalIngresosFinancieros?: number
  totalGastosFinancieros?: number
  resultadoFinanciero?: number

  utilidadAntesImpuestos?: number
  utilidad?: number
}

type BalanceGeneral = {
  activos?: LineaReporte[]
  pasivos?: LineaReporte[]
  capital?: LineaReporte[]

  activosCorrientes?: LineaReporte[]
  activosNoCorrientes?: LineaReporte[]

  pasivosCorrientes?: LineaReporte[]
  pasivosNoCorrientes?: LineaReporte[]

  totalActivoCorriente?: number
  totalActivoNoCorriente?: number

  totalPasivoCorriente?: number
  totalPasivoNoCorriente?: number

  totalActivo?: number
  totalPasivo?: number

  totalCapitalCuentas?: number
  totalCapitalContable?: number

  utilidadEjercicio?: number
  totalPasivoMasCapital?: number

  cuadra?: boolean
}

type Cierre = {
  fecha_cierre?: string
  concepto?: string
  total_ingresos?: number
  total_gastos?: number
  utilidad?: number
  cuenta_capital_codigo?: string
  asiento_cierre_id?: string
  creado_en?: string
}

type DetalleEjercicio = {
  ejercicio: {
    anio: number
    fechaInicio: string
    fechaFin: string
    estado: EstadoEjercicio
    cerradoEn?: string | null
    responsable?: string | null
  }

  resumen: {
    asientos: number
    cuentas: number
    totalDebe: number
    totalHaber: number
    utilidad: number
    totalActivo: number
    totalPasivoCapital: number
    cuadra: boolean
  }

  libroDiario: AsientoDiario[]
  libroMayor: LineaMayor[]
  estadoResultados: EstadoResultados
  balanceGeneral: BalanceGeneral
  cierre?: Cierre | null
}

type EjercicioResumen = {
  anio: number
  fechaInicio: string
  fechaFin: string

  estado: EstadoEjercicio

  fechaCierre?: string | null
  responsable?: string | null

  asientos: number
  cuentas: number

  totalDebe: number
  totalHaber: number

  utilidad: number

  totalActivo: number
  totalPasivoCapital: number

  cuadra: boolean
}

// ============================================================
// UTILIDADES
// ============================================================

function formatoMoneda(
  valor: number | undefined | null
) {
  return new Intl.NumberFormat(
    "es-SV",
    {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(
    Number(valor) || 0
  )
}

function formatoFecha(
  fecha?: string | null
) {
  if (!fecha) return "—"

  const soloFecha =
    fecha.substring(0, 10)

  const partes =
    soloFecha.split("-")

  if (partes.length !== 3) {
    return fecha
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`
}

function escaparXml(
  valor: unknown
) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function descargarArchivo(
  contenido: BlobPart,
  tipo: string,
  nombre: string
) {
  const blob =
    new Blob(
      [contenido],
      { type: tipo }
    )

  const url =
    URL.createObjectURL(blob)

  const enlace =
    document.createElement("a")

  enlace.href = url
  enlace.download = nombre

  document.body.appendChild(
    enlace
  )

  enlace.click()

  enlace.remove()

  URL.revokeObjectURL(url)
}

// ============================================================
// COMPONENTES PEQUEÑOS
// ============================================================

function EstadoBadge({
  estado,
}: {
  estado: EstadoEjercicio
}) {
  if (estado === "ABIERTO") {
    return (
      <span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-500">
        Abierto
      </span>
    )
  }

  if (
    estado === "BLOQUEADO"
  ) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-500">
        Bloqueado
      </span>
    )
  }

  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      Cerrado
    </span>
  )
}

function EstadoContable({
  cuadra,
}: {
  cuadra: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">

      <div className="flex items-center gap-2">

        <CheckCircle2
          className={`size-4 ${
            cuadra
              ? "text-emerald-500"
              : "text-red-500"
          }`}
        />

        <span className="text-sm text-muted-foreground">
          Estado contable
        </span>

      </div>

      <Badge
        variant="muted"
        className={
          cuadra
            ? "border-emerald-500/20 text-emerald-500"
            : "border-red-500/20 text-red-500"
        }
      >
        {cuadra
          ? "Cuadrado"
          : "Con diferencia"}
      </Badge>

    </div>
  )
}

function FilaReporte({
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
      className={`flex items-center justify-between gap-4 border-b border-border/60 py-2.5 text-sm ${
        fuerte
          ? "font-semibold"
          : ""
      }`}
    >
      <span>
        {label}
      </span>

      <span className="tabular-nums">
        {formatoMoneda(valor)}
      </span>
    </div>
  )
}

function ListaReporte({
  items,
}: {
  items?: LineaReporte[]
}) {
  if (!items?.length) {
    return (
      <p className="py-2 text-sm text-muted-foreground">
        Sin movimientos registrados.
      </p>
    )
  }

  return (
    <div>
      {items.map((item) => (
        <div
          key={
            item.cuenta.codigo
          }
          className="flex items-center justify-between gap-4 border-b border-border/50 py-2 text-sm"
        >
          <span>
            <span className="mr-2 text-muted-foreground">
              {
                item.cuenta
                  .codigo
              }
            </span>

            {
              item.cuenta
                .nombre
            }
          </span>

          <span className="tabular-nums">
            {formatoMoneda(
              item.monto
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// PÁGINA
// ============================================================

export default function ArchivoContablePage() {
  const [
    ejercicios,
    setEjercicios,
  ] = useState<
    EjercicioResumen[]
  >([])

  const [
    cargando,
    setCargando,
  ] = useState(true)

  const [
    error,
    setError,
  ] = useState("")

  const [
    anioSeleccionado,
    setAnioSeleccionado,
  ] = useState("TODOS")

  const [
    estadoSeleccionado,
    setEstadoSeleccionado,
  ] = useState("TODOS")

  const [
    busqueda,
    setBusqueda,
  ] = useState("")

  const [
    ejercicioActivo,
    setEjercicioActivo,
  ] =
    useState<DetalleEjercicio | null>(
      null
    )

  const [
    cargandoDetalle,
    setCargandoDetalle,
  ] = useState(false)

  const [
    tabActiva,
    setTabActiva,
  ] =
    useState<TabActiva>(
      "resumen"
    )

  // ============================================================
  // CARGAR PERÍODOS DESDE POSTGRESQL
  // ============================================================

  useEffect(() => {
    cargarEjercicios()
  }, [])

  async function cargarEjercicios() {
    setCargando(true)
    setError("")

    try {
      const response =
        await fetch(
          "/api/ejercicios",
          {
            cache: "no-store",
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ??
            "No se pudieron cargar los períodos contables."
        )
      }

      /*
       * La API general trae la información básica.
       *
       * También consultamos cada ejercicio individualmente
       * para obtener utilidad, activo y estado de cuadratura
       * en tiempo real, incluso si el período todavía está abierto.
       */

      const completos =
        await Promise.all(
          data.map(
            async (
              ejercicio: any
            ) => {
              try {
                const resDetalle =
                  await fetch(
                    `/api/ejercicios/${ejercicio.anio}`,
                    {
                      cache:
                        "no-store",
                    }
                  )

                if (
                  !resDetalle.ok
                ) {
                  throw new Error()
                }

                const detalle: DetalleEjercicio =
                  await resDetalle.json()

                return {
                  anio:
                    ejercicio.anio,

                  fechaInicio:
                    ejercicio.fechaInicio,

                  fechaFin:
                    ejercicio.fechaFin,

                  estado:
                    ejercicio.estado,

                  fechaCierre:
                    ejercicio.fechaCierre,

                  responsable:
                    ejercicio.responsable,

                  asientos:
                    detalle.resumen
                      .asientos,

                  cuentas:
                    detalle.resumen
                      .cuentas,

                  totalDebe:
                    detalle.resumen
                      .totalDebe,

                  totalHaber:
                    detalle.resumen
                      .totalHaber,

                  utilidad:
                    detalle.resumen
                      .utilidad,

                  totalActivo:
                    detalle.resumen
                      .totalActivo,

                  totalPasivoCapital:
                    detalle.resumen
                      .totalPasivoCapital,

                  cuadra:
                    detalle.resumen
                      .cuadra,
                } satisfies EjercicioResumen
              } catch {
                return {
                  anio:
                    ejercicio.anio,

                  fechaInicio:
                    ejercicio.fechaInicio,

                  fechaFin:
                    ejercicio.fechaFin,

                  estado:
                    ejercicio.estado,

                  fechaCierre:
                    ejercicio.fechaCierre,

                  responsable:
                    ejercicio.responsable,

                  asientos:
                    ejercicio.asientos ??
                    0,

                  cuentas:
                    ejercicio.cuentas ??
                    0,

                  totalDebe:
                    ejercicio.totalDebe ??
                    0,

                  totalHaber:
                    ejercicio.totalHaber ??
                    0,

                  utilidad:
                    ejercicio.utilidad ??
                    0,

                  totalActivo: 0,

                  totalPasivoCapital: 0,

                  cuadra:
                    Math.abs(
                      Number(
                        ejercicio.totalDebe
                      ) -
                        Number(
                          ejercicio.totalHaber
                        )
                    ) < 0.01,
                } satisfies EjercicioResumen
              }
            }
          )
        )

      setEjercicios(
        completos
      )
    } catch (
      e: unknown
    ) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo consultar el Archivo Contable."
      )
    } finally {
      setCargando(false)
    }
  }

  // ============================================================
  // FILTROS
  // ============================================================

  const ejerciciosFiltrados =
    useMemo(() => {
      return ejercicios.filter(
        (ejercicio) => {
          const coincideAnio =
            anioSeleccionado ===
              "TODOS" ||
            String(
              ejercicio.anio
            ) ===
              anioSeleccionado

          const coincideEstado =
            estadoSeleccionado ===
              "TODOS" ||
            ejercicio.estado ===
              estadoSeleccionado

          const texto =
            [
              ejercicio.anio,
              ejercicio.estado,
              ejercicio.responsable ??
                "",
            ]
              .join(" ")
              .toLowerCase()

          const coincideBusqueda =
            texto.includes(
              busqueda
                .trim()
                .toLowerCase()
            )

          return (
            coincideAnio &&
            coincideEstado &&
            coincideBusqueda
          )
        }
      )
    }, [
      ejercicios,
      anioSeleccionado,
      estadoSeleccionado,
      busqueda,
    ])

  const ejerciciosCerrados =
    ejercicios.filter(
      (x) =>
        x.estado ===
        "CERRADO"
    ).length

  const utilidadAcumulada =
    ejercicios.reduce(
      (total, ejercicio) =>
        total +
        ejercicio.utilidad,
      0
    )

  // ============================================================
  // VER EJERCICIO
  // ============================================================

  async function abrirEjercicio(
    anio: number
  ) {
    setCargandoDetalle(true)
    setTabActiva("resumen")

    try {
      const response =
        await fetch(
          `/api/ejercicios/${anio}`,
          {
            cache: "no-store",
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ??
            "No se pudo consultar el período."
        )
      }

      setEjercicioActivo(
        data
      )
    } catch (
      e: unknown
    ) {
      window.alert(
        e instanceof Error
          ? e.message
          : "No se pudo abrir el período contable."
      )
    } finally {
      setCargandoDetalle(false)
    }
  }

  // ============================================================
  // CARGAR DETALLE PARA EXPORTAR
  // ============================================================

  async function obtenerDetalle(
    anio: number
  ): Promise<DetalleEjercicio> {
    if (
      ejercicioActivo?.ejercicio
        .anio === anio
    ) {
      return ejercicioActivo
    }

    const response =
      await fetch(
        `/api/ejercicios/${anio}`,
        {
          cache: "no-store",
        }
      )

    const data =
      await response.json()

    if (!response.ok) {
      throw new Error(
        data.error ??
          "No se pudo obtener la información del período."
      )
    }

    return data
  }

  // ============================================================
  // PDF PROFESIONAL
  // ============================================================

async function exportarPdf(
  anio: number
) {
  try {
    const detalle =
      await obtenerDetalle(anio)

    const er =
      detalle.estadoResultados

    const bg =
      detalle.balanceGeneral

    const doc =
      new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      })

    const anchoPagina =
      doc.internal.pageSize.getWidth()

    const altoPagina =
      doc.internal.pageSize.getHeight()

    const margen = 15

    let y = 18

    // ==========================================================
    // UTILIDADES
    // ==========================================================

    const ultimoY = () => {
      const pdf =
        doc as jsPDF & {
          lastAutoTable?: {
            finalY: number
          }
        }

      return (
        pdf.lastAutoTable
          ?.finalY ?? y
      )
    }

    const nuevaPagina =
      (
        titulo?: string
      ) => {
        doc.addPage()

        y = 18

        if (titulo) {
          doc.setFont(
            "helvetica",
            "bold"
          )

          doc.setFontSize(15)

          doc.text(
            titulo,
            margen,
            y
          )

          y += 10
        }
      }

    const comprobarEspacio =
      (
        espacioNecesario: number,
        titulo?: string
      ) => {
        if (
          y +
            espacioNecesario >
          altoPagina - 18
        ) {
          nuevaPagina(
            titulo
          )
        }
      }

    const tituloSeccion =
      (
        texto: string
      ) => {
        comprobarEspacio(
          15
        )

        doc.setFont(
          "helvetica",
          "bold"
        )

        doc.setFontSize(
          13
        )

        doc.text(
          texto,
          margen,
          y
        )

        y += 3

        doc.setDrawColor(
          40,
          40,
          40
        )

        doc.line(
          margen,
          y,
          anchoPagina -
            margen,
          y
        )

        y += 7
      }

    const moneda = (
      valor?: number | null
    ) =>
      formatoMoneda(
        Number(valor ?? 0)
      )

    // ==========================================================
    // PORTADA / ENCABEZADO
    // ==========================================================

    doc.setFont(
      "helvetica",
      "bold"
    )

    doc.setFontSize(22)

    doc.text(
      "Finexa",
      margen,
      y
    )

    y += 6

    doc.setFont(
      "helvetica",
      "normal"
    )

    doc.setFontSize(9)

    doc.setTextColor(
      90,
      90,
      90
    )

    doc.text(
      "Gestión contable inteligente",
      margen,
      y
    )

    y += 11

    doc.setTextColor(
      20,
      20,
      20
    )

    doc.setFont(
      "helvetica",
      "bold"
    )

    doc.setFontSize(17)

    doc.text(
      `Reporte integral del ejercicio contable ${detalle.ejercicio.anio}`,
      margen,
      y
    )

    y += 9

    doc.setFontSize(9)

    doc.setFont(
      "helvetica",
      "normal"
    )

    const columna2 =
      108

    doc.text(
      `Período: ${formatoFecha(
        detalle.ejercicio
          .fechaInicio
      )} al ${formatoFecha(
        detalle.ejercicio
          .fechaFin
      )}`,
      margen,
      y
    )

    doc.text(
      `Estado: ${detalle.ejercicio.estado}`,
      columna2,
      y
    )

    y += 5

    doc.text(
      `Responsable: ${
        detalle.ejercicio
          .responsable ??
        "Contador"
      }`,
      margen,
      y
    )

    doc.text(
      `Fecha de emisión: ${new Date().toLocaleDateString(
        "es-SV"
      )}`,
      columna2,
      y
    )

    y += 8

    doc.setDrawColor(
      30,
      30,
      30
    )

    doc.line(
      margen,
      y,
      anchoPagina -
        margen,
      y
    )

    y += 10

    // ==========================================================
    // RESUMEN EJECUTIVO
    // ==========================================================

    tituloSeccion(
      "Resumen ejecutivo"
    )

    autoTable(
      doc,
      {
        startY: y,

        theme:
          "grid",

        styles: {
          fontSize: 9,
          cellPadding: 4,
        },

        headStyles: {
          fillColor: [
            242,
            242,
            242,
          ],

          textColor: [
            40,
            40,
            40,
          ],

          fontStyle:
            "bold",
        },

        head: [
          [
            "ASIENTOS",
            "CUENTAS CON MOVIMIENTO",
            "MOVIMIENTO ACUMULADO",
            "RESULTADO",
          ],
        ],

        body: [
          [
            String(
              detalle.resumen
                .asientos
            ),

            String(
              detalle.resumen
                .cuentas
            ),

            moneda(
              detalle.resumen
                .totalDebe
            ),

            moneda(
              detalle.resumen
                .utilidad
            ),
          ],
        ],

        margin: {
          left: margen,
          right: margen,
        },
      }
    )

    y =
      ultimoY() + 10

    // ==========================================================
    // LIBRO DIARIO
    // ==========================================================

    nuevaPagina(
      "Libro Diario"
    )

    const filasDiario: (
      | string
      | number
    )[][] = []

    for (
      const asiento
      of detalle.libroDiario
    ) {
      filasDiario.push([
        asiento.numero,
        formatoFecha(
          asiento.fecha
        ),
        asiento.concepto,
        "",
        "",
      ])

      for (
        const linea
        of asiento.lineas
      ) {
        filasDiario.push([
          "",
          "",
          `${linea.codigo} - ${linea.nombre}`,
          linea.debe
            ? moneda(
                linea.debe
              )
            : "",

          linea.haber
            ? moneda(
                linea.haber
              )
            : "",
        ])
      }
    }

    autoTable(
      doc,
      {
        startY: y,

        head: [
          [
            "N.º",
            "Fecha",
            "Cuenta / Concepto",
            "Debe",
            "Haber",
          ],
        ],

        body:
          filasDiario,

        theme:
          "grid",

        styles: {
          fontSize: 7.5,
          cellPadding: 2.2,
        },

        headStyles: {
          fillColor: [
            235,
            235,
            235,
          ],

          textColor: 25,

          fontStyle:
            "bold",
        },

        columnStyles: {
          0: {
            cellWidth: 12,
          },

          1: {
            cellWidth: 22,
          },

          2: {
            cellWidth: 88,
          },

          3: {
            cellWidth: 28,
            halign:
              "right",
          },

          4: {
            cellWidth: 28,
            halign:
              "right",
          },
        },

        margin: {
          left: margen,
          right: margen,
          bottom: 15,
        },

        rowPageBreak:
          "avoid",
      }
    )

    // ==========================================================
    // LIBRO MAYOR
    // ==========================================================

    nuevaPagina(
      "Libro Mayor"
    )

    autoTable(
      doc,
      {
        startY: y,

        head: [
          [
            "Código",
            "Cuenta",
            "Debe",
            "Haber",
            "Saldo",
          ],
        ],

        body:
          detalle.libroMayor.map(
            (linea) => [
              linea.cuenta
                .codigo,

              linea.cuenta
                .nombre,

              moneda(
                linea.debe
              ),

              moneda(
                linea.haber
              ),

              moneda(
                Math.abs(
                  linea.saldo
                )
              ),
            ]
          ),

        theme:
          "grid",

        styles: {
          fontSize: 8,
          cellPadding: 2.5,
        },

        headStyles: {
          fillColor: [
            235,
            235,
            235,
          ],

          textColor: 25,
        },

        columnStyles: {
          0: {
            cellWidth: 20,
          },

          1: {
            cellWidth: 75,
          },

          2: {
            halign:
              "right",
          },

          3: {
            halign:
              "right",
          },

          4: {
            halign:
              "right",
          },
        },

        margin: {
          left: margen,
          right: margen,
        },
      }
    )

    // ==========================================================
    // ESTADO DE RESULTADOS
    // ==========================================================

    nuevaPagina(
      "Estado de Resultados"
    )

    const filasEr = [
      [
        "Ventas netas",
        moneda(
          er.totalVentas
        ),
      ],

      [
        "Costo de venta",
        moneda(
          er.totalCostoVentas
        ),
      ],

      [
        "Utilidad bruta",
        moneda(
          er.utilidadBruta
        ),
      ],

      [
        "Gastos de operación",
        moneda(
          er.totalGastosOperacion
        ),
      ],

      [
        "Ingresos financieros",
        moneda(
          er.totalIngresosFinancieros
        ),
      ],

      [
        "Gastos financieros",
        moneda(
          er.totalGastosFinancieros
        ),
      ],
    ]

    autoTable(
      doc,
      {
        startY: y,

        body:
          filasEr,

        theme:
          "grid",

        styles: {
          fontSize: 9,
          cellPadding: 3,
        },

        columnStyles: {
          1: {
            halign:
              "right",
          },
        },

        margin: {
          left: margen,
          right: margen,
        },
      }
    )

    y =
      ultimoY() + 8

    doc.setFont(
      "helvetica",
      "bold"
    )

    doc.setFontSize(11)

    doc.rect(
      margen,
      y,
      anchoPagina -
        margen * 2,
      10
    )

    doc.text(
      Number(
        er.utilidad ?? 0
      ) >= 0
        ? "Utilidad del ejercicio"
        : "Pérdida del ejercicio",
      margen + 3,
      y + 6.5
    )

    doc.text(
      moneda(
        er.utilidad
      ),
      anchoPagina -
        margen -
        3,
      y + 6.5,
      {
        align:
          "right",
      }
    )

    // ==========================================================
    // BALANCE GENERAL
    // ==========================================================

    nuevaPagina(
      "Balance General"
    )

    const activos =
      bg.activos ?? []

    const pasivos =
      bg.pasivos ?? []

    const capital =
      bg.capital ?? []

    const tablaBalance =
      (
        titulo: string,
        items: LineaReporte[],
        totalTitulo: string,
        total?: number | null
      ) => {
        tituloSeccion(
          titulo
        )

        autoTable(
          doc,
          {
            startY: y,

            body:
              items.map(
                (
                  item
                ) => [
                  `${item.cuenta.codigo} - ${item.cuenta.nombre}`,
                  moneda(
                    item.monto
                  ),
                ]
              ),

            theme:
              "grid",

            styles: {
              fontSize: 8.5,
              cellPadding: 2.5,
            },

            columnStyles: {
              1: {
                halign:
                  "right",
              },
            },

            margin: {
              left: margen,
              right: margen,
            },
          }
        )

        y =
          ultimoY() + 3

        comprobarEspacio(
          15,
          "Balance General"
        )

        doc.setFont(
          "helvetica",
          "bold"
        )

        doc.rect(
          margen,
          y,
          anchoPagina -
            margen * 2,
          9
        )

        doc.text(
          totalTitulo,
          margen + 3,
          y + 6
        )

        doc.text(
          moneda(total),
          anchoPagina -
            margen -
            3,
          y + 6,
          {
            align:
              "right",
          }
        )

        y += 15
      }

    tablaBalance(
      "Activo",
      activos,
      "Total Activo",
      bg.totalActivo
    )

    tablaBalance(
      "Pasivo",
      pasivos,
      "Total Pasivo",
      bg.totalPasivo
    )

    tituloSeccion(
      "Capital contable"
    )

    autoTable(
      doc,
      {
        startY: y,

        body:
          capital.map(
            (item) => [
              `${item.cuenta.codigo} - ${item.cuenta.nombre}`,
              moneda(
                item.monto
              ),
            ]
          ),

        theme:
          "grid",

        styles: {
          fontSize: 8.5,
          cellPadding: 2.5,
        },

        columnStyles: {
          1: {
            halign:
              "right",
          },
        },

        margin: {
          left: margen,
          right: margen,
        },
      }
    )

    y =
      ultimoY() + 5

    comprobarEspacio(
      45,
      "Balance General"
    )

    doc.setFont(
      "helvetica",
      "bold"
    )

    doc.rect(
      margen,
      y,
      anchoPagina -
        margen * 2,
      10
    )

    doc.text(
      "Total Pasivo + Capital",
      margen + 3,
      y + 6.5
    )

    doc.text(
      moneda(
        bg.totalPasivoMasCapital
      ),
      anchoPagina -
        margen -
        3,
      y + 6.5,
      {
        align:
          "right",
      }
    )

    y += 28

    // ==========================================================
    // FIRMAS
    // ==========================================================

    comprobarEspacio(
      35
    )

    const anchoFirma =
      48

    const posiciones = [
      margen,
      anchoPagina / 2 -
        anchoFirma / 2,
      anchoPagina -
        margen -
        anchoFirma,
    ]

    const firmas = [
      "Representante legal",
      "Contador",
      "Auditor externo",
    ]

    posiciones.forEach(
      (
        x,
        indice
      ) => {
        doc.line(
          x,
          y,
          x +
            anchoFirma,
          y
        )

        doc.setFont(
          "helvetica",
          "normal"
        )

        doc.setFontSize(
          8
        )

        doc.text(
          firmas[indice] ?? "",
          x +
            anchoFirma /
              2,
          y + 5,
          {
            align:
              "center",
          }
        )
      }
    )

    // ==========================================================
    // METADATOS DEL PDF
    // ==========================================================

    doc.setProperties({
      title:
        `Reporte contable ${detalle.ejercicio.anio}`,

      subject:
        "Reporte integral de Finexa",

      author:
        "Finexa",

      creator:
        "Finexa",
    })

    // ==========================================================
    // GUARDAR
    // ==========================================================

    doc.save(
      `Finexa_Reporte_Contable_${detalle.ejercicio.anio}.pdf`
    )
  } catch (
    e: unknown
  ) {
    window.alert(
      e instanceof Error
        ? e.message
        : "No se pudo generar el reporte PDF."
    )
  }
}

  // ============================================================
  // EXCEL EDITABLE CON HOJAS Y FÓRMULAS
  // ============================================================

  async function exportarExcel(
    anio: number
  ) {
    try {
      const detalle =
        await obtenerDetalle(
          anio
        )

      const diario =
        detalle.libroDiario

      const mayor =
        detalle.libroMayor

      const er =
        detalle.estadoResultados

      const bg =
        detalle.balanceGeneral

      const filasDiario: string[] =
        []

      let filaExcel = 2

      for (
        const asiento
        of diario
      ) {
        for (
          const linea
          of asiento.lineas
        ) {
          filasDiario.push(`
<Row>
<Cell><Data ss:Type="Number">${asiento.numero}</Data></Cell>
<Cell><Data ss:Type="String">${escaparXml(formatoFecha(asiento.fecha))}</Data></Cell>
<Cell><Data ss:Type="String">${escaparXml(asiento.concepto)}</Data></Cell>
<Cell><Data ss:Type="String">${escaparXml(linea.codigo)}</Data></Cell>
<Cell><Data ss:Type="String">${escaparXml(linea.nombre)}</Data></Cell>
<Cell><Data ss:Type="Number">${Number(linea.debe) || 0}</Data></Cell>
<Cell><Data ss:Type="Number">${Number(linea.haber) || 0}</Data></Cell>
</Row>
          `)

          filaExcel++
        }
      }

      const ultimaFilaDiario =
        Math.max(
          filaExcel - 1,
          2
        )

      const filasMayor =
        mayor
          .map(
            (m) => `
<Row>
<Cell><Data ss:Type="String">${escaparXml(m.cuenta.codigo)}</Data></Cell>
<Cell><Data ss:Type="String">${escaparXml(m.cuenta.nombre)}</Data></Cell>
<Cell><Data ss:Type="Number">${Number(m.debe) || 0}</Data></Cell>
<Cell><Data ss:Type="Number">${Number(m.haber) || 0}</Data></Cell>
<Cell ss:Formula="=RC[-2]-RC[-1]"><Data ss:Type="Number">${Number(m.saldo) || 0}</Data></Cell>
</Row>
          `
          )
          .join("")

      const xml = `
<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>

<Workbook
 xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">

<Styles>

<Style ss:ID="Header">
<Font ss:Bold="1"/>
<Interior ss:Color="#D9EAF7" ss:Pattern="Solid"/>
</Style>

<Style ss:ID="Title">
<Font ss:Bold="1" ss:Size="16"/>
</Style>

<Style ss:ID="Currency">
<NumberFormat ss:Format="$#,##0.00"/>
</Style>

<Style ss:ID="Bold">
<Font ss:Bold="1"/>
</Style>

</Styles>

<Worksheet ss:Name="Resumen">

<Table>

<Row>
<Cell ss:StyleID="Title">
<Data ss:Type="String">FINEXA - EJERCICIO ${detalle.ejercicio.anio}</Data>
</Cell>
</Row>

<Row></Row>

<Row>
<Cell ss:StyleID="Header"><Data ss:Type="String">Concepto</Data></Cell>
<Cell ss:StyleID="Header"><Data ss:Type="String">Valor</Data></Cell>
</Row>

<Row>
<Cell><Data ss:Type="String">Período</Data></Cell>
<Cell><Data ss:Type="String">${formatoFecha(detalle.ejercicio.fechaInicio)} - ${formatoFecha(detalle.ejercicio.fechaFin)}</Data></Cell>
</Row>

<Row>
<Cell><Data ss:Type="String">Estado</Data></Cell>
<Cell><Data ss:Type="String">${escaparXml(detalle.ejercicio.estado)}</Data></Cell>
</Row>

<Row>
<Cell><Data ss:Type="String">Asientos registrados</Data></Cell>
<Cell><Data ss:Type="Number">${detalle.resumen.asientos}</Data></Cell>
</Row>

<Row>
<Cell><Data ss:Type="String">Cuentas con movimiento</Data></Cell>
<Cell><Data ss:Type="Number">${detalle.resumen.cuentas}</Data></Cell>
</Row>

<Row>
<Cell><Data ss:Type="String">Total Debe</Data></Cell>
<Cell ss:StyleID="Currency"><Data ss:Type="Number">${detalle.resumen.totalDebe}</Data></Cell>
</Row>

<Row>
<Cell><Data ss:Type="String">Total Haber</Data></Cell>
<Cell ss:StyleID="Currency"><Data ss:Type="Number">${detalle.resumen.totalHaber}</Data></Cell>
</Row>

<Row>
<Cell><Data ss:Type="String">Resultado del ejercicio</Data></Cell>
<Cell ss:StyleID="Currency"><Data ss:Type="Number">${detalle.resumen.utilidad}</Data></Cell>
</Row>

<Row>
<Cell><Data ss:Type="String">Total Activo</Data></Cell>
<Cell ss:StyleID="Currency"><Data ss:Type="Number">${detalle.resumen.totalActivo}</Data></Cell>
</Row>

<Row>
<Cell><Data ss:Type="String">Pasivo + Capital</Data></Cell>
<Cell ss:StyleID="Currency"><Data ss:Type="Number">${detalle.resumen.totalPasivoCapital}</Data></Cell>
</Row>

</Table>

</Worksheet>

<Worksheet ss:Name="Libro Diario">

<Table>

<Row>
<Cell ss:StyleID="Header"><Data ss:Type="String">N°</Data></Cell>
<Cell ss:StyleID="Header"><Data ss:Type="String">Fecha</Data></Cell>
<Cell ss:StyleID="Header"><Data ss:Type="String">Concepto</Data></Cell>
<Cell ss:StyleID="Header"><Data ss:Type="String">Código</Data></Cell>
<Cell ss:StyleID="Header"><Data ss:Type="String">Cuenta</Data></Cell>
<Cell ss:StyleID="Header"><Data ss:Type="String">Debe</Data></Cell>
<Cell ss:StyleID="Header"><Data ss:Type="String">Haber</Data></Cell>
</Row>

${filasDiario.join("")}

<Row>
<Cell ss:Index="5" ss:StyleID="Bold">
<Data ss:Type="String">TOTALES</Data>
</Cell>

<Cell
 ss:StyleID="Currency"
 ss:Formula="=SUM(R2C6:R${ultimaFilaDiario}C6)">
<Data ss:Type="Number">${detalle.resumen.totalDebe}</Data>
</Cell>

<Cell
 ss:StyleID="Currency"
 ss:Formula="=SUM(R2C7:R${ultimaFilaDiario}C7)">
<Data ss:Type="Number">${detalle.resumen.totalHaber}</Data>
</Cell>
</Row>

</Table>

</Worksheet>

<Worksheet ss:Name="Libro Mayor">

<Table>

<Row>
<Cell ss:StyleID="Header"><Data ss:Type="String">Código</Data></Cell>
<Cell ss:StyleID="Header"><Data ss:Type="String">Cuenta</Data></Cell>
<Cell ss:StyleID="Header"><Data ss:Type="String">Debe</Data></Cell>
<Cell ss:StyleID="Header"><Data ss:Type="String">Haber</Data></Cell>
<Cell ss:StyleID="Header"><Data ss:Type="String">Saldo</Data></Cell>
</Row>

${filasMayor}

</Table>

</Worksheet>

<Worksheet ss:Name="Estado de Resultados">

<Table>

<Row>
<Cell ss:StyleID="Header"><Data ss:Type="String">Concepto</Data></Cell>
<Cell ss:StyleID="Header"><Data ss:Type="String">Monto</Data></Cell>
</Row>

<Row>
<Cell><Data ss:Type="String">Ventas netas</Data></Cell>
<Cell ss:StyleID="Currency"><Data ss:Type="Number">${Number(er.totalVentas) || 0}</Data></Cell>
</Row>

<Row>
<Cell><Data ss:Type="String">Costo de venta</Data></Cell>
<Cell ss:StyleID="Currency"><Data ss:Type="Number">${Number(er.totalCostoVentas) || 0}</Data></Cell>
</Row>

<Row>
<Cell ss:StyleID="Bold"><Data ss:Type="String">Utilidad bruta</Data></Cell>
<Cell ss:StyleID="Currency" ss:Formula="=R2C2-R3C2">
<Data ss:Type="Number">${Number(er.utilidadBruta) || 0}</Data>
</Cell>
</Row>

<Row>
<Cell><Data ss:Type="String">Gastos de operación</Data></Cell>
<Cell ss:StyleID="Currency"><Data ss:Type="Number">${Number(er.totalGastosOperacion) || 0}</Data></Cell>
</Row>

<Row>
<Cell><Data ss:Type="String">Ingresos financieros</Data></Cell>
<Cell ss:StyleID="Currency"><Data ss:Type="Number">${Number(er.totalIngresosFinancieros) || 0}</Data></Cell>
</Row>

<Row>
<Cell><Data ss:Type="String">Gastos financieros</Data></Cell>
<Cell ss:StyleID="Currency"><Data ss:Type="Number">${Number(er.totalGastosFinancieros) || 0}</Data></Cell>
</Row>

<Row>
<Cell ss:StyleID="Bold"><Data ss:Type="String">Resultado del ejercicio</Data></Cell>
<Cell ss:StyleID="Currency"><Data ss:Type="Number">${Number(er.utilidad) || 0}</Data></Cell>
</Row>

</Table>

</Worksheet>

<Worksheet ss:Name="Balance General">

<Table>

<Row>
<Cell ss:StyleID="Header"><Data ss:Type="String">Concepto</Data></Cell>
<Cell ss:StyleID="Header"><Data ss:Type="String">Monto</Data></Cell>
</Row>

<Row>
<Cell ss:StyleID="Bold"><Data ss:Type="String">Activo corriente</Data></Cell>
<Cell ss:StyleID="Currency"><Data ss:Type="Number">${Number(bg.totalActivoCorriente) || 0}</Data></Cell>
</Row>

<Row>
<Cell ss:StyleID="Bold"><Data ss:Type="String">Activo no corriente</Data></Cell>
<Cell ss:StyleID="Currency"><Data ss:Type="Number">${Number(bg.totalActivoNoCorriente) || 0}</Data></Cell>
</Row>

<Row>
<Cell ss:StyleID="Bold"><Data ss:Type="String">TOTAL ACTIVO</Data></Cell>
<Cell ss:StyleID="Currency" ss:Formula="=SUM(R2C2:R3C2)">
<Data ss:Type="Number">${Number(bg.totalActivo) || 0}</Data>
</Cell>
</Row>

<Row></Row>

<Row>
<Cell ss:StyleID="Bold"><Data ss:Type="String">Pasivo corriente</Data></Cell>
<Cell ss:StyleID="Currency"><Data ss:Type="Number">${Number(bg.totalPasivoCorriente) || 0}</Data></Cell>
</Row>

<Row>
<Cell ss:StyleID="Bold"><Data ss:Type="String">Pasivo no corriente</Data></Cell>
<Cell ss:StyleID="Currency"><Data ss:Type="Number">${Number(bg.totalPasivoNoCorriente) || 0}</Data></Cell>
</Row>

<Row>
<Cell ss:StyleID="Bold"><Data ss:Type="String">Capital contable</Data></Cell>
<Cell ss:StyleID="Currency"><Data ss:Type="Number">${Number(bg.totalCapitalContable) || 0}</Data></Cell>
</Row>

<Row>
<Cell ss:StyleID="Bold"><Data ss:Type="String">TOTAL PASIVO + CAPITAL</Data></Cell>
<Cell ss:StyleID="Currency" ss:Formula="=SUM(R6C2:R8C2)">
<Data ss:Type="Number">${Number(bg.totalPasivoMasCapital) || 0}</Data>
</Cell>
</Row>

</Table>

</Worksheet>

</Workbook>
      `

      descargarArchivo(
        xml,
        "application/vnd.ms-excel",
        `Finexa_Ejercicio_${anio}.xls`
      )
    } catch (
      e: unknown
    ) {
      window.alert(
        e instanceof Error
          ? e.message
          : "No se pudo generar el archivo de Excel."
      )
    }
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-8">

      {/* ENCABEZADO */}

      <header className="space-y-2">

        <p className="text-sm font-medium text-primary">
          Archivo histórico
        </p>

        <div className="flex flex-wrap items-start justify-between gap-4">

          <div>

            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Archivo Contable
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Consulta y análisis de períodos fiscales registrados en Finexa.
              Accede al Libro Diario, Libro Mayor, Estados Financieros y
              documentación histórica de cada ejercicio.
            </p>

          </div>

          <Badge
            variant="muted"
            className="gap-2 px-3 py-1.5"
          >
            <Archive className="size-4" />
            Registro histórico
          </Badge>

        </div>

      </header>

      {/* ERROR */}

      {error && (
        <Card className="border-red-500/30">
          <CardContent className="p-4 text-sm text-red-500">
            {error}
          </CardContent>
        </Card>
      )}

      {/* TARJETAS */}

      <section className="grid gap-4 md:grid-cols-3">

        <Card>
          <CardContent className="p-5">

            <div className="flex items-center justify-between">

              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Períodos registrados
              </span>

              <Archive className="size-4 text-primary" />

            </div>

            <p className="mt-3 text-2xl font-bold">
              {ejercicios.length}
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Ejercicios disponibles para consulta
            </p>

          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">

            <div className="flex items-center justify-between">

              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Períodos cerrados
              </span>

              <ShieldCheck className="size-4 text-emerald-500" />

            </div>

            <p className="mt-3 text-2xl font-bold">
              {ejerciciosCerrados}
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Ejercicios finalizados
            </p>

          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">

            <div className="flex items-center justify-between">

              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Resultado acumulado
              </span>

              <TrendingUp className="size-4 text-primary" />

            </div>

            <p className="mt-3 text-2xl font-bold">
              {formatoMoneda(
                utilidadAcumulada
              )}
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Resultado de los períodos registrados
            </p>

          </CardContent>
        </Card>

      </section>

      {/* FILTROS */}

      <Card>

        <CardHeader>

          <CardTitle>
            Consulta de períodos
          </CardTitle>

          <CardDescription>
            Localiza ejercicios por año, estado o responsable.
          </CardDescription>

        </CardHeader>

        <CardContent>

          <div className="grid gap-4 md:grid-cols-[1fr_240px_240px]">

            <div className="relative">

              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

              <input
                value={busqueda}
                onChange={(e) =>
                  setBusqueda(
                    e.target.value
                  )
                }
                placeholder="Buscar período..."
                className="h-10 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />

            </div>

            <div className="relative">

              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

              <select
                value={
                  anioSeleccionado
                }
                onChange={(e) =>
                  setAnioSeleccionado(
                    e.target.value
                  )
                }
                className="h-10 w-full appearance-none rounded-lg border border-input bg-background pl-10 pr-9 text-sm outline-none"
              >

                <option value="TODOS">
                  Todos los períodos
                </option>

                {ejercicios.map(
                  (ejercicio) => (
                    <option
                      key={
                        ejercicio.anio
                      }
                      value={
                        ejercicio.anio
                      }
                    >
                      Ejercicio{" "}
                      {
                        ejercicio.anio
                      }
                    </option>
                  )
                )}

              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            </div>

            <div className="relative">

              <Filter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

              <select
                value={
                  estadoSeleccionado
                }
                onChange={(e) =>
                  setEstadoSeleccionado(
                    e.target.value
                  )
                }
                className="h-10 w-full appearance-none rounded-lg border border-input bg-background pl-10 pr-9 text-sm outline-none"
              >

                <option value="TODOS">
                  Cualquier estado
                </option>

                <option value="ABIERTO">
                  Períodos abiertos
                </option>

                <option value="CERRADO">
                  Períodos cerrados
                </option>

                <option value="BLOQUEADO">
                  Períodos bloqueados
                </option>

              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            </div>

          </div>

        </CardContent>

      </Card>

      {/* LISTADO */}

      <section className="space-y-4">

        <div>

          <h2 className="text-lg font-semibold">
            Períodos fiscales
          </h2>

          <p className="text-sm text-muted-foreground">
            {ejerciciosFiltrados.length} período(s) disponible(s)
          </p>

        </div>

        {cargando ? (

          <Card>
            <CardContent className="flex items-center justify-center gap-3 py-14">

              <Loader2 className="size-5 animate-spin text-primary" />

              <span className="text-sm text-muted-foreground">
                Consultando archivo contable...
              </span>

            </CardContent>
          </Card>

        ) : (
          ejerciciosFiltrados.map(
            (ejercicio) => (
              <Card
                key={
                  ejercicio.anio
                }
                className="overflow-hidden"
              >

                <CardContent className="p-0">

                  <div className="grid gap-6 p-6 lg:grid-cols-[1fr_210px]">

                    <div className="space-y-5">

                      <div className="flex flex-wrap items-start gap-3">

                        <div className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">

                          <Archive className="size-5" />

                        </div>

                        <div>

                          <div className="flex flex-wrap items-center gap-2">

                            <h3 className="text-lg font-semibold">
                              Ejercicio{" "}
                              {
                                ejercicio.anio
                              }
                            </h3>

                            <EstadoBadge
                              estado={
                                ejercicio.estado
                              }
                            />

                          </div>

                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatoFecha(
                              ejercicio.fechaInicio
                            )}
                            {" — "}
                            {formatoFecha(
                              ejercicio.fechaFin
                            )}
                          </p>

                        </div>

                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

                        <div>

                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Asientos
                          </p>

                          <p className="mt-1 text-lg font-semibold">
                            {
                              ejercicio.asientos
                            }
                          </p>

                        </div>

                        <div>

                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Cuentas con movimiento
                          </p>

                          <p className="mt-1 text-lg font-semibold">
                            {
                              ejercicio.cuentas
                            }
                          </p>

                        </div>

                        <div>

                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Movimiento acumulado
                          </p>

                          <p className="mt-1 text-lg font-semibold">
                            {formatoMoneda(
                              ejercicio.totalDebe
                            )}
                          </p>

                        </div>

                        <div>

                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Resultado del ejercicio
                          </p>

                          <p
                            className={`mt-1 text-lg font-semibold ${
                              ejercicio.utilidad >=
                              0
                                ? "text-emerald-500"
                                : "text-red-500"
                            }`}
                          >
                            {formatoMoneda(
                              ejercicio.utilidad
                            )}
                          </p>

                        </div>

                      </div>

                      <EstadoContable
                        cuadra={
                          ejercicio.cuadra
                        }
                      />

                      {ejercicio.estado !==
                        "ABIERTO" && (
                        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">

                          <p>
                            <span className="font-medium text-foreground">
                              Fecha de cierre:
                            </span>{" "}
                            {ejercicio.fechaCierre
                              ? new Date(
                                  ejercicio.fechaCierre
                                ).toLocaleString(
                                  "es-SV"
                                )
                              : "No registrada"}
                          </p>

                          <p>
                            <span className="font-medium text-foreground">
                              Responsable:
                            </span>{" "}
                            {
                              ejercicio.responsable ??
                              "No registrado"
                            }
                          </p>

                        </div>
                      )}

                    </div>

                    <div className="flex flex-wrap items-start gap-2 lg:flex-col">

                      <Button
                        type="button"
                        className="w-full"
                        disabled={
                          cargandoDetalle
                        }
                        onClick={() =>
                          abrirEjercicio(
                            ejercicio.anio
                          )
                        }
                      >

                        {cargandoDetalle ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Eye className="size-4" />
                        )}

                        Consultar período
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() =>
                          exportarPdf(
                            ejercicio.anio
                          )
                        }
                      >

                        <FileDown className="size-4" />

                        Exportar PDF
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() =>
                          exportarExcel(
                            ejercicio.anio
                          )
                        }
                      >

                        <FileSpreadsheet className="size-4" />

                        Exportar Excel
                      </Button>

                    </div>

                  </div>

                </CardContent>

              </Card>
            )
          )
        )}

        {!cargando &&
          ejerciciosFiltrados.length ===
            0 && (
            <Card>

              <CardContent className="flex flex-col items-center justify-center py-14 text-center">

                <Archive className="size-10 text-muted-foreground/40" />

                <h3 className="mt-4 font-semibold">
                  Sin períodos para mostrar
                </h3>

                <p className="mt-1 text-sm text-muted-foreground">
                  No existen registros que coincidan con los criterios seleccionados.
                </p>

              </CardContent>

            </Card>
          )}

      </section>

      {/* ==================================================== */}
      {/* MODAL DETALLE */}
      {/* ==================================================== */}

      {ejercicioActivo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          onClick={() =>
            setEjercicioActivo(
              null
            )
          }
        >

          <div
            className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* CABECERA */}

            <div className="sticky top-0 z-20 flex flex-wrap items-start justify-between gap-4 border-b border-border bg-card/95 p-6 backdrop-blur">

              <div>

                <div className="flex items-center gap-3">

                  <h2 className="text-xl font-bold">
                    Ejercicio{" "}
                    {
                      ejercicioActivo
                        .ejercicio.anio
                    }
                  </h2>

                  <EstadoBadge
                    estado={
                      ejercicioActivo
                        .ejercicio.estado
                    }
                  />

                </div>

                <p className="mt-1 text-sm text-muted-foreground">
                  {formatoFecha(
                    ejercicioActivo
                      .ejercicio
                      .fechaInicio
                  )}
                  {" — "}
                  {formatoFecha(
                    ejercicioActivo
                      .ejercicio.fechaFin
                  )}
                </p>

              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() =>
                  setEjercicioActivo(
                    null
                  )
                }
              >
                <X className="size-4" />
              </Button>

            </div>

            <div className="space-y-6 p-6">

              {/* TABS */}

              <div className="flex flex-wrap gap-2">

                {[
                  {
                    id: "resumen",
                    label:
                      "Resumen",
                  },
                  {
                    id: "diario",
                    label:
                      "Libro Diario",
                  },
                  {
                    id: "mayor",
                    label:
                      "Libro Mayor",
                  },
                  {
                    id: "resultados",
                    label:
                      "Estado de Resultados",
                  },
                  {
                    id: "balance",
                    label:
                      "Balance General",
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() =>
                      setTabActiva(
                        tab.id as TabActiva
                      )
                    }
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      tabActiva ===
                      tab.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}

              </div>

              {/* RESUMEN */}

              {tabActiva ===
                "resumen" && (
                <div className="space-y-5">

                  <div className="grid gap-4 md:grid-cols-2">

                    <Card>

                      <CardHeader>
                        <CardTitle>
                          Información del período
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="space-y-3 text-sm">

                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Asientos registrados
                          </span>

                          <span className="font-medium">
                            {
                              ejercicioActivo
                                .resumen
                                .asientos
                            }
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Cuentas con movimiento
                          </span>

                          <span className="font-medium">
                            {
                              ejercicioActivo
                                .resumen
                                .cuentas
                            }
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Total Debe
                          </span>

                          <span className="font-medium">
                            {formatoMoneda(
                              ejercicioActivo
                                .resumen
                                .totalDebe
                            )}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Total Haber
                          </span>

                          <span className="font-medium">
                            {formatoMoneda(
                              ejercicioActivo
                                .resumen
                                .totalHaber
                            )}
                          </span>
                        </div>

                      </CardContent>

                    </Card>

                    <Card>

                      <CardHeader>
                        <CardTitle>
                          Posición financiera
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="space-y-3 text-sm">

                        <div className="flex justify-between">

                          <span className="text-muted-foreground">
                            Resultado del ejercicio
                          </span>

                          <span
                            className={`font-semibold ${
                              ejercicioActivo
                                .resumen
                                .utilidad >=
                              0
                                ? "text-emerald-500"
                                : "text-red-500"
                            }`}
                          >
                            {formatoMoneda(
                              ejercicioActivo
                                .resumen
                                .utilidad
                            )}
                          </span>

                        </div>

                        <div className="flex justify-between">

                          <span className="text-muted-foreground">
                            Total Activo
                          </span>

                          <span className="font-medium">
                            {formatoMoneda(
                              ejercicioActivo
                                .resumen
                                .totalActivo
                            )}
                          </span>

                        </div>

                        <div className="flex justify-between">

                          <span className="text-muted-foreground">
                            Pasivo + Capital
                          </span>

                          <span className="font-medium">
                            {formatoMoneda(
                              ejercicioActivo
                                .resumen
                                .totalPasivoCapital
                            )}
                          </span>

                        </div>

                      </CardContent>

                    </Card>

                  </div>

                  <EstadoContable
                    cuadra={
                      ejercicioActivo
                        .resumen.cuadra
                    }
                  />

                </div>
              )}

              {/* LIBRO DIARIO */}

              {tabActiva ===
                "diario" && (
                <Card>

                  <CardHeader>

                    <CardTitle>
                      Libro Diario
                    </CardTitle>

                    <CardDescription>
                      Partidas registradas durante el ejercicio fiscal.
                    </CardDescription>

                  </CardHeader>

                  <CardContent>

                    <div className="overflow-x-auto">

                      <table className="w-full min-w-[850px] text-sm">

                        <thead>

                          <tr className="border-b border-border text-left text-muted-foreground">

                            <th className="px-3 py-3">
                              N.º
                            </th>

                            <th className="px-3 py-3">
                              Fecha
                            </th>

                            <th className="px-3 py-3">
                              Concepto / Cuenta
                            </th>

                            <th className="px-3 py-3 text-right">
                              Debe
                            </th>

                            <th className="px-3 py-3 text-right">
                              Haber
                            </th>

                          </tr>

                        </thead>

                        <tbody>

{ejercicioActivo.libroDiario.map(
  (asiento) => (
    <Fragment key={asiento.id}>

      <tr className="border-b border-border bg-muted/20">

        <td className="px-3 py-3 font-medium">
          {asiento.numero}
        </td>

        <td className="px-3 py-3">
          {formatoFecha(asiento.fecha)}
        </td>

        <td
          colSpan={3}
          className="px-3 py-3 font-medium"
        >
          {asiento.concepto}
        </td>

      </tr>

      {asiento.lineas.map(
        (linea) => (
          <tr
            key={`${asiento.id}-${linea.numero}`}
            className="border-b border-border/50"
          >

            <td></td>

            <td></td>

            <td className="px-3 py-2">
              <span className="mr-2 text-muted-foreground">
                {linea.codigo}
              </span>

              {linea.nombre}
            </td>

            <td className="px-3 py-2 text-right tabular-nums">
              {linea.debe
                ? formatoMoneda(linea.debe)
                : "—"}
            </td>

            <td className="px-3 py-2 text-right tabular-nums">
              {linea.haber
                ? formatoMoneda(linea.haber)
                : "—"}
            </td>

          </tr>
        )
      )}

    </Fragment>
  )
)}

                        </tbody>

                        <tfoot>

                          <tr className="border-t-2 border-border font-bold">

                            <td
                              colSpan={
                                3
                              }
                              className="px-3 py-3 text-right"
                            >
                              Totales
                            </td>

                            <td className="px-3 py-3 text-right">
                              {formatoMoneda(
                                ejercicioActivo
                                  .resumen
                                  .totalDebe
                              )}
                            </td>

                            <td className="px-3 py-3 text-right">
                              {formatoMoneda(
                                ejercicioActivo
                                  .resumen
                                  .totalHaber
                              )}
                            </td>

                          </tr>

                        </tfoot>

                      </table>

                    </div>

                  </CardContent>

                </Card>
              )}

              {/* LIBRO MAYOR */}

              {tabActiva ===
                "mayor" && (
                <Card>

                  <CardHeader>

                    <CardTitle>
                      Libro Mayor
                    </CardTitle>

                    <CardDescription>
                      Saldos acumulados por cuenta durante el período.
                    </CardDescription>

                  </CardHeader>

                  <CardContent>

                    <div className="overflow-x-auto">

                      <table className="w-full min-w-[750px] text-sm">

                        <thead>

                          <tr className="border-b border-border text-left text-muted-foreground">

                            <th className="px-3 py-3">
                              Código
                            </th>

                            <th className="px-3 py-3">
                              Cuenta
                            </th>

                            <th className="px-3 py-3 text-right">
                              Debe
                            </th>

                            <th className="px-3 py-3 text-right">
                              Haber
                            </th>

                            <th className="px-3 py-3 text-right">
                              Saldo
                            </th>

                          </tr>

                        </thead>

                        <tbody>

                          {ejercicioActivo.libroMayor.map(
                            (linea) => (
                              <tr
                                key={
                                  linea
                                    .cuenta
                                    .codigo
                                }
                                className="border-b border-border/50"
                              >

                                <td className="px-3 py-3 font-medium text-primary">
                                  {
                                    linea
                                      .cuenta
                                      .codigo
                                  }
                                </td>

                                <td className="px-3 py-3">
                                  {
                                    linea
                                      .cuenta
                                      .nombre
                                  }
                                </td>

                                <td className="px-3 py-3 text-right">
                                  {formatoMoneda(
                                    linea.debe
                                  )}
                                </td>

                                <td className="px-3 py-3 text-right">
                                  {formatoMoneda(
                                    linea.haber
                                  )}
                                </td>

                                <td className="px-3 py-3 text-right font-medium">
                                  {formatoMoneda(
                                    Math.abs(
                                      linea.saldo
                                    )
                                  )}
                                </td>

                              </tr>
                            )
                          )}

                        </tbody>

                      </table>

                    </div>

                  </CardContent>

                </Card>
              )}

              {/* ESTADO DE RESULTADOS */}

              {tabActiva ===
                "resultados" && (
                <Card>

                  <CardHeader>

                    <CardTitle>
                      Estado de Resultados
                    </CardTitle>

                    <CardDescription>
                      Resultado económico obtenido durante el ejercicio fiscal.
                    </CardDescription>

                  </CardHeader>

                  <CardContent className="space-y-5">

                    <section>

                      <h3 className="mb-2 text-sm font-semibold">
                        Ventas
                      </h3>

                      <ListaReporte
                        items={
                          ejercicioActivo
                            .estadoResultados
                            .ventas
                        }
                      />

                      <FilaReporte
                        label="Ventas netas"
                        valor={
                          ejercicioActivo
                            .estadoResultados
                            .totalVentas ??
                          0
                        }
                        fuerte
                      />

                    </section>

                    <section>

                      <h3 className="mb-2 text-sm font-semibold">
                        Costo de venta
                      </h3>

                      <ListaReporte
                        items={
                          ejercicioActivo
                            .estadoResultados
                            .costoVentas
                        }
                      />

                      <FilaReporte
                        label="Total costo de venta"
                        valor={
                          ejercicioActivo
                            .estadoResultados
                            .totalCostoVentas ??
                          0
                        }
                        fuerte
                      />

                    </section>

                    <FilaReporte
                      label="Utilidad bruta"
                      valor={
                        ejercicioActivo
                          .estadoResultados
                          .utilidadBruta ??
                        0
                      }
                      fuerte
                    />

                    <section>

                      <h3 className="mb-2 text-sm font-semibold">
                        Gastos de operación
                      </h3>

                      <ListaReporte
                        items={
                          ejercicioActivo
                            .estadoResultados
                            .gastosOperacion
                        }
                      />

                      <FilaReporte
                        label="Total gastos de operación"
                        valor={
                          ejercicioActivo
                            .estadoResultados
                            .totalGastosOperacion ??
                          0
                        }
                      />

                    </section>

                    <div
                      className={`flex items-center justify-between rounded-lg border p-4 ${
                        (
                          ejercicioActivo
                            .estadoResultados
                            .utilidad ??
                          0
                        ) >= 0
                          ? "border-emerald-500/30 bg-emerald-500/10"
                          : "border-red-500/30 bg-red-500/10"
                      }`}
                    >

                      <span className="font-semibold">
                        {(
                          ejercicioActivo
                            .estadoResultados
                            .utilidad ??
                          0
                        ) >= 0
                          ? "Utilidad del ejercicio"
                          : "Pérdida del ejercicio"}
                      </span>

                      <span className="text-lg font-bold">
                        {formatoMoneda(
                          ejercicioActivo
                            .estadoResultados
                            .utilidad
                        )}
                      </span>

                    </div>

                  </CardContent>

                </Card>
              )}

              {/* BALANCE GENERAL */}

              {tabActiva ===
                "balance" && (
                <Card>

                  <CardHeader>

                    <CardTitle>
                      Balance General
                    </CardTitle>

                    <CardDescription>
                      Situación financiera correspondiente al período seleccionado.
                    </CardDescription>

                  </CardHeader>

                  <CardContent className="grid gap-8 md:grid-cols-2">

                    <div className="space-y-5">

                      <div>

                        <h3 className="mb-2 font-semibold">
                          Activo corriente
                        </h3>

                        <ListaReporte
                          items={
                            ejercicioActivo
                              .balanceGeneral
                              .activosCorrientes
                          }
                        />

                        <FilaReporte
                          label="Total activo corriente"
                          valor={
                            ejercicioActivo
                              .balanceGeneral
                              .totalActivoCorriente ??
                            0
                          }
                          fuerte
                        />

                      </div>

                      <div>

                        <h3 className="mb-2 font-semibold">
                          Activo no corriente
                        </h3>

                        <ListaReporte
                          items={
                            ejercicioActivo
                              .balanceGeneral
                              .activosNoCorrientes
                          }
                        />

                        <FilaReporte
                          label="Total activo no corriente"
                          valor={
                            ejercicioActivo
                              .balanceGeneral
                              .totalActivoNoCorriente ??
                            0
                          }
                          fuerte
                        />

                      </div>

                      <div className="rounded-lg border bg-muted/20 p-4">

                        <div className="flex justify-between font-bold">

                          <span>
                            Total Activo
                          </span>

                          <span>
                            {formatoMoneda(
                              ejercicioActivo
                                .balanceGeneral
                                .totalActivo
                            )}
                          </span>

                        </div>

                      </div>

                    </div>

                    <div className="space-y-5">

                      <div>

                        <h3 className="mb-2 font-semibold">
                          Pasivo corriente
                        </h3>

                        <ListaReporte
                          items={
                            ejercicioActivo
                              .balanceGeneral
                              .pasivosCorrientes
                          }
                        />

                        <FilaReporte
                          label="Total pasivo corriente"
                          valor={
                            ejercicioActivo
                              .balanceGeneral
                              .totalPasivoCorriente ??
                            0
                          }
                        />

                      </div>

                      <div>

                        <h3 className="mb-2 font-semibold">
                          Pasivo no corriente
                        </h3>

                        <ListaReporte
                          items={
                            ejercicioActivo
                              .balanceGeneral
                              .pasivosNoCorrientes
                          }
                        />

                        <FilaReporte
                          label="Total pasivo no corriente"
                          valor={
                            ejercicioActivo
                              .balanceGeneral
                              .totalPasivoNoCorriente ??
                            0
                          }
                        />

                      </div>

                      <div>

                        <h3 className="mb-2 font-semibold">
                          Capital contable
                        </h3>

                        <ListaReporte
                          items={
                            ejercicioActivo
                              .balanceGeneral
                              .capital
                          }
                        />

                        <FilaReporte
                          label="Total capital contable"
                          valor={
                            ejercicioActivo
                              .balanceGeneral
                              .totalCapitalContable ??
                            0
                          }
                          fuerte
                        />

                      </div>

                      <div className="rounded-lg border bg-muted/20 p-4">

                        <div className="flex justify-between font-bold">

                          <span>
                            Total Pasivo + Capital
                          </span>

                          <span>
                            {formatoMoneda(
                              ejercicioActivo
                                .balanceGeneral
                                .totalPasivoMasCapital
                            )}
                          </span>

                        </div>

                      </div>

                    </div>

                  </CardContent>

                </Card>
              )}

              {/* EXPORTACIONES */}

              <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-6">

                <Button
                  variant="outline"
                  onClick={() =>
                    exportarExcel(
                      ejercicioActivo
                        .ejercicio.anio
                    )
                  }
                >

                  <FileSpreadsheet className="size-4" />

                  Exportar a Excel
                </Button>

                <Button
                  onClick={() =>
                    exportarPdf(
                      ejercicioActivo
                        .ejercicio.anio
                    )
                  }
                >

                  <Download className="size-4" />

                  Generar reporte PDF
                </Button>

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  )
}