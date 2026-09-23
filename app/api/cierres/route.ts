import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function GET() {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })
  try {
    const res = await pool.query(`
      SELECT
        c.id,
        c.ejercicio,
        c.fecha_cierre,
        c.concepto,
        c.total_ingresos,
        c.total_gastos,
        c.utilidad,
        c.cuenta_capital_codigo,
        cc.nombre AS cuenta_capital_nombre,
        c.asiento_cierre_id,
        a.numero AS asiento_numero,
        c.creado_en
      FROM cierre_contable c
      JOIN catalogo_cuentas cc ON c.cuenta_capital_codigo = cc.codigo
      JOIN asiento a ON c.asiento_cierre_id = a.id
      ORDER BY c.creado_en DESC
    `)
    return NextResponse.json(res.rows)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al consultar historial de cierres"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
