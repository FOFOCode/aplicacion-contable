-- =============================================================================
-- MIGRACIÓN 013: Candado Estricto de Integridad para Kardex Multi-Ejercicio
-- =============================================================================

-- 1. CANDADO EN BASE DE DATOS: La fecha de todo movimiento de Kardex DEBE coincidir
--    estrictamente con el ejercicio fiscal al que pertenece.
--    Esto previene físicamente que movimientos viejos (ej. facturas de 2026)
--    puedan ser guardados bajo el ejercicio 2027 por errores de frontend o caché.
ALTER TABLE kardex_movimiento 
  DROP CONSTRAINT IF EXISTS chk_kardex_movimiento_ejercicio_fecha;

ALTER TABLE kardex_movimiento 
  ADD CONSTRAINT chk_kardex_movimiento_ejercicio_fecha 
  CHECK (EXTRACT(YEAR FROM fecha) = ejercicio);

-- 2. PROCEDIMIENTO ROBUSTO: sp_generar_partida_apertura genera automáticamente
--    la fila única de Inventario Inicial en Kardex para el nuevo ejercicio.
CREATE OR REPLACE FUNCTION sp_generar_partida_apertura(
    p_ejercicio_origen INT,
    p_ejercicio_destino INT,
    p_usuario_email TEXT DEFAULT 'admin@contable.sv'
)
RETURNS UUID AS $$
DECLARE
    v_asiento_apertura_id UUID;
    v_linea_idx INT := 1;
    v_inv_final NUMERIC(14, 2);
    v_fecha_apertura DATE;
    r RECORD;
    v_total_debe NUMERIC(14, 2) := 0.00;
    v_total_haber NUMERIC(14, 2) := 0.00;
BEGIN
    -- Validar que el ejercicio origen esté formalmente cerrado
    IF NOT EXISTS (SELECT 1 FROM ejercicio_fiscal WHERE ejercicio = p_ejercicio_origen AND estado = 'CERRADO') THEN
        RAISE EXCEPTION 'El ejercicio origen % debe estar formalmente CERRADO para traspasar sus saldos finales.', p_ejercicio_origen;
    END IF;

    -- Si el ejercicio destino no existe, crearlo automáticamente en estado ABIERTO
    INSERT INTO ejercicio_fiscal (ejercicio, fecha_inicio, fecha_fin, ultimo_numero, estado)
    VALUES (
        p_ejercicio_destino,
        MAKE_DATE(p_ejercicio_destino, 1, 1),
        MAKE_DATE(p_ejercicio_destino, 12, 31),
        0,
        'ABIERTO'
    )
    ON CONFLICT (ejercicio) DO UPDATE
    SET estado = CASE WHEN ejercicio_fiscal.estado = 'CERRADO' THEN 'CERRADO' ELSE 'ABIERTO' END;

    IF EXISTS (SELECT 1 FROM ejercicio_fiscal WHERE ejercicio = p_ejercicio_destino AND estado = 'CERRADO') THEN
        RAISE EXCEPTION 'El ejercicio fiscal destino % se encuentra CERRADO.', p_ejercicio_destino;
    END IF;

    IF EXISTS (SELECT 1 FROM asiento WHERE ejercicio = p_ejercicio_destino AND tipo = 'APERTURA' AND estado = 'APLICADO') THEN
        RAISE EXCEPTION 'El ejercicio fiscal % ya cuenta con una partida de APERTURA aplicada.', p_ejercicio_destino;
    END IF;

    -- Obtener Inventario Final de la toma física del ejercicio origen
    SELECT COALESCE(valor_inventario_final, 0.00) INTO v_inv_final
    FROM inventario_toma_fisica WHERE ejercicio = p_ejercicio_origen;

    -- Si no hubo toma física explícita, tomar el saldo que tenía 1104
    IF v_inv_final IS NULL OR v_inv_final <= 0 THEN
        SELECT COALESCE(SUM(al.debe) - SUM(al.haber), 0.00) INTO v_inv_final
        FROM asiento_linea al
        JOIN asiento a ON al.asiento_id = a.id
        WHERE a.ejercicio = p_ejercicio_origen AND al.cuenta_codigo = '1104' AND a.estado = 'APLICADO';
    END IF;

    v_fecha_apertura := MAKE_DATE(p_ejercicio_destino, 1, 1);

    -- Crear cabecera de la Partida #1 de Apertura
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado)
    VALUES (
        p_ejercicio_destino,
        1,
        v_fecha_apertura,
        FORMAT('Asiento de apertura y balance inicial del ejercicio fiscal %s (traspasado desde el ejercicio %s)', p_ejercicio_destino, p_ejercicio_origen),
        'APERTURA',
        'APLICADO'
    ) RETURNING id INTO v_asiento_apertura_id;

    -- Traspasar Inventario de mercadería (1104) con el inventario final del año origen
    IF v_inv_final > 0 THEN
        INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber)
        VALUES (v_asiento_apertura_id, v_linea_idx, '1104', v_inv_final, 0.00);
        v_linea_idx := v_linea_idx + 1;
        v_total_debe := v_total_debe + v_inv_final;
    END IF;

    -- Traspasar las demás cuentas de Balance (Activo, Pasivo, Capital) excluyendo 1104
    FOR r IN (
        SELECT 
            c.codigo,
            c.tipo,
            c.naturaleza,
            ROUND(SUM(al.debe) - SUM(al.haber), 2) AS saldo_neto
        FROM catalogo_cuentas c
        JOIN asiento_linea al ON c.codigo = al.cuenta_codigo
        JOIN asiento a ON al.asiento_id = a.id
        WHERE a.ejercicio = p_ejercicio_origen
          AND a.estado = 'APLICADO'
          AND c.tipo IN ('activo', 'pasivo', 'capital')
          AND c.codigo <> '1104'
        GROUP BY c.codigo, c.tipo, c.naturaleza
        HAVING ROUND(SUM(al.debe) - SUM(al.haber), 2) <> 0
        ORDER BY c.codigo ASC
    ) LOOP
        IF r.saldo_neto > 0 THEN
            INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber)
            VALUES (v_asiento_apertura_id, v_linea_idx, r.codigo, r.saldo_neto, 0.00);
            v_linea_idx := v_linea_idx + 1;
            v_total_debe := v_total_debe + r.saldo_neto;
        ELSIF r.saldo_neto < 0 THEN
            INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber)
            VALUES (v_asiento_apertura_id, v_linea_idx, r.codigo, 0.00, ABS(r.saldo_neto));
            v_linea_idx := v_linea_idx + 1;
            v_total_haber := v_total_haber + ABS(r.saldo_neto);
        END IF;
    END LOOP;

    -- Actualizar correlativo en ejercicio_fiscal
    UPDATE ejercicio_fiscal
    SET ultimo_numero = GREATEST(ultimo_numero, 1)
    WHERE ejercicio = p_ejercicio_destino;

    -- Crear toma física base para el nuevo ejercicio
    INSERT INTO inventario_toma_fisica (
        ejercicio, fecha_toma, valor_inventario_final, responsable, observaciones
    ) VALUES (
        p_ejercicio_destino,
        MAKE_DATE(p_ejercicio_destino, 12, 31),
        v_inv_final,
        'Control Automático de Apertura',
        FORMAT('Valor traspasado de la toma física del ejercicio %s como inventario inicial de %s', p_ejercicio_origen, p_ejercicio_destino)
    )
    ON CONFLICT (ejercicio) DO UPDATE
    SET valor_inventario_final = EXCLUDED.valor_inventario_final;

    -- GENERAR AUTOMÁTICAMENTE LA FILA DE INVENTARIO INICIAL EN KARDEX PARA EL NUEVO EJERCICIO
    -- Limpiar movimientos previos residuales si existieran
    DELETE FROM kardex_movimiento WHERE ejercicio = p_ejercicio_destino AND asiento_id = v_asiento_apertura_id;

    INSERT INTO kardex_movimiento (
        articulo_id, ejercicio, fecha, comprobante, concepto, tipo,
        unidades_entrada, unidades_salida, unidades_saldo,
        costo_unitario, debe, haber, saldo, asiento_id
    )
    SELECT 
        a.id,
        p_ejercicio_destino,
        v_fecha_apertura,
        'APERTURA',
        FORMAT('Inventario inicial traspasado del ejercicio fiscal %s', p_ejercicio_origen),
        'ENTRADA',
        COALESCE(ult.unidades_saldo, 0.00),
        0.00,
        COALESCE(ult.unidades_saldo, 0.00),
        COALESCE(ult.costo_unitario, ROUND(v_inv_final / NULLIF(ult.unidades_saldo, 0), 4), 0.00),
        v_inv_final,
        0.00,
        v_inv_final,
        v_asiento_apertura_id
    FROM articulo_kardex a
    CROSS JOIN LATERAL (
        SELECT km.unidades_saldo, km.costo_unitario
        FROM kardex_movimiento km
        WHERE km.articulo_id = a.id AND km.ejercicio = p_ejercicio_origen
        ORDER BY km.fecha DESC, km.creado_en DESC
        LIMIT 1
    ) ult
    WHERE a.activo = TRUE
    ON CONFLICT DO NOTHING;

    -- Historial de auditoría
    INSERT INTO asiento_historial (
        asiento_id, accion, ejercicio, numero, concepto,
        total_debe, total_haber, motivo, usuario_email
    ) VALUES (
        v_asiento_apertura_id, 'APERTURA', p_ejercicio_destino, 1,
        FORMAT('Asiento de apertura del ejercicio %s', p_ejercicio_destino),
        v_total_debe, v_total_haber,
        FORMAT('Apertura automática generada desde los saldos finales del ejercicio %s', p_ejercicio_origen),
        p_usuario_email
    );

    RETURN v_asiento_apertura_id;
END;
$$ LANGUAGE plpgsql;
