"use client"

import { useMemo, useState } from "react"
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Layers,
  Pencil,
  Plus,
  PowerOff,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import {
  Input,
  Label,
  Select,
} from "@/components/ui/field"

import { useContabilidad } from "@/components/contabilidad-provider"

import {
  RUBROS_CONTABLES,
  sugerirSiguienteCodigo,
} from "@/lib/catalogo"

import {
  ETIQUETA_TIPO,
  grupoPorDigito,
  type Cuenta,
  type Naturaleza,
  type TipoCuenta,
} from "@/lib/types"

const NATURALEZA_DEFAULT: Record<
  TipoCuenta,
  Naturaleza
> = {
  activo: "deudora",
  pasivo: "acreedora",
  capital: "acreedora",
  gasto: "deudora",
  ingreso: "acreedora",
}

const ORDEN_GRUPOS: TipoCuenta[] = [
  "activo",
  "pasivo",
  "capital",
  "gasto",
  "ingreso",
]

function normalizar(
  texto: string
): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .trim()
}

export default function CatalogoPage() {
  const {
    cuentas,
    asientos,
    agregarCuenta,
    renombrarCuenta,
    eliminarCuenta,
    desactivarCuenta,
    cuentaEnUso,
    reactivarCuenta,
    cargando,
  } = useContabilidad()

  // ============================================================
  // FILTROS
  // ============================================================

  const [
    busqueda,
    setBusqueda,
  ] = useState("")

  const [
    grupoFiltro,
    setGrupoFiltro,
  ] = useState<
    "todos" | TipoCuenta
  >("todos")

  const [
    filtroEstado,
    setFiltroEstado,
  ] = useState<
    "todas" |
    "activas" |
    "inactivas"
  >("todas")

  // ============================================================
  // MODALES
  // ============================================================

  const [
    modalNuevoAbierto,
    setModalNuevoAbierto,
  ] = useState(false)

  const [
    cuentaEditando,
    setCuentaEditando,
  ] =
    useState<Cuenta | null>(
      null
    )

  const [
    cuentaDesactivando,
    setCuentaDesactivando,
  ] =
    useState<Cuenta | null>(
      null
    )

  const [
    cuentaEliminando,
    setCuentaEliminando,
  ] =
    useState<Cuenta | null>(
      null
    )

  // ============================================================
  // NUEVA CUENTA
  // ============================================================

  const [
    nuevoRubro,
    setNuevoRubro,
  ] = useState("11")

  const [
    nuevoCodigo,
    setNuevoCodigo,
  ] = useState("")

  const [
    nuevoNombre,
    setNuevoNombre,
  ] = useState("")

  const [
    nuevaNaturaleza,
    setNuevaNaturaleza,
  ] =
    useState<Naturaleza>(
      "deudora"
    )

  const [
    nuevoPermiteMovimiento,
    setNuevoPermiteMovimiento,
  ] = useState(true)

  const [
    formError,
    setFormError,
  ] = useState("")

  // ============================================================
  // EDICIÓN
  // ============================================================

  const [
    editCodigo,
    setEditCodigo,
  ] = useState("")

  const [
    editNombre,
    setEditNombre,
  ] = useState("")

  const [
    editError,
    setEditError,
  ] = useState("")

  // ============================================================
  // TOAST
  // ============================================================

  const [
    toastMensaje,
    setToastMensaje,
  ] =
    useState<string | null>(
      null
    )

  const mostrarToast = (
    mensaje: string
  ) => {
    setToastMensaje(
      mensaje
    )

    setTimeout(
      () =>
        setToastMensaje(
          null
        ),
      3500
    )
  }

  // ============================================================
  // MOVIMIENTOS POR CUENTA
  // ============================================================

  const conteoMovimientos =
    useMemo(() => {
      const mapa: Record<
        string,
        number
      > = {}

      for (
        const asiento
        of asientos
      ) {
        if (
          asiento.estado ===
          "ANULADO"
        ) {
          continue
        }

        for (
          const linea
          of asiento.lineas
        ) {
          mapa[
            linea.codigo
          ] =
            (
              mapa[
                linea.codigo
              ] || 0
            ) + 1
        }
      }

      return mapa
    }, [asientos])

  // ============================================================
  // ESTADÍSTICAS
  // ============================================================

  const estadisticas =
    useMemo(() => {
      const total = cuentas.length
      const activas = cuentas.filter((cuenta) => cuenta.activa).length
      const inactivas = total - activas
      const enUso = cuentas.filter((cuenta) => cuentaEnUso(cuenta.codigo)).length

      const porGrupo: Record<
        TipoCuenta,
        {
          total: number
          activas: number
          enUso: number
        }
      > = {
        activo: { total: 0, activas: 0, enUso: 0 },
        pasivo: { total: 0, activas: 0, enUso: 0 },
        capital: { total: 0, activas: 0, enUso: 0 },
        gasto: { total: 0, activas: 0, enUso: 0 },
        ingreso: { total: 0, activas: 0, enUso: 0 },
      }

      for (const cuenta of cuentas) {
        const grupo = porGrupo[cuenta.tipo]
        if (!grupo) continue
        grupo.total++
        if (cuenta.activa) grupo.activas++
        if (cuentaEnUso(cuenta.codigo)) grupo.enUso++
      }

      return { total, activas, inactivas, enUso, porGrupo }
    }, [cuentas, asientos])

  // ============================================================
  // FILTRADO
  // ============================================================

  const cuentasFiltradas =
    useMemo(() => {
      const consulta =
        normalizar(
          busqueda
        )

      const terminos =
        consulta
          .split(/\s+/)
          .filter(Boolean)

      return cuentas.filter(
        (cuenta) => {
          if (
            terminos.length >
            0
          ) {
            const codigo =
              normalizar(
                cuenta.codigo
              )

            const nombre =
              normalizar(
                cuenta.nombre
              )

            const coincide =
              terminos.every(
                (termino) =>
                  codigo.includes(
                    termino
                  ) ||
                  nombre.includes(
                    termino
                  )
              )

            if (
              !coincide
            ) {
              return false
            }
          }

          if (
            grupoFiltro !==
              "todos" &&
            cuenta.tipo !==
              grupoFiltro
          ) {
            return false
          }

          if (
            filtroEstado ===
              "activas" &&
            !cuenta.activa
          ) {
            return false
          }

          if (
            filtroEstado ===
              "inactivas" &&
            cuenta.activa
          ) {
            return false
          }

          return true
        }
      )
    }, [
      cuentas,
      busqueda,
      grupoFiltro,
      filtroEstado,
    ])

  // ============================================================
  // ESTRUCTURA JERÁRQUICA
  // ============================================================

  const estructuraJerarquica =
    useMemo(() => {
      return ORDEN_GRUPOS
        .map((tipo) => {
          const cuentasDelTipo =
            cuentasFiltradas.filter(
              (cuenta) =>
                cuenta.tipo ===
                tipo
            )

          const rubrosDelTipo =
            RUBROS_CONTABLES.filter(
              (rubro) =>
                rubro.grupo ===
                tipo
            )

          const rubrosConCuentas =
            rubrosDelTipo.map(
              (rubro) => {
                const cuentasDelRubro =
                  cuentasDelTipo
                    .filter(
                      (
                        cuenta
                      ) =>
                        cuenta.codigo.startsWith(
                          rubro.codigo
                        )
                    )
                    .sort(
                      (
                        a,
                        b
                      ) =>
                        a.codigo.localeCompare(
                          b.codigo
                        )
                    )

                return {
                  ...rubro,
                  cuentas:
                    cuentasDelRubro,
                }
              }
            )

          const codigosRubros =
            rubrosDelTipo.map(
              (rubro) =>
                rubro.codigo
            )

          const cuentasOtras =
            cuentasDelTipo
              .filter(
                (cuenta) =>
                  !codigosRubros.some(
                    (
                      codigoRubro
                    ) =>
                      cuenta.codigo.startsWith(
                        codigoRubro
                      )
                  )
              )
              .sort(
                (a, b) =>
                  a.codigo.localeCompare(
                    b.codigo
                  )
              )

          const digito =
            tipo === "activo"
              ? "1"
              : tipo ===
                  "pasivo"
                ? "2"
                : tipo ===
                    "capital"
                  ? "3"
                  : tipo ===
                      "gasto"
                    ? "4"
                    : "5"

          return {
            tipo,

            nombreGrupo:
              ETIQUETA_TIPO[
                tipo
              ],

            digito,

            totalCuentas:
              cuentasDelTipo.length,

            rubros:
              rubrosConCuentas.filter(
                (rubro) =>
                  rubro.cuentas
                    .length >
                    0 ||
                  (
                    grupoFiltro ===
                      tipo &&
                    !busqueda
                  )
              ),

            cuentasOtras,
          }
        })
        .filter(
          (grupo) =>
            grupo.totalCuentas >
              0 ||
            (
              grupoFiltro ===
                grupo.tipo &&
              !busqueda
            )
        )
    }, [
      cuentasFiltradas,
      grupoFiltro,
      busqueda,
    ])

  // ============================================================
  // NUEVA CUENTA
  // ============================================================

  const abrirModalNuevaCuenta =
    (
      rubroInicial =
        "11"
    ) => {
      setNuevoRubro(
        rubroInicial
      )

      const sugerencia =
        sugerirSiguienteCodigo(
          rubroInicial,
          cuentas
        )

      setNuevoCodigo(
        sugerencia
      )

      setNuevoNombre("")

      const grupo =
        RUBROS_CONTABLES.find(
          (rubro) =>
            rubro.codigo ===
            rubroInicial
        )?.grupo ??
        "activo"

      setNuevaNaturaleza(
        NATURALEZA_DEFAULT[
          grupo
        ]
      )

      setNuevoPermiteMovimiento(
        true
      )

      setFormError("")

      setModalNuevoAbierto(
        true
      )
    }

  const manejarCambioRubro =
    (
      codigoRubro: string
    ) => {
      setNuevoRubro(
        codigoRubro
      )

      const sugerencia =
        sugerirSiguienteCodigo(
          codigoRubro,
          cuentas
        )

      setNuevoCodigo(
        sugerencia
      )

      const grupo =
        RUBROS_CONTABLES.find(
          (rubro) =>
            rubro.codigo ===
            codigoRubro
        )?.grupo ??
        "activo"

      setNuevaNaturaleza(
        NATURALEZA_DEFAULT[
          grupo
        ]
      )
    }

  const guardarNuevaCuenta =
    async () => {
      setFormError("")

      const codigo =
        nuevoCodigo.trim()

      const nombre =
        nuevoNombre.trim()

      if (
        !/^\d{3,}$/.test(
          codigo
        )
      ) {
        setFormError(
          "El código debe contener al menos 3 dígitos numéricos."
        )

        return
      }

      const tipo =
        grupoPorDigito(
          codigo
        )

      if (!tipo) {
        setFormError(
          "El primer dígito debe ser 1 (Activo), 2 (Pasivo), 3 (Capital), 4 (Gastos) o 5 (Ingresos)."
        )

        return
      }

      if (!nombre) {
        setFormError(
          "El nombre oficial de la cuenta es obligatorio."
        )

        return
      }

      if (
        cuentas.some(
          (cuenta) =>
            cuenta.codigo ===
            codigo
        )
      ) {
        setFormError(
          `El código ${codigo} ya está registrado en el catálogo.`
        )

        return
      }

      if (
        cuentas.some(
          (cuenta) =>
            normalizar(
              cuenta.nombre
            ) ===
            normalizar(
              nombre
            )
        )
      ) {
        setFormError(
          `Ya existe una cuenta registrada con el nombre "${nombre}".`
        )

        return
      }

      await agregarCuenta({
        codigo,
        nombre,
        tipo,
        naturaleza:
          nuevaNaturaleza,

        permite_movimiento:
          nuevoPermiteMovimiento,

        activa: true,
      })

      setModalNuevoAbierto(
        false
      )

      mostrarToast(
        `Cuenta ${codigo} — ${nombre} agregada exitosamente.`
      )
    }

  // ============================================================
  // EDITAR CUENTA
  // ============================================================

  const guardarEdicion =
    async () => {
      if (
        !cuentaEditando
      ) {
        return
      }

      setEditError("")

      const codigo =
        editCodigo.trim()

      const nombre =
        editNombre.trim()

      if (
        cuentaEnUso(
          cuentaEditando.codigo
        )
      ) {
        setEditError(
          "No se puede modificar esta cuenta porque ya posee movimientos contables registrados."
        )

        return
      }

      if (
        !/^\d{3,}$/.test(
          codigo
        )
      ) {
        setEditError(
          "El código debe contener al menos 3 dígitos numéricos."
        )

        return
      }

      const tipo =
        grupoPorDigito(
          codigo
        )

      if (!tipo) {
        setEditError(
          "El primer dígito debe ser 1 (Activo), 2 (Pasivo), 3 (Capital), 4 (Gastos) o 5 (Ingresos)."
        )

        return
      }

      if (!nombre) {
        setEditError(
          "El nombre de la cuenta no puede estar vacío."
        )

        return
      }

      if (
        cuentas.some(
          (cuenta) =>
            cuenta.codigo ===
              codigo &&
            cuenta.codigo !==
              cuentaEditando.codigo
        )
      ) {
        setEditError(
          `El código ${codigo} ya está registrado en el catálogo.`
        )

        return
      }

      if (
        cuentas.some(
          (cuenta) =>
            cuenta.codigo !==
              cuentaEditando.codigo &&
            normalizar(
              cuenta.nombre
            ) ===
              normalizar(
                nombre
              )
        )
      ) {
        setEditError(
          `Ya existe una cuenta registrada con el nombre "${nombre}".`
        )

        return
      }

      const resultado =
        await renombrarCuenta(
          cuentaEditando.codigo,
          codigo,
          nombre
        )

      if (
        !resultado.success
      ) {
        setEditError(
          resultado.error ??
            "No se pudo modificar la cuenta."
        )

        return
      }

      setCuentaEditando(
        null
      )

      mostrarToast(
        `Cuenta ${codigo} — ${nombre} actualizada correctamente.`
      )
    }

  // ============================================================
  // ELIMINAR
  // ============================================================

  const confirmarDesactivacion =
    async () => {
      if (!cuentaDesactivando) return

      const codigo = cuentaDesactivando.codigo
      const resultado = await desactivarCuenta(codigo)

      if (!resultado.success) {
        setCuentaDesactivando(null)
        mostrarToast(
          resultado.error ??
            `No se pudo desactivar la cuenta ${codigo}.`
        )
        return
      }

      setCuentaDesactivando(null)
      mostrarToast(`Cuenta ${codigo} desactivada correctamente.`)
    }

  const confirmarEliminacion =
    async () => {
      if (!cuentaEliminando) return

      const codigo = cuentaEliminando.codigo
      const resultado = await eliminarCuenta(codigo)

      if (!resultado.success) {
        setCuentaEliminando(null)
        mostrarToast(
          resultado.error ??
            `No se pudo eliminar la cuenta ${codigo}.`
        )
        return
      }

      setCuentaEliminando(null)
      mostrarToast(`Cuenta ${codigo} eliminada definitivamente.`)
    }

  // ============================================================
  // FILA DE CUENTA
  // ============================================================

  const renderFilaCuenta =
    (cuenta: Cuenta) => {
      const movimientos = conteoMovimientos[cuenta.codigo] || 0
      const protegida = cuentaEnUso(cuenta.codigo)
      const esSubcuenta = cuenta.codigo.length > 4

      return (
        <div
          key={cuenta.codigo}
          className={`flex flex-col gap-2 p-3 transition-colors hover:bg-muted/25 sm:flex-row sm:items-center sm:justify-between ${
            !cuenta.activa ? "bg-muted/15 opacity-75" : ""
          }`}
        >
          <div className="flex items-start gap-3 sm:items-center">
            <span
              className={`font-mono text-sm font-semibold ${
                esSubcuenta ? "pl-5 text-muted-foreground" : "text-primary"
              }`}
            >
              {cuenta.codigo}
            </span>

            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`text-sm ${
                    cuenta.activa
                      ? "font-medium text-foreground"
                      : "text-muted-foreground line-through"
                  }`}
                >
                  {cuenta.nombre}
                </span>

                {cuenta.codigo === "1104" && (
                  <span className="inline-flex items-center rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                    Inventario Inicial
                  </span>
                )}

                {!cuenta.activa && (
                  <Badge
                    variant="muted"
                    className="border-amber-500/20 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
                  >
                    Inactiva
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-2.5 border-t border-border/40 pt-1 sm:justify-end sm:border-0 sm:pt-0">
            <div className="flex items-center gap-1.5">
              <Badge
                variant={cuenta.naturaleza === "deudora" ? "deudora" : "acreedora"}
                className="px-2 py-0 font-mono text-[11px] capitalize"
              >
                {cuenta.naturaleza}
              </Badge>

              <span
                title={`${movimientos} movimientos del ejercicio seleccionado`}
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[11px] ${
                  movimientos > 0
                    ? "bg-muted font-medium text-foreground"
                    : "bg-muted/40 text-muted-foreground"
                }`}
              >
                {movimientos > 0 ? `${movimientos} part.` : "Sin uso"}
              </span>

              {protegida && (
                <span
                  title="Esta cuenta posee movimientos y está protegida contra edición, desactivación y eliminación."
                  className="inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  <ShieldCheck className="size-3" />
                  Protegida
                </span>
              )}
            </div>

            {!protegida && (
              <div className="flex items-center gap-1">
                {cuenta.activa ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Editar ${cuenta.nombre}`}
                      title="Modificar código y nombre"
                      onClick={() => {
                        setCuentaEditando(cuenta)
                        setEditCodigo(cuenta.codigo)
                        setEditNombre(cuenta.nombre)
                        setEditError("")
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Desactivar ${cuenta.nombre}`}
                      title="Desactivar cuenta"
                      className="text-amber-500 hover:bg-amber-500/10 hover:text-amber-500"
                      onClick={() => setCuentaDesactivando(cuenta)}
                    >
                      <PowerOff className="size-3.5" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Eliminar ${cuenta.nombre}`}
                      title="Eliminar definitivamente"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setCuentaEliminando(cuenta)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Reactivar ${cuenta.nombre}`}
                      title="Reactivar cuenta"
                      className="text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                      onClick={async () => {
                        await reactivarCuenta(cuenta.codigo)
                        mostrarToast(`Cuenta ${cuenta.codigo} reactivada correctamente.`)
                      }}
                    >
                      <RotateCcw className="size-3.5" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Eliminar ${cuenta.nombre}`}
                      title="Eliminar definitivamente"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setCuentaEliminando(cuenta)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )
    }

  // ============================================================
  // INTERFAZ
  // ============================================================

  if (cargando) {
    return (
      <div className="space-y-4">
        <div className="h-20 animate-pulse rounded-xl border border-border bg-card" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-xl border border-border bg-card" />
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {toastMensaje && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg border border-primary/20 bg-background/95 px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="size-4 text-primary" />

          <span>
            {toastMensaje}
          </span>
        </div>
      )}

      {/* ====================================================== */}
      {/* CABECERA */}
      {/* ====================================================== */}

      <header className="flex flex-col gap-3 border-b border-border/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Catálogo de
              Cuentas
            </h1>

            <Badge
              variant="outline"
              className="font-mono text-xs"
            >
              Plan
              Institucional
            </Badge>
          </div>

          <p className="mt-0.5 text-xs text-muted-foreground">
            Codificación
            decimal
            normalizada: 1
            Activo, 2
            Pasivo, 3
            Capital, 4
            Costos y Gastos,
            5 Ingresos.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-9 gap-1.5 px-3.5 shadow-sm"
            onClick={() =>
              abrirModalNuevaCuenta(
                grupoFiltro !==
                  "todos"
                  ? grupoFiltro ===
                    "activo"
                    ? "11"
                    : grupoFiltro ===
                        "pasivo"
                      ? "21"
                      : grupoFiltro ===
                          "capital"
                        ? "31"
                        : grupoFiltro ===
                            "gasto"
                          ? "41"
                          : "51"
                  : "11"
              )
            }
          >
            <Plus className="size-4" />

            Nueva Cuenta
          </Button>
        </div>
      </header>

      {/* ====================================================== */}
      {/* KPIs */}
      {/* ====================================================== */}

      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">

        <button
          type="button"
          onClick={() =>
            setGrupoFiltro(
              "todos"
            )
          }
          className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all ${
            grupoFiltro ===
            "todos"
              ? "border-primary bg-primary/[0.04] ring-1 ring-primary shadow-xs"
              : "border-border bg-card hover:bg-muted/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Total Cuentas
            </span>

            <Layers className="size-3.5 text-muted-foreground" />
          </div>

          <div className="mt-2">
            <div className="text-xl font-bold text-foreground">
              {
                estadisticas.total
              }
            </div>

            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {
                  estadisticas.activas
                }{" "}
                act.
              </span>

              <span>·</span>

              <span>
                {
                  estadisticas.enUso
                }{" "}
                en uso
              </span>
            </div>
          </div>
        </button>

        {ORDEN_GRUPOS.map(
          (grupo) => {
            const datos =
              estadisticas
                .porGrupo[
                grupo
              ]

            const activo =
              grupoFiltro ===
              grupo

            const digito =
              grupo ===
              "activo"
                ? "1"
                : grupo ===
                    "pasivo"
                  ? "2"
                  : grupo ===
                      "capital"
                    ? "3"
                    : grupo ===
                        "gasto"
                      ? "4"
                      : "5"

            return (
              <button
                key={
                  grupo
                }
                type="button"
                onClick={() =>
                  setGrupoFiltro(
                    activo
                      ? "todos"
                      : grupo
                  )
                }
                className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all ${
                  activo
                    ? "border-primary bg-primary/[0.05] ring-1 ring-primary shadow-xs"
                    : "border-border bg-card hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate text-xs font-semibold text-foreground">
                    {
                      ETIQUETA_TIPO[
                        grupo
                      ]
                    }
                  </span>

                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-bold text-muted-foreground">
                    {digito}
                  </span>
                </div>

                <div className="mt-2">
                  <div className="text-xl font-bold text-foreground">
                    {
                      datos.total
                    }
                  </div>

                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      {
                        datos.activas
                      }{" "}
                      activas
                    </span>

                    <span>·</span>

                    <span>
                      {
                        datos.enUso
                      }{" "}
                      partidas
                    </span>
                  </div>
                </div>
              </button>
            )
          }
        )}
      </section>

      {/* ====================================================== */}
      {/* BÚSQUEDA Y FILTROS */}
      {/* ====================================================== */}

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            placeholder="Buscar por código numérico o nombre de cuenta..."
            value={
              busqueda
            }
            onChange={(
              event
            ) =>
              setBusqueda(
                event.target
                  .value
              )
            }
            className="h-9 pl-9 pr-8 text-sm"
          />

          {busqueda && (
            <button
              type="button"
              onClick={() =>
                setBusqueda(
                  ""
                )
              }
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() =>
                setFiltroEstado(
                  "todas"
                )
              }
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filtroEstado ===
                "todas"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todas
            </button>

            <button
              type="button"
              onClick={() =>
                setFiltroEstado(
                  "activas"
                )
              }
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filtroEstado ===
                "activas"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Activas (
              {
                estadisticas.activas
              }
              )
            </button>

            <button
              type="button"
              onClick={() =>
                setFiltroEstado(
                  "inactivas"
                )
              }
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filtroEstado ===
                "inactivas"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Inactivas (
              {
                estadisticas.inactivas
              }
              )
            </button>
          </div>

          <Badge
            variant="muted"
            className="h-8 px-2.5 font-mono text-xs"
          >
            {
              cuentasFiltradas.length
            }{" "}
            /{" "}
            {
              cuentas.length
            }{" "}
            cuentas
          </Badge>
        </div>
      </div>

      {grupoFiltro !==
        "todos" && (
        <div className="flex items-center gap-2 px-1 text-xs">
          <span className="text-muted-foreground">
            Filtrando por
            clase:
          </span>

          <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 font-medium text-primary">
            {
              ETIQUETA_TIPO[
                grupoFiltro
              ]
            }

            <button
              type="button"
              onClick={() =>
                setGrupoFiltro(
                  "todos"
                )
              }
              className="ml-0.5 transition-colors hover:text-destructive"
              title="Quitar filtro de clase y ver todo el catálogo"
            >
              <X className="size-3" />
            </button>
          </span>

          <button
            type="button"
            onClick={() =>
              setGrupoFiltro(
                "todos"
              )
            }
            className="font-medium text-primary hover:underline"
          >
            Ver todas las
            clases
          </button>
        </div>
      )}

      {/* ====================================================== */}
      {/* LISTADO */}
      {/* ====================================================== */}

      <div className="space-y-6">
        {estructuraJerarquica.length ===
        0 ? (
          <Card className="border-dashed p-8 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Search className="size-6" />
            </div>

            <h3 className="mt-3 text-base font-semibold text-foreground">
              No se
              encontraron
              cuentas
            </h3>

            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              {grupoFiltro !==
              "todos"
                ? `No existen cuentas que coincidan con "${busqueda}" dentro de ${ETIQUETA_TIPO[grupoFiltro]}.`
                : `No existen cuentas contables que coincidan con "${busqueda}".`}
            </p>

            <div className="mt-4 flex items-center justify-center gap-2">
              {grupoFiltro !==
                "todos" && (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() =>
                    setGrupoFiltro(
                      "todos"
                    )
                  }
                >
                  Buscar en todo
                  el catálogo
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setBusqueda(
                    ""
                  )

                  setGrupoFiltro(
                    "todos"
                  )

                  setFiltroEstado(
                    "todas"
                  )
                }}
              >
                Limpiar
                filtros
              </Button>
            </div>
          </Card>
        ) : (
          estructuraJerarquica.map(
            (grupo) => (
              <div
                key={
                  grupo.tipo
                }
                className="space-y-3"
              >
                <div className="flex items-center justify-between border-b-2 border-primary/20 px-1 pb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-md bg-primary font-mono text-xs font-bold text-primary-foreground">
                      {
                        grupo.digito
                      }
                    </span>

                    <h2 className="text-base font-bold uppercase tracking-wide text-foreground">
                      {
                        grupo.nombreGrupo
                      }
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {
                        grupo.totalCuentas
                      }{" "}
                      {grupo.totalCuentas ===
                      1
                        ? "cuenta"
                        : "cuentas"}
                    </span>

                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="h-7 gap-1 text-xs text-primary hover:text-primary"
                      onClick={() =>
                        abrirModalNuevaCuenta(
                          grupo
                            .rubros[
                            0
                          ]
                            ?.codigo ||
                            `${grupo.digito}1`
                        )
                      }
                    >
                      <Plus className="size-3.5" />

                      Añadir en{" "}
                      {
                        grupo.nombreGrupo.split(
                          " "
                        )[0]
                      }
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {grupo.rubros.map(
                    (
                      rubro
                    ) => (
                      <Card
                        key={
                          rubro.codigo
                        }
                        className="overflow-hidden border-border/80 shadow-xs"
                      >
                        <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs font-bold text-primary">
                              {
                                rubro.codigo
                              }
                            </span>

                            <span className="text-xs font-semibold text-foreground">
                              {
                                rubro.nombre
                              }
                            </span>

                            <span className="hidden text-[11px] text-muted-foreground md:inline">
                              ·{" "}
                              {
                                rubro.descripcion
                              }
                            </span>
                          </div>

                          <span className="font-mono text-[11px] text-muted-foreground">
                            {
                              rubro
                                .cuentas
                                .length
                            }{" "}
                            {rubro
                              .cuentas
                              .length ===
                            1
                              ? "cuenta"
                              : "cuentas"}
                          </span>
                        </div>

                        <div className="divide-y divide-border/60">
                          {rubro
                            .cuentas
                            .length ===
                          0 ? (
                            <div className="p-4 text-center text-xs italic text-muted-foreground">
                              No hay
                              cuentas
                              registradas
                              en este
                              rubro.
                            </div>
                          ) : (
                            rubro.cuentas.map(
                              renderFilaCuenta
                            )
                          )}
                        </div>
                      </Card>
                    )
                  )}

                  {grupo
                    .cuentasOtras &&
                    grupo
                      .cuentasOtras
                      .length >
                      0 && (
                      <Card className="overflow-hidden border-border/80 shadow-xs">
                        <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs font-bold text-primary">
                              {
                                grupo.digito
                              }
                            </span>

                            <span className="text-xs font-semibold text-foreground">
                              Otras
                              cuentas
                              de{" "}
                              {
                                grupo.nombreGrupo
                              }
                            </span>
                          </div>

                          <span className="font-mono text-[11px] text-muted-foreground">
                            {
                              grupo
                                .cuentasOtras
                                .length
                            }{" "}
                            {grupo
                              .cuentasOtras
                              .length ===
                            1
                              ? "cuenta"
                              : "cuentas"}
                          </span>
                        </div>

                        <div className="divide-y divide-border/60">
                          {grupo.cuentasOtras.map(
                            renderFilaCuenta
                          )}
                        </div>
                      </Card>
                    )}
                </div>
              </div>
            )
          )
        )}
      </div>

      {/* ====================================================== */}
      {/* MODAL NUEVA CUENTA */}
      {/* ====================================================== */}

      {modalNuevoAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-card p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Plus className="size-5 text-primary" />

                <h3 className="text-base font-bold text-foreground">
                  Agregar Nueva
                  Cuenta
                  Contable
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setModalNuevoAbierto(
                    false
                  )
                }
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs sm:text-sm">
              <div className="space-y-1.5">
                <Label htmlFor="nuevo-rubro">
                  Rubro Contable
                  (Grupo y
                  Subgrupo)
                </Label>

                <Select
                  id="nuevo-rubro"
                  value={
                    nuevoRubro
                  }
                  onChange={(
                    event
                  ) =>
                    manejarCambioRubro(
                      event
                        .target
                        .value
                    )
                  }
                  className="h-9 font-medium"
                >
                  {RUBROS_CONTABLES.map(
                    (
                      rubro
                    ) => (
                      <option
                        key={
                          rubro.codigo
                        }
                        value={
                          rubro.codigo
                        }
                      >
                        {
                          rubro.codigo
                        }{" "}
                        —{" "}
                        {
                          rubro.nombre
                        }{" "}
                        (
                        {
                          ETIQUETA_TIPO[
                            rubro
                              .grupo
                          ]
                        }
                        )
                      </option>
                    )
                  )}
                </Select>

                <p className="text-[11px] text-muted-foreground">
                  Al cambiar de
                  rubro, el
                  sistema calcula
                  automáticamente
                  el código
                  correlativo
                  disponible.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr]">
                <div className="space-y-1.5">
                  <Label htmlFor="nuevo-codigo">
                    Código
                    Numérico
                  </Label>

                  <Input
                    id="nuevo-codigo"
                    inputMode="numeric"
                    value={
                      nuevoCodigo
                    }
                    onChange={(
                      event
                    ) =>
                      setNuevoCodigo(
                        event
                          .target
                          .value
                      )
                    }
                    className="font-mono font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="nuevo-nombre">
                    Nombre Oficial
                    de la Cuenta
                  </Label>

                  <Input
                    id="nuevo-nombre"
                    placeholder="Ej. Deudores comerciales locales"
                    value={
                      nuevoNombre
                    }
                    onChange={(
                      event
                    ) =>
                      setNuevoNombre(
                        event
                          .target
                          .value
                      )
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="nueva-naturaleza">
                    Naturaleza
                    Contable
                  </Label>

                  <Select
                    id="nueva-naturaleza"
                    value={
                      nuevaNaturaleza
                    }
                    onChange={(
                      event
                    ) =>
                      setNuevaNaturaleza(
                        event
                          .target
                          .value as Naturaleza
                      )
                    }
                  >
                    <option value="deudora">
                      Deudora
                      (Saldo en
                      Debe)
                    </option>

                    <option value="acreedora">
                      Acreedora
                      (Saldo en
                      Haber)
                    </option>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="nuevo-tipo-afectacion">
                    Nivel
                    Operativo
                  </Label>

                  <Select
                    id="nuevo-tipo-afectacion"
                    value={
                      nuevoPermiteMovimiento
                        ? "detalle"
                        : "titulo"
                    }
                    onChange={(
                      event
                    ) =>
                      setNuevoPermiteMovimiento(
                        event
                          .target
                          .value ===
                          "detalle"
                      )
                    }
                  >
                    <option value="detalle">
                      Afectable
                      (Permite
                      Asientos)
                    </option>

                    <option value="titulo">
                      De Título /
                      Acumulación
                    </option>
                  </Select>
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
                  <AlertCircle className="size-4 shrink-0" />

                  <span>
                    {
                      formError
                    }
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setModalNuevoAbierto(
                    false
                  )
                }
              >
                Cancelar
              </Button>

              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={
                  guardarNuevaCuenta
                }
                className="gap-1.5"
              >
                <Check className="size-4" />

                Registrar Cuenta
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================== */}
      {/* MODAL EDITAR */}
      {/* ====================================================== */}

      {cuentaEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="size-5 text-primary" />

                <h3 className="text-base font-bold text-foreground">
                  Modificar
                  Cuenta
                  Contable
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setCuentaEditando(
                    null
                  )
                }
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs sm:text-sm">
              <div className="space-y-1 rounded-lg border border-border/80 bg-muted/40 p-3 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Código actual:
                  </span>

                  <span className="font-bold text-primary">
                    {
                      cuentaEditando.codigo
                    }
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Clasificación:
                  </span>

                  <span className="font-semibold uppercase text-foreground">
                    {
                      ETIQUETA_TIPO[
                        cuentaEditando
                          .tipo
                      ]
                    }
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Naturaleza
                    actual:
                  </span>

                  <span className="font-semibold capitalize text-foreground">
                    {
                      cuentaEditando.naturaleza
                    }
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-codigo">
                  Código de la
                  Cuenta
                </Label>

                <Input
                  id="edit-codigo"
                  inputMode="numeric"
                  value={
                    editCodigo
                  }
                  onChange={(
                    event
                  ) =>
                    setEditCodigo(
                      event
                        .target
                        .value
                    )
                  }
                  className="font-mono font-bold"
                />

                <p className="text-[11px] text-muted-foreground">
                  El código puede
                  cambiarse
                  únicamente si
                  la cuenta no
                  tiene
                  movimientos
                  registrados.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-nombre">
                  Nombre Oficial
                  de la Cuenta
                </Label>

                <Input
                  id="edit-nombre"
                  value={
                    editNombre
                  }
                  onChange={(
                    event
                  ) =>
                    setEditNombre(
                      event
                        .target
                        .value
                    )
                  }
                  className="font-medium"
                />
              </div>

              {editError && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
                  <AlertCircle className="size-4 shrink-0" />

                  <span>
                    {
                      editError
                    }
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setCuentaEditando(
                    null
                  )
                }
              >
                Cancelar
              </Button>

              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={
                  guardarEdicion
                }
                className="gap-1.5"
              >
                <Check className="size-4" />

                Guardar
                Modificación
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================== */}
      {/* MODAL DESACTIVAR */}
      {/* ====================================================== */}

      {cuentaDesactivando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <PowerOff className="size-5 text-amber-500" />
                <h3 className="text-base font-bold text-foreground">
                  Desactivar Cuenta Contable
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCuentaDesactivando(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="font-mono text-sm font-bold text-primary">
                {cuentaDesactivando.codigo} — {cuentaDesactivando.nombre}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                La cuenta seguirá guardada en PostgreSQL, pero no estará disponible para nuevas operaciones. Podrás verla con el filtro Inactivas y reactivarla después.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setCuentaDesactivando(null)}>
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={confirmarDesactivacion} className="gap-1.5 bg-amber-600 text-white hover:bg-amber-700">
                <PowerOff className="size-4" />
                Desactivar cuenta
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================== */}
      {/* MODAL ELIMINAR DEFINITIVAMENTE */}
      {/* ====================================================== */}

      {cuentaEliminando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-5 text-destructive" />
                <h3 className="text-base font-bold text-foreground">
                  Eliminar Cuenta Definitivamente
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCuentaEliminando(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="font-mono text-sm font-bold text-primary">
                {cuentaEliminando.codigo} — {cuentaEliminando.nombre}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Esta cuenta no tiene movimientos registrados. Al confirmar será eliminada físicamente del catálogo. Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setCuentaEliminando(null)}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={confirmarEliminacion} className="gap-1.5">
                <Trash2 className="size-4" />
                Eliminar definitivamente
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}