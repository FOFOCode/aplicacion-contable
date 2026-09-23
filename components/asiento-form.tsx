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
  const { cuentas, agregarAsiento, esEjercicioCerrado, ejercicioSeleccionado } = useContabilidad()
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [concepto, setConcepto] = useState("")
  const [lineas, setLineas] = useState<LineaEditable[]>([nuevaLinea(), nuevaLinea()])
  const [errores, setErrores] = useState<string[]>([])
  const [exito, setExito] = useState(false)
  const [guardando, setGuardando] = useState(false)

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

  async function guardar() {
    setExito(false)
    if (esEjercicioCerrado) {
      setErrores([`El ejercicio fiscal ${ejercicioSeleccionado} se encuentra cerrado o bloqueado. No se admiten nuevas operaciones.`])
      return
    }

    const limpias = lineas
      .filter((l) => l.codigo)
      .map(({ codigo, debe, haber }) => ({ codigo, debe: Number(debe) || 0, haber: Number(haber) || 0 }))

    const validacion = validarPartidaDoble(fecha, concepto, limpias)
    if (!validacion.valido) {
      setErrores(validacion.errores)
      return
    }

    setGuardando(true)
    const res = await agregarAsiento({ fecha, concepto: concepto.trim(), lineas: limpias })
    setGuardando(false)

    if (res && !res.success) {
      setErrores([res.error || "Error al guardar el asiento"])
      return
    }

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

        {esEjercicioCerrado && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
            <TriangleAlert className="size-4 shrink-0 text-amber-600" />
            <span>
              El ejercicio fiscal <strong>{ejercicioSeleccionado}</strong> se encuentra CERRADO o BLOQUEADO. No se pueden registrar nuevas partidas contables en este año.
            </span>
          </div>
        )}

        <div className="flex gap-3">
          <Button type="button" onClick={guardar} disabled={esEjercicioCerrado || guardando}>
            {guardando ? "Guardando..." : "Guardar asiento"}
          </Button>
          <Button type="button" variant="ghost" onClick={limpiar} disabled={guardando}>
            Limpiar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
