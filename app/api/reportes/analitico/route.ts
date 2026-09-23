import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function GET(req: Request) {
  const pool = getDbPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })

  try {
    const { searchParams } = new URL(req.url)
    const ejercicioParam = searchParams.get("ejercicio")
    const ejercicio = ejercicioParam ? parseInt(ejercicioParam, 10) : new Date().getFullYear()

    const res = await pool.query(
      `SELECT * FROM vista_estado_resultados_analitico WHERE ejercicio = $1`,
      [ejercicio]
    )

    if (res.rows.length === 0) {
      return NextResponse.json({ error: `Sin datos calculados para el ejercicio ${ejercicio}` }, { status: 404 })
    }

    const row = res.rows[0]
    return NextResponse.json({
      ejercicio: row.ejercicio,
      ventasTotales: parseFloat(row.ventas_totales || 0),
      devolucionesSobreVentas: parseFloat(row.devoluciones_sobre_ventas || 0),
      rebajasSobreVentas: parseFloat(row.rebajas_sobre_ventas || 0),
      ventasNetas: parseFloat(row.ventas_netas || 0),
      inventarioInicial: parseFloat(row.inventario_inicial || 0),
      compras: parseFloat(row.compras || 0),
      gastosSobreCompras: parseFloat(row.gastos_sobre_compras || 0),
      comprasTotales: parseFloat(row.compras_totales || 0),
      devolucionesSobreCompras: parseFloat(row.devoluciones_sobre_compras || 0),
      rebajasSobreCompras: parseFloat(row.rebajas_sobre_compras || 0),
      comprasNetas: parseFloat(row.compras_netas || 0),
      totalMercancias: parseFloat(row.total_mercancias || 0),
      inventarioFinal: parseFloat(row.inventario_final || 0),
      fechaInventarioFinal: row.fecha_inventario_final ? new Date(row.fecha_inventario_final).toISOString().slice(0, 10) : null,
      costoVentas: parseFloat(row.costo_ventas || 0),
      utilidadBruta: parseFloat(row.utilidad_bruta || 0),
      gastosOperacion: parseFloat(row.gastos_operacion || 0),
      utilidadOperacion: parseFloat(row.utilidad_operacion || 0),
      productosFinancieros: parseFloat(row.productos_financieros || 0),
      gastosFinancieros: parseFloat(row.gastos_financieros || 0),
      otrosIngresos: parseFloat(row.otros_ingresos || 0),
      utilidadNeta: parseFloat(row.utilidad_neta || 0),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al obtener reporte analítico SQL"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
