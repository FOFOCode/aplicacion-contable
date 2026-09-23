"use client"

import { useMemo, useState } from "react"
import { Check, Pencil, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input, Label } from "@/components/ui/field"
import { useContabilidad } from "@/components/contabilidad-provider"
import { ETIQUETA_TIPO, grupoPorDigito, type Naturaleza, type TipoCuenta } from "@/lib/types"

const NATURALEZA_POR_TIPO: Record<TipoCuenta, Naturaleza> = {
  activo: "deudora",
  pasivo: "acreedora",
  capital: "acreedora",
  gasto: "deudora",
  ingreso: "acreedora",
}

const ORDEN: TipoCuenta[] = ["activo", "pasivo", "capital", "gasto", "ingreso"]

export default function CatalogoPage() {
  const { cuentas, asientos, agregarCuenta, renombrarCuenta, eliminarCuenta, reactivarCuenta, reiniciarEjemplo, limpiarTodo } = useContabilidad()
  const [codigo, setCodigo] = useState("")
  const [nombre, setNombre] = useState("")
  const [error, setError] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [editando, setEditando] = useState<string | null>(null)

  const tipo = grupoPorDigito(codigo)

  const cuentasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return cuentas
    return cuentas.filter((c) => c.codigo.includes(q) || c.nombre.toLowerCase().includes(q))
  }, [cuentas, busqueda])

  const grupos = useMemo(() => {
    return ORDEN.map((t) => ({
      tipo: t,
      cuentas: cuentasFiltradas.filter((c) => c.tipo === t).sort((a, b) => a.codigo.localeCompare(b.codigo)),
    })).filter((g) => g.cuentas.length > 0)
  }, [cuentasFiltradas])

  function guardarCuenta() {
    setError("")
    if (editando) {
      if (!nombre.trim()) {
        setError("El nombre de la cuenta es obligatorio.")
        return
      }
      renombrarCuenta(editando, nombre.trim())
      setEditando(null)
      setNombre("")
      return
    }
    if (!/^\d{3,}$/.test(codigo.trim())) {
      setError("El código debe tener al menos 3 dígitos numéricos.")
      return
    }
    if (!tipo) {
      setError("El primer dígito debe ser 1, 2, 3, 4 o 5.")
      return
    }
    if (!nombre.trim()) {
      setError("El nombre de la cuenta es obligatorio.")
      return
    }
    if (cuentas.some((c) => c.codigo === codigo.trim())) {
      setError("Ya existe una cuenta con ese código.")
      return
    }
    agregarCuenta({
      codigo: codigo.trim(),
      nombre: nombre.trim(),
      tipo,
      naturaleza: NATURALEZA_POR_TIPO[tipo],
      activa: true,
    })
    setCodigo("")
    setNombre("")
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">Datos complementarios</p>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Catálogo de Cuentas</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Clasificación por primer dígito del código: 1 Activo, 2 Pasivo, 3 Capital contable, 4
          Costos y gastos, 5 Ingresos. Esta clasificación alimenta los Estados Financieros.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Agregar cuenta</CardTitle>
          <CardDescription>
            El tipo y la naturaleza se asignan automáticamente según el primer dígito.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[160px_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="codigo">Código</Label>
              <Input
                id="codigo"
                inputMode="numeric"
                placeholder="1106"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre de la cuenta</Label>
              <Input
                id="nombre"
                placeholder="Documentos por cobrar"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
              <Button type="button" onClick={guardarCuenta} className="h-9">
                {editando ? <Check className="size-4" /> : <Plus className="size-4" />}
                {editando ? "Guardar cambio" : "Agregar"}
              </Button>
              {editando && (
                <Button type="button" variant="ghost" className="h-9" onClick={() => { setEditando(null); setNombre(""); setCodigo("") }}>
                  Cancelar
                </Button>
              )}

          </div>
          {tipo && (
            <p className="text-sm text-muted-foreground">
              Clasificación detectada:{" "}
              <span className="font-medium text-foreground">{ETIQUETA_TIPO[tipo]}</span> · naturaleza{" "}
              <span className="font-medium text-foreground">{NATURALEZA_POR_TIPO[tipo]}</span>
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="muted" className="px-3 py-1 text-sm font-medium">
            {cuentas.length} cuentas en catálogo
          </Badge>
          <span className="text-xs text-muted-foreground">Estructurado jerárquicamente por grupo y subgrupo</span>
        </div>
        <div className="w-full sm:w-72">
          <Input
            placeholder="Buscar por código o nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        {grupos.map((g) => (
          <Card key={g.tipo}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                {ETIQUETA_TIPO[g.tipo]}
                <Badge variant="muted">Código {g.cuentas[0].codigo.charAt(0)}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {g.cuentas.map((c) => (
                  <div key={c.codigo} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      <span className="font-medium text-primary">{c.codigo}</span> {c.nombre}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant={c.activa ? (c.naturaleza === "deudora" ? "deudora" : "acreedora") : "muted"}>
                        {c.activa ? (c.naturaleza === "deudora" ? "Deudora" : "Acreedora") : "Eliminada"}
                      </Badge>
                      <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Modificar ${c.nombre}`} onClick={() => { setEditando(c.codigo); setCodigo(c.codigo); setNombre(c.nombre) }}>
                        <Pencil className="size-4" />
                      </Button>
                      {c.activa ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label={`Eliminar ${c.nombre}`}
                          title={asientos.some((a) => a.lineas.some((l) => l.codigo === c.codigo)) ? "No se puede eliminar: la cuenta tiene movimientos registrados" : "Eliminar cuenta"}
                          disabled={asientos.some((a) => a.lineas.some((l) => l.codigo === c.codigo))}
                          onClick={() => {
                            if (window.confirm(`¿Deseas eliminar la cuenta ${c.nombre}?`)) eliminarCuenta(c.codigo)
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : (
                        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Reactivar ${c.nombre}`} onClick={() => reactivarCuenta(c.codigo)}>
                          <RotateCcw className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Datos de prueba</CardTitle>
          <CardDescription>
            Restablece el ejercicio de ejemplo o elimina todos los asientos registrados.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" className="h-9" onClick={reiniciarEjemplo}>
            <RefreshCw className="size-4" />
            Restablecer ejemplo
          </Button>
          <Button type="button" variant="destructive" className="h-9" onClick={limpiarTodo}>
            <Trash2 className="size-4" />
            Vaciar asientos
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
