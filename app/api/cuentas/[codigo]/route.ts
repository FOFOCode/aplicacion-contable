import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const pool = getDbPool();
  if (!pool)
    return NextResponse.json(
      { error: "No database configured" },
      { status: 503 },
    );
  try {
    const { codigo } = await params;
    const { nombre, padre_codigo, permite_movimiento } = await req.json();
    try {
      await pool.query(
        "UPDATE catalogo_cuentas SET nombre = COALESCE($1, nombre), padre_codigo = COALESCE($2, padre_codigo), permite_movimiento = COALESCE($3, permite_movimiento) WHERE codigo = $4",
        [
          nombre || null,
          padre_codigo || null,
          typeof permite_movimiento === "boolean" ? permite_movimiento : null,
          codigo,
        ],
      );
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("padre_codigo"))
        throw error;
      await pool.query(
        "UPDATE catalogo_cuentas SET nombre = COALESCE($1, nombre) WHERE codigo = $2",
        [nombre || null, codigo],
      );
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al renombrar cuenta";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const pool = getDbPool();
  if (!pool)
    return NextResponse.json(
      { error: "No database configured" },
      { status: 503 },
    );
  try {
    const { codigo } = await params;
    // Verificar si está en uso en asientos
    const checkRes = await pool.query(
      "SELECT 1 FROM asiento_linea WHERE cuenta_codigo = $1 LIMIT 1",
      [codigo],
    );
    if (checkRes.rows.length > 0) {
      // Soft delete
      await pool.query(
        "UPDATE catalogo_cuentas SET activa = false WHERE codigo = $1",
        [codigo],
      );
      return NextResponse.json({ success: true, softDeleted: true });
    }
    // Hard delete
    await pool.query("DELETE FROM catalogo_cuentas WHERE codigo = $1", [
      codigo,
    ]);
    return NextResponse.json({ success: true, softDeleted: false });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al eliminar cuenta";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const pool = getDbPool();
  if (!pool)
    return NextResponse.json(
      { error: "No database configured" },
      { status: 503 },
    );
  try {
    const { codigo } = await params;
    await pool.query(
      "UPDATE catalogo_cuentas SET activa = true WHERE codigo = $1",
      [codigo],
    );
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al reactivar cuenta";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
