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
// OBTENER CUENTAS
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
    const res = await pool.query(`
      SELECT
        c.codigo,
        c.nombre,
        c.tipo,
        c.naturaleza,
        c.permite_movimiento,
        c.activa,

        EXISTS (
          SELECT 1
          FROM asiento_linea al
          WHERE al.cuenta_codigo = c.codigo
        ) AS "enUso"

      FROM catalogo_cuentas c

      ORDER BY c.codigo ASC
    `)

    return NextResponse.json(
      res.rows
    )
  } catch (e: unknown) {
    const msg =
      e instanceof Error
        ? e.message
        : "Error al consultar cuentas"

    return NextResponse.json(
      {
        error: msg,
      },
      {
        status: 500,
      }
    )
  }
}

// ============================================================
// AGREGAR CUENTA
// ============================================================

export async function POST(req: Request) {
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
    const body = await req.json()

    const codigo = String(
      body.codigo ?? ""
    ).trim()

    const nombre = String(
      body.nombre ?? ""
    ).trim()

    const permiteMovimiento =
      body.permite_movimiento !== false

    // ========================================================
    // VALIDAR CÓDIGO
    // ========================================================

    if (!/^\d{3,}$/.test(codigo)) {
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

    if (!nombre) {
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
      clasificarCuenta(codigo)

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
    // VALIDAR CÓDIGO DUPLICADO
    // ========================================================

    const codigoExistente =
      await pool.query(
        `
        SELECT codigo
        FROM catalogo_cuentas
        WHERE codigo = $1
        LIMIT 1
        `,
        [codigo]
      )

    if (
      codigoExistente.rows.length > 0
    ) {
      return NextResponse.json(
        {
          error:
            "Ya existe una cuenta con ese código.",
        },
        {
          status: 409,
        }
      )
    }

    // ========================================================
    // VALIDAR NOMBRE DUPLICADO
    // ========================================================

    const nombreExistente =
      await pool.query(
        `
        SELECT codigo
        FROM catalogo_cuentas
        WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($1))
        LIMIT 1
        `,
        [nombre]
      )

    if (
      nombreExistente.rows.length > 0
    ) {
      return NextResponse.json(
        {
          error:
            "Ya existe una cuenta registrada con ese nombre.",
        },
        {
          status: 409,
        }
      )
    }

    // ========================================================
    // INSERTAR CUENTA
    // ========================================================

    const resultado =
      await pool.query(
        `
        INSERT INTO catalogo_cuentas
        (
          codigo,
          nombre,
          tipo,
          naturaleza,
          permite_movimiento,
          activa
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          TRUE
        )

        RETURNING
          codigo,
          nombre,
          tipo,
          naturaleza,
          permite_movimiento,
          activa
        `,
        [
          codigo,
          nombre,
          clasificacion.tipo,
          clasificacion.naturaleza,
          permiteMovimiento,
        ]
      )

    return NextResponse.json(
      {
        success: true,
        cuenta: {
          ...resultado.rows[0],
          enUso: false,
        },
      },
      {
        status: 201,
      }
    )
  } catch (e: unknown) {
    const msg =
      e instanceof Error
        ? e.message
        : "Error al insertar cuenta"

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