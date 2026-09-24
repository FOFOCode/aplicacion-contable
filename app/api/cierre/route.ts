import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function POST(req: Request) {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })
  try {
    const body = await req.json().catch(() => ({}))
    const ejercicio = body.ejercicio ? parseInt(body.ejercicio, 10) : new Date().getFullYear()
    const fechaCierre = body.fecha_cierre || `${ejercicio}-12-31`
    const concepto = body.concepto || `Asiento de liquidación y cierre contable del ejercicio fiscal ${ejercicio}`
    const aperturarSiguiente = Boolean(body.aperturar_siguiente)

    if (aperturarSiguiente) {
      const res = await pool.query(
        "SELECT * FROM sp_cerrar_ejercicio_y_aperturar_siguiente($1, $2, $3)",
        [ejercicio, fechaCierre, concepto]
      )
      const fila = res.rows[0]
      return NextResponse.json({
        success: true,
        asientoId: fila?.asiento_cierre_id,
        asientoAperturaId: fila?.asiento_apertura_id,
        siguienteEjercicio: fila?.ejercicio_destino,
      })
    }

    const res = await pool.query(
      "SELECT sp_cerrar_ciclo_contable($1, $2, $3) AS nuevo_asiento_id",
      [ejercicio, fechaCierre, concepto]
    )
    return NextResponse.json({
      success: true,
      asientoId: res.rows[0]?.nuevo_asiento_id,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al cerrar ciclo contable"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
