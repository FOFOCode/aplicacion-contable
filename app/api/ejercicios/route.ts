import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function GET() {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })

  try {
    const res = await pool.query(
      `SELECT 
        ejercicio, 
        fecha_inicio::text AS fecha_inicio, 
        fecha_fin::text AS fecha_fin, 
        ultimo_numero, 
        estado, 
        cerrado_en::text AS cerrado_en, 
        creado_en::text AS creado_en 
      FROM ejercicio_fiscal 
      ORDER BY ejercicio DESC`
    )
    return NextResponse.json(res.rows)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al obtener ejercicios fiscales"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })

  try {
    const body = await req.json()
    const ejercicio = parseInt(body.ejercicio, 10)
    if (isNaN(ejercicio) || ejercicio < 1900 || ejercicio > 2100) {
      return NextResponse.json({ error: "Ejercicio fiscal inválido." }, { status: 400 })
    }

    const fechaInicio = body.fecha_inicio || `${ejercicio}-01-01`
    const fechaFin = body.fecha_fin || `${ejercicio}-12-31`
    const estado = body.estado || "ABIERTO"

    const res = await pool.query(
      `INSERT INTO ejercicio_fiscal (ejercicio, fecha_inicio, fecha_fin, ultimo_numero, estado)
       VALUES ($1, $2, $3, 0, $4)
       ON CONFLICT (ejercicio) DO UPDATE
       SET fecha_inicio = EXCLUDED.fecha_inicio,
           fecha_fin = EXCLUDED.fecha_fin
       RETURNING ejercicio, fecha_inicio::text AS fecha_inicio, fecha_fin::text AS fecha_fin, ultimo_numero, estado, cerrado_en::text, creado_en::text`,
      [ejercicio, fechaInicio, fechaFin, estado]
    )

    return NextResponse.json(res.rows[0])
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al registrar ejercicio fiscal"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function PATCH(req: Request) {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })

  try {
    const body = await req.json()
    const ejercicio = parseInt(body.ejercicio, 10)
    const { estado } = body

    if (!["ABIERTO", "CERRADO", "BLOQUEADO"].includes(estado)) {
      return NextResponse.json({ error: "Estado de ejercicio fiscal inválido." }, { status: 400 })
    }

    const res = await pool.query(
      `UPDATE ejercicio_fiscal 
       SET estado = $1,
           cerrado_en = CASE WHEN $1 = 'CERRADO' THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE ejercicio = $2
       RETURNING ejercicio, fecha_inicio::text AS fecha_inicio, fecha_fin::text AS fecha_fin, ultimo_numero, estado, cerrado_en::text`,
      [estado, ejercicio]
    )

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Ejercicio no encontrado" }, { status: 404 })
    }

    return NextResponse.json(res.rows[0])
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al actualizar estado del ejercicio fiscal"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
