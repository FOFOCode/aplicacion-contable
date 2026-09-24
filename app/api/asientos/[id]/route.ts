import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })

  const client = await pool.connect()
  try {
    const { id } = await params
    const body = await req.json()
    const { concepto, tipo, documento_soporte, lineas, motivo } = body

    if (!concepto || !concepto.trim()) {
      return NextResponse.json({ error: "El concepto o glosa es obligatorio." }, { status: 400 })
    }

    if (!Array.isArray(lineas) || lineas.length < 2) {
      return NextResponse.json(
        { error: "El asiento debe contener al menos 2 líneas contables." },
        { status: 400 }
      )
    }

    await client.query("BEGIN")

    // 1. Obtener asiento y verificar que el folio diario esté ABIERTO
    const asientoRes = await client.query(
      `SELECT a.id, a.ejercicio, a.numero, a.estado, a.folio_diario_id, f.estado AS folio_estado
       FROM asiento a
       LEFT JOIN folio_diario f ON a.folio_diario_id = f.id
       WHERE a.id = $1 FOR UPDATE OF a`,
      [id]
    )

    if (asientoRes.rows.length === 0) {
      await client.query("ROLLBACK")
      return NextResponse.json({ error: "El comprobante contable no existe." }, { status: 404 })
    }

    const asiento = asientoRes.rows[0]

    if (asiento.estado === "ANULADO") {
      await client.query("ROLLBACK")
      return NextResponse.json(
        { error: "No se puede editar un asiento que ya ha sido ANULADO." },
        { status: 400 }
      )
    }

    if (asiento.folio_estado === "CERRADO") {
      await client.query("ROLLBACK")
      return NextResponse.json(
        { error: "El Folio Diario está CERRADO y foliado. El comprobante es legalmente inmutable." },
        { status: 403 }
      )
    }

    // 2. Validar Partida Doble estricta en centavos
    let totalDebeCents = 0
    let totalHaberCents = 0
    for (const l of lineas) {
      const debe = Math.round((Number(l.debe) || 0) * 100)
      const haber = Math.round((Number(l.haber) || 0) * 100)
      if (debe < 0 || haber < 0) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "No se permiten importes negativos." }, { status: 400 })
      }
      totalDebeCents += debe
      totalHaberCents += haber
    }

    if (totalDebeCents === 0 || totalDebeCents !== totalHaberCents) {
      await client.query("ROLLBACK")
      return NextResponse.json(
        { error: "Descuadre en Partida Doble: el total del Debe debe ser igual al Haber y mayor a 0." },
        { status: 400 }
      )
    }

    // 3. Activar bandera de sesión para permitir el reemplazo técnico de líneas en folio abierto
    await client.query("SET LOCAL contabilidad.permitir_modificacion_lineas = 'true'")

    // Eliminar líneas previas
    await client.query("DELETE FROM asiento_linea WHERE asiento_id = $1", [id])

    // Insertar nuevas líneas
    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i]
      await client.query(
        "INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES ($1, $2, $3, $4, $5)",
        [id, i + 1, l.codigo, Number(l.debe) || 0, Number(l.haber) || 0]
      )
    }

    // 4. Actualizar cabecera del asiento
    await client.query(
      `UPDATE asiento 
       SET concepto = $1,
           tipo = COALESCE($2, tipo),
           documento_soporte = $3
       WHERE id = $4`,
      [concepto.trim(), tipo, documento_soporte?.trim() || null, id]
    )

    // 5. Registrar traza en asiento_historial con acción 'MODIFICACION'
    await client.query(
      `INSERT INTO asiento_historial (asiento_id, accion, ejercicio, numero, concepto, total_debe, total_haber, motivo)
       VALUES ($1, 'MODIFICACION', $2, $3, $4, $5, $6, $7)`,
      [
        id,
        asiento.ejercicio,
        asiento.numero,
        concepto.trim(),
        totalDebeCents / 100,
        totalHaberCents / 100,
        motivo || "Corrección de partida en folio diario abierto",
      ]
    )

    await client.query("COMMIT")
    return NextResponse.json({ success: true, id, modificado: true, mensaje: "Partida modificada correctamente." })
  } catch (e: unknown) {
    await client.query("ROLLBACK")
    const msg = e instanceof Error ? e.message : "Error al actualizar asiento"
    return NextResponse.json({ error: msg }, { status: 400 })
  } finally {
    client.release()
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })
  try {
    const { id } = await params
    let motivo = "Anulación contable por corrección/auditoría"
    let usuarioEmail = "admin@contable.sv"
    try {
      const body = await req.json()
      if (body?.motivo) motivo = String(body.motivo)
      if (body?.usuario_email) usuarioEmail = String(body.usuario_email)
    } catch {
      // Body opcional
    }

    // Por auditoría contable no se elimina en cascada: se anula formalmente con trazabilidad de autor
    await pool.query("SELECT sp_anular_asiento($1, $2, $3)", [id, motivo, usuarioEmail])
    return NextResponse.json({ success: true, anulado: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al anular asiento"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
