import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function GET() {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })
  try {
    const res = await pool.query(`
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
        creado_en::text AS creado_en
      FROM asiento_historial
      ORDER BY creado_en DESC
    `)
    return NextResponse.json(res.rows)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al obtener historial de auditoría"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
