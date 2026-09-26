import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const hoyStr = searchParams.get("fecha") || new Date().toISOString().slice(0, 10)
  const ejercicioParam = searchParams.get("ejercicio")
  const ejercicio = ejercicioParam
    ? parseInt(ejercicioParam, 10)
    : parseInt(hoyStr.split("-")[0], 10)

  const pool = getDbPool();
  if (!pool) {
    return NextResponse.json({
      estado: "NO_INICIADO",
      folio: null,
      partidas: [],
      fecha: hoyStr,
      ejercicio,
      mensaje: "Base de datos no configurada, operando en modo local.",
    });
  }

  try {
    // 1. Buscar si existe un folio para la fecha y ejercicio solicitados
    const resFolio = await pool.query(
      `SELECT id, ejercicio, numero_folio, fecha::text, estado, 
              total_debe::float, total_haber::float, cerrado_en::text, cerrado_por, creado_en::text
       FROM folio_diario
       WHERE fecha = $1 AND ejercicio = $2
       LIMIT 1`,
      [hoyStr, ejercicio],
    )

    // 5. Verificar si existen folios previos abiertos en este ejercicio
    const resPrevOpen = await pool.query(
      `SELECT id, numero_folio, fecha::text, total_debe::float, total_haber::float
       FROM folio_diario
       WHERE ejercicio = $1 AND fecha < $2 AND estado = 'ABIERTO'
       ORDER BY fecha ASC`,
      [ejercicio, hoyStr],
    )

    if (resFolio.rows.length === 0) {
      return NextResponse.json({
        estado: "NO_INICIADO",
        folio: null,
        partidas: [],
        totales: {
          totalDebe: 0,
          totalHaber: 0,
          diferencia: 0,
          cuadrado: true,
          partidasCuadradas: 0,
          partidasActivas: 0,
          totalPartidas: 0,
        },
        foliosPreviosAbiertos: resPrevOpen.rows.map((r) => ({
          id: r.id,
          numero_folio: r.numero_folio,
          fecha: r.fecha,
          total_debe: Number(r.total_debe) || 0,
          total_haber: Number(r.total_haber) || 0,
        })),
        fecha: hoyStr,
        ejercicio,
      })
    }

    const folio = resFolio.rows[0];

    // 2. Obtener las partidas asociadas a este folio (o registradas en esta fecha con su folio_id)
    const resAsientos = await pool.query(
      `SELECT id, correlativo_global, ejercicio, numero, fecha::text, concepto, tipo, estado,
              documento_soporte, folio_diario_id, anulado_en::text, motivo_anulacion
       FROM asiento
       WHERE folio_diario_id = $1 OR (folio_diario_id IS NULL AND fecha = $2 AND ejercicio = $3)
       ORDER BY numero ASC`,
      [folio.id, hoyStr, ejercicio],
    )

    // 3. Obtener líneas contables
    const asientoIds = resAsientos.rows.map((r) => r.id);
    let lineasByAsiento = new Map<
      string,
      Array<{ codigo: string; debe: number; haber: number }>
    >();

    if (asientoIds.length > 0) {
      const resLineas = await pool.query(
        `SELECT asiento_id, cuenta_codigo, debe::float, haber::float, linea_numero
         FROM asiento_linea
         WHERE asiento_id = ANY($1::uuid[])
         ORDER BY asiento_id, linea_numero ASC`,
        [asientoIds],
      );

      for (const l of resLineas.rows) {
        if (!lineasByAsiento.has(l.asiento_id)) {
          lineasByAsiento.set(l.asiento_id, []);
        }
        lineasByAsiento.get(l.asiento_id)!.push({
          codigo: l.cuenta_codigo,
          debe: Number(l.debe) || 0,
          haber: Number(l.haber) || 0,
        });
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
    }));

    // 4. Calcular sumas y cuadratura del folio considerando partidas activas
    // Identificar números de partidas originales que fueron modificadas o sustituidas por un Asiento de Ajuste
    const numerosAjustados = new Set<number>()
    for (const a of partidas) {
      if (a.tipo === "AJUSTE") {
        const matchDoc = a.documento_soporte?.match(/(?:Ajuste|Reversión)\s+P-(\d+)/i)
        if (matchDoc) numerosAjustados.add(parseInt(matchDoc[1], 10))
        const matchCon = a.concepto?.match(/Ajuste\s+a\s+Partida\s+#(\d+)/i)
        if (matchCon) numerosAjustados.add(parseInt(matchCon[1], 10))
      }
    }

    // Sincronizar en base de datos las partidas sustituidas para que queden marcadas como ANULADO
    for (const num of numerosAjustados) {
      const pOrig = partidas.find((p) => p.numero === num)
      if (pOrig && pOrig.estado !== "ANULADO") {
        pOrig.estado = "ANULADO"
        pOrig.motivo_anulacion = pOrig.motivo_anulacion || "Modificada y sustituida por Asiento de Ajuste"
        pool.query(
          "UPDATE asiento SET estado = 'ANULADO', anulado_en = COALESCE(anulado_en, CURRENT_TIMESTAMP), motivo_anulacion = COALESCE(motivo_anulacion, 'Modificada y sustituida por Asiento de Ajuste') WHERE id = $1",
          [pOrig.id]
        ).catch(() => {})
      }
    }

    const partidasActivas = partidas.filter(
      (p) => p.estado !== "ANULADO" && !numerosAjustados.has(p.numero)
    )
    let debeCents = 0
    let haberCents = 0
    let partidasCuadradas = 0

    for (const p of partidasActivas) {
      let pDebe = 0
      let pHaber = 0
      for (const l of p.lineas) {
        pDebe += Math.round((Number(l.debe) || 0) * 100);
        pHaber += Math.round((Number(l.haber) || 0) * 100);
      }
      debeCents += pDebe;
      haberCents += pHaber;
      if (pDebe === pHaber && pDebe > 0) {
        partidasCuadradas++;
      }
    }

    const diffCents = debeCents - haberCents
    const totalDebe = debeCents / 100
    const totalHaber = haberCents / 100
    const diferencia = Math.abs(diffCents) / 100
    const cuadrado =
      diffCents === 0 &&
      (partidasActivas.length === 0 || (debeCents > 0 && partidasCuadradas === partidasActivas.length))

    return NextResponse.json({
      estado: folio.estado,
      folio: {
        ...folio,
        total_debe: totalDebe,
        total_haber: totalHaber,
        cantidad_partidas: partidas.length,
        partidas_activas: partidasActivas.length,
      },
      partidas,
      totales: {
        totalDebe,
        totalHaber,
        diferencia,
        cuadrado,
        partidasCuadradas,
        partidasActivas: partidasActivas.length,
        totalPartidas: partidasActivas.length,
      },
      foliosPreviosAbiertos: resPrevOpen.rows.map((r) => ({
        id: r.id,
        numero_folio: r.numero_folio,
        fecha: r.fecha,
        total_debe: Number(r.total_debe) || 0,
        total_haber: Number(r.total_haber) || 0,
      })),
      fecha: hoyStr,
      ejercicio,
    })
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? e.message : "Error al obtener folio diario";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
