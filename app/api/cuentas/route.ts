import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
  const pool = getDbPool();
  if (!pool)
    return NextResponse.json(
      { error: "No database configured" },
      { status: 503 },
    );
  try {
    let res;
    try {
      res = await pool.query(
        "SELECT codigo, nombre, tipo, naturaleza, padre_codigo, permite_movimiento, activa FROM catalogo_cuentas ORDER BY codigo ASC",
      );
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("padre_codigo"))
        throw error;
      res = await pool.query(
        "SELECT codigo, nombre, tipo, naturaleza, permite_movimiento, activa FROM catalogo_cuentas ORDER BY codigo ASC",
      );
    }
    return NextResponse.json(res.rows);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al consultar cuentas";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const pool = getDbPool();
  if (!pool)
    return NextResponse.json(
      { error: "No database configured" },
      { status: 503 },
    );
  try {
    const {
      codigo,
      nombre,
      tipo,
      naturaleza,
      padre_codigo,
      permite_movimiento,
    } = await req.json();
    try {
      await pool.query(
        "INSERT INTO catalogo_cuentas (codigo, nombre, tipo, naturaleza, padre_codigo, permite_movimiento, activa) VALUES ($1, $2, $3, $4, $5, COALESCE($6, true), true)",
        [
          codigo,
          nombre,
          tipo,
          naturaleza,
          padre_codigo || null,
          permite_movimiento,
        ],
      );
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("padre_codigo"))
        throw error;
      await pool.query(
        "INSERT INTO catalogo_cuentas (codigo, nombre, tipo, naturaleza, activa) VALUES ($1, $2, $3, $4, true)",
        [codigo, nombre, tipo, naturaleza],
      );
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al insertar cuenta";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
