import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db"

type RouteContext = {
  params: Promise<{
    codigo: string
  }>
}

async function obtenerCodigo(context: RouteContext) {
  const { codigo } = await context.params
  return decodeURIComponent(codigo).trim()
}

async function cuentaTieneMovimientos(codigo: string) {
  const pool = getDbPool()
  if (!pool) return false

  const resultado = await pool.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM asiento_linea
        WHERE cuenta_codigo = $1
      ) AS "enUso"
    `,
    [codigo]
  )

  return Boolean(resultado.rows[0]?.enUso)
}

export async function PUT(req: Request, context: RouteContext) {
  const pool = getDbPool()

  if (!pool) {
    return NextResponse.json(
      { error: "No database configured" },
      { status: 503 }
    )
  }

  try {
    const codigoActual = await obtenerCodigo(context)

    const cuentaActual = await pool.query(
      `
        SELECT codigo, nombre, tipo, naturaleza, permite_movimiento, activa
        FROM catalogo_cuentas
        WHERE codigo = $1
        LIMIT 1
      `,
      [codigoActual]
    )

    if (cuentaActual.rows.length === 0) {
      return NextResponse.json(
        { error: "La cuenta no existe en la base de datos." },
        { status: 404 }
      )
    }

    if (await cuentaTieneMovimientos(codigoActual)) {
      return NextResponse.json(
        {
          error:
            "Esta cuenta posee movimientos contables registrados y no puede modificarse.",
        },
        { status: 409 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const codigoNuevo = String(body.codigo ?? codigoActual).trim()
    const nombreNuevo = String(body.nombre ?? "").trim()

    if (!/^\d{3,}$/.test(codigoNuevo)) {
      return NextResponse.json(
        { error: "El código debe contener al menos 3 dígitos numéricos." },
        { status: 400 }
      )
    }

    if (!nombreNuevo) {
      return NextResponse.json(
        { error: "El nombre de la cuenta es obligatorio." },
        { status: 400 }
      )
    }

    const codigoDuplicado = await pool.query(
      `
        SELECT codigo
        FROM catalogo_cuentas
        WHERE codigo = $1
          AND codigo <> $2
        LIMIT 1
      `,
      [codigoNuevo, codigoActual]
    )

    if (codigoDuplicado.rows.length > 0) {
      return NextResponse.json(
        { error: "Ya existe otra cuenta con ese código." },
        { status: 409 }
      )
    }

    const nombreDuplicado = await pool.query(
      `
        SELECT codigo
        FROM catalogo_cuentas
        WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($1))
          AND codigo <> $2
        LIMIT 1
      `,
      [nombreNuevo, codigoActual]
    )

    if (nombreDuplicado.rows.length > 0) {
      return NextResponse.json(
        { error: "Ya existe otra cuenta registrada con ese nombre." },
        { status: 409 }
      )
    }

    const primerDigito = codigoNuevo.charAt(0)

    const mapa = {
      "1": { tipo: "activo", naturaleza: "deudora" },
      "2": { tipo: "pasivo", naturaleza: "acreedora" },
      "3": { tipo: "capital", naturaleza: "acreedora" },
      "4": { tipo: "gasto", naturaleza: "deudora" },
      "5": { tipo: "ingreso", naturaleza: "acreedora" },
    } as const

    const clasificacion = mapa[primerDigito as keyof typeof mapa]

    if (!clasificacion) {
      return NextResponse.json(
        { error: "El primer dígito debe ser 1, 2, 3, 4 o 5." },
        { status: 400 }
      )
    }

    const resultado = await pool.query(
      `
        UPDATE catalogo_cuentas
        SET codigo = $1,
            nombre = $2,
            tipo = $3,
            naturaleza = $4
        WHERE codigo = $5
        RETURNING codigo, nombre, tipo, naturaleza, permite_movimiento, activa
      `,
      [
        codigoNuevo,
        nombreNuevo,
        clasificacion.tipo,
        clasificacion.naturaleza,
        codigoActual,
      ]
    )

    return NextResponse.json({
      success: true,
      cuenta: resultado.rows[0],
    })
  } catch (error) {
    console.error("Error modificando cuenta:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo modificar la cuenta.",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const pool = getDbPool()

  if (!pool) {
    return NextResponse.json(
      { error: "No database configured" },
      { status: 503 }
    )
  }

  try {
    const codigo = await obtenerCodigo(context)

    const cuenta = await pool.query(
      `
        SELECT codigo, nombre, activa
        FROM catalogo_cuentas
        WHERE codigo = $1
        LIMIT 1
      `,
      [codigo]
    )

    if (cuenta.rows.length === 0) {
      return NextResponse.json(
        { error: "La cuenta no existe en la base de datos." },
        { status: 404 }
      )
    }

    if (await cuentaTieneMovimientos(codigo)) {
      return NextResponse.json(
        {
          error:
            "Esta cuenta posee movimientos contables registrados y no puede eliminarse.",
        },
        { status: 409 }
      )
    }

    await pool.query(
      `DELETE FROM catalogo_cuentas WHERE codigo = $1`,
      [codigo]
    )

    return NextResponse.json({
      success: true,
      message: "Cuenta eliminada definitivamente.",
    })
  } catch (error) {
    console.error("Error eliminando cuenta:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo eliminar la cuenta.",
      },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const pool = getDbPool()

  if (!pool) {
    return NextResponse.json(
      { error: "No database configured" },
      { status: 503 }
    )
  }

  try {
    const codigo = await obtenerCodigo(context)
    const body = await req.json().catch(() => ({}))
    const accion = String(body.accion ?? "reactivar").toLowerCase()

    const cuenta = await pool.query(
      `
        SELECT codigo, nombre, activa
        FROM catalogo_cuentas
        WHERE codigo = $1
        LIMIT 1
      `,
      [codigo]
    )

    if (cuenta.rows.length === 0) {
      return NextResponse.json(
        { error: "La cuenta no existe en la base de datos." },
        { status: 404 }
      )
    }

    if (await cuentaTieneMovimientos(codigo)) {
      return NextResponse.json(
        {
          error:
            "Esta cuenta posee movimientos contables registrados y no puede cambiar de estado.",
        },
        { status: 409 }
      )
    }

    if (accion !== "desactivar" && accion !== "reactivar") {
      return NextResponse.json(
        { error: "Acción de cuenta inválida." },
        { status: 400 }
      )
    }

    const activa = accion === "reactivar"

    const resultado = await pool.query(
      `
        UPDATE catalogo_cuentas
        SET activa = $1
        WHERE codigo = $2
        RETURNING codigo, nombre, tipo, naturaleza, permite_movimiento, activa
      `,
      [activa, codigo]
    )

    return NextResponse.json({
      success: true,
      message: activa
        ? "Cuenta reactivada correctamente."
        : "Cuenta desactivada correctamente.",
      cuenta: resultado.rows[0],
    })
  } catch (error) {
    console.error("Error cambiando estado de cuenta:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cambiar el estado de la cuenta.",
      },
      { status: 500 }
    )
  }
}
