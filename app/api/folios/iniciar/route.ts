import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function POST(req: Request) {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })

  const client = await pool.connect()
  try {
    const body = await req.json().catch(() => ({}))
    const fecha = body.fecha || new Date().toISOString().slice(0, 10)
    const ejercicio = body.ejercicio
      ? parseInt(String(body.ejercicio), 10)
      : parseInt(fecha.split("-")[0], 10)

    await client.query("BEGIN")

    // Auto-cerrar folios abiertos de fechas anteriores al avanzar al nuevo día
    const prevOpenFolios = await client.query(
      `SELECT id, numero_folio, fecha FROM folio_diario 
       WHERE ejercicio = $1 AND fecha < $2 AND estado = 'ABIERTO'
       ORDER BY fecha ASC`,
      [ejercicio, fecha],
    )

    for (const prev of prevOpenFolios.rows) {
      try {
        await client.query("SELECT * FROM sp_cerrar_folio_diario($1, 'CIERRE_AUTOMATICO_JORNADA')", [prev.id])
      } catch (err) {
        console.warn(`No se pudo auto-cerrar folio previo ${prev.numero_folio} (${prev.fecha}):`, err)
      }
    }

    // Verificar si ya existe un folio para esta fecha y ejercicio
    const existing = await client.query(
      "SELECT id, numero_folio, fecha, estado FROM folio_diario WHERE fecha = $1 AND ejercicio = $2",
      [fecha, ejercicio],
    )

    if (existing.rows.length > 0) {
      await client.query("COMMIT")
      return NextResponse.json(existing.rows[0])
    }

    // Obtener siguiente consecutivo anual
    const numRes = await client.query(
      "SELECT fn_proximo_numero_folio($1) AS next_folio",
      [ejercicio],
    )
    const numeroFolio = numRes.rows[0]?.next_folio || 1

    // Crear el folio
    const insertRes = await client.query(
      `INSERT INTO folio_diario (ejercicio, numero_folio, fecha, estado)
       VALUES ($1, $2, $3, 'ABIERTO')
       RETURNING id, ejercicio, numero_folio, fecha::text, estado, total_debe::float, total_haber::float, creado_en::text`,
      [ejercicio, numeroFolio, fecha],
    )

    const nuevoFolio = insertRes.rows[0]

    // Asociar asientos huérfanos que ya se hayan creado para esta fecha
    await client.query(
      "UPDATE asiento SET folio_diario_id = $1 WHERE fecha = $2 AND folio_diario_id IS NULL",
      [nuevoFolio.id, fecha],
    )

    await client.query("COMMIT")
    return NextResponse.json(nuevoFolio)
  } catch (e: unknown) {
    await client.query("ROLLBACK")
    const msg = e instanceof Error ? e.message : "Error al iniciar folio diario"
    return NextResponse.json({ error: msg }, { status: 500 })
  } finally {
    client.release()
  }
}
