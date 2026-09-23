import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function POST(req: Request) {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })

  try {
    const body = await req.json().catch(() => ({}))
    const { folio_id, fecha, motivo, usuario, rol } = body

    if (!motivo || motivo.trim().length < 10) {
      return NextResponse.json(
        { error: "Se requiere un motivo formal de auditoría de al menos 10 caracteres para reabrir el folio." },
        { status: 400 }
      )
    }

    let targetFolioId = folio_id

    if (!targetFolioId) {
      if (!fecha) {
        return NextResponse.json({ error: "Indique el folio_id o la fecha a reabrir." }, { status: 400 })
      }
      const res = await pool.query(
        "SELECT id FROM folio_diario WHERE fecha = $1 AND estado = 'CERRADO' LIMIT 1",
        [fecha]
      )
      if (res.rows.length === 0) {
        return NextResponse.json(
          { error: `No se encontró un folio cerrado para la fecha ${fecha}.` },
          { status: 404 }
        )
      }
      targetFolioId = res.rows[0].id
    }

    const resReapertura = await pool.query(
      "SELECT * FROM sp_reabrir_folio_diario($1, $2, $3, $4)",
      [targetFolioId, motivo.trim(), usuario || "AUDITOR_SISTEMA", rol || "AUDITOR"]
    )

    const resultado = resReapertura.rows[0]
    const num = resultado.out_numero_folio ?? resultado.numero_folio
    return NextResponse.json({
      exito: true,
      mensaje: `Folio Diario #${num} reabierto exitosamente para correcciones de auditoría.`,
      folio: {
        id: resultado.out_folio_id ?? resultado.id,
        numero_folio: num,
        fecha: resultado.out_fecha ?? resultado.fecha,
        estado: resultado.out_estado ?? resultado.estado,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al reabrir folio diario"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
