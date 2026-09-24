import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

// ============================================================
// OBTENER EJERCICIOS FISCALES
// Compatible con:
// - ContabilidadProvider
// - Ciclos Contables
// - Archivo Contable
// ============================================================

export async function GET() {
  const pool = getDbPool()

  if (!pool) {
    return NextResponse.json(
      {
        error: "No database configured",
      },
      {
        status: 503,
      }
    )
  }

  try {
    const result = await pool.query(`
      SELECT
        ef.ejercicio,

        ef.fecha_inicio::text
          AS fecha_inicio,

        ef.fecha_fin::text
          AS fecha_fin,

        ef.ultimo_numero,

        ef.estado,

        ef.cerrado_en::text
          AS cerrado_en,

        ef.creado_en::text
          AS creado_en,

        COALESCE(
          (
            SELECT COUNT(*)::int
            FROM asiento a
            WHERE
              a.ejercicio = ef.ejercicio
              AND COALESCE(
                a.estado,
                'APLICADO'
              ) <> 'ANULADO'
          ),
          0
        ) AS cantidad_asientos,

        COALESCE(
          (
            SELECT
              COUNT(
                DISTINCT al.cuenta_codigo
              )::int
            FROM asiento a
            INNER JOIN asiento_linea al
              ON al.asiento_id = a.id
            WHERE
              a.ejercicio = ef.ejercicio
              AND COALESCE(
                a.estado,
                'APLICADO'
              ) <> 'ANULADO'
          ),
          0
        ) AS cuentas_movimiento,

        COALESCE(
          (
            SELECT
              SUM(al.debe)
            FROM asiento a
            INNER JOIN asiento_linea al
              ON al.asiento_id = a.id
            WHERE
              a.ejercicio = ef.ejercicio
              AND COALESCE(
                a.estado,
                'APLICADO'
              ) <> 'ANULADO'
          ),
          0
        )::float
          AS total_debe,

        COALESCE(
          (
            SELECT
              SUM(al.haber)
            FROM asiento a
            INNER JOIN asiento_linea al
              ON al.asiento_id = a.id
            WHERE
              a.ejercicio = ef.ejercicio
              AND COALESCE(
                a.estado,
                'APLICADO'
              ) <> 'ANULADO'
          ),
          0
        )::float
          AS total_haber,

        COALESCE(
          (
            SELECT
              cc.utilidad
            FROM cierre_contable cc
            WHERE
              cc.ejercicio =
                ef.ejercicio
            ORDER BY
              cc.fecha_cierre DESC
            LIMIT 1
          ),
          0
        )::float
          AS utilidad,

        (
          SELECT
            ah.usuario_email
          FROM asiento_historial ah
          WHERE
            ah.ejercicio =
              ef.ejercicio
            AND ah.accion =
              'CIERRE'
          ORDER BY
            ah.creado_en DESC
          LIMIT 1
        ) AS responsable

      FROM ejercicio_fiscal ef

      ORDER BY
        ef.ejercicio DESC
    `)

    const ejercicios =
      result.rows.map(
        (row) => ({
          // ==================================================
          // FORMATO PRINCIPAL
          // Lo usa ContabilidadProvider / Ciclos
          // ==================================================

          ejercicio:
            Number(
              row.ejercicio
            ),

          fecha_inicio:
            row.fecha_inicio,

          fecha_fin:
            row.fecha_fin,

          ultimo_numero:
            Number(
              row.ultimo_numero
            ) || 0,

          estado:
            row.estado,

          cerrado_en:
            row.cerrado_en,

          creado_en:
            row.creado_en,

          // ==================================================
          // DATOS DE RESUMEN
          // ==================================================

          cantidad_asientos:
            Number(
              row.cantidad_asientos
            ) || 0,

          cuentas_movimiento:
            Number(
              row.cuentas_movimiento
            ) || 0,

          total_debe:
            Number(
              row.total_debe
            ) || 0,

          total_haber:
            Number(
              row.total_haber
            ) || 0,

          utilidad:
            Number(
              row.utilidad
            ) || 0,

          responsable:
            row.responsable ??
            null,

          // ==================================================
          // ALIAS PARA ARCHIVO CONTABLE
          // ==================================================

          anio:
            Number(
              row.ejercicio
            ),

          fechaInicio:
            row.fecha_inicio,

          fechaFin:
            row.fecha_fin,

          fechaCierre:
            row.cerrado_en,

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
        })
      )

    return NextResponse.json(
      ejercicios
    )
  } catch (e: unknown) {
    const message =
      e instanceof Error
        ? e.message
        : "Error al consultar ejercicios fiscales"

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

// ============================================================
// CREAR EJERCICIO FISCAL
// ============================================================

export async function POST(
  req: Request
) {
  const pool = getDbPool()

  if (!pool) {
    return NextResponse.json(
      {
        error: "No database configured",
      },
      {
        status: 503,
      }
    )
  }

  try {
    const body =
      await req.json()

    const ejercicio =
      Number.parseInt(
        String(
          body.ejercicio ?? ""
        ),
        10
      )

    if (
      Number.isNaN(
        ejercicio
      ) ||
      ejercicio < 1900 ||
      ejercicio > 2100
    ) {
      return NextResponse.json(
        {
          error:
            "Ejercicio fiscal inválido.",
        },
        {
          status: 400,
        }
      )
    }

    const fechaInicio =
      String(
        body.fecha_inicio ??
        `${ejercicio}-01-01`
      )

    const fechaFin =
      String(
        body.fecha_fin ??
        `${ejercicio}-12-31`
      )

    const estado =
      String(
        body.estado ??
        "ABIERTO"
      )

    if (
      ![
        "ABIERTO",
        "CERRADO",
        "BLOQUEADO",
      ].includes(
        estado
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Estado de ejercicio fiscal inválido.",
        },
        {
          status: 400,
        }
      )
    }

    const existente =
      await pool.query(
        `
        SELECT ejercicio
        FROM ejercicio_fiscal
        WHERE ejercicio = $1
        LIMIT 1
        `,
        [
          ejercicio,
        ]
      )

    if (
      existente.rows.length >
      0
    ) {
      return NextResponse.json(
        {
          error:
            `El ejercicio fiscal ${ejercicio} ya existe.`,
        },
        {
          status: 409,
        }
      )
    }

    const res =
      await pool.query(
        `
        INSERT INTO ejercicio_fiscal
        (
          ejercicio,
          fecha_inicio,
          fecha_fin,
          ultimo_numero,
          estado
        )
        VALUES
        (
          $1,
          $2,
          $3,
          0,
          $4
        )

        RETURNING
          ejercicio,
          fecha_inicio::text
            AS fecha_inicio,
          fecha_fin::text
            AS fecha_fin,
          ultimo_numero,
          estado,
          cerrado_en::text
            AS cerrado_en,
          creado_en::text
            AS creado_en
        `,
        [
          ejercicio,
          fechaInicio,
          fechaFin,
          estado,
        ]
      )

    return NextResponse.json(
      res.rows[0],
      {
        status: 201,
      }
    )
  } catch (e: unknown) {
    const message =
      e instanceof Error
        ? e.message
        : "Error al registrar ejercicio fiscal"

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 400,
      }
    )
  }
}

// ============================================================
// CAMBIAR ESTADO DEL EJERCICIO
// ============================================================

export async function PATCH(
  req: Request
) {
  const pool = getDbPool()

  if (!pool) {
    return NextResponse.json(
      {
        error: "No database configured",
      },
      {
        status: 503,
      }
    )
  }

  try {
    const body =
      await req.json()

    const ejercicio =
      Number.parseInt(
        String(
          body.ejercicio ?? ""
        ),
        10
      )

    const estado =
      String(
        body.estado ?? ""
      )

    if (
      Number.isNaN(
        ejercicio
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Ejercicio fiscal inválido.",
        },
        {
          status: 400,
        }
      )
    }

    if (
      ![
        "ABIERTO",
        "CERRADO",
        "BLOQUEADO",
      ].includes(
        estado
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Estado de ejercicio fiscal inválido.",
        },
        {
          status: 400,
        }
      )
    }

    const res =
      await pool.query(
        `
        UPDATE ejercicio_fiscal

        SET
          estado = $1,

          cerrado_en =
            CASE
              WHEN $1 = 'CERRADO'
                THEN COALESCE(
                  cerrado_en,
                  CURRENT_TIMESTAMP
                )

              WHEN $1 = 'ABIERTO'
                THEN NULL

              ELSE cerrado_en
            END

        WHERE ejercicio = $2

        RETURNING
          ejercicio,

          fecha_inicio::text
            AS fecha_inicio,

          fecha_fin::text
            AS fecha_fin,

          ultimo_numero,

          estado,

          cerrado_en::text
            AS cerrado_en,

          creado_en::text
            AS creado_en
        `,
        [
          estado,
          ejercicio,
        ]
      )

    if (
      res.rows.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "Ejercicio no encontrado.",
        },
        {
          status: 404,
        }
      )
    }

    return NextResponse.json(
      res.rows[0]
    )
  } catch (e: unknown) {
    const message =
      e instanceof Error
        ? e.message
        : "Error al actualizar estado del ejercicio fiscal"

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 400,
      }
    )
  }
}