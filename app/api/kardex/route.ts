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
        },
      })
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

    return NextResponse.json({
      success: true,
      movimiento: resInsert.rows[0],
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al registrar movimiento en kardex"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
