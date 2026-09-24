import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

function clasificarCuenta(codigo: string) {
  const primerDigito = codigo.charAt(0)

  switch (primerDigito) {
    case "1":
      return {
        tipo: "activo",
        naturaleza: "deudora",
      }

    case "2":
      return {
        tipo: "pasivo",
        naturaleza: "acreedora",
      }

    case "3":
      return {
        tipo: "capital",
        naturaleza: "acreedora",
      }

    case "4":
      return {
        tipo: "gasto",
        naturaleza: "deudora",
      }

    case "5":
      return {
        tipo: "ingreso",
        naturaleza: "acreedora",
      }

    default:
      return null
  }
}

// ============================================================
// MODIFICAR CUENTA
// ============================================================

export async function PUT(
  req: Request,
  {
    params,
  }: {
    params: Promise<{
      codigo: string
    }>
  }
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

  const client =
    await pool.connect()

  try {
    const paramsResueltos =
      await params

    const codigoActual =
      decodeURIComponent(
        paramsResueltos.codigo
      )

    const body =
      await req.json()

    const codigoNuevo =
      String(
        body.codigo ?? ""
      ).trim()

    const nombreNuevo =
      String(
        body.nombre ?? ""
      ).trim()

    // ========================================================
    // VALIDAR CÓDIGO
    // ========================================================

    if (
      !/^\d{3,}$/.test(
        codigoNuevo
      )
    ) {
      return NextResponse.json(
        {
          error:
            "El código debe tener al menos 3 dígitos numéricos.",
        },
        {
          status: 400,
        }
      )
    }

    // ========================================================
    // VALIDAR NOMBRE
    // ========================================================

    if (!nombreNuevo) {
      return NextResponse.json(
        {
          error:
            "El nombre de la cuenta es obligatorio.",
        },
        {
          status: 400,
        }
      )
    }

    // ========================================================
    // CLASIFICACIÓN AUTOMÁTICA
    // ========================================================

    const clasificacion =
      clasificarCuenta(
        codigoNuevo
      )

    if (!clasificacion) {
      return NextResponse.json(
        {
          error:
            "El primer dígito del código debe ser 1, 2, 3, 4 o 5.",
        },
        {
          status: 400,
        }
      )
    }

    // ========================================================
    // INICIAR TRANSACCIÓN
    // ========================================================

    await client.query(
      "BEGIN"
    )

    // ========================================================
    // VERIFICAR QUE LA CUENTA EXISTA
    // ========================================================

    const cuentaActual =
      await client.query(
        `
        SELECT
          codigo,
          nombre,
          tipo,
          naturaleza,
          activa

        FROM catalogo_cuentas

        WHERE codigo = $1

        FOR UPDATE
        `,
        [
          codigoActual,
        ]
      )

    if (
      cuentaActual.rows.length === 0
    ) {
      await client.query(
        "ROLLBACK"
      )

      return NextResponse.json(
        {
          error:
            "La cuenta no existe.",
        },
        {
          status: 404,
        }
      )
    }

    // ========================================================
    // VERIFICAR SI TIENE MOVIMIENTOS
    // ========================================================

    const movimientos =
      await client.query(
        `
        SELECT 1

        FROM asiento_linea

        WHERE cuenta_codigo = $1

        LIMIT 1
        `,
        [
          codigoActual,
        ]
      )

    if (
      movimientos.rows.length > 0
    ) {
      await client.query(
        "ROLLBACK"
      )

      return NextResponse.json(
        {
          error:
            "No se puede modificar esta cuenta porque ya posee movimientos contables registrados.",
        },
        {
          status: 409,
        }
      )
    }

    // ========================================================
    // VALIDAR CÓDIGO DUPLICADO
    // ========================================================

    if (
      codigoNuevo !==
      codigoActual
    ) {
      const codigoExistente =
        await client.query(
          `
          SELECT codigo

          FROM catalogo_cuentas

          WHERE codigo = $1

          LIMIT 1
          `,
          [
            codigoNuevo,
          ]
        )

      if (
        codigoExistente.rows
          .length > 0
      ) {
        await client.query(
          "ROLLBACK"
        )

        return NextResponse.json(
          {
            error:
              "Ya existe otra cuenta con ese código.",
          },
          {
            status: 409,
          }
        )
      }
    }

    // ========================================================
    // VALIDAR NOMBRE DUPLICADO
    // ========================================================

    const nombreExistente =
      await client.query(
        `
        SELECT codigo

        FROM catalogo_cuentas

        WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($1))
          AND codigo <> $2

        LIMIT 1
        `,
        [
          nombreNuevo,
          codigoActual,
        ]
      )

    if (
      nombreExistente.rows.length > 0
    ) {
      await client.query(
        "ROLLBACK"
      )

      return NextResponse.json(
        {
          error:
            "Ya existe otra cuenta registrada con ese nombre.",
        },
        {
          status: 409,
        }
      )
    }

    // ========================================================
    // ACTUALIZAR CUENTA
    // ========================================================

    const resultado =
      await client.query(
        `
        UPDATE catalogo_cuentas

        SET
          codigo = $1,
          nombre = $2,
          tipo = $3,
          naturaleza = $4

        WHERE codigo = $5

        RETURNING
          codigo,
          nombre,
          tipo,
          naturaleza,
          activa
        `,
        [
          codigoNuevo,
          nombreNuevo,
          clasificacion.tipo,
          clasificacion.naturaleza,
          codigoActual,
        ]
      )

    await client.query(
      "COMMIT"
    )

    return NextResponse.json({
      success: true,
      cuenta:
        resultado.rows[0],
    })
  } catch (e: unknown) {
    try {
      await client.query(
        "ROLLBACK"
      )
    } catch {
      // No hacemos nada si la transacción
      // ya había terminado.
    }

    const msg =
      e instanceof Error
        ? e.message
        : "Error al modificar cuenta"

    return NextResponse.json(
      {
        error: msg,
      },
      {
        status: 400,
      }
    )
  } finally {
    client.release()
  }
}

// ============================================================
// ELIMINAR CUENTA
// ============================================================

export async function DELETE(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{
      codigo: string
    }>
  }
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
    const paramsResueltos =
      await params

    const codigoCuenta =
      decodeURIComponent(
        paramsResueltos.codigo
      )

    // ========================================================
    // VERIFICAR QUE EXISTA
    // ========================================================

    const cuenta =
      await pool.query(
        `
        SELECT
          codigo,
          nombre

        FROM catalogo_cuentas

        WHERE codigo = $1
        `,
        [
          codigoCuenta,
        ]
      )

    if (
      cuenta.rows.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "La cuenta no existe.",
        },
        {
          status: 404,
        }
      )
    }

    // ========================================================
    // COMPROBAR SI ESTÁ EN USO
    // ========================================================

    const movimientos =
      await pool.query(
        `
        SELECT 1

        FROM asiento_linea

        WHERE cuenta_codigo = $1

        LIMIT 1
        `,
        [
          codigoCuenta,
        ]
      )

    if (
      movimientos.rows.length > 0
    ) {
      return NextResponse.json(
        {
          error:
            "No se puede eliminar esta cuenta porque posee movimientos contables registrados.",
        },
        {
          status: 409,
        }
      )
    }

    // ========================================================
    // ELIMINAR
    // ========================================================

    await pool.query(
      `
      DELETE FROM catalogo_cuentas
      WHERE codigo = $1
      `,
      [
        codigoCuenta,
      ]
    )

    return NextResponse.json({
      success: true,
    })
  } catch (e: unknown) {
    const msg =
      e instanceof Error
        ? e.message
        : "Error al eliminar cuenta"

    return NextResponse.json(
      {
        error: msg,
      },
      {
        status: 400,
      }
    )
  }
}

// ============================================================
// REACTIVAR CUENTA
// Se conserva por compatibilidad con el provider.
// ============================================================

export async function PATCH(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{
      codigo: string
    }>
  }
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
    const paramsResueltos =
      await params

    const codigoCuenta =
      decodeURIComponent(
        paramsResueltos.codigo
      )

    const resultado =
      await pool.query(
        `
        UPDATE catalogo_cuentas

        SET activa = TRUE

        WHERE codigo = $1

        RETURNING
          codigo,
          nombre,
          tipo,
          naturaleza,
          activa
        `,
        [
          codigoCuenta,
        ]
      )

    if (
      resultado.rows.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "La cuenta no existe.",
        },
        {
          status: 404,
        }
      )
    }

    return NextResponse.json({
      success: true,
      cuenta:
        resultado.rows[0],
    })
  } catch (e: unknown) {
    const msg =
      e instanceof Error
        ? e.message
        : "Error al reactivar cuenta"

    return NextResponse.json(
      {
        error: msg,
      },
      {
        status: 400,
      }
    )
  }
}