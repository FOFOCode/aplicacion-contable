import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function POST(req: Request) {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })

  try {
    const body = await req.json().catch(() => ({}))
    const { folio_id, fecha, usuario } = body

    let targetFolioId = folio_id

    // Si no enviaron folio_id, buscar por fecha
    if (!targetFolioId) {
      const targetFecha = fecha || new Date().toISOString().slice(0, 10)
      const res = await pool.query(
        "SELECT id FROM folio_diario WHERE fecha = $1 AND estado = 'ABIERTO' LIMIT 1",
        [targetFecha],
      )
      if (res.rows.length === 0) {
        return NextResponse.json(
          { error: `No se encontró un folio abierto para la fecha ${targetFecha}.` },
          { status: 404 },
        )
      }
      targetFolioId = res.rows[0].id
    }

    // Ejecutar el procedimiento almacenado transaccional de cierre formal
    const resCierre = await pool.query(
      "SELECT * FROM sp_cerrar_folio_diario($1, $2)",
      [targetFolioId, usuario || "CONTADOR_PRINCIPAL"],
    )

    if (resCierre.rows.length === 0) {
      return NextResponse.json(
        { error: "No se pudo completar el cierre del folio diario." },
        { status: 500 },
      )
    }

    const resultado = resCierre.rows[0]

    return NextResponse.json({
      exito: true,
      mensaje: `¡Folio Diario #${resultado.numero_folio} cerrado y foliado legalmente!`,
      cierre: {
        folio_id: resultado.folio_id,
        numero_folio: resultado.numero_folio,
        fecha: resultado.fecha,
        total_debe: Number(resultado.total_debe),
        total_haber: Number(resultado.total_haber),
        partidas_cerradas: Number(resultado.partidas_cerradas),
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al cerrar folio diario"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
