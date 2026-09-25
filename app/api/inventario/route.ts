import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET(req: Request) {
  const pool = getDbPool();
  if (!pool)
    return NextResponse.json(
      { valor_inventario_final: 6500, existe: false },
      { status: 200 },
    );

  try {
    const { searchParams } = new URL(req.url);
    const ejercicioParam = searchParams.get("ejercicio");
    const ejercicio = ejercicioParam
      ? parseInt(ejercicioParam, 10)
      : new Date().getFullYear();

    const res = await pool.query(
      `SELECT 
        id, 
        ejercicio, 
        fecha_toma::text AS fecha_toma, 
        valor_inventario_final::float AS valor_inventario_final, 
        responsable, 
        observaciones, 
        es_manual, 
        origen, 
        creado_en::text AS creado_en, 
        actualizado_en::text AS actualizado_en 
      FROM inventario_toma_fisica 
      WHERE ejercicio = $1
      ORDER BY fecha_toma DESC, creado_en DESC
      LIMIT 1`,
      [ejercicio],
    );

    if (res.rows.length === 0) {
      return NextResponse.json({
        ejercicio,
        fecha_toma: new Date().toISOString().slice(0, 10),
        valor_inventario_final: 6500,
        responsable: "",
        observaciones: "Sin toma física registrada",
        es_manual: false,
        origen: "KARDEX_AUTO",
        existe: false,
      });
    }

    return NextResponse.json({ ...res.rows[0], existe: true });
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? e.message : "Error al consultar inventario físico";
    return NextResponse.json(
      { error: msg, valor_inventario_final: 6500 },
      { status: 500 },
    );
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
    const body = await req.json();
    const ejercicio = body.ejercicio
      ? parseInt(body.ejercicio, 10)
      : new Date().getFullYear();
    const fechaToma = body.fecha_toma || new Date().toISOString().slice(0, 10);
    const valor =
      typeof body.valor_inventario_final === "number"
        ? body.valor_inventario_final
        : parseFloat(body.valor_inventario_final || 0);
    const responsable = body.responsable
      ? String(body.responsable).trim()
      : null;
    const observaciones = body.observaciones
      ? String(body.observaciones).trim()
      : null;
    const esManual =
      typeof body.es_manual === "boolean" ? body.es_manual : null;
    const origen = body.origen ? String(body.origen).trim() : null;

    if (isNaN(valor) || valor < 0) {
      return NextResponse.json(
        {
          error:
            "El valor del inventario final no puede ser negativo ni inválido.",
        },
        { status: 400 },
      );
    }

    const res = await pool.query(
      `INSERT INTO inventario_toma_fisica (
        ejercicio, fecha_toma, valor_inventario_final, responsable, observaciones, es_manual, origen
      ) VALUES ($1, $2, $3, $4, $5, COALESCE($6, FALSE), COALESCE($7, 'KARDEX_AUTO'))
      ON CONFLICT (ejercicio) DO UPDATE
      SET fecha_toma = EXCLUDED.fecha_toma,
          valor_inventario_final = EXCLUDED.valor_inventario_final,
          responsable = EXCLUDED.responsable,
          observaciones = EXCLUDED.observaciones,
          es_manual = CASE WHEN $6 IS NULL THEN inventario_toma_fisica.es_manual ELSE EXCLUDED.es_manual END,
          origen = CASE WHEN $7 IS NULL THEN inventario_toma_fisica.origen ELSE EXCLUDED.origen END,
          actualizado_en = CURRENT_TIMESTAMP
      RETURNING 
        id, 
        ejercicio, 
        fecha_toma::text AS fecha_toma, 
        valor_inventario_final::float AS valor_inventario_final, 
        responsable, 
        observaciones, 
        es_manual, 
        origen, 
        creado_en::text AS creado_en, 
        actualizado_en::text AS actualizado_en`,
      [
        ejercicio,
        fechaToma,
        valor,
        responsable,
        observaciones,
        esManual,
        origen,
      ],
    );

    return NextResponse.json({ ...res.rows[0], existe: true });
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? e.message : "Error al registrar inventario físico";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
