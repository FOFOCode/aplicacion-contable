import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { redondear } from "@/lib/contabilidad";
import type {
  BalanceGeneral,
  EstadoResultados,
  LineaReporte,
} from "@/lib/contabilidad";
import type { SaldoCuenta } from "@/lib/types";

function numero(value: unknown): number {
  return redondear(Number(value) || 0);
}

function linea(row: Record<string, unknown>): LineaReporte {
  return {
    cuenta: {
      codigo: String(row.cuenta_codigo),
      nombre: String(row.cuenta_nombre),
      tipo: row.cuenta_tipo as
        | "activo"
        | "pasivo"
        | "capital"
        | "gasto"
        | "ingreso",
      naturaleza: row.cuenta_naturaleza as "deudora" | "acreedora",
      rol_resultado: ["4103", "4104"].includes(String(row.cuenta_codigo))
        ? "reductora_ventas"
        : ["5102", "5103"].includes(String(row.cuenta_codigo))
          ? "reductora_compras"
          : "normal",
      permite_movimiento: Boolean(row.permite_movimiento),
      activa: Boolean(row.activa),
    },
    monto: numero(row.saldo_normalizado),
  };
}

export async function GET(req: Request) {
  const pool = getDbPool();
  if (!pool)
    return NextResponse.json(
      { error: "No database configured" },
      { status: 503 },
    );

  const { searchParams } = new URL(req.url);
  const ejercicio = Number.parseInt(searchParams.get("ejercicio") || "", 10);
  if (!Number.isInteger(ejercicio)) {
    return NextResponse.json(
      { error: "El ejercicio fiscal es obligatorio y debe ser entero." },
      { status: 400 },
    );
  }

  try {
    const [mayorRes, analiticoRes, inventarioRes] = await Promise.all([
      pool.query(
        `SELECT ejercicio, cuenta_codigo, cuenta_nombre, cuenta_tipo, cuenta_naturaleza,
                permite_movimiento, activa, total_debe, total_haber, saldo_neto,
                naturaleza_saldo, saldo_normalizado
           FROM vista_libro_mayor
          WHERE ejercicio = $1
          ORDER BY cuenta_codigo`,
        [ejercicio],
      ),
      pool.query(
        `WITH saldos AS (
          SELECT cuenta_codigo, saldo_normalizado
            FROM vista_libro_mayor
           WHERE ejercicio = $1
        )
        SELECT
          COALESCE(SUM(saldo_normalizado) FILTER (WHERE cuenta_codigo = '5101'), 0) AS ventas_totales,
          COALESCE(SUM(saldo_normalizado) FILTER (WHERE cuenta_codigo = '4103'), 0) AS devoluciones_sobre_ventas,
          COALESCE(SUM(saldo_normalizado) FILTER (WHERE cuenta_codigo = '4104'), 0) AS rebajas_sobre_ventas,
          COALESCE(SUM(saldo_normalizado) FILTER (WHERE cuenta_codigo = '1104'), 0) AS inventario_inicial,
          COALESCE(SUM(saldo_normalizado) FILTER (WHERE cuenta_codigo = '4101'), 0) AS compras,
          COALESCE(SUM(saldo_normalizado) FILTER (WHERE cuenta_codigo = '4102'), 0) AS gastos_sobre_compras,
          COALESCE(SUM(saldo_normalizado) FILTER (WHERE cuenta_codigo IN ('5102', '4106')), 0) AS devoluciones_sobre_compras,
          COALESCE(SUM(saldo_normalizado) FILTER (WHERE cuenta_codigo IN ('5103', '4107')), 0) AS rebajas_sobre_compras,
          COALESCE(SUM(saldo_normalizado) FILTER (WHERE cuenta_codigo LIKE '42%'), 0) AS gastos_operacion,
          COALESCE(SUM(saldo_normalizado) FILTER (WHERE cuenta_codigo = '5104'), 0) AS otros_ingresos
        FROM saldos`,
        [ejercicio],
      ),
      pool.query(
        `SELECT id, ejercicio, fecha_toma::text AS fecha_toma,
                valor_inventario_final::float AS valor_inventario_final,
                responsable, observaciones, es_manual, origen,
                creado_en::text AS creado_en, actualizado_en::text AS actualizado_en
           FROM inventario_toma_fisica
          WHERE ejercicio = $1
          ORDER BY fecha_toma DESC, creado_en DESC
          LIMIT 1`,
        [ejercicio],
      ),
    ]);

    const rows = mayorRes.rows as Record<string, unknown>[];
    const mayor: SaldoCuenta[] = rows.map((row) => ({
      cuenta: linea(row).cuenta,
      debe: numero(row.total_debe),
      haber: numero(row.total_haber),
      saldo: numero(row.saldo_neto),
      naturalezaSaldo: row.naturaleza_saldo as "deudora" | "acreedora" | null,
    }));
    const porTipo = (tipo: string, prefijos: string[] = []) =>
      rows
        .filter(
          (row) =>
            row.cuenta_tipo === tipo &&
            (!prefijos.length ||
              prefijos.some((prefijo) =>
                String(row.cuenta_codigo).startsWith(prefijo),
              )),
        )
        .map(linea);
    const suma = (items: LineaReporte[]) =>
      redondear(items.reduce((total, item) => total + item.monto, 0));
    const resumen = (analiticoRes.rows[0] || {}) as Record<string, unknown>;
    const ventas = porTipo("ingreso").filter(
      (item) => !item.cuenta.codigo.startsWith("52"),
    );
    const ingresosFinancieros = porTipo("ingreso", ["52"]);
    const costoVentas = porTipo("gasto", ["41"]);
    const gastosFinancieros = porTipo("gasto", ["43"]);
    const gastosOperacion = porTipo("gasto", ["42"]);
    const ingresos = porTipo("ingreso");
    const gastos = porTipo("gasto");
    const inventario = inventarioRes.rows[0] || null;
    const inventarioFinal = numero(inventario?.valor_inventario_final);
    const ventasTotales = numero(resumen.ventas_totales);
    const devolucionesSobreVentas = numero(resumen.devoluciones_sobre_ventas);
    const rebajasSobreVentas = numero(resumen.rebajas_sobre_ventas);
    const ventasNetas = redondear(
      ventasTotales - devolucionesSobreVentas - rebajasSobreVentas,
    );
    const inventarioInicial = numero(resumen.inventario_inicial);
    const compras = numero(resumen.compras);
    const gastosSobreCompras = numero(resumen.gastos_sobre_compras);
    const comprasTotales = redondear(compras + gastosSobreCompras);
    const devolucionesSobreCompras = numero(resumen.devoluciones_sobre_compras);
    const rebajasSobreCompras = numero(resumen.rebajas_sobre_compras);
    const comprasNetas = redondear(
      comprasTotales - devolucionesSobreCompras - rebajasSobreCompras,
    );
    const totalMercancias = redondear(inventarioInicial + comprasNetas);
    const costoVentasAnalitico = redondear(totalMercancias - inventarioFinal);
    const utilidadBruta = redondear(ventasNetas - costoVentasAnalitico);
    const totalGastosOperacion = numero(resumen.gastos_operacion);
    const utilidadOperacion = redondear(utilidadBruta - totalGastosOperacion);
    const totalIngresosFinancieros = suma(ingresosFinancieros);
    const totalGastosFinancieros = suma(gastosFinancieros);
    const resultadoFinanciero = redondear(
      totalIngresosFinancieros - totalGastosFinancieros,
    );
    const otrosIngresos = numero(resumen.otros_ingresos);
    const utilidad = redondear(
      utilidadOperacion + resultadoFinanciero + otrosIngresos,
    );
    const estadoResultados: EstadoResultados = {
      ingresos,
      gastos,
      ventas,
      costoVentas,
      gastosOperacion,
      ingresosFinancieros,
      gastosFinancieros,
      totalVentas: ventasNetas,
      totalCostoVentas: costoVentasAnalitico,
      utilidadBruta,
      totalGastosOperacion,
      utilidadOperacion,
      totalIngresosFinancieros,
      totalGastosFinancieros,
      resultadoFinanciero,
      totalIngresos: redondear(
        ventasNetas + totalIngresosFinancieros + otrosIngresos,
      ),
      totalGastos: redondear(
        costoVentasAnalitico + totalGastosOperacion + totalGastosFinancieros,
      ),
      utilidad,
      calculadoPorSql: true,
      analitico: {
        ventasTotales,
        devolucionesSobreVentas,
        rebajasSobreVentas,
        ventasNetas,
        inventarioInicial,
        compras,
        gastosSobreCompras,
        comprasTotales,
        devolucionesSobreCompras,
        rebajasSobreCompras,
        comprasNetas,
        totalMercancias,
        inventarioFinalEstimado: inventarioFinal,
        valorInventarioFinal: inventarioFinal,
        fechaInventarioFinal: inventario?.fecha_toma || null,
        responsableInventarioFinal: inventario?.responsable || null,
        costoVentas: costoVentasAnalitico,
        utilidadBruta,
        gastosOperacion: totalGastosOperacion,
        utilidadOperacion,
        totalIngresosFinancieros,
        totalGastosFinancieros,
        otrosIngresos,
        utilidadNeta: utilidad,
      },
    };
    const activos = porTipo("activo").map((item) =>
      item.cuenta.codigo === "1104"
        ? { ...item, monto: inventarioFinal }
        : item,
    );
    if (
      !activos.some((item) => item.cuenta.codigo === "1104") &&
      inventarioFinal > 0
    ) {
      activos.push({
        cuenta: {
          codigo: "1104",
          nombre: "Inventario de mercadería",
          tipo: "activo",
          naturaleza: "deudora",
          activa: true,
        },
        monto: inventarioFinal,
      });
    }
    const pasivos = porTipo("pasivo");
    const capital = porTipo("capital");
    const totalActivo = suma(activos);
    const totalPasivo = suma(pasivos);
    const totalCapitalCuentas = suma(capital);
    const totalCapitalContable = redondear(totalCapitalCuentas + utilidad);
    const totalPasivoMasCapital = redondear(totalPasivo + totalCapitalContable);
    const balanceGeneral: BalanceGeneral = {
      activos,
      pasivos,
      capital,
      totalActivo,
      totalPasivo,
      totalCapitalContable,
      utilidadEjercicio: utilidad,
      totalPasivoMasCapital,
      cuadra: Math.abs(totalActivo - totalPasivoMasCapital) < 0.01,
    };
    const totalDebe = numero(
      rows.reduce((total, row) => total + Number(row.total_debe || 0), 0),
    );
    const totalHaber = numero(
      rows.reduce((total, row) => total + Number(row.total_haber || 0), 0),
    );
    return NextResponse.json({
      ejercicio,
      origen: "SQL",
      mayor,
      estadoResultados,
      balanceGeneral,
      inventario: inventario
        ? { ...inventario, valor_inventario_final: inventarioFinal }
        : null,
      controles: {
        totalDebe,
        totalHaber,
        diferenciaDebeHaber: redondear(totalDebe - totalHaber),
        diferenciaPatrimonial: redondear(totalActivo - totalPasivoMasCapital),
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Error al generar estados financieros";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
