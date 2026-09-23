"use client"

import { useMemo, useState } from "react"
import { Check, Info, Pencil, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react"
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
  const { cuentas, asientos, agregarCuenta, renombrarCuenta, eliminarCuenta, reactivarCuenta, reiniciarEjemplo } = useContabilidad()
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
      setCodigo("")
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

      {/* AVISO METODOLÓGICO: CUENTAS DEL MÉTODO ANALÍTICO */}
      <Card className="border-primary/25 bg-primary/[0.02]">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-3.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
              <Info className="size-5" />
            </div>
            <div className="space-y-1.5 text-xs sm:text-sm">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                Estructura Contable · Método Analítico o Pormenorizado
                <Badge variant="default" className="text-[10px] bg-primary/15 text-primary border-primary/30">
                  Norma Técnica
                </Badge>
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Bajo el Método Analítico, las operaciones con mercancías no se registran en una sola cuenta de Inventario, sino que se abren cuentas especializadas para determinar paso a paso el Costo de Ventas:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                <div className="rounded border border-border/80 bg-background/60 p-2">
                  <span className="font-bold text-primary">1104 Inventario de mercadería:</span> Refleja el Inventario Inicial (inmutable durante el año hasta la toma física final).
                </div>
                <div className="rounded border border-border/80 bg-background/60 p-2">
                  <span className="font-bold text-primary">4101 Compras:</span> Registra adquisiciones a precio de costo (naturaleza deudora).
                </div>
                <div className="rounded border border-border/80 bg-background/60 p-2">
                  <span className="font-bold text-amber-600 dark:text-amber-400">5102 Devoluciones s/ compras:</span> Cuenta correctora acreedora que reduce directamente las compras brutas.
                </div>
                <div className="rounded border border-border/80 bg-background/60 p-2">
                  <span className="font-bold text-amber-600 dark:text-amber-400">5103 Rebajas s/ compras:</span> Cuenta correctora acreedora (bonificaciones y descuentos concedidos por proveedores).
                </div>
                <div className="rounded border border-border/80 bg-background/60 p-2">
                  <span className="font-bold text-primary">5101 Ventas:</span> Ingresos brutos por comercialización de mercaderías.
                </div>
                <div className="rounded border border-border/80 bg-background/60 p-2">
                  <span className="font-bold text-amber-600 dark:text-amber-400">4103 Devoluciones s/ ventas:</span> Cuenta correctora deudora que deduce las ventas brutas.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={editando ? "border-primary ring-1 ring-primary" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{editando ? `Modificar cuenta: ${editando}` : "Agregar nueva cuenta"}</span>
            {editando && (
              <Badge variant="outline" className="border-primary text-primary text-xs">
                Modo edición
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {editando
              ? "Modifica el nombre oficial de la cuenta contable. El código permanece inmutable para mantener la integridad de los libros."
              : "El tipo y la naturaleza se asignan automáticamente según el primer dígito del código."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[180px_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="codigo">
                Código {editando && <span className="text-[11px] text-muted-foreground font-normal">(Fijo)</span>}
              </Label>
              <Input
                id="codigo"
                inputMode="numeric"
                placeholder="1106"
                value={codigo}
                disabled={Boolean(editando)}
                className={editando ? "bg-muted cursor-not-allowed opacity-80 font-mono font-semibold" : "font-mono"}
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
            <div className="flex items-center gap-2">
              <Button type="button" onClick={guardarCuenta} className="h-9">
                {editando ? <Check className="size-4" /> : <Plus className="size-4" />}
                {editando ? "Guardar cambio" : "Agregar"}
              </Button>
              {editando && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  onClick={() => {
                    setEditando(null)
                    setNombre("")
                    setCodigo("")
                    setError("")
                  }}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </div>
          {tipo && (
            <p className="text-sm text-muted-foreground">
              Clasificación detectada:{" "}
              <span className="font-medium text-foreground">{ETIQUETA_TIPO[tipo]}</span> · naturaleza{" "}
              <span className="font-medium text-foreground">{NATURALEZA_POR_TIPO[tipo]}</span>
            </p>
          )}
          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
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
                  <div key={c.codigo} className="flex items-center justify-between py-2 text-sm gap-2">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-primary font-mono">{c.codigo}</span>
                      <span className="text-foreground">{c.nombre}</span>
                      {(c.codigo === "5102" || c.codigo === "5103") && (
                        <span className="inline-flex items-center text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                          Correctora de Compras (Acreedora)
                        </span>
                      )}
                      {(c.codigo === "4103" || c.codigo === "4104") && (
                        <span className="inline-flex items-center text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                          Correctora de Ventas (Deudora)
                        </span>
                      )}
                      {c.codigo === "1104" && (
                        <span className="inline-flex items-center text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                          Inventario Inicial (Analítico)
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant={c.activa ? (c.naturaleza === "deudora" ? "deudora" : "acreedora") : "muted"}>
                        {c.activa ? (c.naturaleza === "deudora" ? "Deudora" : "Acreedora") : "Eliminada"}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Modificar ${c.nombre}`}
                        onClick={() => {
                          setEditando(c.codigo)
                          setCodigo(c.codigo)
                          setNombre(c.nombre)
                          window.scrollTo({ top: 0, behavior: "smooth" })
                        }}
                      >
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

      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mantenimiento y Demostración</CardTitle>
          <CardDescription>
            Puedes restablecer el catálogo de cuentas y los asientos del caso comercial didáctico para pruebas o capacitación.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-9"
            onClick={() => {
              if (window.confirm("¿Deseas restablecer el catálogo y los asientos del caso didáctico de ejemplo? Esta acción recargará las operaciones iniciales.")) {
                reiniciarEjemplo()
              }
            }}
          >
            <RefreshCw className="size-4" />
            Restablecer datos didácticos de ejemplo
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
