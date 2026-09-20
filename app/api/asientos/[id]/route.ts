import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })
  try {
    const { id } = await params
    await pool.query("DELETE FROM asiento WHERE id = $1", [id])
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al eliminar asiento"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
