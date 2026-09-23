"use client"

import { useMemo, useState } from "react"

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
  Search,
  ShieldCheck,
  TrendingUp,
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

type EstadoEjercicio = "ABIERTO" | "CERRADO"

type TabActiva =
  | "resumen"
  | "diario"
  | "mayor"
  | "resultados"
  | "balance"

type Ejercicio = {
  id: number
  anio: number

  fechaInicio: string
  fechaFin: string

  estado: EstadoEjercicio

  fechaCierre?: string
  cerradoPor?: string
  observaciones?: string

  asientos: number
  cuentas: number

  totalDebe: number
  totalHaber: number

  utilidad: number

  totalActivo: number
  totalPasivoCapital: number
}

const EJERCICIOS_DEMO: Ejercicio[] = [
  {
    id: 1,
    anio: 2027,

    fechaInicio: "01/01/2027",
    fechaFin: "31/12/2027",

    estado: "ABIERTO",

    asientos: 14,
    cuentas: 19,

    totalDebe: 48750,
    totalHaber: 48750,

    utilidad: 7250,

    totalActivo: 38400,
    totalPasivoCapital: 38400,
  },

  {
    id: 2,
    anio: 2026,

    fechaInicio: "01/01/2026",
    fechaFin: "31/12/2026",

    estado: "CERRADO",

    fechaCierre:
      "31/12/2026 · 11:42 PM",

    cerradoPor: "Contador",

    observaciones:
      "Ejercicio cerrado correctamente. Todas las operaciones fueron verificadas antes del cierre.",

    asientos: 87,
    cuentas: 24,

    totalDebe: 128450,
    totalHaber: 128450,

    utilidad: 18920,

    totalActivo: 76300,
    totalPasivoCapital: 76300,
  },

  {
    id: 3,
    anio: 2025,

    fechaInicio: "01/01/2025",
    fechaFin: "31/12/2025",

    estado: "CERRADO",

    fechaCierre:
      "31/12/2025 · 10:15 PM",

    cerradoPor: "Contador",

    observaciones:
      "Cierre anual completado sin diferencias contables.",

    asientos: 71,
    cuentas: 21,

    totalDebe: 101300,
    totalHaber: 101300,

    utilidad: 14480,

    totalActivo: 68150,
    totalPasivoCapital: 68150,
  },
]

function formatoMoneda(
  valor: number
) {
  return new Intl.NumberFormat(
    "es-SV",
    {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }
  ).format(valor)
}

export default function ArchivoContablePage() {
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
  ] = useState<Ejercicio | null>(
    null
  )

  const [
    tabActiva,
    setTabActiva,
  ] = useState<TabActiva>(
    "resumen"
  )

  // ============================================================
  // FILTROS
  // ============================================================

  const ejerciciosFiltrados =
    useMemo(() => {
      return EJERCICIOS_DEMO.filter(
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
            `${ejercicio.anio} ${ejercicio.estado} ${ejercicio.cerradoPor ?? ""}`
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
      anioSeleccionado,
      estadoSeleccionado,
      busqueda,
    ])

  // ============================================================
  // INDICADORES GENERALES
  // ============================================================

  const totalEjercicios =
    EJERCICIOS_DEMO.length

  const ejerciciosCerrados =
    EJERCICIOS_DEMO.filter(
      (x) =>
        x.estado === "CERRADO"
    ).length

  const utilidadAcumulada =
    EJERCICIOS_DEMO.reduce(
      (total, ejercicio) =>
        total +
        ejercicio.utilidad,
      0
    )

  // ============================================================
  // ABRIR DETALLE
  // ============================================================

  function abrirEjercicio(
    ejercicio: Ejercicio
  ) {
    setEjercicioActivo(
      ejercicio
    )

    setTabActiva(
      "resumen"
    )
  }

  // ============================================================
  // EXPORTACIONES
  // TODAVÍA SON DEMOSTRACIÓN
  // ============================================================

  function exportarPdf(
    ejercicio: Ejercicio
  ) {
    alert(
      `Exportación PDF del ejercicio ${ejercicio.anio} pendiente de conectar con los datos reales.`
    )
  }

  function exportarExcel(
    ejercicio: Ejercicio
  ) {
    alert(
      `Exportación Excel del ejercicio ${ejercicio.anio} pendiente de conectar con los datos reales.`
    )
  }

  return (
    <div className="space-y-8">

      {/* ==================================================== */}
      {/* ENCABEZADO */}
      {/* ==================================================== */}

      <header className="space-y-2">

        <p className="text-sm font-medium text-primary">
          Consulta histórica
        </p>

        <div className="flex flex-wrap items-start justify-between gap-4">

          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Archivo Contable
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Consulta ejercicios
              contables anteriores,
              revisa sus estados
              financieros y exporta
              información histórica
              en PDF o Excel.
            </p>
          </div>

          <Badge
            variant="muted"
            className="gap-2 px-3 py-1.5"
          >
            <Archive className="size-4" />

            Historial financiero
          </Badge>

        </div>

      </header>

      {/* ==================================================== */}
      {/* RESUMEN GENERAL */}
      {/* ==================================================== */}

      <section className="grid gap-4 md:grid-cols-3">

        <Card>
          <CardContent className="p-5">

            <div className="flex items-center justify-between">

              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Ejercicios registrados
              </span>

              <Archive className="size-4 text-primary" />

            </div>

            <p className="mt-3 text-2xl font-bold">
              {totalEjercicios}
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Períodos disponibles
            </p>

          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">

            <div className="flex items-center justify-between">

              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Ejercicios cerrados
              </span>

              <ShieldCheck className="size-4 text-emerald-500" />

            </div>

            <p className="mt-3 text-2xl font-bold">
              {ejerciciosCerrados}
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Bloqueados para edición
            </p>

          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">

            <div className="flex items-center justify-between">

              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Utilidad acumulada
              </span>

              <TrendingUp className="size-4 text-primary" />

            </div>

            <p className="mt-3 text-2xl font-bold">
              {formatoMoneda(
                utilidadAcumulada
              )}
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Todos los ejercicios
            </p>

          </CardContent>
        </Card>

      </section>

      {/* ==================================================== */}
      {/* FILTROS */}
      {/* ==================================================== */}

      <Card>

        <CardHeader>
          <CardTitle>
            Buscar ejercicios
          </CardTitle>

          <CardDescription>
            Filtra el archivo por
            año, estado o búsqueda.
          </CardDescription>
        </CardHeader>

        <CardContent>

          <div className="grid gap-4 md:grid-cols-[1fr_190px_190px]">

            {/* BUSCADOR */}

            <div className="relative">

              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

              <input
                value={busqueda}
                onChange={(e) =>
                  setBusqueda(
                    e.target.value
                  )
                }
                placeholder="Buscar por año, estado o usuario..."
                className="h-10 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />

            </div>

            {/* AÑO */}

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
                className="h-10 w-full appearance-none rounded-lg border border-input bg-background pl-10 pr-9 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="TODOS">
                  Todos los años
                </option>

                {EJERCICIOS_DEMO.map(
                  (ejercicio) => (
                    <option
                      key={
                        ejercicio.anio
                      }
                      value={
                        ejercicio.anio
                      }
                    >
                      {
                        ejercicio.anio
                      }
                    </option>
                  )
                )}

              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            </div>

            {/* ESTADO */}

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
                className="h-10 w-full appearance-none rounded-lg border border-input bg-background pl-10 pr-9 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="TODOS">
                  Todos los estados
                </option>

                <option value="ABIERTO">
                  Abierto
                </option>

                <option value="CERRADO">
                  Cerrado
                </option>

              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            </div>

          </div>

        </CardContent>

      </Card>

      {/* ==================================================== */}
      {/* LISTADO */}
      {/* ==================================================== */}

      <section className="space-y-4">

        <div>
          <h2 className="text-lg font-semibold">
            Ejercicios contables
          </h2>

          <p className="text-sm text-muted-foreground">
            {
              ejerciciosFiltrados.length
            }{" "}
            resultado(s)
          </p>
        </div>

        {ejerciciosFiltrados.map(
          (ejercicio) => {
            const cuadrado =
              Math.abs(
                ejercicio.totalDebe -
                  ejercicio.totalHaber
              ) < 0.01

            return (
              <Card
                key={
                  ejercicio.id
                }
                className="overflow-hidden"
              >

                <CardContent className="p-0">

                  <div className="grid gap-6 p-6 lg:grid-cols-[1fr_210px]">

                    {/* INFORMACIÓN */}

                    <div className="space-y-5">

                      <div className="flex flex-wrap items-start gap-3">

                        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">

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

                            <Badge
                              variant={
                                ejercicio.estado ===
                                "CERRADO"
                                  ? "muted"
                                  : "deudora"
                              }
                            >
                              {
                                ejercicio.estado
                              }
                            </Badge>

                          </div>

                          <p className="mt-1 text-sm text-muted-foreground">
                            {
                              ejercicio.fechaInicio
                            }{" "}
                            —{" "}
                            {
                              ejercicio.fechaFin
                            }
                          </p>

                        </div>

                      </div>

                      {/* MÉTRICAS */}

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
                            Cuentas
                          </p>

                          <p className="mt-1 text-lg font-semibold">
                            {
                              ejercicio.cuentas
                            }
                          </p>
                        </div>

                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Movimiento
                          </p>

                          <p className="mt-1 text-lg font-semibold">
                            {formatoMoneda(
                              ejercicio.totalDebe
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Resultado
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

                      {/* PARTIDA DOBLE */}

                      <div
                        className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
                          cuadrado
                            ? "border-emerald-500/30 bg-emerald-500/10"
                            : "border-red-500/30 bg-red-500/10"
                        }`}
                      >

                        <CheckCircle2
                          className={`size-5 ${
                            cuadrado
                              ? "text-emerald-500"
                              : "text-red-500"
                          }`}
                        />

                        <span className="font-medium">
                          {cuadrado
                            ? "Partida doble verificada · Debe = Haber"
                            : "El ejercicio presenta diferencias contables"}
                        </span>

                      </div>

                      {/* CIERRE */}

                      {ejercicio.estado ===
                        "CERRADO" && (
                        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">

                          <p>
                            <span className="font-medium text-foreground">
                              Cerrado:
                            </span>{" "}
                            {
                              ejercicio.fechaCierre
                            }
                          </p>

                          <p>
                            <span className="font-medium text-foreground">
                              Responsable:
                            </span>{" "}
                            {
                              ejercicio.cerradoPor
                            }
                          </p>

                        </div>
                      )}

                    </div>

                    {/* BOTONES */}

                    <div className="flex flex-wrap items-start gap-2 lg:flex-col">

                      <Button
                        type="button"
                        className="w-full"
                        onClick={() =>
                          abrirEjercicio(
                            ejercicio
                          )
                        }
                      >
                        <Eye className="size-4" />

                        Ver ejercicio
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() =>
                          exportarPdf(
                            ejercicio
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
                            ejercicio
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
          }
        )}

        {ejerciciosFiltrados.length ===
          0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-14 text-center">

              <Archive className="size-10 text-muted-foreground/40" />

              <h3 className="mt-4 font-semibold">
                No se encontraron ejercicios
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Modifica los filtros
                para mostrar otros
                resultados.
              </p>

            </CardContent>
          </Card>
        )}

      </section>

      {/* ==================================================== */}
      {/* MODAL */}
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
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* HEADER */}

            <div className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-4 border-b border-border bg-card p-6">

              <div>

                <div className="flex items-center gap-2">

                  <h2 className="text-xl font-bold">
                    Ejercicio{" "}
                    {
                      ejercicioActivo.anio
                    }
                  </h2>

                  <Badge
                    variant={
                      ejercicioActivo.estado ===
                      "ABIERTO"
                        ? "deudora"
                        : "muted"
                    }
                  >
                    {
                      ejercicioActivo.estado
                    }
                  </Badge>

                </div>

                <p className="mt-1 text-sm text-muted-foreground">
                  {
                    ejercicioActivo.fechaInicio
                  }{" "}
                  —{" "}
                  {
                    ejercicioActivo.fechaFin
                  }
                </p>

              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setEjercicioActivo(
                    null
                  )
                }
              >
                Cerrar
              </Button>

            </div>

            {/* CONTENIDO */}

            <div className="space-y-6 p-6">

              {/* ================================================= */}
              {/* TABS */}
              {/* ================================================= */}

              <div className="flex flex-wrap gap-2">

                <button
                  type="button"
                  onClick={() =>
                    setTabActiva(
                      "resumen"
                    )
                  }
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    tabActiva ===
                    "resumen"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  Resumen
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setTabActiva(
                      "diario"
                    )
                  }
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    tabActiva ===
                    "diario"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  Libro Diario
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setTabActiva(
                      "mayor"
                    )
                  }
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    tabActiva ===
                    "mayor"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  Libro Mayor
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setTabActiva(
                      "resultados"
                    )
                  }
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    tabActiva ===
                    "resultados"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  Estado de Resultados
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setTabActiva(
                      "balance"
                    )
                  }
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    tabActiva ===
                    "balance"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  Balance General
                </button>

              </div>

              {/* ================================================= */}
              {/* RESUMEN */}
              {/* ================================================= */}

              {tabActiva ===
                "resumen" && (
                <div className="space-y-6">

                  <div className="grid gap-4 md:grid-cols-2">

                    <Card>
                      <CardHeader>
                        <CardTitle>
                          Resumen del ejercicio
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="space-y-3 text-sm">

                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Asientos registrados
                          </span>

                          <span className="font-medium">
                            {
                              ejercicioActivo.asientos
                            }
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Cuentas con movimiento
                          </span>

                          <span className="font-medium">
                            {
                              ejercicioActivo.cuentas
                            }
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Total Debe
                          </span>

                          <span className="font-medium">
                            {formatoMoneda(
                              ejercicioActivo.totalDebe
                            )}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Total Haber
                          </span>

                          <span className="font-medium">
                            {formatoMoneda(
                              ejercicioActivo.totalHaber
                            )}
                          </span>
                        </div>

                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>
                          Resultado financiero
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="space-y-3 text-sm">

                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Utilidad del ejercicio
                          </span>

                          <span className="font-semibold text-emerald-500">
                            {formatoMoneda(
                              ejercicioActivo.utilidad
                            )}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Total activo
                          </span>

                          <span className="font-medium">
                            {formatoMoneda(
                              ejercicioActivo.totalActivo
                            )}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Pasivo + Capital
                          </span>

                          <span className="font-medium">
                            {formatoMoneda(
                              ejercicioActivo.totalPasivoCapital
                            )}
                          </span>
                        </div>

                      </CardContent>
                    </Card>

                  </div>

                  {ejercicioActivo.observaciones && (
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          Observaciones del cierre
                        </CardTitle>
                      </CardHeader>

                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {
                            ejercicioActivo.observaciones
                          }
                        </p>
                      </CardContent>
                    </Card>
                  )}

                </div>
              )}

              {/* ================================================= */}
              {/* LIBRO DIARIO */}
              {/* ================================================= */}

              {tabActiva ===
                "diario" && (
                <Card>

                  <CardHeader>
                    <CardTitle>
                      Libro Diario
                    </CardTitle>

                    <CardDescription>
                      Asientos registrados
                      durante el ejercicio{" "}
                      {
                        ejercicioActivo.anio
                      }.
                    </CardDescription>
                  </CardHeader>

                  <CardContent>

                    <div className="overflow-x-auto">

                      <table className="w-full text-sm">

                        <thead>

                          <tr className="border-b border-border text-left text-muted-foreground">

                            <th className="px-3 py-3">
                              N°
                            </th>

                            <th className="px-3 py-3">
                              Fecha
                            </th>

                            <th className="px-3 py-3">
                              Concepto
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

                          <tr className="border-b border-border/60">

                            <td className="px-3 py-4">
                              1
                            </td>

                            <td className="px-3 py-4">
                              02/01/
                              {
                                ejercicioActivo.anio
                              }
                            </td>

                            <td className="px-3 py-4">
                              Asiento inicial del ejercicio
                            </td>

                            <td className="px-3 py-4 text-right">
                              {formatoMoneda(
                                5000
                              )}
                            </td>

                            <td className="px-3 py-4 text-right">
                              {formatoMoneda(
                                5000
                              )}
                            </td>

                          </tr>

                          <tr className="border-b border-border/60">

                            <td className="px-3 py-4">
                              2
                            </td>

                            <td className="px-3 py-4">
                              05/01/
                              {
                                ejercicioActivo.anio
                              }
                            </td>

                            <td className="px-3 py-4">
                              Compra de mercadería
                            </td>

                            <td className="px-3 py-4 text-right">
                              {formatoMoneda(
                                3200
                              )}
                            </td>

                            <td className="px-3 py-4 text-right">
                              {formatoMoneda(
                                3200
                              )}
                            </td>

                          </tr>

                        </tbody>

                      </table>

                    </div>

                    <p className="mt-5 rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                      Vista de demostración. Al conectar
                      Archivo Contable con PostgreSQL,
                      aquí aparecerán todos los asientos
                      reales del ejercicio seleccionado.
                    </p>

                  </CardContent>

                </Card>
              )}

              {/* ================================================= */}
              {/* LIBRO MAYOR */}
              {/* ================================================= */}

              {tabActiva ===
                "mayor" && (
                <Card>

                  <CardHeader>
                    <CardTitle>
                      Libro Mayor
                    </CardTitle>

                    <CardDescription>
                      Saldos acumulados de
                      las cuentas del ejercicio{" "}
                      {
                        ejercicioActivo.anio
                      }.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">

                    <div className="grid gap-4 md:grid-cols-2">

                      <div className="rounded-lg border border-border p-4">

                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          1101 · Caja general
                        </p>

                        <p className="mt-2 text-xl font-semibold">
                          {formatoMoneda(
                            12500
                          )}
                        </p>

                        <Badge
                          variant="deudora"
                          className="mt-2"
                        >
                          Deudora
                        </Badge>

                      </div>

                      <div className="rounded-lg border border-border p-4">

                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          3101 · Capital social
                        </p>

                        <p className="mt-2 text-xl font-semibold">
                          {formatoMoneda(
                            12500
                          )}
                        </p>

                        <Badge
                          variant="acreedora"
                          className="mt-2"
                        >
                          Acreedora
                        </Badge>

                      </div>

                    </div>

                    <p className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                      Vista de demostración.
                      Después se mostrarán todas
                      las cuentas reales y sus
                      movimientos históricos.
                    </p>

                  </CardContent>

                </Card>
              )}

              {/* ================================================= */}
              {/* ESTADO DE RESULTADOS */}
              {/* ================================================= */}

              {tabActiva ===
                "resultados" && (
                <Card>

                  <CardHeader>
                    <CardTitle>
                      Estado de Resultados
                    </CardTitle>

                    <CardDescription>
                      Resultado económico
                      correspondiente al ejercicio{" "}
                      {
                        ejercicioActivo.anio
                      }.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">

                    <div className="flex justify-between border-b border-border pb-3">

                      <span>
                        Ventas netas
                      </span>

                      <span className="font-medium">
                        {formatoMoneda(
                          ejercicioActivo.utilidad +
                            25000
                        )}
                      </span>

                    </div>

                    <div className="flex justify-between border-b border-border pb-3">

                      <span>
                        Costos y gastos
                      </span>

                      <span className="font-medium">
                        {formatoMoneda(
                          25000
                        )}
                      </span>

                    </div>

                    <div className="flex justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">

                      <span className="font-semibold">
                        Utilidad del ejercicio
                      </span>

                      <span className="font-bold text-emerald-500">
                        {formatoMoneda(
                          ejercicioActivo.utilidad
                        )}
                      </span>

                    </div>

                    <p className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                      Vista de demostración.
                      Posteriormente se mostrará
                      el Estado de Resultados
                      histórico completo.
                    </p>

                  </CardContent>

                </Card>
              )}

              {/* ================================================= */}
              {/* BALANCE GENERAL */}
              {/* ================================================= */}

              {tabActiva ===
                "balance" && (
                <Card>

                  <CardHeader>
                    <CardTitle>
                      Balance General
                    </CardTitle>

                    <CardDescription>
                      Situación financiera
                      al cierre del ejercicio{" "}
                      {
                        ejercicioActivo.anio
                      }.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="grid gap-5 md:grid-cols-2">

                    <div className="rounded-lg border border-border p-5">

                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Total Activo
                      </p>

                      <p className="mt-2 text-2xl font-bold">
                        {formatoMoneda(
                          ejercicioActivo.totalActivo
                        )}
                      </p>

                    </div>

                    <div className="rounded-lg border border-border p-5">

                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Pasivo + Capital
                      </p>

                      <p className="mt-2 text-2xl font-bold">
                        {formatoMoneda(
                          ejercicioActivo.totalPasivoCapital
                        )}
                      </p>

                    </div>

                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 md:col-span-2">

                      <div className="flex flex-wrap items-center justify-between gap-4">

                        <div className="flex items-center gap-3">

                          <CheckCircle2 className="size-5 text-emerald-500" />

                          <span className="font-semibold">
                            Ecuación contable balanceada
                          </span>

                        </div>

                        <span className="font-bold">
                          {formatoMoneda(
                            ejercicioActivo.totalActivo
                          )}
                          {" = "}
                          {formatoMoneda(
                            ejercicioActivo.totalPasivoCapital
                          )}
                        </span>

                      </div>

                    </div>

                    <p className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground md:col-span-2">
                      Vista de demostración.
                      Luego se mostrarán Activo
                      corriente, Activo no corriente,
                      Pasivo corriente,
                      Pasivo no corriente y
                      Capital Contable reales.
                    </p>

                  </CardContent>

                </Card>
              )}

              {/* ================================================= */}
              {/* EXPORTACIONES */}
              {/* ================================================= */}

              <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-6">

                <Button
                  variant="outline"
                  onClick={() =>
                    exportarExcel(
                      ejercicioActivo
                    )
                  }
                >
                  <FileSpreadsheet className="size-4" />

                  Excel editable
                </Button>

                <Button
                  onClick={() =>
                    exportarPdf(
                      ejercicioActivo
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