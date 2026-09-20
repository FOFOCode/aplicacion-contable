import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function GET() {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })
  try {
    const resAsientos = await pool.query(
      "SELECT id, numero, fecha::text, concepto FROM asiento ORDER BY numero ASC"
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
      numero: a.numero,
      fecha: a.fecha,
      concepto: a.concepto,
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

    await client.query("BEGIN")
    const resA = await client.query(
      "INSERT INTO asiento (fecha, concepto, tipo) VALUES ($1, $2, 'OPERACION') RETURNING id, numero",
      [fecha, concepto]
    )
    const asientoId = resA.rows[0].id
    const numero = resA.rows[0].numero

    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i]
      await client.query(
        "INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES ($1, $2, $3, $4, $5)",
        [asientoId, i + 1, l.codigo, Number(l.debe) || 0, Number(l.haber) || 0]
      )
    }

    await client.query("COMMIT")
    return NextResponse.json({ id: asientoId, numero })
  } catch (e: unknown) {
    await client.query("ROLLBACK")
    const msg = e instanceof Error ? e.message : "Error al guardar el asiento"
    return NextResponse.json({ error: msg }, { status: 400 })
  } finally {
    client.release()
  }
}
