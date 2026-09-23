import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function GET() {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })
  try {
    const resAsientos = await pool.query(
      "SELECT id, correlativo_global, ejercicio, numero, fecha::text, concepto, tipo, estado, anulado_en::text, motivo_anulacion FROM asiento ORDER BY fecha DESC, numero DESC"
    )
    const resLineas = await pool.query(
      "SELECT asiento_id, cuenta_codigo, debe::float, haber::float, linea_numero FROM asiento_linea ORDER BY asiento_id, linea_numero ASC"
    )

    const lineasByAsiento = new Map<string, Array<{ codigo: string; debe: number; haber: number }>>()
    for (const l of resLineas.rows) {
      if (!lineasByAsiento.has(l.asiento_id)) {
        lineasByAsiento.set(l.asiento_id, [])
      }
      lineasByAsiento.get(l.asiento_id)!.push({
        codigo: l.cuenta_codigo,
        debe: Number(l.debe) || 0,
        haber: Number(l.haber) || 0,
      })
    }

    const asientos = resAsientos.rows.map((a) => ({
      id: a.id,
      correlativo_global: a.correlativo_global,
      ejercicio: a.ejercicio,
      numero: a.numero,
      fecha: a.fecha,
      concepto: a.concepto,
      tipo: a.tipo,
      estado: a.estado,
      anulado_en: a.anulado_en,
      motivo_anulacion: a.motivo_anulacion,
      lineas: lineasByAsiento.get(a.id) || [],
    }))

    return NextResponse.json(asientos)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al obtener asientos"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })

  const client = await pool.connect()
  try {
    const { fecha, concepto, lineas } = await req.json()

    if (!Array.isArray(lineas) || lineas.length < 2) {
      return NextResponse.json(
        { error: "El asiento debe tener al menos dos líneas." },
        { status: 400 }
      )
    }

    const ejercicio = fecha ? new Date(fecha).getFullYear() : new Date().getFullYear()

    await client.query("BEGIN")

    // Obtener número consecutivo específico para este año fiscal
    const numRes = await client.query("SELECT fn_proximo_numero_asiento($1) AS next_num", [ejercicio])
    const numero = numRes.rows[0]?.next_num || 1

    const resA = await client.query(
      "INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) VALUES ($1, $2, $3, $4, 'OPERACION', 'APLICADO') RETURNING id, correlativo_global, numero, ejercicio",
      [ejercicio, numero, fecha, concepto]
    )
    const asientoId = resA.rows[0].id
    const correlativo_global = resA.rows[0].correlativo_global

    let totalDebe = 0
    let totalHaber = 0

    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i]
      const debe = Number(l.debe) || 0
      const haber = Number(l.haber) || 0
      totalDebe += debe
      totalHaber += haber
      await client.query(
        "INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES ($1, $2, $3, $4, $5)",
        [asientoId, i + 1, l.codigo, debe, haber]
      )
    }

    // Registrar traza en el historial de auditoría
    await client.query(
      "INSERT INTO asiento_historial (asiento_id, accion, ejercicio, numero, concepto, total_debe, total_haber, motivo) VALUES ($1, 'CREACION', $2, $3, $4, $5, $6, 'Registro regular de partida contable')",
      [asientoId, ejercicio, numero, concepto, totalDebe, totalHaber]
    )

    await client.query("COMMIT")
    return NextResponse.json({ id: asientoId, correlativo_global, numero, ejercicio, estado: "APLICADO" })
  } catch (e: unknown) {
    await client.query("ROLLBACK")
    const msg = e instanceof Error ? e.message : "Error al guardar el asiento"
    return NextResponse.json({ error: msg }, { status: 400 })
  } finally {
    client.release()
  }
}

