import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })
  try {
    const { codigo } = await params
    const { nombre } = await req.json()
    await pool.query(
      "UPDATE catalogo_cuentas SET nombre = $1 WHERE codigo = $2",
      [nombre, codigo]
    )
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al renombrar cuenta"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })
  try {
    const { codigo } = await params
    // Verificar si está en uso en asientos
    const checkRes = await pool.query(
      "SELECT 1 FROM asiento_linea WHERE cuenta_codigo = $1 LIMIT 1",
      [codigo]
    )
    if (checkRes.rows.length > 0) {
      // Soft delete
      await pool.query(
        "UPDATE catalogo_cuentas SET activa = false WHERE codigo = $1",
        [codigo]
      )
      return NextResponse.json({ success: true, softDeleted: true })
    }
    // Hard delete
    await pool.query("DELETE FROM catalogo_cuentas WHERE codigo = $1", [codigo])
    return NextResponse.json({ success: true, softDeleted: false })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al eliminar cuenta"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })
  try {
    const { codigo } = await params
    await pool.query(
      "UPDATE catalogo_cuentas SET activa = true WHERE codigo = $1",
      [codigo]
    )
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al reactivar cuenta"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
