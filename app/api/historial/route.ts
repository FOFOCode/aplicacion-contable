import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function GET(req: Request) {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })
  try {
    const { searchParams } = new URL(req.url)
    const ejercicioParam = searchParams.get("ejercicio")
    let query = `
      SELECT 
        id,
        asiento_id,
        accion,
        ejercicio,
        numero,
        concepto,
        total_debe::float AS total_debe,
        total_haber::float AS total_haber,
        motivo,
        usuario_email,
        creado_en::text AS creado_en
      FROM asiento_historial`
    const params: unknown[] = []
    if (ejercicioParam) {
      query += ` WHERE ejercicio = $1`
      params.push(parseInt(ejercicioParam, 10))
    }
    query += ` ORDER BY creado_en DESC`

    const res = await pool.query(query, params)
    return NextResponse.json(res.rows)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al obtener historial de auditoría"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
