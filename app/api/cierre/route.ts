import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function POST() {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })
  try {
    const res = await pool.query("SELECT sp_cerrar_ciclo_contable() AS nuevo_asiento_id")
    return NextResponse.json({ success: true, asientoId: res.rows[0]?.nuevo_asiento_id })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al cerrar ciclo contable"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
