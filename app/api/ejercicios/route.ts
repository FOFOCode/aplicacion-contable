import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

export async function GET() {
  const pool = getDbPool()

  if (!pool) {
    return NextResponse.json(
      { error: "No database configured" },
      { status: 503 }
    )
  }

  try {
    const result = await pool.query(`
      SELECT
        ef.ejercicio,
        ef.fecha_inicio::text AS fecha_inicio,
        ef.fecha_fin::text AS fecha_fin,
        ef.estado,
        ef.cerrado_en,

        COUNT(DISTINCT a.id)::int AS cantidad_asientos,

        COUNT(
          DISTINCT CASE
            WHEN al.cuenta_codigo IS NOT NULL
            THEN al.cuenta_codigo
          END
        )::int AS cuentas_movimiento,

        COALESCE(
          SUM(al.debe),
          0
        )::float AS total_debe,

        COALESCE(
          SUM(al.haber),
          0
        )::float AS total_haber,

        COALESCE(
          MAX(cc.utilidad),
          0
        )::float AS utilidad,

        MAX(ah.usuario_email) AS responsable

      FROM ejercicio_fiscal ef

      LEFT JOIN asiento a
        ON a.ejercicio = ef.ejercicio
        AND COALESCE(a.estado, 'APLICADO') <> 'ANULADO'

      LEFT JOIN asiento_linea al
        ON al.asiento_id = a.id

      LEFT JOIN cierre_contable cc
        ON cc.ejercicio = ef.ejercicio

      LEFT JOIN asiento_historial ah
        ON ah.ejercicio = ef.ejercicio
        AND ah.accion = 'CIERRE'

      GROUP BY
        ef.ejercicio,
        ef.fecha_inicio,
        ef.fecha_fin,
        ef.estado,
        ef.cerrado_en

      ORDER BY ef.ejercicio DESC
    `)

    return NextResponse.json(
      result.rows.map((row) => ({
        anio: Number(row.ejercicio),

        fechaInicio:
          row.fecha_inicio,

        fechaFin:
          row.fecha_fin,

        estado:
          row.estado,

        fechaCierre:
          row.cerrado_en,

        responsable:
          row.responsable,

        asientos:
          Number(
            row.cantidad_asientos
          ) || 0,

        cuentas:
          Number(
            row.cuentas_movimiento
          ) || 0,

        totalDebe:
          Number(
            row.total_debe
          ) || 0,

        totalHaber:
          Number(
            row.total_haber
          ) || 0,

        utilidad:
          Number(
            row.utilidad
          ) || 0,
      }))
    )
  } catch (e: unknown) {
    const message =
      e instanceof Error
        ? e.message
        : "Error al consultar ejercicios"

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}