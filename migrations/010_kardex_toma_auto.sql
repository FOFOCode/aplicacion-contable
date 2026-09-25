-- =============================================================================
-- MIGRACIÓN 010: Sincronización Kardex -> Toma Física siempre como AUTOMÁTICA
-- La sincronización desde Kardex (CPP) marca es_manual = FALSE y origen = 'KARDEX_AUTO',
-- de modo que la vista analítica use el saldo en tiempo real y no sea tratada como toma manual.
-- =============================================================================

CREATE OR REPLACE FUNCTION sp_sincronizar_kardex_con_toma_fisica(
    p_ejercicio INT,
    p_responsable VARCHAR(150) DEFAULT 'Comité de Auditoría y Control de Inventarios',
    p_observaciones TEXT DEFAULT 'Inventario final conciliado directamente desde las tarjetas de Kardex (Método Analítico)'
)
RETURNS TABLE (
    r_ejercicio INT,
    r_fecha_toma DATE,
    r_valor_inventario_final NUMERIC(14, 2),
    r_responsable VARCHAR(150),
    r_observaciones TEXT,
    r_es_manual BOOLEAN,
    r_origen VARCHAR(30)
) AS $$
DECLARE
    v_total_kardex NUMERIC(14, 2) := 0.00;
    v_fecha DATE := CURRENT_DATE;
BEGIN
    -- Sumar el último saldo monetario de cada artículo activo en el ejercicio
    SELECT COALESCE(SUM(ultimo_mov.saldo), 0.00)
    INTO v_total_kardex
    FROM articulo_kardex a
    CROSS JOIN LATERAL (
        SELECT m.saldo, m.fecha
        FROM kardex_movimiento m
        WHERE m.articulo_id = a.id AND m.ejercicio = p_ejercicio
        ORDER BY m.fecha DESC, m.creado_en DESC
        LIMIT 1
    ) ultimo_mov
    WHERE a.activo = TRUE;

    IF v_total_kardex <= 0 THEN
        -- Si no hay movimientos en kardex para ese ejercicio, mantener el que esté o 0.00
        SELECT COALESCE(itf.valor_inventario_final, 0.00)
        INTO v_total_kardex
        FROM inventario_toma_fisica itf
        WHERE itf.ejercicio = p_ejercicio;
    END IF;

    -- Upsert en inventario_toma_fisica marcado como AUTOMÁTICO (KARDEX_AUTO)
    INSERT INTO inventario_toma_fisica (
        ejercicio, fecha_toma, valor_inventario_final, responsable, observaciones, es_manual, origen
    ) VALUES (
        p_ejercicio, v_fecha, v_total_kardex, p_responsable, p_observaciones, FALSE, 'KARDEX_AUTO'
    )
    ON CONFLICT (ejercicio) DO UPDATE
    SET valor_inventario_final = EXCLUDED.valor_inventario_final,
        fecha_toma = EXCLUDED.fecha_toma,
        responsable = EXCLUDED.responsable,
        observaciones = EXCLUDED.observaciones,
        es_manual = FALSE,
        origen = 'KARDEX_AUTO',
        actualizado_en = CURRENT_TIMESTAMP;

    RETURN QUERY
    SELECT 
        itf.ejercicio, 
        itf.fecha_toma, 
        itf.valor_inventario_final, 
        itf.responsable, 
        itf.observaciones,
        itf.es_manual,
        itf.origen
    FROM inventario_toma_fisica itf
    WHERE itf.ejercicio = p_ejercicio;
END;
$$ LANGUAGE plpgsql;