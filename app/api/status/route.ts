import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function GET() {
  const pool = getDbPool()

  if (!pool) {
    return NextResponse.json({
      connected: false,
      error: "DATABASE_URL no está siendo cargada",
    })
  }

  try {
    const resultado = await pool.query(`
      SELECT
        current_database() AS database,
        current_user AS usuario,
        NOW() AS fecha
    `)

    return NextResponse.json({
      connected: true,
      database: resultado.rows[0].database,
      usuario: resultado.rows[0].usuario,
      fecha: resultado.rows[0].fecha,
    })
  } catch (e: unknown) {
    const error = e as {
      message?: string
      code?: string
    }

    return NextResponse.json(
      {
        connected: false,
        error: error?.message ?? "Error desconocido",
        code: error?.code ?? null,
      },
      { status: 500 }
    )
  }
}