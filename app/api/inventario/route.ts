import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function GET(req: Request) {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ valor_inventario_final: 6500 }, { status: 200 })

  try {
    const { searchParams } = new URL(req.url)
    const ejercicioParam = searchParams.get("ejercicio")
    const ejercicio = ejercicioParam ? parseInt(ejercicioParam, 10) : new Date().getFullYear()

    const res = await pool.query(
      `SELECT id, ejercicio, fecha_toma::text, valor_inventario_final::float, responsable, observaciones
       FROM inventario_toma_fisica
       WHERE ejercicio = $1
       LIMIT 1`,
      [ejercicio],
    )

    if (res.rows.length === 0) {
      // Si no hay registro para ese año, buscar el más reciente
      const fallback = await pool.query(
        `SELECT id, ejercicio, fecha_toma::text, valor_inventario_final::float, responsable, observaciones
         FROM inventario_toma_fisica
         ORDER BY ejercicio DESC, fecha_toma DESC
         LIMIT 1`
      )
      if (fallback.rows.length > 0) {
        return NextResponse.json(fallback.rows[0])
      }
      return NextResponse.json({ valor_inventario_final: 6500, ejercicio })
    }

    return NextResponse.json(res.rows[0])
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al obtener inventario"
    return NextResponse.json({ error: msg, valor_inventario_final: 6500 }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })

  try {
    const body = await req.json()
    const { ejercicio = new Date().getFullYear(), valor_inventario_final, responsable, observaciones } = body

    if (valor_inventario_final === undefined || Number(valor_inventario_final) < 0) {
      return NextResponse.json({ error: "El valor del inventario final debe ser mayor o igual a 0." }, { status: 400 })
    }

    const res = await pool.query(
      `INSERT INTO inventario_toma_fisica (ejercicio, valor_inventario_final, responsable, observaciones, fecha_toma)
       VALUES ($1, $2, COALESCE($3, 'Comité de Inventario'), $4, CURRENT_DATE)
       ON CONFLICT (ejercicio) DO UPDATE
       SET valor_inventario_final = EXCLUDED.valor_inventario_final,
           responsable = EXCLUDED.responsable,
           observaciones = EXCLUDED.observaciones,
           actualizado_en = CURRENT_TIMESTAMP
       RETURNING id, ejercicio, fecha_toma::text, valor_inventario_final::float, responsable, observaciones`,
      [ejercicio, Number(valor_inventario_final), responsable || "Comité de Inventario", observaciones || ""]
    )

    return NextResponse.json(res.rows[0])
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al guardar inventario"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
