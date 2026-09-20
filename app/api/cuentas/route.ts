import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function GET() {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })
  try {
    const res = await pool.query(
      "SELECT codigo, nombre, tipo, naturaleza, activa FROM catalogo_cuentas ORDER BY codigo ASC"
    )
    return NextResponse.json(res.rows)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al consultar cuentas"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })
  try {
    const { codigo, nombre, tipo, naturaleza } = await req.json()
    await pool.query(
      "INSERT INTO catalogo_cuentas (codigo, nombre, tipo, naturaleza, activa) VALUES ($1, $2, $3, $4, true)",
      [codigo, nombre, tipo, naturaleza]
    )
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al insertar cuenta"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
