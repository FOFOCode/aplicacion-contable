This file is a merged representation of a subset of the codebase, containing files not matching ignore patterns, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of a subset of the repository's contents that is considered the most important context.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching these patterns are excluded: project.zip, *.zip
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
```
app/
  catalogo/
    page.tsx
  estados-financieros/
    page.tsx
  libro-diario/
    page.tsx
  libro-mayor/
    page.tsx
  globals.css
  layout.tsx
  page.tsx
components/
  ui/
    badge.tsx
    button.tsx
    card.tsx
    field.tsx
  app-shell.tsx
  asiento-form.tsx
  contabilidad-provider.tsx
lib/
  catalogo.ts
  contabilidad.ts
  types.ts
  utils.ts
public/
  apple-icon.png
  icon-dark-32x32.png
  icon-light-32x32.png
  icon.svg
  placeholder-logo.png
  placeholder-logo.svg
  placeholder-user.jpg
  placeholder.jpg
  placeholder.svg
.gitignore
components.json
next.config.mjs
package.json
pnpm-workspace.yaml
postcss.config.mjs
tsconfig.json
```

# Files

## File: app/catalogo/page.tsx
```typescript
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
  const [editando, setEditando] = useState<string | null>(null)

  const tipo = grupoPorDigito(codigo)

  const grupos = useMemo(() => {
    return ORDEN.map((t) => ({
      tipo: t,
      cuentas: cuentas.filter((c) => c.tipo === t).sort((a, b) => a.codigo.localeCompare(b.codigo)),
    })).filter((g) => g.cuentas.length > 0)
  }, [cuentas])

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
```

## File: app/estados-financieros/page.tsx
```typescript
"use client"

import { CircleCheck, FileDown, RotateCcw, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useContabilidad } from "@/components/contabilidad-provider"
import { formatoMoneda } from "@/lib/contabilidad"
import type { LineaReporte } from "@/lib/contabilidad"

function Renglones({ items }: { items: LineaReporte[] }) {
  if (items.length === 0) return <p className="px-1 py-2 text-sm text-muted-foreground">Sin movimientos.</p>
  return <div className="divide-y divide-border">{items.map((it) => <div key={it.cuenta.codigo} className="flex items-center justify-between px-1 py-2 text-sm"><span><span className="mr-2 text-muted-foreground">{it.cuenta.codigo}</span>{it.cuenta.nombre}</span><span className="tabular-nums">{formatoMoneda(it.monto)}</span></div>)}</div>
}

function TotalRow({ label, valor, fuerte }: { label: string; valor: number; fuerte?: boolean }) {
  return <div className={`flex items-center justify-between border-t border-border px-1 pt-2 text-sm ${fuerte ? "font-bold" : "font-semibold"}`}><span>{label}</span><span className="tabular-nums">{formatoMoneda(valor)}</span></div>
}

function ReportSection({ title, code, items, totalLabel, total }: { title: string; code: string; items: LineaReporte[]; totalLabel: string; total: number }) {
  return <div><h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">{title}<Badge variant="muted">Código {code}</Badge></h3><Renglones items={items}/><TotalRow label={totalLabel} valor={total}/></div>
}

export default function EstadosFinancierosPage() {
  const { estadoResultados: er, balanceGeneral: bg, cerrarCicloContable, asientos } = useContabilidad()

  function exportarPdf() {
    const previousTitle = document.title
    document.title = "Reporte de Estados Financieros"
    window.print()
    window.setTimeout(() => { document.title = previousTitle }, 500)
  }

  function cerrarEjercicio() {
    const confirmado = window.confirm("Se cerrará el ejercicio actual y se generará un asiento de apertura con los saldos de activo, pasivo, capital e inventario. ¿Deseas continuar?")
    if (confirmado) cerrarCicloContable()
  }

  return <div className="space-y-8 report-page">
    <header className="space-y-3 report-header">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm font-medium text-primary">Reportes contables</p><h1 className="text-2xl font-bold tracking-tight md:text-3xl">Reporte de Estados Financieros</h1><p className="mt-1 text-sm text-muted-foreground">Corte del ejercicio contable · Expresado en dólares de los Estados Unidos de América</p></div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button type="button" variant="outline" onClick={exportarPdf}><FileDown className="size-4"/>Exportar PDF</Button>
          <Button type="button" variant="outline" onClick={cerrarEjercicio} disabled={!asientos.length} className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"><RotateCcw className="size-4"/>Cerrar ejercicio</Button>
        </div>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">Información preparada automáticamente a partir de los asientos registrados y clasificada por el catálogo de cuentas.</p>
    </header>

    <Card className="report-card">
      <CardHeader><CardTitle>Estado de Resultados</CardTitle><CardDescription>Presentación en cascada: ventas, costo de ventas, gastos de operación y resultado del ejercicio.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <ReportSection title="Ventas" code="5" items={er.ventas} totalLabel="Ventas netas" total={er.totalVentas}/>
        <ReportSection title="Costo de ventas" code="41" items={er.costoVentas} totalLabel="Utilidad bruta" total={er.utilidadBruta}/>
        <ReportSection title="Gastos de operación" code="4" items={er.gastosOperacion} totalLabel="Utilidad de operación" total={er.utilidadOperacion}/>
        <div className="grid gap-5 border-t border-border pt-5 md:grid-cols-2"><ReportSection title="Ingresos financieros" code="52" items={er.ingresosFinancieros} totalLabel="Total ingresos financieros" total={er.totalIngresosFinancieros}/><ReportSection title="Gastos financieros" code="43" items={er.gastosFinancieros} totalLabel="Total gastos financieros" total={er.totalGastosFinancieros}/></div>
        <div className={`flex items-center justify-between rounded-lg border p-4 ${er.utilidad >= 0 ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"}`}><span className="font-semibold">{er.utilidad >= 0 ? "Utilidad del ejercicio" : "Pérdida del ejercicio"}</span><span className="text-lg font-bold tabular-nums">{formatoMoneda(er.utilidad)}</span></div>
      </CardContent>
    </Card>

    <Card className="report-card">
      <CardHeader><CardTitle>Balance General</CardTitle><CardDescription>Activo = Pasivo + Capital contable. El activo se presenta a la izquierda y el pasivo y capital a la derecha.</CardDescription></CardHeader>
      <CardContent className="grid gap-8 md:grid-cols-2">
        <div><h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">Activo <Badge variant="deudora">Código 1</Badge></h3><Renglones items={bg.activos}/><TotalRow label="Total activo" valor={bg.totalActivo} fuerte/></div>
        <div className="space-y-6"><div><h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">Pasivo <Badge variant="acreedora">Código 2</Badge></h3><Renglones items={bg.pasivos}/><TotalRow label="Total pasivo" valor={bg.totalPasivo}/></div><div><h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">Capital social y contable <Badge variant="acreedora">Código 3</Badge></h3><Renglones items={bg.capital}/><div className="flex items-center justify-between px-1 py-2 text-sm"><span className="text-muted-foreground">Utilidad del ejercicio</span><span className="tabular-nums">{formatoMoneda(bg.utilidadEjercicio)}</span></div><TotalRow label="Total capital contable" valor={bg.totalCapitalContable}/></div><TotalRow label="Total pasivo + capital" valor={bg.totalPasivoMasCapital} fuerte/></div>
      </CardContent>
      <CardContent className="pt-0"><div className={`flex items-center gap-3 rounded-lg border p-4 text-sm ${bg.cuadra ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"}`}>{bg.cuadra ? <CircleCheck className="size-5 shrink-0 text-emerald-600"/> : <TriangleAlert className="size-5 shrink-0 text-red-600"/>}<span className="font-medium">{bg.cuadra ? `Balance cuadrado: ${formatoMoneda(bg.totalActivo)} = ${formatoMoneda(bg.totalPasivoMasCapital)}` : `El balance no cuadra: Activo ${formatoMoneda(bg.totalActivo)} ≠ Pasivo + Capital ${formatoMoneda(bg.totalPasivoMasCapital)}`}</span></div></CardContent>
    </Card>
    <footer className="hidden border-t border-border pt-8 text-center text-xs text-muted-foreground print:block"><p>Las notas son parte integrante de los estados financieros.</p><div className="mt-12 grid grid-cols-3 gap-10"><div className="border-t border-foreground/50 pt-2">Representante legal</div><div className="border-t border-foreground/50 pt-2">Contador</div><div className="border-t border-foreground/50 pt-2">Auditor externo</div></div></footer>
  </div>
}
```

## File: app/libro-diario/page.tsx
```typescript
"use client"

import { Trash2 } from "lucide-react"
import { AsientoForm } from "@/components/asiento-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useContabilidad } from "@/components/contabilidad-provider"
import { formatoMoneda, totalesAsiento } from "@/lib/contabilidad"

export default function LibroDiarioPage() {
  const { asientos, cuentas, eliminarAsiento } = useContabilidad()

  const nombreCuenta = (codigo: string) =>
    cuentas.find((c) => c.codigo === codigo)?.nombre ?? "Cuenta desconocida"

  const ordenados = [...asientos].sort((a, b) => b.numero - a.numero)

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Libro Diario</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Registro de asientos con Fecha, Código/Cuenta, Concepto, Debe y Haber. El sistema bloquea
          el guardado si el asiento no cumple la Partida Doble.
        </p>
      </header>

      <AsientoForm />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Asientos registrados</h2>
          <span className="text-sm text-muted-foreground">{asientos.length} en total</span>
        </div>

        {ordenados.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Aún no hay asientos registrados.
            </CardContent>
          </Card>
        ) : (
          ordenados.map((a) => {
            const totales = totalesAsiento(a.lineas)
            return (
              <Card key={a.id}>
                <CardHeader className="flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-sm text-primary">
                        Partida #{a.numero}
                      </span>
                      <span className="text-sm font-normal text-muted-foreground">{a.fecha}</span>
                    </CardTitle>
                    <CardDescription className="mt-1">{a.concepto}</CardDescription>
                  </div>
                  <button
                    onClick={() => eliminarAsiento(a.id)}
                    className="text-muted-foreground transition-colors hover:text-red-600"
                    aria-label={`Eliminar partida ${a.numero}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full min-w-[480px] text-sm">
                      <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Cuenta</th>
                          <th className="px-3 py-2 text-right font-medium">Debe</th>
                          <th className="px-3 py-2 text-right font-medium">Haber</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {a.lineas.map((l, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2">
                              <span className="font-medium">{l.codigo}</span>
                              <span className="text-muted-foreground"> — {nombreCuenta(l.codigo)}</span>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {l.debe > 0 ? formatoMoneda(l.debe) : ""}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {l.haber > 0 ? formatoMoneda(l.haber) : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/40 font-medium">
                        <tr>
                          <td className="px-3 py-2 text-right">Totales</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatoMoneda(totales.debe)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatoMoneda(totales.haber)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </section>
    </div>
  )
}
```

## File: app/libro-mayor/page.tsx
```typescript
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useContabilidad } from "@/components/contabilidad-provider"
import { formatoMoneda, redondear } from "@/lib/contabilidad"
import { ETIQUETA_TIPO } from "@/lib/types"

export default function LibroMayorPage() {
  const { mayor } = useContabilidad()

  const totalDebe = redondear(mayor.reduce((s, m) => s + m.debe, 0))
  const totalHaber = redondear(mayor.reduce((s, m) => s + m.haber, 0))
  const totalDeudor = redondear(
    mayor.filter((m) => m.naturalezaSaldo === "deudora").reduce((s, m) => s + Math.abs(m.saldo), 0),
  )
  const totalAcreedor = redondear(
    mayor.filter((m) => m.naturalezaSaldo === "acreedora").reduce((s, m) => s + Math.abs(m.saldo), 0),
  )

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">Tarea 2</p>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Libro Mayor</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Mayorización automática en tiempo real: el sistema consolida los débitos y créditos de
          cada asiento y determina el saldo Deudor o Acreedor de cada cuenta, sin cálculos manuales.
        </p>
      </header>

      {mayor.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No hay movimientos. Registra asientos en el Libro Diario para ver la mayorización.
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2">
            {mayor.map((m) => (
              <Card key={m.cuenta.codigo}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm">
                      <span className="text-primary">{m.cuenta.codigo}</span> {m.cuenta.nombre}
                    </CardTitle>
                    <Badge variant="muted">{ETIQUETA_TIPO[m.cuenta.tipo]}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border text-sm">
                    <div className="border-r border-border">
                      <p className="border-b border-border bg-muted/60 px-3 py-1.5 text-center text-xs font-medium uppercase text-muted-foreground">
                        Debe
                      </p>
                      <p className="px-3 py-2 text-right tabular-nums">{formatoMoneda(m.debe)}</p>
                    </div>
                    <div>
                      <p className="border-b border-border bg-muted/60 px-3 py-1.5 text-center text-xs font-medium uppercase text-muted-foreground">
                        Haber
                      </p>
                      <p className="px-3 py-2 text-right tabular-nums">{formatoMoneda(m.haber)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Saldo</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold tabular-nums">
                        {formatoMoneda(Math.abs(m.saldo))}
                      </span>
                      {m.naturalezaSaldo === "deudora" && <Badge variant="deudora">Deudor</Badge>}
                      {m.naturalezaSaldo === "acreedora" && (
                        <Badge variant="acreedora">Acreedor</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>

          <section>
            <Card>
              <CardHeader>
                <CardTitle>Balance de Comprobación</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Cuenta</th>
                        <th className="px-3 py-2 text-right font-medium">Debe</th>
                        <th className="px-3 py-2 text-right font-medium">Haber</th>
                        <th className="px-3 py-2 text-right font-medium">Saldo deudor</th>
                        <th className="px-3 py-2 text-right font-medium">Saldo acreedor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {mayor.map((m) => (
                        <tr key={m.cuenta.codigo}>
                          <td className="px-3 py-2">
                            <span className="font-medium">{m.cuenta.codigo}</span>
                            <span className="text-muted-foreground"> — {m.cuenta.nombre}</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatoMoneda(m.debe)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatoMoneda(m.haber)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {m.naturalezaSaldo === "deudora" ? formatoMoneda(Math.abs(m.saldo)) : ""}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {m.naturalezaSaldo === "acreedora"
                              ? formatoMoneda(Math.abs(m.saldo))
                              : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/40 font-semibold">
                      <tr>
                        <td className="px-3 py-2 text-right">Totales</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatoMoneda(totalDebe)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatoMoneda(totalHaber)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatoMoneda(totalDeudor)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatoMoneda(totalAcreedor)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  El total del Debe debe coincidir con el total del Haber, y el saldo deudor con el
                  saldo acreedor, confirmando la Partida Doble.
                </p>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  )
}
```

## File: app/globals.css
```css
@import 'tailwindcss';
@import 'tw-animate-css';
@import 'shadcn/tailwind.css';

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --color-foreground: var(--foreground);
  --color-background: var(--background);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

:root {
  color-scheme: light;
  --background: oklch(0.985 0.005 160);
  --foreground: oklch(0.19 0.02 165);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.19 0.02 165);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.19 0.02 165);
  --primary: oklch(0.48 0.1 166);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.96 0.01 160);
  --secondary-foreground: oklch(0.3 0.03 165);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --radius: 0.625rem;
  --sidebar: oklch(0.27 0.04 170);
  --sidebar-foreground: oklch(0.95 0.01 160);
  --sidebar-primary: oklch(0.62 0.12 165);
  --sidebar-primary-foreground: oklch(0.15 0.02 165);
  --sidebar-accent: oklch(0.34 0.05 170);
  --sidebar-accent-foreground: oklch(0.97 0 0);
  --sidebar-border: oklch(1 0 0 / 12%);
  --sidebar-ring: oklch(0.62 0.12 165);
}

.dark {
  color-scheme: dark;
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}

@media (prefers-color-scheme: dark) {
  :root:not(.light) {
    color-scheme: dark;
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.205 0 0);
    --card-foreground: oklch(0.985 0 0);
    --popover: oklch(0.205 0 0);
    --popover-foreground: oklch(0.985 0 0);
    --primary: oklch(0.922 0 0);
    --primary-foreground: oklch(0.205 0 0);
    --secondary: oklch(0.269 0 0);
    --secondary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.269 0 0);
    --muted-foreground: oklch(0.708 0 0);
    --accent: oklch(0.269 0 0);
    --accent-foreground: oklch(0.985 0 0);
    --destructive: oklch(0.704 0.191 22.216);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 15%);
    --ring: oklch(0.556 0 0);
    --chart-1: oklch(0.87 0 0);
    --chart-2: oklch(0.556 0 0);
    --chart-3: oklch(0.439 0 0);
    --chart-4: oklch(0.371 0 0);
    --chart-5: oklch(0.269 0 0);
    --sidebar: oklch(0.205 0 0);
    --sidebar-foreground: oklch(0.985 0 0);
    --sidebar-primary: oklch(0.488 0.243 264.376);
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.269 0 0);
    --sidebar-accent-foreground: oklch(0.985 0 0);
    --sidebar-border: oklch(1 0 0 / 10%);
    --sidebar-ring: oklch(0.556 0 0);
  }
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}

@media print {
  @page {
    size: letter;
    margin: 16mm 14mm;
  }

  html, body {
    background: #fff !important;
    color: #111827 !important;
    font-size: 10pt;
  }

  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .report-page {
    max-width: none !important;
    gap: 18pt !important;
  }

  .report-header {
    border-bottom: 1.5pt solid #0f766e;
    padding-bottom: 10pt;
  }

  .report-card {
    break-inside: avoid;
    border: 0 !important;
    box-shadow: none !important;
    background: #fff !important;
    padding: 0 !important;
  }

  .report-card [data-slot="card-header"] {
    border-bottom: 0.5pt solid #cbd5e1;
    padding: 0 0 7pt !important;
  }

  .report-card [data-slot="card-content"] {
    padding: 9pt 0 0 !important;
  }

  .report-card .divide-y > div {
    border-color: #e2e8f0;
  }

  .report-card .border-emerald-500\/30 {
    border-color: #0f766e !important;
    background: #ecfdf5 !important;
  }
}
```

## File: app/layout.tsx
```typescript
import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ContabilidadProvider } from '@/components/contabilidad-provider'
import { AppShell } from '@/components/app-shell'

export const metadata: Metadata = {
  title: 'Módulo Contable | Ciclo contable automático',
  description:
    'Módulo contable web: Libro Diario con Partida Doble, mayorización automática y generación dinámica de Estados Financieros.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ContabilidadProvider>
          <AppShell>{children}</AppShell>
        </ContabilidadProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
```

## File: app/page.tsx
```typescript
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
```

## File: components/ui/badge.tsx
```typescript
import * as React from "react"
import { cn } from "@/lib/utils"

type Variant = "default" | "deudora" | "acreedora" | "muted" | "success" | "warning"

const styles: Record<Variant, string> = {
  default: "bg-primary/10 text-primary border-primary/20",
  deudora: "bg-sky-500/10 text-sky-700 border-sky-500/20 dark:text-sky-300",
  acreedora: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300",
  muted: "bg-muted text-muted-foreground border-border",
  success: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300",
  warning: "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-300",
}

export function Badge({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"span"> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles[variant],
        className,
      )}
      {...props}
    />
  )
}
```

## File: components/ui/button.tsx
```typescript
import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground [a]:hover:bg-primary/80',
        outline:
          'border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
        ghost:
          'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
        destructive:
          'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default:
          'h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        icon: 'size-8',
        'icon-xs':
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        'icon-sm':
          'size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg',
        'icon-lg': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
```

## File: components/ui/card.tsx
```typescript
import * as React from "react"
import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground rounded-xl border border-border shadow-sm",
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 p-5 pb-3", className)} {...props} />
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("text-base font-semibold leading-tight", className)} {...props} />
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5 pt-0", className)} {...props} />
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent }
```

## File: components/ui/field.tsx
```typescript
import * as React from "react"
import { cn } from "@/lib/utils"

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors",
        "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("text-sm font-medium leading-none text-foreground", className)}
      {...props}
    />
  )
}
```

## File: components/app-shell.tsx
```typescript
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpenText,
  Library,
  ListTree,
  Scale,
  LayoutDashboard,
  Menu,
  Home,
} from "lucide-react"
import { useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/", label: "Panel principal", icon: LayoutDashboard },
  { href: "/libro-diario", label: "Libro Diario", icon: BookOpenText },
  { href: "/libro-mayor", label: "Libro Mayor", icon: ListTree },
  { href: "/estados-financieros", label: "Reporte de Estados Financieros", icon: Scale },
  { href: "/catalogo", label: "Catálogo de Cuentas", icon: Library },
]

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-svh bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Scale className="size-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Módulo Contable</p>
            <p className="text-xs text-sidebar-foreground/60">Ciclo contable automático</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border px-5 py-4 text-xs text-sidebar-foreground/60">
          <p>Sistema de gestión contable</p>
          <p className="mt-1">Partida doble y reportes financieros</p>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 md:hidden">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex size-9 items-center justify-center rounded-md border border-border"
            aria-label="Abrir menú"
          >
            <Menu className="size-5" />
          </button>
          <span className="text-sm font-semibold">Módulo Contable</span>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mb-5 flex justify-end print:hidden">
            <Link href="/" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label="Ir al panel principal">
              <Home className="size-4" />
              Panel principal
            </Link>
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}
```

## File: components/asiento-form.tsx
```typescript
"use client"

import { useMemo, useState } from "react"
import { Plus, Trash2, TriangleAlert, CircleCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input, Label, Select } from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useContabilidad } from "@/components/contabilidad-provider"
import { formatoMoneda, totalesAsiento, validarPartidaDoble } from "@/lib/contabilidad"
import type { AsientoLinea } from "@/lib/types"

type LineaEditable = AsientoLinea & { key: string }

function nuevaLinea(): LineaEditable {
  return { key: crypto.randomUUID(), codigo: "", debe: 0, haber: 0 }
}

export function AsientoForm() {
  const { cuentas, agregarAsiento } = useContabilidad()
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [concepto, setConcepto] = useState("")
  const [lineas, setLineas] = useState<LineaEditable[]>([nuevaLinea(), nuevaLinea()])
  const [errores, setErrores] = useState<string[]>([])
  const [exito, setExito] = useState(false)

  const totales = useMemo(() => totalesAsiento(lineas), [lineas])
  const balanceado = totales.debe === totales.haber && totales.debe > 0

  function actualizarLinea(key: string, campo: keyof AsientoLinea, valor: string) {
    setExito(false)
    setLineas((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l
        if (campo === "codigo") return { ...l, codigo: valor }
        const num = valor === "" ? 0 : Number(valor)
        // Un renglón sólo admite Debe o Haber, nunca ambos.
        if (campo === "debe") return { ...l, debe: num, haber: num > 0 ? 0 : l.haber }
        return { ...l, haber: num, debe: num > 0 ? 0 : l.debe }
      }),
    )
  }

  function agregarRenglon() {
    setLineas((prev) => [...prev, nuevaLinea()])
  }

  function quitarRenglon(key: string) {
    setLineas((prev) => (prev.length <= 2 ? prev : prev.filter((l) => l.key !== key)))
  }

  function limpiar() {
    setFecha(new Date().toISOString().slice(0, 10))
    setConcepto("")
    setLineas([nuevaLinea(), nuevaLinea()])
    setErrores([])
  }

  function guardar() {
    setExito(false)
    const limpias = lineas
      .filter((l) => l.codigo)
      .map(({ codigo, debe, haber }) => ({ codigo, debe: Number(debe) || 0, haber: Number(haber) || 0 }))

    const validacion = validarPartidaDoble(fecha, concepto, limpias)
    if (!validacion.valido) {
      setErrores(validacion.errores)
      return
    }
    // El guardado sólo ocurre cuando la Partida Doble es válida.
    agregarAsiento({ fecha, concepto: concepto.trim(), lineas: limpias })
    setErrores([])
    setExito(true)
    limpiar()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registro de asiento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="fecha">Fecha</Label>
            <Input
              id="fecha"
              type="date"
              value={fecha}
              onChange={(e) => {
                setFecha(e.target.value)
                setExito(false)
              }}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="concepto">Concepto</Label>
            <Input
              id="concepto"
              placeholder="Descripción de la transacción"
              value={concepto}
              onChange={(e) => {
                setConcepto(e.target.value)
                setExito(false)
              }}
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Código / Cuenta</th>
                <th className="px-3 py-2 text-right font-medium">Debe</th>
                <th className="px-3 py-2 text-right font-medium">Haber</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lineas.map((l) => (
                <tr key={l.key}>
                  <td className="px-3 py-2">
                    <Select
                      value={l.codigo}
                      onChange={(e) => actualizarLinea(l.key, "codigo", e.target.value)}
                    >
                      <option value="">Seleccione una cuenta…</option>
                      {cuentas.filter((c) => c.activa).map((c) => (
                        <option key={c.codigo} value={c.codigo}>
                          {c.codigo} — {c.nombre}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      className="text-right"
                      value={l.debe || ""}
                      onChange={(e) => actualizarLinea(l.key, "debe", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      className="text-right"
                      value={l.haber || ""}
                      onChange={(e) => actualizarLinea(l.key, "haber", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => quitarRenglon(l.key)}
                      disabled={lineas.length <= 2}
                      className="text-muted-foreground transition-colors hover:text-red-600 disabled:opacity-30"
                      aria-label="Eliminar renglón"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/40 font-medium">
              <tr>
                <td className="px-3 py-2 text-right">Totales</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatoMoneda(totales.debe)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatoMoneda(totales.haber)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" size="sm" type="button" onClick={agregarRenglon}>
            <Plus className="size-4" />
            Agregar renglón
          </Button>
          {balanceado ? (
            <Badge variant="success">Partida Doble balanceada</Badge>
          ) : (
            <Badge variant="muted">
              Diferencia: {formatoMoneda(Math.abs(totales.diferencia))}
            </Badge>
          )}
        </div>

        {errores.length > 0 && (
          <div className="flex gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-red-600" />
            <div>
              <p className="font-medium text-red-700 dark:text-red-300">
                No se puede guardar el asiento
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-red-700/90 dark:text-red-300/90">
                {errores.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {exito && (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
            <CircleCheck className="size-5 shrink-0 text-emerald-600" />
            <p className="font-medium text-emerald-700 dark:text-emerald-300">
              Asiento guardado y mayorizado automáticamente.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <Button type="button" onClick={guardar}>
            Guardar asiento
          </Button>
          <Button type="button" variant="ghost" onClick={limpiar}>
            Limpiar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

## File: components/contabilidad-provider.tsx
```typescript
"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { CATALOGO_CUENTAS } from "@/lib/catalogo"
import {
  calcularBalanceGeneral,
  calcularEstadoResultados,
  calcularMayor,
} from "@/lib/contabilidad"
import type { Asiento, Cuenta } from "@/lib/types"

const STORAGE_ASIENTOS = "modulo-contable:asientos"
const STORAGE_CUENTAS = "modulo-contable:cuentas"

const ASIENTOS_EJEMPLO: Asiento[] = [
  {
    id: "a1",
    numero: 1,
    fecha: "2026-01-02",
    concepto: "Aportación inicial de los socios en efectivo y banco.",
    lineas: [
      { codigo: "1101", debe: 10000, haber: 0 },
      { codigo: "1102", debe: 5000, haber: 0 },
      { codigo: "3101", debe: 0, haber: 15000 },
    ],
  },
  {
    id: "a2",
    numero: 2,
    fecha: "2026-01-05",
    concepto: "Compra de mercadería al crédito fiscal, pagada con banco.",
    lineas: [
      { codigo: "1104", debe: 4000, haber: 0 },
      { codigo: "1105", debe: 520, haber: 0 },
      { codigo: "1102", debe: 0, haber: 4520 },
    ],
  },
  {
    id: "a3",
    numero: 3,
    fecha: "2026-01-12",
    concepto: "Venta de mercadería con IVA débito fiscal, cobrada en banco.",
    lineas: [
      { codigo: "1102", debe: 6780, haber: 0 },
      { codigo: "5101", debe: 0, haber: 6000 },
      { codigo: "2103", debe: 0, haber: 780 },
    ],
  },
  {
    id: "a4",
    numero: 4,
    fecha: "2026-01-12",
    concepto: "Registro del costo de la mercadería vendida.",
    lineas: [
      { codigo: "4101", debe: 3000, haber: 0 },
      { codigo: "1104", debe: 0, haber: 3000 },
    ],
  },
  {
    id: "a5",
    numero: 5,
    fecha: "2026-01-20",
    concepto: "Pago de gastos de administración con banco.",
    lineas: [
      { codigo: "4201", debe: 800, haber: 0 },
      { codigo: "1102", debe: 0, haber: 800 },
    ],
  },
]

interface ContabilidadContextValue {
  cuentas: Cuenta[]
  asientos: Asiento[]
  agregarAsiento: (a: Omit<Asiento, "id" | "numero">) => void
  eliminarAsiento: (id: string) => void
  agregarCuenta: (c: Cuenta) => void
  renombrarCuenta: (codigo: string, nombre: string) => void
  /** Elimina una cuenta. Si tiene movimientos no se borra: se marca como eliminada (activa=false). */
  eliminarCuenta: (codigo: string) => { softDeleted: boolean }
  reactivarCuenta: (codigo: string) => void
  cuentaEnUso: (codigo: string) => boolean
  reiniciarEjemplo: () => void
  limpiarTodo: () => void
  cerrarCicloContable: () => void
  mayor: ReturnType<typeof calcularMayor>
  estadoResultados: ReturnType<typeof calcularEstadoResultados>
  balanceGeneral: ReturnType<typeof calcularBalanceGeneral>
}

const ContabilidadContext = createContext<ContabilidadContextValue | null>(null)

export function ContabilidadProvider({ children }: { children: ReactNode }) {
  const [cuentas, setCuentas] = useState<Cuenta[]>(CATALOGO_CUENTAS)
  const [asientos, setAsientos] = useState<Asiento[]>(ASIENTOS_EJEMPLO)
  const [hidratado, setHidratado] = useState(false)

  useEffect(() => {
    try {
      const rawA = localStorage.getItem(STORAGE_ASIENTOS)
      const rawC = localStorage.getItem(STORAGE_CUENTAS)
      if (rawA) setAsientos(JSON.parse(rawA))
      if (rawC) setCuentas(JSON.parse(rawC))
    } catch {
      // Ignorar almacenamiento corrupto; se usa el estado por defecto.
    }
    setHidratado(true)
  }, [])

  useEffect(() => {
    if (!hidratado) return
    localStorage.setItem(STORAGE_ASIENTOS, JSON.stringify(asientos))
    localStorage.setItem(STORAGE_CUENTAS, JSON.stringify(cuentas))
  }, [asientos, cuentas, hidratado])

  const agregarAsiento: ContabilidadContextValue["agregarAsiento"] = (a) => {
    setAsientos((prev) => {
      const numero = prev.reduce((max, x) => Math.max(max, x.numero), 0) + 1
      return [...prev, { ...a, id: crypto.randomUUID(), numero }]
    })
  }

  const eliminarAsiento = (id: string) => setAsientos((prev) => prev.filter((a) => a.id !== id))

  const agregarCuenta = (c: Cuenta) =>
    setCuentas((prev) =>
      prev.some((x) => x.codigo === c.codigo)
        ? prev
        : [...prev, { ...c, activa: true }].sort((a, b) => a.codigo.localeCompare(b.codigo)),
    )

  const cuentaEnUso = (codigo: string) =>
    asientos.some((a) => a.lineas.some((l) => l.codigo === codigo))

  const renombrarCuenta = (codigo: string, nombre: string) =>
    setCuentas((prev) => prev.map((c) => (c.codigo === codigo ? { ...c, nombre } : c)))

  const eliminarCuenta = (codigo: string) => {
    const enUso = asientos.some((a) => a.lineas.some((l) => l.codigo === codigo))
    if (enUso) {
      // No se puede borrar físicamente: la cuenta pertenece a asientos ya registrados.
      setCuentas((prev) => prev.map((c) => (c.codigo === codigo ? { ...c, activa: false } : c)))
      return { softDeleted: true }
    }
    setCuentas((prev) => prev.filter((c) => c.codigo !== codigo))
    return { softDeleted: false }
  }

  const reactivarCuenta = (codigo: string) =>
    setCuentas((prev) => prev.map((c) => (c.codigo === codigo ? { ...c, activa: true } : c)))

  const reiniciarEjemplo = () => {
    setCuentas(CATALOGO_CUENTAS)
    setAsientos(ASIENTOS_EJEMPLO)
  }

  const limpiarTodo = () => setAsientos([])

  const cerrarCicloContable = () => {
    const saldos = calcularMayor(cuentas, asientos).filter((s) => s.cuenta.tipo !== "ingreso" && s.cuenta.tipo !== "gasto")
    const utilidad = calcularEstadoResultados(calcularMayor(cuentas, asientos)).utilidad
    const cuentaCapital = cuentas.find((cuenta) => cuenta.tipo === "capital" && cuenta.activa)
    const lineas = saldos
      .map((saldo) => {
        const importe = Math.abs(saldo.saldo)
        if (!importe) return null
        const esDeudora = saldo.cuenta.naturaleza === "deudora"
        return { codigo: saldo.cuenta.codigo, debe: esDeudora ? importe : 0, haber: esDeudora ? 0 : importe }
      })
      .filter((linea): linea is { codigo: string; debe: number; haber: number } => Boolean(linea))

    if (utilidad !== 0 && cuentaCapital) {
      lineas.push({ codigo: cuentaCapital.codigo, debe: utilidad < 0 ? Math.abs(utilidad) : 0, haber: utilidad > 0 ? utilidad : 0 })
    }

    const debe = lineas.reduce((total, linea) => total + linea.debe, 0)
    const haber = lineas.reduce((total, linea) => total + linea.haber, 0)
    if (!lineas.length || Math.abs(debe - haber) >= 0.01) return

    setAsientos([{ id: crypto.randomUUID(), numero: 1, fecha: new Date().toISOString().slice(0, 10), concepto: "Asiento de apertura del nuevo ejercicio contable", lineas }])
  }

  const mayor = useMemo(() => calcularMayor(cuentas, asientos), [cuentas, asientos])
  const estadoResultados = useMemo(() => calcularEstadoResultados(mayor), [mayor])
  const balanceGeneral = useMemo(
    () => calcularBalanceGeneral(mayor, estadoResultados.utilidad),
    [mayor, estadoResultados.utilidad],
  )

  const value: ContabilidadContextValue = {
    cuentas,
    asientos,
    agregarAsiento,
    eliminarAsiento,
    agregarCuenta,
    renombrarCuenta,
    eliminarCuenta,
    reactivarCuenta,
    cuentaEnUso,
    reiniciarEjemplo,
    limpiarTodo,
    cerrarCicloContable,
    mayor,
    estadoResultados,
    balanceGeneral,
  }

  return <ContabilidadContext.Provider value={value}>{children}</ContabilidadContext.Provider>
}

export function useContabilidad() {
  const ctx = useContext(ContabilidadContext)
  if (!ctx) throw new Error("useContabilidad debe usarse dentro de ContabilidadProvider")
  return ctx
}
```

## File: lib/catalogo.ts
```typescript
import type { Cuenta } from "./types"

/**
 * Catálogo de Cuentas base (equivale al futuro data.sql).
 * Clasificación por primer dígito:
 *  1 = Activo, 2 = Pasivo, 3 = Capital contable, 4 = Costos y gastos, 5 = Ingresos
 */
export const CATALOGO_CUENTAS: Cuenta[] = [
  // 1 - Activo (naturaleza deudora)
  { codigo: "1101", nombre: "Caja general", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1102", nombre: "Bancos", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1103", nombre: "Cuentas por cobrar", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1104", nombre: "Inventario de mercadería", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1105", nombre: "IVA crédito fiscal", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1201", nombre: "Mobiliario y equipo", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1202", nombre: "Equipo de transporte", tipo: "activo", naturaleza: "deudora", activa: true },

  // 2 - Pasivo (naturaleza acreedora)
  { codigo: "2101", nombre: "Cuentas por pagar", tipo: "pasivo", naturaleza: "acreedora", activa: true },
  { codigo: "2102", nombre: "Préstamos bancarios por pagar", tipo: "pasivo", naturaleza: "acreedora", activa: true },
  { codigo: "2103", nombre: "IVA débito fiscal", tipo: "pasivo", naturaleza: "acreedora", activa: true },
  { codigo: "2104", nombre: "Impuestos por pagar", tipo: "pasivo", naturaleza: "acreedora", activa: true },

  // 3 - Capital contable (naturaleza acreedora)
  { codigo: "3101", nombre: "Capital social", tipo: "capital", naturaleza: "acreedora", activa: true },
  { codigo: "3102", nombre: "Utilidades acumuladas", tipo: "capital", naturaleza: "acreedora", activa: true },
  { codigo: "3103", nombre: "Reserva legal", tipo: "capital", naturaleza: "acreedora", activa: true },

  // 4 - Costos y gastos (naturaleza deudora)
  //   41 = costo de ventas · 42 = gastos de operación · 43 = gastos financieros
  { codigo: "4101", nombre: "Costo de venta", tipo: "gasto", naturaleza: "deudora", activa: true },
  { codigo: "4201", nombre: "Gastos de administración", tipo: "gasto", naturaleza: "deudora", activa: true },
  { codigo: "4202", nombre: "Gastos de venta", tipo: "gasto", naturaleza: "deudora", activa: true },
  { codigo: "4301", nombre: "Gastos financieros", tipo: "gasto", naturaleza: "deudora", activa: true },

  // 5 - Ingresos (naturaleza acreedora)
  //   51 = ventas / operativos · 52 = ingresos financieros
  { codigo: "5101", nombre: "Ventas", tipo: "ingreso", naturaleza: "acreedora", activa: true },
  { codigo: "5102", nombre: "Otros ingresos operativos", tipo: "ingreso", naturaleza: "acreedora", activa: true },
  { codigo: "5201", nombre: "Productos financieros", tipo: "ingreso", naturaleza: "acreedora", activa: true },
]
```

## File: lib/contabilidad.ts
```typescript
import type { Asiento, AsientoLinea, Cuenta, SaldoCuenta, TipoCuenta } from "./types"
import { subgrupoResultados } from "./types"

export function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function formatoMoneda(n: number): string {
  return new Intl.NumberFormat("es-SV", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n || 0)
}

export function totalesAsiento(lineas: AsientoLinea[]) {
  const debe = redondear(lineas.reduce((s, l) => s + (Number(l.debe) || 0), 0))
  const haber = redondear(lineas.reduce((s, l) => s + (Number(l.haber) || 0), 0))
  return { debe, haber, diferencia: redondear(debe - haber) }
}

export interface ResultadoValidacion {
  valido: boolean
  errores: string[]
}

/**
 * Valida la Partida Doble y la integridad del asiento.
 * El sistema debe bloquear el guardado si no se cumple.
 */
export function validarPartidaDoble(
  fecha: string,
  concepto: string,
  lineas: AsientoLinea[],
): ResultadoValidacion {
  const errores: string[] = []

  if (!fecha) errores.push("La fecha del asiento es obligatoria.")
  if (!concepto.trim()) errores.push("El concepto del asiento es obligatorio.")

  const lineasConCuenta = lineas.filter((l) => l.codigo)
  if (lineasConCuenta.length < 2) {
    errores.push("Un asiento debe tener al menos dos cuentas (un cargo y un abono).")
  }

  for (const l of lineasConCuenta) {
    const debe = Number(l.debe) || 0
    const haber = Number(l.haber) || 0
    if (debe < 0 || haber < 0) {
      errores.push(`La cuenta ${l.codigo} tiene valores negativos.`)
    }
    if (debe > 0 && haber > 0) {
      errores.push(`La cuenta ${l.codigo} no puede tener Debe y Haber a la vez.`)
    }
    if (debe === 0 && haber === 0) {
      errores.push(`La cuenta ${l.codigo} no tiene ningún movimiento.`)
    }
  }

  const { debe, haber } = totalesAsiento(lineasConCuenta)
  if (debe === 0 && haber === 0) {
    errores.push("El asiento no tiene importes registrados.")
  } else if (debe !== haber) {
    errores.push(
      `No se cumple la Partida Doble: el total del Debe (${formatoMoneda(debe)}) debe ser igual al total del Haber (${formatoMoneda(haber)}).`,
    )
  }

  return { valido: errores.length === 0, errores }
}

/**
 * Mayorización automática: consolida débitos y créditos de cada cuenta
 * del catálogo y determina el saldo (Deudor / Acreedor).
 */
export function calcularMayor(cuentas: Cuenta[], asientos: Asiento[]): SaldoCuenta[] {
  return cuentas
    .map((cuenta) => {
      let debe = 0
      let haber = 0
      for (const asiento of asientos) {
        for (const linea of asiento.lineas) {
          if (linea.codigo === cuenta.codigo) {
            debe += Number(linea.debe) || 0
            haber += Number(linea.haber) || 0
          }
        }
      }
      debe = redondear(debe)
      haber = redondear(haber)
      const saldo = redondear(debe - haber)
      const naturalezaSaldo = saldo === 0 ? null : saldo > 0 ? "deudora" : "acreedora"
      return { cuenta, debe, haber, saldo, naturalezaSaldo }
    })
    .filter((s) => s.debe !== 0 || s.haber !== 0)
}

/** Saldo mostrado según la naturaleza de la cuenta (siempre positivo cuando es normal). */
export function saldoNormalizado(s: SaldoCuenta): number {
  return s.cuenta.naturaleza === "deudora" ? redondear(s.debe - s.haber) : redondear(s.haber - s.debe)
}

export interface LineaReporte {
  cuenta: Cuenta
  monto: number
}

export interface EstadoResultados {
  ingresos: LineaReporte[]
  gastos: LineaReporte[]
  // Desglose en cascada
  ventas: LineaReporte[]
  costoVentas: LineaReporte[]
  gastosOperacion: LineaReporte[]
  ingresosFinancieros: LineaReporte[]
  gastosFinancieros: LineaReporte[]
  totalVentas: number
  totalCostoVentas: number
  utilidadBruta: number
  totalGastosOperacion: number
  utilidadOperacion: number
  totalIngresosFinancieros: number
  totalGastosFinancieros: number
  resultadoFinanciero: number
  totalIngresos: number
  totalGastos: number
  utilidad: number
}

/**
 * Estado de Resultados: código 5 (ingresos) - código 4 (costos y gastos) = utilidad.
 * Además arma el reporte en cascada (ventas → utilidad bruta → utilidad de operación → utilidad neta)
 * clasificando cada cuenta por sus dos primeros dígitos.
 */
export function calcularEstadoResultados(mayor: SaldoCuenta[]): EstadoResultados {
  const ingresos: LineaReporte[] = []
  const gastos: LineaReporte[] = []
  const ventas: LineaReporte[] = []
  const costoVentas: LineaReporte[] = []
  const gastosOperacion: LineaReporte[] = []
  const ingresosFinancieros: LineaReporte[] = []
  const gastosFinancieros: LineaReporte[] = []

  for (const s of mayor) {
    if (s.cuenta.tipo === "ingreso") {
      const linea = { cuenta: s.cuenta, monto: redondear(s.haber - s.debe) }
      ingresos.push(linea)
      if (subgrupoResultados(s.cuenta.codigo, "ingreso") === "ingresosFinancieros") {
        ingresosFinancieros.push(linea)
      } else {
        ventas.push(linea)
      }
    } else if (s.cuenta.tipo === "gasto") {
      const linea = { cuenta: s.cuenta, monto: redondear(s.debe - s.haber) }
      gastos.push(linea)
      const sub = subgrupoResultados(s.cuenta.codigo, "gasto")
      if (sub === "costoVentas") costoVentas.push(linea)
      else if (sub === "gastosFinancieros") gastosFinancieros.push(linea)
      else gastosOperacion.push(linea)
    }
  }

  const suma = (arr: LineaReporte[]) => redondear(arr.reduce((a, b) => a + b.monto, 0))
  const totalVentas = suma(ventas)
  const totalCostoVentas = suma(costoVentas)
  const utilidadBruta = redondear(totalVentas - totalCostoVentas)
  const totalGastosOperacion = suma(gastosOperacion)
  const utilidadOperacion = redondear(utilidadBruta - totalGastosOperacion)
  const totalIngresosFinancieros = suma(ingresosFinancieros)
  const totalGastosFinancieros = suma(gastosFinancieros)
  const resultadoFinanciero = redondear(totalIngresosFinancieros - totalGastosFinancieros)
  const totalIngresos = suma(ingresos)
  const totalGastos = suma(gastos)

  return {
    ingresos,
    gastos,
    ventas,
    costoVentas,
    gastosOperacion,
    ingresosFinancieros,
    gastosFinancieros,
    totalVentas,
    totalCostoVentas,
    utilidadBruta,
    totalGastosOperacion,
    utilidadOperacion,
    totalIngresosFinancieros,
    totalGastosFinancieros,
    resultadoFinanciero,
    totalIngresos,
    totalGastos,
    utilidad: redondear(totalIngresos - totalGastos),
  }
}

export interface BalanceGeneral {
  activos: LineaReporte[]
  pasivos: LineaReporte[]
  capital: LineaReporte[]
  totalActivo: number
  totalPasivo: number
  totalCapitalContable: number
  utilidadEjercicio: number
  totalPasivoMasCapital: number
  cuadra: boolean
}

/** Balance General: código 1 (activo) = código 2 (pasivo) + código 3 (capital contable) */
export function calcularBalanceGeneral(mayor: SaldoCuenta[], utilidadEjercicio: number): BalanceGeneral {
  const activos: LineaReporte[] = []
  const pasivos: LineaReporte[] = []
  const capital: LineaReporte[] = []

  for (const s of mayor) {
    if (s.cuenta.tipo === "activo") {
      activos.push({ cuenta: s.cuenta, monto: redondear(s.debe - s.haber) })
    } else if (s.cuenta.tipo === "pasivo") {
      pasivos.push({ cuenta: s.cuenta, monto: redondear(s.haber - s.debe) })
    } else if (s.cuenta.tipo === "capital") {
      capital.push({ cuenta: s.cuenta, monto: redondear(s.haber - s.debe) })
    }
  }

  const totalActivo = redondear(activos.reduce((a, b) => a + b.monto, 0))
  const totalPasivo = redondear(pasivos.reduce((a, b) => a + b.monto, 0))
  const totalCapitalCuentas = redondear(capital.reduce((a, b) => a + b.monto, 0))
  const totalCapitalContable = redondear(totalCapitalCuentas + utilidadEjercicio)
  const totalPasivoMasCapital = redondear(totalPasivo + totalCapitalContable)

  return {
    activos,
    pasivos,
    capital,
    totalActivo,
    totalPasivo,
    totalCapitalContable,
    utilidadEjercicio,
    totalPasivoMasCapital,
    cuadra: Math.abs(totalActivo - totalPasivoMasCapital) < 0.01,
  }
}

export interface Totales {
  totalPorTipo: Record<TipoCuenta, number>
  totalDebe: number
  totalHaber: number
  numeroAsientos: number
}
```

## File: lib/types.ts
```typescript
export type Naturaleza = "deudora" | "acreedora"

export type TipoCuenta = "activo" | "pasivo" | "capital" | "gasto" | "ingreso"

export interface Cuenta {
  codigo: string
  nombre: string
  tipo: TipoCuenta
  naturaleza: Naturaleza
  /** Cuenta activa. Una cuenta usada en asientos no se borra: se marca como eliminada (activa=false). */
  activa: boolean
}

/**
 * Subclasificación del Estado de Resultados por los dos primeros dígitos del código.
 * Permite armar el reporte en cascada (ventas, costo de ventas, gastos de operación, financieros).
 */
export type SubgrupoResultados =
  | "ventas"
  | "costoVentas"
  | "gastosOperacion"
  | "ingresosFinancieros"
  | "gastosFinancieros"

export function subgrupoResultados(codigo: string, tipo: TipoCuenta): SubgrupoResultados | null {
  const p = codigo.trim().slice(0, 2)
  if (tipo === "ingreso") {
    return p === "52" ? "ingresosFinancieros" : "ventas"
  }
  if (tipo === "gasto") {
    if (p === "41") return "costoVentas"
    if (p === "43") return "gastosFinancieros"
    return "gastosOperacion"
  }
  return null
}

export interface AsientoLinea {
  codigo: string
  debe: number
  haber: number
}

export interface Asiento {
  id: string
  numero: number
  fecha: string
  concepto: string
  lineas: AsientoLinea[]
}

export interface SaldoCuenta {
  cuenta: Cuenta
  debe: number
  haber: number
  saldo: number
  naturalezaSaldo: Naturaleza | null
}

/** Devuelve el grupo contable a partir del primer dígito del código de cuenta. */
export function grupoPorDigito(codigo: string): TipoCuenta | null {
  switch (codigo.trim().charAt(0)) {
    case "1":
      return "activo"
    case "2":
      return "pasivo"
    case "3":
      return "capital"
    case "4":
      return "gasto"
    case "5":
      return "ingreso"
    default:
      return null
  }
}

export const ETIQUETA_TIPO: Record<TipoCuenta, string> = {
  activo: "Activo",
  pasivo: "Pasivo",
  capital: "Capital contable",
  gasto: "Costos y gastos",
  ingreso: "Ingresos",
}
```

## File: lib/utils.ts
```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

## File: public/icon.svg
```xml
<svg width="180" height="180" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    @media (prefers-color-scheme: light) {
      .background { fill: black; }
      .foreground { fill: white; }
    }
    @media (prefers-color-scheme: dark) {
      .background { fill: white; }
      .foreground { fill: black; }
    }
  </style>
  <g clip-path="url(#clip0_7960_43945)">
    <rect class="background" width="180" height="180" rx="37" />
    <g style="transform: scale(95%); transform-origin: center">
      <path class="foreground"
        d="M101.141 53H136.632C151.023 53 162.689 64.6662 162.689 79.0573V112.904H148.112V79.0573C148.112 78.7105 148.098 78.3662 148.072 78.0251L112.581 112.898C112.701 112.902 112.821 112.904 112.941 112.904H148.112V126.672H112.941C98.5504 126.672 86.5638 114.891 86.5638 100.5V66.7434H101.141V100.5C101.141 101.15 101.191 101.792 101.289 102.422L137.56 66.7816C137.255 66.7563 136.945 66.7434 136.632 66.7434H101.141V53Z" />
      <path class="foreground"
        d="M65.2926 124.136L14 66.7372H34.6355L64.7495 100.436V66.7372H80.1365V118.47C80.1365 126.278 70.4953 129.958 65.2926 124.136Z" />
    </g>
  </g>
  <defs>
    <clipPath id="clip0_7960_43945">
      <rect width="180" height="180" fill="white" />
    </clipPath>
  </defs>
</svg>
```

## File: public/placeholder-logo.svg
```xml
<svg xmlns="http://www.w3.org/2000/svg" width="215" height="48" fill="none"><path fill="#000" d="M57.588 9.6h6L73.828 38h-5.2l-2.36-6.88h-11.36L52.548 38h-5.2l10.24-28.4Zm7.16 17.16-4.16-12.16-4.16 12.16h8.32Zm23.694-2.24c-.186-1.307-.706-2.32-1.56-3.04-.853-.72-1.866-1.08-3.04-1.08-1.68 0-2.986.613-3.92 1.84-.906 1.227-1.36 2.947-1.36 5.16s.454 3.933 1.36 5.16c.934 1.227 2.24 1.84 3.92 1.84 1.254 0 2.307-.373 3.16-1.12.854-.773 1.387-1.867 1.6-3.28l5.12.24c-.186 1.68-.733 3.147-1.64 4.4-.906 1.227-2.08 2.173-3.52 2.84-1.413.667-2.986 1-4.72 1-2.08 0-3.906-.453-5.48-1.36-1.546-.907-2.76-2.2-3.64-3.88-.853-1.68-1.28-3.627-1.28-5.84 0-2.24.427-4.187 1.28-5.84.88-1.68 2.094-2.973 3.64-3.88 1.574-.907 3.4-1.36 5.48-1.36 1.68 0 3.227.32 4.64.96 1.414.64 2.56 1.56 3.44 2.76.907 1.2 1.454 2.6 1.64 4.2l-5.12.28Zm11.486-7.72.12 3.4c.534-1.227 1.307-2.173 2.32-2.84 1.04-.693 2.267-1.04 3.68-1.04 1.494 0 2.76.387 3.8 1.16 1.067.747 1.827 1.813 2.28 3.2.507-1.44 1.294-2.52 2.36-3.24 1.094-.747 2.414-1.12 3.96-1.12 1.414 0 2.64.307 3.68.92s1.84 1.52 2.4 2.72c.56 1.2.84 2.667.84 4.4V38h-4.96V25.92c0-1.813-.293-3.187-.88-4.12-.56-.96-1.413-1.44-2.56-1.44-.906 0-1.68.213-2.32.64-.64.427-1.133 1.053-1.48 1.88-.32.827-.48 1.84-.48 3.04V38h-4.56V25.92c0-1.2-.133-2.213-.4-3.04-.24-.827-.626-1.453-1.16-1.88-.506-.427-1.133-.64-1.88-.64-.906 0-1.68.227-2.32.68-.64.427-1.133 1.053-1.48 1.88-.32.827-.48 1.827-.48 3V38h-4.96V16.8h4.48Zm26.723 10.6c0-2.24.427-4.187 1.28-5.84.854-1.68 2.067-2.973 3.64-3.88 1.574-.907 3.4-1.36 5.48-1.36 1.84 0 3.494.413 4.96 1.24 1.467.827 2.64 2.08 3.52 3.76.88 1.653 1.347 3.693 1.4 6.12v1.32h-15.08c.107 1.813.614 3.227 1.52 4.24.907.987 2.134 1.48 3.68 1.48.987 0 1.88-.253 2.68-.76a4.803 4.803 0 0 0 1.84-2.2l5.08.36c-.64 2.027-1.84 3.64-3.6 4.84-1.733 1.173-3.733 1.76-6 1.76-2.08 0-3.906-.453-5.48-1.36-1.573-.907-2.786-2.2-3.64-3.88-.853-1.68-1.28-3.627-1.28-5.84Zm15.16-2.04c-.213-1.733-.76-3.013-1.64-3.84-.853-.827-1.893-1.24-3.12-1.24-1.44 0-2.6.453-3.48 1.36-.88.88-1.44 2.12-1.68 3.72h9.92ZM163.139 9.6V38h-5.04V9.6h5.04Zm8.322 7.2.24 5.88-.64-.36c.32-2.053 1.094-3.56 2.32-4.52 1.254-.987 2.787-1.48 4.6-1.48 2.32 0 4.107.733 5.36 2.2 1.254 1.44 1.88 3.387 1.88 5.84V38h-4.96V25.92c0-1.253-.12-2.28-.36-3.08-.24-.8-.64-1.413-1.2-1.84-.533-.427-1.253-.64-2.16-.64-1.44 0-2.573.48-3.4 1.44-.8.933-1.2 2.307-1.2 4.12V38h-4.96V16.8h4.48Zm30.003 7.72c-.186-1.307-.706-2.32-1.56-3.04-.853-.72-1.866-1.08-3.04-1.08-1.68 0-2.986.613-3.92 1.84-.906 1.227-1.36 2.947-1.36 5.16s.454 3.933 1.36 5.16c.934 1.227 2.24 1.84 3.92 1.84 1.254 0 2.307-.373 3.16-1.12.854-.773 1.387-1.867 1.6-3.28l5.12.24c-.186 1.68-.733 3.147-1.64 4.4-.906 1.227-2.08 2.173-3.52 2.84-1.413.667-2.986 1-4.72 1-2.08 0-3.906-.453-5.48-1.36-1.546-.907-2.76-2.2-3.64-3.88-.853-1.68-1.28-3.627-1.28-5.84 0-2.24.427-4.187 1.28-5.84.88-1.68 2.094-2.973 3.64-3.88 1.574-.907 3.4-1.36 5.48-1.36 1.68 0 3.227.32 4.64.96 1.414.64 2.56 1.56 3.44 2.76.907 1.2 1.454 2.6 1.64 4.2l-5.12.28Zm11.443 8.16V38h-5.6v-5.32h5.6Z"/><path fill="#171717" fill-rule="evenodd" d="m7.839 40.783 16.03-28.054L20 6 0 40.783h7.839Zm8.214 0H40L27.99 19.894l-4.02 7.032 3.976 6.914H20.02l-3.967 6.943Z" clip-rule="evenodd"/></svg>
```

## File: public/placeholder.svg
```xml
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" fill="none"><rect width="1200" height="1200" fill="#EAEAEA" rx="3"/><g opacity=".5"><g opacity=".5"><path fill="#FAFAFA" d="M600.709 736.5c-75.454 0-136.621-61.167-136.621-136.62 0-75.454 61.167-136.621 136.621-136.621 75.453 0 136.62 61.167 136.62 136.621 0 75.453-61.167 136.62-136.62 136.62Z"/><path stroke="#C9C9C9" stroke-width="2.418" d="M600.709 736.5c-75.454 0-136.621-61.167-136.621-136.62 0-75.454 61.167-136.621 136.621-136.621 75.453 0 136.62 61.167 136.62 136.621 0 75.453-61.167 136.62-136.62 136.62Z"/></g><path stroke="url(#a)" stroke-width="2.418" d="M0-1.209h553.581" transform="scale(1 -1) rotate(45 1163.11 91.165)"/><path stroke="url(#b)" stroke-width="2.418" d="M404.846 598.671h391.726"/><path stroke="url(#c)" stroke-width="2.418" d="M599.5 795.742V404.017"/><path stroke="url(#d)" stroke-width="2.418" d="m795.717 796.597-391.441-391.44"/><path fill="#fff" d="M600.709 656.704c-31.384 0-56.825-25.441-56.825-56.824 0-31.384 25.441-56.825 56.825-56.825 31.383 0 56.824 25.441 56.824 56.825 0 31.383-25.441 56.824-56.824 56.824Z"/><g clip-path="url(#e)"><path fill="#666" fill-rule="evenodd" d="M616.426 586.58h-31.434v16.176l3.553-3.554.531-.531h9.068l.074-.074 8.463-8.463h2.565l7.18 7.181V586.58Zm-15.715 14.654 3.698 3.699 1.283 1.282-2.565 2.565-1.282-1.283-5.2-5.199h-6.066l-5.514 5.514-.073.073v2.876a2.418 2.418 0 0 0 2.418 2.418h26.598a2.418 2.418 0 0 0 2.418-2.418v-8.317l-8.463-8.463-7.181 7.181-.071.072Zm-19.347 5.442v4.085a6.045 6.045 0 0 0 6.046 6.045h26.598a6.044 6.044 0 0 0 6.045-6.045v-7.108l1.356-1.355-1.282-1.283-.074-.073v-17.989h-38.689v23.43l-.146.146.146.147Z" clip-rule="evenodd"/></g><path stroke="#C9C9C9" stroke-width="2.418" d="M600.709 656.704c-31.384 0-56.825-25.441-56.825-56.824 0-31.384 25.441-56.825 56.825-56.825 31.383 0 56.824 25.441 56.824 56.825 0 31.383-25.441 56.824-56.824 56.824Z"/></g><defs><linearGradient id="a" x1="554.061" x2="-.48" y1=".083" y2=".087" gradientUnits="userSpaceOnUse"><stop stop-color="#C9C9C9" stop-opacity="0"/><stop offset=".208" stop-color="#C9C9C9"/><stop offset=".792" stop-color="#C9C9C9"/><stop offset="1" stop-color="#C9C9C9" stop-opacity="0"/></linearGradient><linearGradient id="b" x1="796.912" x2="404.507" y1="599.963" y2="599.965" gradientUnits="userSpaceOnUse"><stop stop-color="#C9C9C9" stop-opacity="0"/><stop offset=".208" stop-color="#C9C9C9"/><stop offset=".792" stop-color="#C9C9C9"/><stop offset="1" stop-color="#C9C9C9" stop-opacity="0"/></linearGradient><linearGradient id="c" x1="600.792" x2="600.794" y1="403.677" y2="796.082" gradientUnits="userSpaceOnUse"><stop stop-color="#C9C9C9" stop-opacity="0"/><stop offset=".208" stop-color="#C9C9C9"/><stop offset=".792" stop-color="#C9C9C9"/><stop offset="1" stop-color="#C9C9C9" stop-opacity="0"/></linearGradient><linearGradient id="d" x1="404.85" x2="796.972" y1="403.903" y2="796.02" gradientUnits="userSpaceOnUse"><stop stop-color="#C9C9C9" stop-opacity="0"/><stop offset=".208" stop-color="#C9C9C9"/><stop offset=".792" stop-color="#C9C9C9"/><stop offset="1" stop-color="#C9C9C9" stop-opacity="0"/></linearGradient><clipPath id="e"><path fill="#fff" d="M581.364 580.535h38.689v38.689h-38.689z"/></clipPath></defs></svg>
```

## File: .gitignore
```
# v0 sandbox internal files
__v0_runtime_loader.js
__v0_devtools.tsx
__v0_jsx-dev-runtime.ts
.snowflake/
.v0-trash/
.vercel/

# Environment variables
.env*.local

# Common ignores
node_modules
.next/
.DS_Store
```

## File: components.json
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

## File: next.config.mjs
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
```

## File: package.json
```json
{
  "name": "my-project",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@12.3.4",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@base-ui/react": "^1.5.0",
    "@vercel/analytics": "1.6.1",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "jspdf": "^4.2.1",
    "jspdf-autotable": "^5.0.8",
    "lucide-react": "^1.16.0",
    "next": "16.3.3",
    "react": "^19",
    "react-dom": "^19",
    "shadcn": "^4.11.0",
    "tailwind-merge": "^3.3.1",
    "tw-animate-css": "^1.4.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.3.3",
    "@types/node": "^24",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "postcss": "^8.5",
    "tailwindcss": "^4.3.3",
    "typescript": "5.7.3"
  }
}
```

## File: pnpm-workspace.yaml
```yaml
pmOnFail: ignore

minimumReleaseAgeExclude:
  - '@next/*'
  - next

allowBuilds:
  core-js: set this to true or false
```

## File: postcss.config.mjs
```javascript
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
```

## File: tsconfig.json
```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "target": "ES6",
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```
