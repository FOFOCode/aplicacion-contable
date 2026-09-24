import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function GET(req: Request) {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })
  try {
    const { searchParams } = new URL(req.url)
    const ejercicioParam = searchParams.get("ejercicio")
    let query = "SELECT id, correlativo_global, ejercicio, numero, fecha::text, concepto, tipo, estado, anulado_en::text, motivo_anulacion FROM asiento"
    const params: unknown[] = []
    if (ejercicioParam) {
      query += " WHERE ejercicio = $1"
      params.push(parseInt(ejercicioParam, 10))
    }
    query += " ORDER BY fecha DESC, numero DESC"

    const resAsientos = await pool.query(query, params)
    const resLineas = await pool.query(
      "SELECT asiento_id, cuenta_codigo, debe::float, haber::float, linea_numero FROM asiento_linea ORDER BY asiento_id, linea_numero ASC"
    )

    const lineasByAsiento = new Map<string, Array<{ codigo: string; debe: number; haber: number }>>()
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

    const asientos = resAsientos.rows.map((a) => ({
      id: a.id,
      correlativo_global: a.correlativo_global,
      ejercicio: a.ejercicio,
      numero: a.numero,
      fecha: a.fecha,
      concepto: a.concepto,
      tipo: a.tipo,
      estado: a.estado,
      anulado_en: a.anulado_en,
      motivo_anulacion: a.motivo_anulacion,
      lineas: lineasByAsiento.get(a.id) || [],
    }))

    return NextResponse.json(asientos)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al obtener asientos"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })

  const client = await pool.connect()
  try {
    const { fecha, concepto, lineas, tipo: tipoInput, documento_soporte, folio_diario_id, usuario_email } = await req.json()
    const email = usuario_email || "admin@contable.sv"

    if (!Array.isArray(lineas) || lineas.length < 2) {
      return NextResponse.json(
        { error: "El asiento debe tener al menos dos líneas." },
        { status: 400 }
      )
    }

    const ejercicio = fecha ? parseInt(fecha.split("-")[0], 10) : new Date().getFullYear()

    await client.query("BEGIN")

    // Buscar folio abierto para la fecha si no vino en el body
    let targetFolioId = folio_diario_id
    if (!targetFolioId) {
      const folioRes = await client.query(
        "SELECT id FROM folio_diario WHERE fecha = $1 AND estado = 'ABIERTO' LIMIT 1",
        [fecha]
      )
      if (folioRes.rows.length > 0) {
        targetFolioId = folioRes.rows[0].id
      } else {
        // Auto-iniciar folio para la fecha si no hay uno abierto (cero bloqueos)
        const existFolio = await client.query("SELECT id FROM folio_diario WHERE fecha = $1 LIMIT 1", [fecha])
        if (existFolio.rows.length === 0) {
          const numFolioRes = await client.query(
            "SELECT fn_proximo_numero_folio($1) AS next_folio",
            [ejercicio]
          )
          const nextFolioNum = numFolioRes.rows[0]?.next_folio || 1
          const nuevoFolio = await client.query(
            "INSERT INTO folio_diario (ejercicio, numero_folio, fecha, estado) VALUES ($1, $2, $3, 'ABIERTO') RETURNING id",
            [ejercicio, nextFolioNum, fecha]
          )
          targetFolioId = nuevoFolio.rows[0]?.id
        } else {
          targetFolioId = existFolio.rows[0].id
        }
      }
    }

    // Obtener número consecutivo específico para este año fiscal
    const numRes = await client.query("SELECT fn_proximo_numero_asiento($1) AS next_num", [ejercicio])
    const numero = numRes.rows[0]?.next_num || 1
    const tipo = tipoInput || "OPERACION"

    const resA = await client.query(
      `INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado, documento_soporte, folio_diario_id) 
       VALUES ($1, $2, $3, $4, $5, 'APLICADO', $6, $7) 
       RETURNING id, correlativo_global, numero, ejercicio`,
      [ejercicio, numero, fecha, concepto, tipo, documento_soporte || null, targetFolioId || null]
    )
    const asientoId = resA.rows[0].id
    const correlativo_global = resA.rows[0].correlativo_global

    let totalDebe = 0
    let totalHaber = 0

    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i]
      const debe = Number(l.debe) || 0
      const haber = Number(l.haber) || 0
      totalDebe += debe
      totalHaber += haber
      const articuloId = l.articulo_id || null
      const cantidad = l.cantidad ? Number(l.cantidad) : null
      const costoUnitario = l.costo_unitario ? Number(l.costo_unitario) : null

      await client.query(
        `INSERT INTO asiento_linea (
          asiento_id, linea_numero, cuenta_codigo, debe, haber, articulo_id, cantidad, costo_unitario
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [asientoId, i + 1, l.codigo, debe, haber, articuloId, cantidad, costoUnitario]
      )

      // Registrar automáticamente en Kardex si es cuenta de mercaderías (Método Analítico)
      if (["4101", "5101", "5102", "4103", "4106", "5103"].includes(l.codigo)) {
        const monto = l.codigo.startsWith("4") ? debe : haber
        if (monto > 0) {
          try {
            await client.query(
              `SELECT sp_registrar_kardex_desde_linea($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                asientoId,
                i + 1,
                l.codigo,
                monto,
                articuloId,
                cantidad,
                fecha,
                concepto,
                documento_soporte || `P-${numero}`,
              ]
            )
          } catch (kErr) {
            console.error("Aviso: no se pudo registrar movimiento automático en Kardex:", kErr)
          }
        }
      }
    }

    // Registrar traza en el historial de auditoría con identificación de autoría legal
    await client.query(
      "INSERT INTO asiento_historial (asiento_id, accion, ejercicio, numero, concepto, total_debe, total_haber, motivo, usuario_email) VALUES ($1, 'CREACION', $2, $3, $4, $5, $6, 'Registro regular de partida contable', $7)",
      [asientoId, ejercicio, numero, concepto, totalDebe, totalHaber, email]
    )

    await client.query("COMMIT")
    return NextResponse.json({ id: asientoId, correlativo_global, numero, ejercicio, estado: "APLICADO" })
  } catch (e: unknown) {
    await client.query("ROLLBACK")
    const msg = e instanceof Error ? e.message : "Error al guardar el asiento"
    return NextResponse.json({ error: msg }, { status: 400 })
  } finally {
    client.release()
  }
}

export async function DELETE(req: Request) {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    const motivo = searchParams.get("motivo") || "Anulación contable por corrección/auditoría"

    if (!id) {
      return NextResponse.json({ error: "El ID del asiento es obligatorio." }, { status: 400 })
    }

    await pool.query("SELECT sp_anular_asiento($1, $2)", [id, motivo])
    return NextResponse.json({ success: true, anulado: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al anular asiento"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
