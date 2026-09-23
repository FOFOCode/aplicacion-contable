"use client"

import { useMemo, useState } from "react"
import {
  Check,
  Pencil,
  Plus,
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
import { Input, Label } from "@/components/ui/field"

import { useContabilidad } from "@/components/contabilidad-provider"

import {
  ETIQUETA_TIPO,
  grupoPorDigito,
  type Naturaleza,
  type TipoCuenta,
} from "@/lib/types"

const NATURALEZA_POR_TIPO: Record<TipoCuenta, Naturaleza> = {
  activo: "deudora",
  pasivo: "acreedora",
  capital: "acreedora",
  gasto: "deudora",
  ingreso: "acreedora",
}

const ORDEN: TipoCuenta[] = [
  "activo",
  "pasivo",
  "capital",
  "gasto",
  "ingreso",
]

function normalizarNombre(valor: string) {
  return valor.trim().toLocaleLowerCase("es")
}

export default function CatalogoPage() {
  const {
    cuentas,
    agregarCuenta,
    renombrarCuenta,
    eliminarCuenta,
    cuentaEnUso,
  } = useContabilidad()

  const [codigo, setCodigo] = useState("")
  const [nombre, setNombre] = useState("")

  const [error, setError] = useState("")
  const [mensaje, setMensaje] = useState("")

  const [editando, setEditando] =
    useState<string | null>(null)

  const [cuentaAEliminar, setCuentaAEliminar] = useState<{
    codigo: string
    nombre: string
  } | null>(null)

  const [eliminando, setEliminando] = useState(false)

  const tipo = grupoPorDigito(codigo)

  const grupos = useMemo(() => {
    return ORDEN.map((t) => ({
      tipo: t,

      cuentas: cuentas
        .filter(
          (c) =>
            c.tipo === t &&
            c.activa
        )
        .sort((a, b) =>
          a.codigo.localeCompare(b.codigo)
        ),
    })).filter(
      (g) => g.cuentas.length > 0
    )
  }, [cuentas])

  function limpiarFormulario() {
    setCodigo("")
    setNombre("")
    setEditando(null)
  }

  function iniciarEdicion(codigoCuenta: string) {
    setError("")
    setMensaje("")

    if (cuentaEnUso(codigoCuenta)) {
      setError(
        "No se puede modificar esta cuenta porque ya posee movimientos contables registrados."
      )

      return
    }

    const cuenta = cuentas.find(
      (c) => c.codigo === codigoCuenta
    )

    if (!cuenta) {
      setError(
        "No se encontró la cuenta seleccionada."
      )

      return
    }

    setEditando(cuenta.codigo)
    setCodigo(cuenta.codigo)
    setNombre(cuenta.nombre)
  }

  async function guardarCuenta() {
    setError("")
    setMensaje("")

    const codigoLimpio = codigo.trim()
    const nombreLimpio = nombre.trim()

    if (!/^\d{3,}$/.test(codigoLimpio)) {
      setError(
        "El código debe tener al menos 3 dígitos numéricos."
      )
      return
    }

    if (!tipo) {
      setError(
        "El primer dígito debe ser 1, 2, 3, 4 o 5."
      )
      return
    }

    if (!nombreLimpio) {
      setError(
        "El nombre de la cuenta es obligatorio."
      )
      return
    }

    // =========================================================
    // EDITAR
    // =========================================================

    if (editando) {
      const codigoDuplicado = cuentas.some(
        (c) =>
          c.codigo === codigoLimpio &&
          c.codigo !== editando
      )

      if (codigoDuplicado) {
        setError(
          "Ya existe otra cuenta con ese código."
        )
        return
      }

      const nombreDuplicado = cuentas.some(
        (c) =>
          normalizarNombre(c.nombre) ===
            normalizarNombre(nombreLimpio) &&
          c.codigo !== editando
      )

      if (nombreDuplicado) {
        setError(
          "Ya existe una cuenta registrada con ese nombre."
        )
        return
      }

      const resultado =
        await renombrarCuenta(
          editando,
          codigoLimpio,
          nombreLimpio
        )

      if (!resultado.success) {
        setError(
          resultado.error ??
            "No se pudo modificar la cuenta."
        )
        return
      }

      limpiarFormulario()

      setMensaje(
        "Cuenta modificada correctamente."
      )

      return
    }

    // =========================================================
    // AGREGAR
    // =========================================================

    const codigoDuplicado = cuentas.some(
      (c) =>
        c.codigo === codigoLimpio
    )

    if (codigoDuplicado) {
      setError(
        "Ya existe una cuenta con ese código."
      )
      return
    }

    const nombreDuplicado = cuentas.some(
      (c) =>
        normalizarNombre(c.nombre) ===
        normalizarNombre(nombreLimpio)
    )

    if (nombreDuplicado) {
      setError(
        "Ya existe una cuenta registrada con ese nombre."
      )
      return
    }

    await agregarCuenta({
      codigo: codigoLimpio,
      nombre: nombreLimpio,
      tipo,
      naturaleza:
        NATURALEZA_POR_TIPO[tipo],
      activa: true,
    })

    limpiarFormulario()

    setMensaje(
      "Cuenta agregada correctamente."
    )
  }

  function manejarEliminar(
    codigoCuenta: string,
    nombreCuenta: string
  ) {
    setError("")
    setMensaje("")

    if (cuentaEnUso(codigoCuenta)) {
      setError(
        "No se puede eliminar esta cuenta porque posee movimientos contables registrados."
      )
      return
    }

    setCuentaAEliminar({
      codigo: codigoCuenta,
      nombre: nombreCuenta,
    })
  }

  async function confirmarEliminacion() {
    if (!cuentaAEliminar) return

    setEliminando(true)
    setError("")
    setMensaje("")

    const resultado =
      await eliminarCuenta(
        cuentaAEliminar.codigo
      )

    if (!resultado.success) {
      setError(
        resultado.error ??
          "No se pudo eliminar la cuenta."
      )

      setEliminando(false)
      setCuentaAEliminar(null)
      return
    }

    if (
      editando ===
      cuentaAEliminar.codigo
    ) {
      limpiarFormulario()
    }

    setCuentaAEliminar(null)
    setEliminando(false)

    setMensaje(
      "Cuenta eliminada correctamente."
    )
  }

  function cancelarEdicion() {
    setError("")
    setMensaje("")
    limpiarFormulario()
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">
          Datos complementarios
        </p>

        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Catálogo de Cuentas
        </h1>

        <p className="max-w-2xl text-sm text-muted-foreground">
          Clasificación por primer dígito del código:
          1 Activo, 2 Pasivo, 3 Capital contable,
          4 Costos y gastos, 5 Ingresos.
          Esta clasificación alimenta los Estados Financieros.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            {editando
              ? "Modificar cuenta"
              : "Agregar cuenta"}
          </CardTitle>

          <CardDescription>
            {editando
              ? "Puedes modificar el código y el nombre mientras la cuenta no tenga movimientos."
              : "El tipo y la naturaleza se asignan automáticamente según el primer dígito."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[160px_1fr_auto_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="codigo">
                Código
              </Label>

              <Input
                id="codigo"
                inputMode="numeric"
                placeholder="1106"
                value={codigo}
                onChange={(e) => {
                  setCodigo(e.target.value)
                  setError("")
                  setMensaje("")
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nombre">
                Nombre de la cuenta
              </Label>

              <Input
                id="nombre"
                placeholder="Documentos por cobrar"
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value)
                  setError("")
                  setMensaje("")
                }}
              />
            </div>

            <Button
              type="button"
              onClick={guardarCuenta}
              className="h-9"
            >
              <Plus
                className={
                  editando
                    ? "hidden"
                    : "size-4"
                }
              />

              <Check
                className={
                  editando
                    ? "size-4"
                    : "hidden"
                }
              />

              <span
                className={
                  editando
                    ? "hidden"
                    : ""
                }
              >
                Agregar
              </span>

              <span
                className={
                  editando
                    ? ""
                    : "hidden"
                }
              >
                Guardar cambio
              </span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={cancelarEdicion}
              className={
                editando
                  ? "h-9"
                  : "hidden"
              }
            >
              <X className="size-4" />
              Cancelar
            </Button>
          </div>

          {tipo && (
            <p className="text-sm text-muted-foreground">
              Clasificación detectada:{" "}

              <span className="font-medium text-foreground">
                {ETIQUETA_TIPO[tipo]}
              </span>

              {" · "}

              naturaleza{" "}

              <span className="font-medium text-foreground">
                {NATURALEZA_POR_TIPO[tipo]}
              </span>
            </p>
          )}

          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-500">
                {error}
              </p>
            </div>
          )}

          {mensaje && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
              <p className="text-sm text-emerald-500">
                {mensaje}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        {grupos.map((g) => (
          <Card key={g.tipo}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                {ETIQUETA_TIPO[g.tipo]}

                <Badge variant="muted">
                  Código{" "}
                  {g.cuentas[0].codigo.charAt(0)}
                </Badge>
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="divide-y divide-border">
                {g.cuentas.map((c) => {
                  const enUso =
                    cuentaEnUso(c.codigo)

                  return (
                    <div
                      key={c.codigo}
                      className="flex items-center justify-between gap-3 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-primary">
                          {c.codigo}
                        </span>{" "}

                        {c.nombre}
                      </span>

                      <div className="flex shrink-0 items-center gap-2">
                        <Badge
                          variant={
                            c.naturaleza ===
                            "deudora"
                              ? "deudora"
                              : "acreedora"
                          }
                        >
                          {c.naturaleza ===
                          "deudora"
                            ? "Deudora"
                            : "Acreedora"}
                        </Badge>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={
                            enUso
                              ? "size-8 cursor-not-allowed opacity-30"
                              : "size-8"
                          }
                          aria-label={`Modificar ${c.nombre}`}
                          aria-disabled={enUso}
                          title={
                            enUso
                              ? "No se puede modificar: la cuenta tiene movimientos registrados"
                              : "Modificar cuenta"
                          }
                          onClick={() =>
                            iniciarEdicion(
                              c.codigo
                            )
                          }
                        >
                          <Pencil className="size-4" />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={
                            enUso
                              ? "size-8 cursor-not-allowed text-destructive opacity-30"
                              : "size-8 text-destructive"
                          }
                          aria-label={`Eliminar ${c.nombre}`}
                          aria-disabled={enUso}
                          title={
                            enUso
                              ? "No se puede eliminar: la cuenta tiene movimientos registrados"
                              : "Eliminar cuenta"
                          }
                          onClick={() =>
                            manejarEliminar(
                              c.codigo,
                              c.nombre
                            )
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {cuentaAEliminar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          onClick={() => {
            if (!eliminando) {
              setCuentaAEliminar(null)
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="mb-5 flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                <Trash2 className="size-5 text-red-500" />
              </div>

              <div className="space-y-1">
                <h2 className="text-lg font-semibold">
                  Eliminar cuenta
                </h2>

                <p className="text-sm text-muted-foreground">
                  Esta acción eliminará permanentemente la cuenta del catálogo.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background/50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Cuenta seleccionada
              </p>

              <p className="mt-1 font-medium">
                <span className="text-primary">
                  {cuentaAEliminar.codigo}
                </span>{" "}

                {cuentaAEliminar.nombre}
              </p>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              ¿Estás seguro de que deseas eliminar esta cuenta?
              Esta acción no se puede deshacer.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={eliminando}
                onClick={() =>
                  setCuentaAEliminar(null)
                }
              >
                Cancelar
              </Button>

              <Button
                type="button"
                variant="destructive"
                disabled={eliminando}
                onClick={
                  confirmarEliminacion
                }
              >
                <Trash2 className="size-4" />

                {eliminando
                  ? "Eliminando..."
                  : "Eliminar cuenta"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}