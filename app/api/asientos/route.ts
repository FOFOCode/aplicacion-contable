import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function GET(req: Request) {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })
  try {
    const { searchParams } = new URL(req.url)
    const ejercicioParam = searchParams.get("ejercicio")
    let query = "SELECT id, correlativo_global, ejercicio, numero, fecha::text, concepto, tipo, estado, anulado_en::text, motivo_anulacion FROM asiento"
    const params: unknown[] = []
    if (ejercicioParam) {
      query += " WHERE ejercicio = $1"
      params.push(parseInt(ejercicioParam, 10))
    }
    query += " ORDER BY fecha DESC, numero DESC"

    const resAsientos = await pool.query(query, params)
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
    const { fecha, concepto, lineas, usuario_email } = await req.json()
    const email = usuario_email || "admin@contable.sv"

    if (!Array.isArray(lineas) || lineas.length < 2) {
      return NextResponse.json(
        { error: "El asiento debe tener al menos dos líneas." },
        { status: 400 }
      )
    }

    const ejercicio = fecha ? parseInt(fecha.split("-")[0], 10) : new Date().getFullYear()

    await client.query("BEGIN")

    // El número es asignado de forma única, atómica y segura por el trigger de PostgreSQL (trg_asiento_validar_numero)
    // evitando el riesgo de doble incremento o condición de carrera (Split-Brain).
    const resA = await client.query(
      "INSERT INTO asiento (ejercicio, fecha, concepto, tipo, estado) VALUES ($1, $2, $3, 'OPERACION', 'APLICADO') RETURNING id, correlativo_global, numero, ejercicio",
      [ejercicio, fecha, concepto]
    )
    const asientoId = resA.rows[0].id
    const correlativo_global = resA.rows[0].correlativo_global
    const numero = resA.rows[0].numero

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

    // Registrar traza en el historial de auditoría con identificación de autoría legal
    await client.query(
      "INSERT INTO asiento_historial (asiento_id, accion, ejercicio, numero, concepto, total_debe, total_haber, motivo, usuario_email) VALUES ($1, 'CREACION', $2, $3, $4, $5, $6, 'Registro regular de partida contable', $7)",
      [asientoId, ejercicio, numero, concepto, totalDebe, totalHaber, email]
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
