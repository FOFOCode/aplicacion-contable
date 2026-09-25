import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

import {
  calcularBalanceGeneral,
  calcularEstadoResultados,
  calcularMayor,
} from "@/lib/contabilidad"

import type {
  Asiento,
  Cuenta,
} from "@/lib/types"

export async function GET(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{
      ejercicio: string
    }>
  }
) {
  const pool = getDbPool()

  if (!pool) {
    return NextResponse.json(
      {
        error:
          "No database configured",
      },
      {
        status: 503,
      }
    )
  }

  try {
    const { ejercicio } =
      await params

    const anio =
      Number(ejercicio)

    if (
      !Number.isInteger(anio)
    ) {
      return NextResponse.json(
        {
          error:
            "Ejercicio inválido.",
        },
        {
          status: 400,
        }
      )
    }

    // ========================================================
    // EJERCICIO FISCAL
    // ========================================================

    const resEjercicio =
      await pool.query(
        `
        SELECT
          ejercicio,
          fecha_inicio::text,
          fecha_fin::text,
          estado,
          cerrado_en,
          creado_en
        FROM ejercicio_fiscal
        WHERE ejercicio = $1
        LIMIT 1
        `,
        [anio]
      )

    if (
      resEjercicio.rows
        .length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "El ejercicio solicitado no existe.",
        },
        {
          status: 404,
        }
      )
    }

    // ========================================================
    // CATÁLOGO DE CUENTAS
    // ========================================================

    const resCuentas =
      await pool.query(`
        SELECT
          codigo,
          nombre,
          tipo,
          naturaleza,
          activa
        FROM catalogo_cuentas
        ORDER BY codigo ASC
      `)

    const cuentas: Cuenta[] =
      resCuentas.rows.map(
        (c) => ({
          codigo:
            c.codigo,

          nombre:
            c.nombre,

          tipo:
            c.tipo,

          naturaleza:
            c.naturaleza,

          activa:
            c.activa,
        })
      )

    // ========================================================
    // ASIENTOS DEL EJERCICIO
    // ========================================================

    const resAsientos =
      await pool.query(
        `
        SELECT
          id,
          numero,
          fecha::text,
          concepto,
          tipo,
          estado
        FROM asiento
        WHERE ejercicio = $1
          AND COALESCE(
            estado,
            'APLICADO'
          ) <> 'ANULADO'
        ORDER BY numero ASC
        `,
        [anio]
      )

    // ========================================================
    // LÍNEAS
    // ========================================================

    const resLineas =
      await pool.query(
        `
        SELECT
          al.asiento_id,
          al.linea_numero,
          al.cuenta_codigo,
          al.debe::float,
          al.haber::float,

          cc.nombre AS cuenta_nombre

        FROM asiento_linea al

        INNER JOIN asiento a
          ON a.id =
             al.asiento_id

        LEFT JOIN catalogo_cuentas cc
          ON cc.codigo =
             al.cuenta_codigo

        WHERE a.ejercicio = $1
          AND COALESCE(
            a.estado,
            'APLICADO'
          ) <> 'ANULADO'

        ORDER BY
          a.numero ASC,
          al.linea_numero ASC
        `,
        [anio]
      )

    // ========================================================
    // AGRUPAR LÍNEAS POR ASIENTO
    // ========================================================

    const lineasPorAsiento =
      new Map<
        string,
        Array<{
          codigo: string
          debe: number
          haber: number
        }>
      >()

    for (
      const linea
      of resLineas.rows
    ) {
      const id =
        String(
          linea.asiento_id
        )

      if (
        !lineasPorAsiento.has(
          id
        )
      ) {
        lineasPorAsiento.set(
          id,
          []
        )
      }

      lineasPorAsiento
        .get(id)!
        .push({
          codigo:
            linea.cuenta_codigo,

          debe:
            Number(
              linea.debe
            ) || 0,

          haber:
            Number(
              linea.haber
            ) || 0,
        })
    }

    // ========================================================
    // CONSTRUIR ASIENTOS PARA LAS FUNCIONES CONTABLES
    // ========================================================

    const asientos: Asiento[] =
      resAsientos.rows.map(
        (a) => ({
          id:
            a.id,

          numero:
            a.numero,

          fecha:
            a.fecha,

          concepto:
            a.concepto,

          lineas:
            lineasPorAsiento.get(
              String(a.id)
            ) || [],
        })
      )

    // ========================================================
    // LIBRO MAYOR
    // ========================================================

    const mayor =
      calcularMayor(
        cuentas,
        asientos
      )

    // ========================================================
    // ESTADO DE RESULTADOS
    // ========================================================

    const estadoResultados =
      calcularEstadoResultados(
        mayor
      )

    // ========================================================
    // BALANCE GENERAL
    // ========================================================

    const balanceGeneral =
      calcularBalanceGeneral(
        mayor,
        estadoResultados.utilidad
      )

    // ========================================================
    // TOTALES
    // ========================================================

    let totalDebe = 0
    let totalHaber = 0

    for (
      const asiento
      of asientos
    ) {
      for (
        const linea
        of asiento.lineas
      ) {
        totalDebe +=
          Number(
            linea.debe
          ) || 0

        totalHaber +=
          Number(
            linea.haber
          ) || 0
      }
    }

    // ========================================================
    // DATOS DEL CIERRE
    // ========================================================

    const resCierre =
      await pool.query(
        `
        SELECT
          fecha_cierre::text,
          concepto,
          total_ingresos::float,
          total_gastos::float,
          utilidad::float,
          cuenta_capital_codigo,
          asiento_cierre_id,
          creado_en
        FROM cierre_contable
        WHERE ejercicio = $1
        LIMIT 1
        `,
        [anio]
      )

    const cierre =
      resCierre.rows[0] ??
      null

    // ========================================================
    // RESPONSABLE
    // ========================================================

    const resResponsable =
      await pool.query(
        `
        SELECT usuario_email
        FROM asiento_historial
        WHERE ejercicio = $1
          AND accion = 'CIERRE'
        ORDER BY creado_en DESC
        LIMIT 1
        `,
        [anio]
      )

    const responsable =
      resResponsable.rows[0]
        ?.usuario_email ??
      null

    // ========================================================
    // RESPUESTA
    // ========================================================

    return NextResponse.json({
      ejercicio: {
        anio,

        fechaInicio:
          resEjercicio.rows[0]
            .fecha_inicio,

        fechaFin:
          resEjercicio.rows[0]
            .fecha_fin,

        estado:
          resEjercicio.rows[0]
            .estado,

        cerradoEn:
          resEjercicio.rows[0]
            .cerrado_en,

        responsable,
      },

      resumen: {
        asientos:
          asientos.length,

        cuentas:
          mayor.length,

        totalDebe,

        totalHaber,

        utilidad:
          estadoResultados.utilidad,

        totalActivo:
          balanceGeneral.totalActivo,

        totalPasivoCapital:
          balanceGeneral.totalPasivoMasCapital,

        cuadra:
          balanceGeneral.cuadra,
      },

      libroDiario:
        resAsientos.rows.map(
          (a) => ({
            id:
              a.id,

            numero:
              a.numero,

            fecha:
              a.fecha,

            concepto:
              a.concepto,

            tipo:
              a.tipo,

            estado:
              a.estado,

            lineas:
              resLineas.rows
                .filter(
                  (l) =>
                    String(
                      l.asiento_id
                    ) ===
                    String(a.id)
                )
                .map(
                  (l) => ({
                    numero:
                      l.linea_numero,

                    codigo:
                      l.cuenta_codigo,

                    nombre:
                      l.cuenta_nombre,

                    debe:
                      Number(
                        l.debe
                      ) || 0,

                    haber:
                      Number(
                        l.haber
                      ) || 0,
                  })
                ),
          })
        ),

      libroMayor:
        mayor,

      estadoResultados,

      balanceGeneral,

      cierre,
    })
  } catch (e: unknown) {
    const message =
      e instanceof Error
        ? e.message
        : "Error al consultar ejercicio"

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      }
    )
  }
}