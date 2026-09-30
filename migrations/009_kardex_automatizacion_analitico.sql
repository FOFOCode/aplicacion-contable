-- =============================================================================
-- MIGRACIÓN 009: Automatización 100% de Kardex, Folios e Inventario Final Analítico
-- =============================================================================

-- 1. EXTENDER ASIENTO_LINEA CON REFERENCIAS A ARTÍCULOS Y UNIDADES
ALTER TABLE asiento_linea 
ADD COLUMN IF NOT EXISTS articulo_id UUID REFERENCES articulo_kardex(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS cantidad NUMERIC(12, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC(14, 4) DEFAULT NULL;

-- 2. EXTENDER INVENTARIO_TOMA_FISICA CON BANDERAS DE AUDITORÍA MANUAL
ALTER TABLE inventario_toma_fisica 
ADD COLUMN IF NOT EXISTS es_manual BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS origen VARCHAR(30) NOT NULL DEFAULT 'KARDEX_AUTO';

-- 3. FUNCIÓN STORED PROCEDURE: REGISTRAR KARDEX DESDE LÍNEA CONTABLE
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

-- 4. MANEJO DE ANULACIÓN: ELIMINAR MOVIMIENTOS DE KARDEX CUANDO SE ANULA LA PARTIDA
CREATE OR REPLACE FUNCTION fn_revertir_kardex_al_anular()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado = 'ANULADO' AND OLD.estado != 'ANULADO' THEN
        DELETE FROM kardex_movimiento WHERE asiento_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_anular_kardex_asiento ON asiento;
CREATE TRIGGER tr_anular_kardex_asiento
AFTER UPDATE OF estado ON asiento
FOR EACH ROW
WHEN (NEW.estado = 'ANULADO')
EXECUTE FUNCTION fn_revertir_kardex_al_anular();

-- 5. REDEFINIR VISTA_ESTADO_RESULTADOS_ANALITICO PARA CÁLCULO 100% EN TIEMPO REAL
CREATE OR REPLACE VIEW vista_estado_resultados_analitico AS
WITH ejercicios_activos AS (
    SELECT DISTINCT ejercicio FROM vista_libro_mayor
),
kardex_tiempo_real AS (
    SELECT 
        e.ejercicio,
        COALESCE(SUM(ultimo.saldo), 0.00) AS saldo_kardex_total,
        MAX(ultimo.fecha) AS fecha_ultimo_movimiento
    FROM ejercicios_activos e
    CROSS JOIN articulo_kardex a
    CROSS JOIN LATERAL (
        SELECT km.saldo, km.fecha
        FROM kardex_movimiento km
        LEFT JOIN asiento ast ON km.asiento_id = ast.id
        WHERE km.articulo_id = a.id 
          AND km.ejercicio = e.ejercicio
          AND (km.asiento_id IS NULL OR ast.estado = 'APLICADO')
        ORDER BY km.fecha DESC, km.creado_en DESC
        LIMIT 1
    ) ultimo
    WHERE a.activo = TRUE
    GROUP BY e.ejercicio
),
tomas_inventario AS (
    SELECT DISTINCT ON (ejercicio)
        ejercicio,
        valor_inventario_final,
        fecha_toma,
        es_manual
    FROM inventario_toma_fisica
    ORDER BY ejercicio, fecha_toma DESC, creado_en DESC
),
componentes AS (
    SELECT 
        e.ejercicio,
        COALESCE((SELECT saldo_normalizado FROM vista_libro_mayor m WHERE m.ejercicio = e.ejercicio AND m.cuenta_codigo = '5101'), 0.00) AS ventas_totales,
        COALESCE((SELECT saldo_normalizado FROM vista_libro_mayor m WHERE m.ejercicio = e.ejercicio AND m.cuenta_codigo = '4103'), 0.00) AS devoluciones_sobre_ventas,
        COALESCE((SELECT saldo_normalizado FROM vista_libro_mayor m WHERE m.ejercicio = e.ejercicio AND m.cuenta_codigo = '4104'), 0.00) AS rebajas_sobre_ventas,
        COALESCE((SELECT saldo_normalizado FROM vista_libro_mayor m WHERE m.ejercicio = e.ejercicio AND m.cuenta_codigo = '1104'), 0.00) AS inventario_inicial,
        COALESCE((SELECT saldo_normalizado FROM vista_libro_mayor m WHERE m.ejercicio = e.ejercicio AND m.cuenta_codigo = '4101'), 0.00) AS compras,
        COALESCE((SELECT saldo_normalizado FROM vista_libro_mayor m WHERE m.ejercicio = e.ejercicio AND m.cuenta_codigo = '4102'), 0.00) AS gastos_sobre_compras,
        COALESCE((SELECT saldo_normalizado FROM vista_libro_mayor m WHERE m.ejercicio = e.ejercicio AND m.cuenta_codigo IN ('5102', '4106')), 0.00) AS devoluciones_sobre_compras,
        COALESCE((SELECT saldo_normalizado FROM vista_libro_mayor m WHERE m.ejercicio = e.ejercicio AND m.cuenta_codigo IN ('5103', '4107')), 0.00) AS rebajas_sobre_compras,
        
        -- RESOLUCIÓN AUTOMÁTICA DEL INVENTARIO FINAL:
        -- Si hay una toma manual de auditoría explícita (es_manual = true), se respeta la toma.
        -- De lo contrario, se calcula dinámicamente en tiempo real desde el saldo de Kardex.
        CASE 
            WHEN ti.es_manual = TRUE THEN ti.valor_inventario_final
            WHEN ktr.saldo_kardex_total IS NOT NULL AND ktr.saldo_kardex_total > 0 THEN ktr.saldo_kardex_total
            ELSE COALESCE(ti.valor_inventario_final, (SELECT saldo_normalizado FROM vista_libro_mayor m WHERE m.ejercicio = e.ejercicio AND m.cuenta_codigo = '1104'), 0.00)
        END AS inventario_final,

        COALESCE(
            CASE WHEN ti.es_manual = TRUE THEN ti.fecha_toma ELSE ktr.fecha_ultimo_movimiento END,
            CURRENT_DATE
        ) AS fecha_inventario_final,

        COALESCE((SELECT SUM(saldo_normalizado) FROM vista_libro_mayor m WHERE m.ejercicio = e.ejercicio AND m.cuenta_codigo LIKE '42%'), 0.00) AS gastos_operacion,
        COALESCE((SELECT SUM(saldo_normalizado) FROM vista_libro_mayor m WHERE m.ejercicio = e.ejercicio AND m.cuenta_codigo LIKE '43%'), 0.00) AS gastos_financieros,
        COALESCE((SELECT SUM(saldo_normalizado) FROM vista_libro_mayor m WHERE m.ejercicio = e.ejercicio AND m.cuenta_codigo LIKE '52%'), 0.00) AS productos_financieros,
        COALESCE((SELECT saldo_normalizado FROM vista_libro_mayor m WHERE m.ejercicio = e.ejercicio AND m.cuenta_codigo = '5104'), 0.00) AS otros_ingresos
    FROM ejercicios_activos e
    LEFT JOIN kardex_tiempo_real ktr ON e.ejercicio = ktr.ejercicio
    LEFT JOIN tomas_inventario ti ON e.ejercicio = ti.ejercicio
)
SELECT 
    ejercicio,
    ventas_totales,
    devoluciones_sobre_ventas,
    rebajas_sobre_ventas,
    ROUND(ventas_totales - devoluciones_sobre_ventas - rebajas_sobre_ventas, 2) AS ventas_netas,
    inventario_inicial,
    compras,
    gastos_sobre_compras,
    ROUND(compras + gastos_sobre_compras, 2) AS compras_totales,
    devoluciones_sobre_compras,
    rebajas_sobre_compras,
    ROUND((compras + gastos_sobre_compras) - devoluciones_sobre_compras - rebajas_sobre_compras, 2) AS compras_netas,
    ROUND(inventario_inicial + ((compras + gastos_sobre_compras) - devoluciones_sobre_compras - rebajas_sobre_compras), 2) AS total_mercancias,
    inventario_final,
    fecha_inventario_final,
    ROUND(
        (inventario_inicial + ((compras + gastos_sobre_compras) - devoluciones_sobre_compras - rebajas_sobre_compras)) - inventario_final,
        2
    ) AS costo_ventas,
    ROUND(
        (ventas_totales - devoluciones_sobre_ventas - rebajas_sobre_ventas)
        - ((inventario_inicial + ((compras + gastos_sobre_compras) - devoluciones_sobre_compras - rebajas_sobre_compras)) - inventario_final),
        2
    ) AS utilidad_bruta,
    gastos_operacion,
    ROUND(
        (ventas_totales - devoluciones_sobre_ventas - rebajas_sobre_ventas)
        - ((inventario_inicial + ((compras + gastos_sobre_compras) - devoluciones_sobre_compras - rebajas_sobre_compras)) - inventario_final)
        - gastos_operacion,
        2
    ) AS utilidad_operacion,
    productos_financieros,
    gastos_financieros,
    otros_ingresos,
    ROUND(
        (ventas_totales - devoluciones_sobre_ventas - rebajas_sobre_ventas)
        - ((inventario_inicial + ((compras + gastos_sobre_compras) - devoluciones_sobre_compras - rebajas_sobre_compras)) - inventario_final)
        - gastos_operacion
        + productos_financieros
        - gastos_financieros
        + otros_ingresos,
        2
    ) AS utilidad_neta
FROM componentes;
