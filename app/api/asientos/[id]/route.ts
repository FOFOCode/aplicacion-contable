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
    let usuarioEmail = "admin@contable.sv"
    try {
      const body = await req.json()
      if (body?.motivo) motivo = String(body.motivo)
      if (body?.usuario_email) usuarioEmail = String(body.usuario_email)
    } catch {
      // Body opcional
    }

    // Por auditoría contable no se elimina en cascada: se anula formalmente con trazabilidad de autor
    await pool.query("SELECT sp_anular_asiento($1, $2, $3)", [id, motivo, usuarioEmail])
    return NextResponse.json({ success: true, anulado: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al anular asiento"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
