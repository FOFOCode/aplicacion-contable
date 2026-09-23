import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })
  try {
    const { id } = await params
    let motivo = "Anulación contable por corrección/auditoría"
    try {
      const body = await req.json()
      if (body?.motivo) motivo = String(body.motivo)
    } catch {
      // Body opcional
    }

    // Por auditoría contable no se elimina en cascada: se anula y se preserva el historial
    await pool.query("SELECT sp_anular_asiento($1, $2)", [id, motivo])
    return NextResponse.json({ success: true, anulado: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al anular asiento"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
