import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const hoyStr = searchParams.get("fecha") || new Date().toISOString().slice(0, 10)

  const pool = getDbPool()
  if (!pool) {
    return NextResponse.json({
      estado: "NO_INICIADO",
      folio: null,
      partidas: [],
      fecha: hoyStr,
      mensaje: "Base de datos no configurada, operando en modo local.",
    })
  }

  try {
    // 1. Buscar si existe un folio para la fecha solicitada
    const resFolio = await pool.query(
      `SELECT id, ejercicio, numero_folio, fecha::text, estado, 
              total_debe::float, total_haber::float, cerrado_en::text, cerrado_por, creado_en::text
       FROM folio_diario
       WHERE fecha = $1
       LIMIT 1`,
      [hoyStr],
    )

    if (resFolio.rows.length === 0) {
      return NextResponse.json({
        estado: "NO_INICIADO",
        folio: null,
        partidas: [],
        fecha: hoyStr,
      })
    }

    const folio = resFolio.rows[0]

    // 2. Obtener las partidas asociadas a este folio (o registradas en esta fecha con su folio_id)
    const resAsientos = await pool.query(
      `SELECT id, correlativo_global, ejercicio, numero, fecha::text, concepto, tipo, estado,
              documento_soporte, folio_diario_id, anulado_en::text, motivo_anulacion
       FROM asiento
       WHERE folio_diario_id = $1 OR (folio_diario_id IS NULL AND fecha = $2)
       ORDER BY numero ASC`,
      [folio.id, hoyStr],
    )

    // 3. Obtener líneas contables
    const asientoIds = resAsientos.rows.map((r) => r.id)
    let lineasByAsiento = new Map<string, Array<{ codigo: string; debe: number; haber: number }>>()

    if (asientoIds.length > 0) {
      const resLineas = await pool.query(
        `SELECT asiento_id, cuenta_codigo, debe::float, haber::float, linea_numero
         FROM asiento_linea
         WHERE asiento_id = ANY($1::uuid[])
         ORDER BY asiento_id, linea_numero ASC`,
        [asientoIds],
      )

      for (const l of resLineas.rows) {
        if (!lineasByAsiento.has(l.asiento_id)) {
          lineasByAsiento.set(l.asiento_id, [])
        }
        lineasByAsiento.get(l.asiento_id)!.push({
          codigo: l.cuenta_codigo,
          debe: Number(l.debe) || 0,
          haber: Number(l.haber) || 0,
        })
      }
    }

    const partidas = resAsientos.rows.map((a) => ({
      id: a.id,
      correlativo_global: a.correlativo_global,
      ejercicio: a.ejercicio,
      numero: a.numero,
      fecha: a.fecha,
      concepto: a.concepto,
      tipo: a.tipo,
      estado: a.estado,
      documento_soporte: a.documento_soporte,
      folio_diario_id: a.folio_diario_id || folio.id,
      anulado_en: a.anulado_en,
      motivo_anulacion: a.motivo_anulacion,
      lineas: lineasByAsiento.get(a.id) || [],
    }))

    // 4. Calcular sumas y cuadratura del folio
    let debeCents = 0
    let haberCents = 0
    let partidasCuadradas = 0

    for (const p of partidas) {
      if (p.estado === "ANULADO") continue
      let pDebe = 0
      let pHaber = 0
      for (const l of p.lineas) {
        pDebe += Math.round((Number(l.debe) || 0) * 100)
        pHaber += Math.round((Number(l.haber) || 0) * 100)
      }
      debeCents += pDebe
      haberCents += pHaber
      if (pDebe === pHaber && pDebe > 0) {
        partidasCuadradas++
      }
    }

    const diffCents = debeCents - haberCents
    const totalDebe = debeCents / 100
    const totalHaber = haberCents / 100
    const diferencia = Math.abs(diffCents) / 100
    const cuadrado = diffCents === 0 && (partidas.length === 0 || (debeCents > 0 && partidasCuadradas === partidas.length))

    return NextResponse.json({
      estado: folio.estado,
      folio: {
        ...folio,
        total_debe: totalDebe,
        total_haber: totalHaber,
        cantidad_partidas: partidas.length,
      },
      partidas,
      totales: {
        totalDebe,
        totalHaber,
        diferencia,
        cuadrado,
        partidasCuadradas,
        totalPartidas: partidas.length,
      },
      fecha: hoyStr,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al obtener folio diario"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
