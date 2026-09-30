-- =============================================================================
-- MIGRACIÓN 014: Redondear a Entero (CEIL) en Unidades de Kardex si hay decimal > 0
-- =============================================================================

CREATE OR REPLACE FUNCTION sp_registrar_kardex_desde_linea(
    p_asiento_id UUID,
    p_linea_numero INT,
    p_cuenta_codigo VARCHAR(20),
    p_monto NUMERIC(14, 2),
    p_articulo_id UUID,
    p_cantidad NUMERIC(12, 2),
    p_fecha DATE,
    p_concepto TEXT,
    p_comprobante VARCHAR(100)
)
RETURNS UUID AS $$
DECLARE
    v_ejercicio INT;
    v_art_id UUID := p_articulo_id;
    v_tipo VARCHAR(30);
    v_u_entrada NUMERIC(12, 2) := 0;
    v_u_salida NUMERIC(12, 2) := 0;
    v_u_saldo_ant NUMERIC(12, 2) := 0;
    v_m_saldo_ant NUMERIC(14, 2) := 0;
    v_costo_ant NUMERIC(14, 4) := 0;
    v_costo_operacion NUMERIC(14, 4) := 0;
    v_debe NUMERIC(14, 2) := 0;
    v_haber NUMERIC(14, 2) := 0;
    v_u_saldo_nuevo NUMERIC(12, 2) := 0;
    v_m_saldo_nuevo NUMERIC(14, 2) := 0;
    v_mov_id UUID;
    r_ult RECORD;
BEGIN
    -- Obtener ejercicio del asiento
    SELECT ejercicio INTO v_ejercicio FROM asiento WHERE id = p_asiento_id;
    IF v_ejercicio IS NULL THEN
        v_ejercicio := EXTRACT(YEAR FROM p_fecha)::INT;
    END IF;

    -- Si no se envió artículo, tomar el primero activo
    IF v_art_id IS NULL THEN
        SELECT id INTO v_art_id FROM articulo_kardex WHERE activo = TRUE ORDER BY codigo ASC LIMIT 1;
    END IF;

    IF v_art_id IS NULL THEN
        -- Si no hay artículos en el sistema, salir silenciosamente sin error
        RETURN NULL;
    END IF;

    -- Determinar tipo de movimiento
    IF p_cuenta_codigo = '4101' THEN
        v_tipo := 'ENTRADA';
    ELSIF p_cuenta_codigo = '5101' THEN
        v_tipo := 'SALIDA';
    ELSIF p_cuenta_codigo IN ('5102', '4106') THEN
        v_tipo := 'DEVOLUCION_COMPRA';
    ELSIF p_cuenta_codigo IN ('4103', '5103') THEN
        v_tipo := 'DEVOLUCION_VENTA';
    ELSE
        -- No es cuenta de mercadería
        RETURN NULL;
    END IF;

    -- Obtener último saldo del artículo en este ejercicio
    SELECT unidades_saldo, saldo, costo_unitario 
    INTO r_ult
    FROM kardex_movimiento
    WHERE articulo_id = v_art_id AND ejercicio = v_ejercicio
    ORDER BY fecha DESC, creado_en DESC
    LIMIT 1;

    IF r_ult.unidades_saldo IS NOT NULL THEN
        v_u_saldo_ant := r_ult.unidades_saldo;
        v_m_saldo_ant := r_ult.saldo;
        v_costo_ant := r_ult.costo_unitario;
    END IF;

    IF v_costo_ant <= 0 THEN
        v_costo_ant := 5.0000; -- Costo base de respaldo si está en cero
    END IF;

    -- Calcular unidades y montos según tipo (redondeando unidades siempre a entero hacia arriba si hay decimal > 0: CEIL)
    IF v_tipo = 'ENTRADA' THEN
        IF p_cantidad IS NOT NULL AND p_cantidad > 0 THEN
            v_u_entrada := CEIL(p_cantidad);
            v_costo_operacion := ROUND(p_monto / v_u_entrada, 4);
        ELSE
            -- Estimar unidades según costo vigente redondeando hacia arriba a entero
            v_u_entrada := CEIL(p_monto / v_costo_ant);
            v_costo_operacion := v_costo_ant;
        END IF;
        v_debe := p_monto;
        v_haber := 0.00;
        v_u_saldo_nuevo := v_u_saldo_ant + v_u_entrada;
        v_m_saldo_nuevo := v_m_saldo_ant + v_debe;
        IF v_u_saldo_nuevo > 0 THEN
            v_costo_operacion := ROUND(v_m_saldo_nuevo / v_u_saldo_nuevo, 4);
        END IF;

    ELSIF v_tipo = 'SALIDA' THEN
        IF p_cantidad IS NOT NULL AND p_cantidad > 0 THEN
            v_u_salida := CEIL(p_cantidad);
        ELSE
            -- En ventas p_monto es precio comercial (estimar unidades con margen 35% y redondear hacia arriba)
            v_u_salida := CEIL(p_monto / (v_costo_ant * 1.35));
        END IF;
        v_costo_operacion := v_costo_ant;
        v_haber := ROUND(v_u_salida * v_costo_operacion, 2);
        v_debe := 0.00;
        v_u_saldo_nuevo := GREATEST(0, v_u_saldo_ant - v_u_salida);
        v_m_saldo_nuevo := GREATEST(0, v_m_saldo_ant - v_haber);

    ELSIF v_tipo = 'DEVOLUCION_COMPRA' THEN
        v_u_salida := CEIL(COALESCE(p_cantidad, p_monto / v_costo_ant));
        v_costo_operacion := v_costo_ant;
        v_haber := ROUND(v_u_salida * v_costo_operacion, 2);
        v_debe := 0.00;
        v_u_saldo_nuevo := GREATEST(0, v_u_saldo_ant - v_u_salida);
        v_m_saldo_nuevo := GREATEST(0, v_m_saldo_ant - v_haber);

    ELSIF v_tipo = 'DEVOLUCION_VENTA' THEN
        v_u_entrada := CEIL(COALESCE(p_cantidad, p_monto / (v_costo_ant * 1.35)));
        v_costo_operacion := v_costo_ant;
        v_debe := ROUND(v_u_entrada * v_costo_operacion, 2);
        v_haber := 0.00;
        v_u_saldo_nuevo := v_u_saldo_ant + v_u_entrada;
        v_m_saldo_nuevo := v_m_saldo_ant + v_debe;
    END IF;

    -- Insertar en kardex_movimiento
    INSERT INTO kardex_movimiento (
        articulo_id, ejercicio, fecha, comprobante, concepto, tipo,
        unidades_entrada, unidades_salida, unidades_saldo,
        costo_unitario, debe, haber, saldo, asiento_id
    ) VALUES (
        v_art_id, v_ejercicio, p_fecha, p_comprobante, p_concepto, v_tipo,
        v_u_entrada, v_u_salida, v_u_saldo_nuevo,
        v_costo_operacion, v_debe, v_haber, v_m_saldo_nuevo, p_asiento_id
    )
    RETURNING id INTO v_mov_id;

    RETURN v_mov_id;
END;
$$ LANGUAGE plpgsql;
