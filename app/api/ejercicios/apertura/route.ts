import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function POST(req: Request) {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })
  try {
    const body = await req.json().catch(() => ({}))
    const ejercicioOrigen = parseInt(body.ejercicio_origen, 10)
    const ejercicioDestino = body.ejercicio_destino
      ? parseInt(body.ejercicio_destino, 10)
      : ejercicioOrigen + 1

    if (isNaN(ejercicioOrigen) || isNaN(ejercicioDestino)) {
      return NextResponse.json(
        { error: "Los ejercicios origen y destino deben ser años numéricos válidos." },
        { status: 400 }
      )
    }

    const res = await pool.query(
      "SELECT sp_generar_partida_apertura($1, $2) AS apertura_id",
      [ejercicioOrigen, ejercicioDestino]
    )

    return NextResponse.json({
      success: true,
      asientoAperturaId: res.rows[0]?.apertura_id,
      ejercicioDestino,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al generar partida de apertura"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
