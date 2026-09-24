import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function GET() {
  const pool = getDbPool()
  if (!pool) return NextResponse.json([], { status: 200 })

  try {
    const resFolios = await pool.query(
      `SELECT f.id, f.ejercicio, f.numero_folio, f.fecha::text, f.estado, 
              f.total_debe::float, f.total_haber::float, f.cerrado_en::text, f.cerrado_por, f.creado_en::text,
              COUNT(a.id)::int AS cantidad_partidas
       FROM folio_diario f
       LEFT JOIN asiento a ON a.folio_diario_id = f.id
       GROUP BY f.id
       ORDER BY f.fecha DESC, f.numero_folio DESC`,
    )

    const resAsientos = await pool.query(
      `SELECT a.id, a.folio_diario_id, a.numero, a.correlativo_global, a.fecha::text, a.concepto, a.tipo, a.estado
       FROM asiento a
       WHERE a.folio_diario_id IS NOT NULL
       ORDER BY a.fecha DESC, a.numero ASC`,
    )

    const resLineas = await pool.query(
      `SELECT al.asiento_id, al.cuenta_codigo, al.debe::float, al.haber::float
       FROM asiento_linea al
       JOIN asiento a ON a.id = al.asiento_id
       WHERE a.folio_diario_id IS NOT NULL
       ORDER BY al.asiento_id, al.linea_numero ASC`,
    )

    const lineasByAsiento = new Map<string, Array<{ codigo: string; debe: number; haber: number }>>()
    for (const l of resLineas.rows) {
      if (!lineasByAsiento.has(l.asiento_id)) lineasByAsiento.set(l.asiento_id, [])
      lineasByAsiento.get(l.asiento_id)!.push({
        codigo: l.cuenta_codigo,
        debe: Number(l.debe) || 0,
        haber: Number(l.haber) || 0,
      })
    }

    const asientosByFolio = new Map<string, any[]>()
    for (const a of resAsientos.rows) {
      if (!asientosByFolio.has(a.folio_diario_id)) asientosByFolio.set(a.folio_diario_id, [])
      asientosByFolio.get(a.folio_diario_id)!.push({
        ...a,
        lineas: lineasByAsiento.get(a.id) || [],
      })
    }

    const foliosConPartidas = resFolios.rows.map((f) => ({
      ...f,
      partidas: asientosByFolio.get(f.id) || [],
    }))

    return NextResponse.json(foliosConPartidas)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al obtener historial de folios"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
