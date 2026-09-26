import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function GET(req: Request) {
  const pool = getDbPool()
  if (!pool) {
    return NextResponse.json({ error: "No database configured" }, { status: 503 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const ejercicioParam = searchParams.get("ejercicio")
    const ejercicio = ejercicioParam ? parseInt(ejercicioParam, 10) : new Date().getFullYear()
    const articuloCodigo = searchParams.get("articulo")

    // 1. Obtener artículos activos
    const resArticulos = await pool.query(
      `SELECT 
        id, 
        codigo, 
        nombre, 
        unidad, 
        cuenta_codigo AS "cuentaCodigo", 
        ubicacion, 
        stock_minimo::float AS "stockMinimo", 
        stock_maximo::float AS "stockMaximo",
        activo
      FROM articulo_kardex
      WHERE activo = TRUE
      ORDER BY codigo ASC`
    )

    // 2. Obtener movimientos del ejercicio
    let queryMov = `
      SELECT 
        m.id,
        m.articulo_id AS "articuloId",
        a.codigo AS "articuloCodigo",
        m.ejercicio,
        m.fecha::text AS fecha,
        m.comprobante,
        m.concepto,
        m.tipo,
        m.unidades_entrada::float AS "unidadesEntrada",
        m.unidades_salida::float AS "unidadesSalida",
        m.unidades_saldo::float AS "unidadesSaldo",
        m.costo_unitario::float AS "costoUnitario",
        m.debe::float AS debe,
        m.haber::float AS haber,
        m.saldo::float AS saldo,
        m.asiento_id AS "asientoId",
        m.creado_en::text AS "creadoEn"
      FROM kardex_movimiento m
      JOIN articulo_kardex a ON m.articulo_id = a.id
      WHERE m.ejercicio = $1
    `
    const params: unknown[] = [ejercicio]

    if (articuloCodigo) {
      queryMov += ` AND a.codigo = $2`
      params.push(articuloCodigo)
    }

    queryMov += ` ORDER BY m.fecha ASC, m.creado_en ASC`

    const resMovimientos = await pool.query(queryMov, params)

    // 3. Calcular saldo monetario total del inventario al cierre del ejercicio
    const resTotal = await pool.query(
      `SELECT COALESCE(SUM(ultimo.saldo), 0.00)::float AS total_inventario
       FROM articulo_kardex a
       CROSS JOIN LATERAL (
         SELECT m.saldo
         FROM kardex_movimiento m
         WHERE m.articulo_id = a.id AND m.ejercicio = $1
         ORDER BY m.fecha DESC, m.creado_en DESC
         LIMIT 1
       ) ultimo
       WHERE a.activo = TRUE`,
      [ejercicio]
    )

    const totalInventarioValorado = resTotal.rows[0]?.total_inventario || 0

    return NextResponse.json({
      ejercicio,
      articulos: resArticulos.rows,
      movimientos: resMovimientos.rows,
      totalInventarioValorado,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al consultar kardex"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const pool = getDbPool()
  if (!pool) {
    return NextResponse.json({ error: "No database configured" }, { status: 503 })
  }

  try {
    const body = await req.json()

    // ACCIÓN: Sincronizar Kardex con Toma Física del Método Analítico
    if (body.action === "sincronizar_toma") {
      const ejercicio = body.ejercicio ? parseInt(body.ejercicio, 10) : new Date().getFullYear()
      const responsable = body.responsable || "Comité de Auditoría y Control de Inventarios"
      const observaciones =
        body.observaciones ||
        "Inventario final conciliado directamente desde las tarjetas de Kardex (Método Analítico)"

      const resSync = await pool.query(
        `SELECT * FROM sp_sincronizar_kardex_con_toma_fisica($1, $2, $3)`,
        [ejercicio, responsable, observaciones]
      )

      const row = resSync.rows[0]
      return NextResponse.json({
        success: true,
        tomaFisica: {
          ejercicio: row.r_ejercicio,
          fecha_toma: row.r_fecha_toma,
          valor_inventario_final: parseFloat(row.r_valor_inventario_final),
          responsable: row.r_responsable,
          observaciones: row.r_observaciones,
          es_manual: false,
          origen: "KARDEX_AUTO",
        },
      })
    }

    // ACCIÓN: Vaciar completamente el kardex (comenzar de 0)
    if (body.action === "vaciar_kardex" || body.action === "limpiar_kardex") {
      const ejercicio = body.ejercicio ? parseInt(body.ejercicio, 10) : new Date().getFullYear()
      const articuloCodigo = body.articuloCodigo || "ART-001"

      const resArt = await pool.query(
        `SELECT id FROM articulo_kardex WHERE codigo = $1 LIMIT 1`,
        [articuloCodigo]
      )
      if (resArt.rows.length > 0) {
        await pool.query(
          `DELETE FROM kardex_movimiento WHERE articulo_id = $1 AND ejercicio = $2`,
          [resArt.rows[0].id, ejercicio]
        )
      } else {
        await pool.query(
          `DELETE FROM kardex_movimiento WHERE ejercicio = $1`,
          [ejercicio]
        )
      }
      await pool.query(
        `DELETE FROM inventario_toma_fisica WHERE ejercicio = $1`,
        [ejercicio]
      )
      return NextResponse.json({ success: true, count: 0, movimientos: [] })
    }

    // ACCIÓN: Guardar lote de movimientos manuales en la base de datos (Persistencia de modo manual)
    if (body.action === "guardar_manual_batch") {
      const ejercicio = body.ejercicio ? parseInt(body.ejercicio, 10) : new Date().getFullYear()
      const articuloCodigo = body.articuloCodigo || "ART-001"
      const movimientos = Array.isArray(body.movimientos) ? body.movimientos : []

      // Validar existencia del artículo
      const resArt = await pool.query(
        `SELECT id FROM articulo_kardex WHERE codigo = $1 LIMIT 1`,
        [articuloCodigo]
      )
      if (resArt.rows.length === 0) {
        return NextResponse.json({ error: `El artículo ${articuloCodigo} no existe.` }, { status: 400 })
      }
      const articuloId = resArt.rows[0].id

      const client = await pool.connect()
      try {
        await client.query("BEGIN")

        // Reemplazar movimientos del artículo en este ejercicio
        await client.query(
          `DELETE FROM kardex_movimiento WHERE articulo_id = $1 AND ejercicio = $2`,
          [articuloId, ejercicio]
        )

        const insertedRows = []
        const isValidUuid = (val: unknown): val is string =>
          typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)

        // Deduplicar movimientos para evitar que se dupliquen por dobles llamadas o estado residual
        const uniqueMovs = []
        const seenKeys = new Set<string>()
        for (const m of movimientos) {
          const uIn = Math.max(0, parseFloat(m.unidadesEntrada || 0))
          const uOut = Math.max(0, parseFloat(m.unidadesSalida || 0))
          const key = isValidUuid(m.asientoId)
            ? `asiento-${m.asientoId}`
            : `${m.fecha}-${m.comprobante}-${m.tipo}-${uIn}-${uOut}`
          if (!seenKeys.has(key)) {
            seenKeys.add(key)
            uniqueMovs.push(m)
          }
        }

        for (const m of uniqueMovs) {
          const uEntrada = Math.max(0, parseFloat(m.unidadesEntrada || 0))
          const uSalida = Math.max(0, parseFloat(m.unidadesSalida || 0))
          const uSaldo = Math.max(0, parseFloat(m.unidadesSaldo || 0))
          const costoUnit = Math.max(0, parseFloat(m.costoUnitario || 0))
          const debe = Math.max(0, parseFloat(m.debe || 0))
          const haber = Math.max(0, parseFloat(m.haber || 0))
          const saldo = Math.max(0, parseFloat(m.saldo || 0))
          const fecha = m.fecha ? String(m.fecha).slice(0, 10) : new Date().toISOString().slice(0, 10)
          const comprobante = m.comprobante ? String(m.comprobante).trim() : "COMP-001"
          const concepto = m.concepto ? String(m.concepto).trim() : "Movimiento de almacén"
          const tipo = m.tipo || (uEntrada > 0 ? "ENTRADA" : "SALIDA")
          const asientoId = isValidUuid(m.asientoId) ? m.asientoId : null

          const resIns = await client.query(
            `INSERT INTO kardex_movimiento (
              articulo_id, ejercicio, fecha, comprobante, concepto, tipo,
              unidades_entrada, unidades_salida, unidades_saldo,
              costo_unitario, debe, haber, saldo, asiento_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING 
              id, 
              articulo_id AS "articuloId", 
              ejercicio, 
              fecha::text AS fecha, 
              comprobante, 
              concepto, 
              tipo, 
              unidades_entrada::float AS "unidadesEntrada", 
              unidades_salida::float AS "unidadesSalida", 
              unidades_saldo::float AS "unidadesSaldo", 
              costo_unitario::float AS "costoUnitario", 
              debe::float AS debe, 
              haber::float AS haber, 
              saldo::float AS saldo, 
              asiento_id AS "asientoId",
              creado_en::text AS "creadoEn"`,
            [
              articuloId,
              ejercicio,
              fecha,
              comprobante,
              concepto,
              tipo,
              uEntrada,
              uSalida,
              uSaldo,
              costoUnit,
              debe,
              haber,
              saldo,
              asientoId,
            ]
          )
          insertedRows.push(resIns.rows[0])
        }

        // Si hay movimientos, sincronizar automáticamente con toma física
        if (insertedRows.length > 0) {
          try {
            await client.query(
              `SELECT * FROM sp_sincronizar_kardex_con_toma_fisica($1, $2, $3)`,
              [
                ejercicio,
                "Control de Almacén y Auditoría",
                `Inventario final sincronizado desde la tarjeta de Kardex (${articuloCodigo})`
              ]
            )
          } catch (syncErr) {
            console.error("Advertencia al sincronizar toma física en batch:", syncErr)
          }
        }

        await client.query("COMMIT")

        return NextResponse.json({
          success: true,
          movimientos: insertedRows,
          count: insertedRows.length,
        })
      } catch (err) {
        await client.query("ROLLBACK")
        throw err
      } finally {
        client.release()
      }
    }

    // ACCIÓN: Eliminar un movimiento específico de kardex
    if (body.action === "eliminar_movimiento") {
      const { id, ejercicio } = body
      if (!id) {
        return NextResponse.json({ error: "ID de movimiento requerido" }, { status: 400 })
      }
      await pool.query(`DELETE FROM kardex_movimiento WHERE id = $1`, [id])
      if (ejercicio) {
        try {
          await pool.query(
            `SELECT * FROM sp_sincronizar_kardex_con_toma_fisica($1, $2, $3)`,
            [
              parseInt(ejercicio, 10),
              "Control de Almacén y Auditoría",
              "Inventario recalculado tras eliminación de movimiento en Kardex"
            ]
          )
        } catch {
          // ignore
        }
      }
      return NextResponse.json({ success: true })
    }

    // ACCIÓN: Registrar nuevo movimiento de Kardex con Costo Promedio Ponderado
    const ejercicio = body.ejercicio ? parseInt(body.ejercicio, 10) : new Date().getFullYear()
    const articuloCodigo = body.articuloCodigo || "ART-001"
    const fecha = body.fecha || new Date().toISOString().slice(0, 10)
    const comprobante = body.comprobante ? String(body.comprobante).trim() : "COMP-001"
    const concepto = body.concepto ? String(body.concepto).trim() : "Movimiento de almacén"
    const tipo = body.tipo || "ENTRADA"
    const unidadesEntrada = Math.max(0, parseFloat(body.unidadesEntrada || 0))
    const unidadesSalida = Math.max(0, parseFloat(body.unidadesSalida || 0))
    const costoInput = Math.max(0, parseFloat(body.costoUnitario || 0))

    // Validar existencia del artículo
    const resArt = await pool.query(
      `SELECT id FROM articulo_kardex WHERE codigo = $1 LIMIT 1`,
      [articuloCodigo]
    )
    if (resArt.rows.length === 0) {
      return NextResponse.json({ error: `El artículo ${articuloCodigo} no existe.` }, { status: 400 })
    }
    const articuloId = resArt.rows[0].id

    // Obtener el último saldo del artículo en el ejercicio para calcular CPP
    const resUltimo = await pool.query(
      `SELECT unidades_saldo::float, saldo::float, costo_unitario::float
       FROM kardex_movimiento
       WHERE articulo_id = $1 AND ejercicio = $2
       ORDER BY fecha DESC, creado_en DESC
       LIMIT 1`,
      [articuloId, ejercicio]
    )

    let uSaldoAnt = 0
    let mSaldoAnt = 0
    if (resUltimo.rows.length > 0) {
      uSaldoAnt = resUltimo.rows[0].unidades_saldo
      mSaldoAnt = resUltimo.rows[0].saldo
    }

    let uSaldoNuevo = uSaldoAnt
    let mSaldoNuevo = mSaldoAnt
    let costoUnitario = costoInput
    let debe = 0
    let haber = 0

    if (tipo === "ENTRADA" || tipo === "DEVOLUCION_VENTA") {
      uSaldoNuevo = uSaldoAnt + unidadesEntrada
      debe = Math.round(unidadesEntrada * costoUnitario * 100) / 100
      mSaldoNuevo = Math.round((mSaldoAnt + debe) * 100) / 100
      costoUnitario = uSaldoNuevo > 0 ? Math.round((mSaldoNuevo / uSaldoNuevo) * 10000) / 10000 : costoInput
    } else if (tipo === "SALIDA" || tipo === "DEVOLUCION_COMPRA") {
      if (uSaldoAnt > 0 && mSaldoAnt > 0) {
        costoUnitario = Math.round((mSaldoAnt / uSaldoAnt) * 10000) / 10000
      }
      uSaldoNuevo = Math.max(0, uSaldoAnt - unidadesSalida)
      haber = Math.round(unidadesSalida * costoUnitario * 100) / 100
      mSaldoNuevo = Math.max(0, Math.round((mSaldoAnt - haber) * 100) / 100)
    } else if (tipo === "AJUSTE") {
      if (unidadesEntrada > 0) {
        uSaldoNuevo = uSaldoAnt + unidadesEntrada
        debe = Math.round(unidadesEntrada * costoUnitario * 100) / 100
        mSaldoNuevo = Math.round((mSaldoAnt + debe) * 100) / 100
      } else {
        uSaldoNuevo = Math.max(0, uSaldoAnt - unidadesSalida)
        haber = Math.round(unidadesSalida * costoUnitario * 100) / 100
        mSaldoNuevo = Math.max(0, Math.round((mSaldoAnt - haber) * 100) / 100)
      }
    }

    const resInsert = await pool.query(
      `INSERT INTO kardex_movimiento (
        articulo_id, ejercicio, fecha, comprobante, concepto, tipo,
        unidades_entrada, unidades_salida, unidades_saldo,
        costo_unitario, debe, haber, saldo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING 
        id, 
        articulo_id AS "articuloId", 
        ejercicio, 
        fecha::text AS fecha, 
        comprobante, 
        concepto, 
        tipo, 
        unidades_entrada::float AS "unidadesEntrada", 
        unidades_salida::float AS "unidadesSalida", 
        unidades_saldo::float AS "unidadesSaldo", 
        costo_unitario::float AS "costoUnitario", 
        debe::float AS debe, 
        haber::float AS haber, 
        saldo::float AS saldo, 
        creado_en::text AS "creadoEn"`,
      [
        articuloId,
        ejercicio,
        fecha,
        comprobante,
        concepto,
        tipo,
        unidadesEntrada,
        unidadesSalida,
        uSaldoNuevo,
        costoUnitario,
        debe,
        haber,
        mSaldoNuevo,
      ]
    )

    // Sincronizar automáticamente con toma física del ejercicio
    try {
      await pool.query(
        `SELECT * FROM sp_sincronizar_kardex_con_toma_fisica($1, $2, $3)`,
        [
          ejercicio,
          "Control de Almacén y Auditoría",
          `Inventario conciliado automáticamente por registro en Kardex (${articuloCodigo})`
        ]
      )
    } catch (syncErr) {
      console.error("Advertencia al sincronizar toma física tras movimiento único:", syncErr)
    }

    return NextResponse.json({
      success: true,
      movimiento: resInsert.rows[0],
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al registrar movimiento en kardex"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function DELETE(req: Request) {
  const pool = getDbPool()
  if (!pool) {
    return NextResponse.json({ error: "No database configured" }, { status: 503 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const ejercicioParam = searchParams.get("ejercicio")
    const ejercicio = ejercicioParam ? parseInt(ejercicioParam, 10) : new Date().getFullYear()
    const articuloCodigo = searchParams.get("articulo") || "ART-001"

    const resArt = await pool.query(
      `SELECT id FROM articulo_kardex WHERE codigo = $1 LIMIT 1`,
      [articuloCodigo]
    )
    if (resArt.rows.length > 0) {
      await pool.query(
        `DELETE FROM kardex_movimiento WHERE articulo_id = $1 AND ejercicio = $2`,
        [resArt.rows[0].id, ejercicio]
      )
    } else {
      await pool.query(
        `DELETE FROM kardex_movimiento WHERE ejercicio = $1`,
        [ejercicio]
      )
    }
    await pool.query(
      `DELETE FROM inventario_toma_fisica WHERE ejercicio = $1`,
      [ejercicio]
    )

    return NextResponse.json({ success: true, message: "Kardex e inventario vaciados correctamente" })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al vaciar kardex"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

