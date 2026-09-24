import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

import { getDbPool } from "@/lib/db"

export async function POST(req: Request) {
  const pool = getDbPool()

  if (!pool) {
    return NextResponse.json(
      {
        error: "No hay conexión disponible con la base de datos.",
      },
      {
        status: 503,
      }
    )
  }

  try {
    const body = await req.json()

    const email = String(body.email ?? "")
      .trim()
      .toLowerCase()

    const password = String(body.password ?? "")

    if (!email || !password) {
      return NextResponse.json(
        {
          error: "Ingrese el correo electrónico y la contraseña.",
        },
        {
          status: 400,
        }
      )
    }

    const resultado = await pool.query(
      `
      SELECT
        id,
        nombre,
        email,
        password_hash,
        tipo,
        activo
      FROM usuario
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
      `,
      [email]
    )

    if (resultado.rows.length === 0) {
      return NextResponse.json(
        {
          error: "Correo electrónico o contraseña incorrectos.",
        },
        {
          status: 401,
        }
      )
    }

    const usuario = resultado.rows[0]

    if (!usuario.activo) {
      return NextResponse.json(
        {
          error: "El usuario se encuentra deshabilitado.",
        },
        {
          status: 403,
        }
      )
    }

    const passwordCorrecta = await bcrypt.compare(
      password,
      usuario.password_hash
    )

    if (!passwordCorrecta) {
      return NextResponse.json(
        {
          error: "Correo electrónico o contraseña incorrectos.",
        },
        {
          status: 401,
        }
      )
    }

    await pool.query(
      `
      UPDATE usuario
      SET ultimo_acceso = NOW()
      WHERE id = $1
      `,
      [usuario.id]
    )

    return NextResponse.json({
      success: true,

      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        tipo: usuario.tipo,
      },
    })
  } catch (e: unknown) {
    const mensaje =
      e instanceof Error
        ? e.message
        : "No se pudo iniciar sesión."

    console.error("Error login:", e)

    return NextResponse.json(
      {
        error: mensaje,
      },
      {
        status: 500,
      }
    )
  }
}