-- =============================================================================
-- MIGRACIÓN 012: Robustecimiento de Cierre Contable Analítico y Partida de Apertura
-- =============================================================================

-- 1. Permitir la acción 'APERTURA' en el historial de asientos
ALTER TABLE asiento_historial DROP CONSTRAINT IF EXISTS asiento_historial_accion_check;
ALTER TABLE asiento_historial ADD CONSTRAINT asiento_historial_accion_check 
  CHECK (accion IN ('CREACION', 'MODIFICACION', 'ANULACION', 'CIERRE', 'APERTURA'));

-- 2. Procedimiento de Cierre Contable con soporte del Método Analítico y actualización de estado
CREATE OR REPLACE FUNCTION sp_cerrar_ciclo_contable(
    p_ejercicio INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT,
    p_fecha_cierre DATE DEFAULT CURRENT_DATE,
    p_concepto TEXT DEFAULT 'Asiento de liquidación y cierre del ejercicio fiscal'
)
RETURNS UUID AS $$
DECLARE
    v_asiento_cierre_id UUID;
    v_proximo_numero INT;
    v_utilidad NUMERIC(14, 2);
    v_total_ingresos NUMERIC(14, 2);
    v_total_gastos NUMERIC(14, 2);
    v_inv_inicial NUMERIC(14, 2) := 0.00;
    v_inv_final NUMERIC(14, 2) := 0.00;
    v_cuenta_capital VARCHAR(20);
    v_linea_idx INT := 1;
    r RECORD;
BEGIN
    -- 1. Obtener totales desde la vista analítica si existe para este ejercicio
    SELECT 
        COALESCE(ventas_totales, 0.00),
        COALESCE(costo_ventas + gastos_operacion + gastos_financieros, 0.00),
        COALESCE(utilidad_neta, 0.00),
        COALESCE(inventario_inicial, 0.00),
        COALESCE(inventario_final, 0.00)
    INTO v_total_ingresos, v_total_gastos, v_utilidad, v_inv_inicial, v_inv_final
    FROM vista_estado_resultados_analitico
    WHERE ejercicio = p_ejercicio;

    -- Fallback a vista_estado_resultados estándar
    IF v_utilidad IS NULL THEN
        SELECT 
            COALESCE(total_ingresos, 0.00),
            COALESCE(total_gastos, 0.00),
            COALESCE(utilidad, 0.00)
        INTO v_total_ingresos, v_total_gastos, v_utilidad
        FROM vista_estado_resultados
        WHERE ejercicio = p_ejercicio;
    END IF;

    IF v_utilidad IS NULL THEN
        SELECT 
            COALESCE(total_ingresos, 0.00),
            COALESCE(total_gastos, 0.00),
            COALESCE(utilidad, 0.00)
        INTO v_total_ingresos, v_total_gastos, v_utilidad
        FROM vista_estado_resultados
        LIMIT 1;
    END IF;

    -- 2. Cuenta de capital disponible para absorber la utilidad
    SELECT codigo INTO v_cuenta_capital 
    FROM catalogo_cuentas 
    WHERE activa = TRUE AND tipo = 'capital'
    ORDER BY CASE WHEN codigo = '3102' THEN 0 ELSE 1 END, codigo ASC
    LIMIT 1;

    IF v_cuenta_capital IS NULL THEN
        RAISE EXCEPTION 'No existe una cuenta de capital activa para transferir la utilidad.';
    END IF;

    -- 3. Obtener número consecutivo para este ejercicio fiscal específico
    v_proximo_numero := fn_proximo_numero_asiento(p_ejercicio);

    -- 4. Insertar cabecera del Asiento de Cierre
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado)
    VALUES (p_ejercicio, v_proximo_numero, p_fecha_cierre, p_concepto, 'CIERRE', 'APLICADO')
    RETURNING id INTO v_asiento_cierre_id;

    -- 5. Cancelar cuentas de Ingresos (Se cargan al Debe para saldo 0)
    FOR r IN (
        SELECT al.cuenta_codigo, ROUND(SUM(al.haber) - SUM(al.debe), 2) AS saldo
        FROM catalogo_cuentas c
        JOIN asiento_linea al ON c.codigo = al.cuenta_codigo
        JOIN asiento a ON al.asiento_id = a.id
        WHERE a.estado = 'APLICADO' AND a.ejercicio = p_ejercicio AND c.tipo = 'ingreso'
        GROUP BY al.cuenta_codigo
        HAVING ROUND(SUM(al.haber) - SUM(al.debe), 2) <> 0
    ) LOOP
        IF r.saldo > 0 THEN
            INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber)
            VALUES (v_asiento_cierre_id, v_linea_idx, r.cuenta_codigo, r.saldo, 0.00);
            v_linea_idx := v_linea_idx + 1;
        ELSIF r.saldo < 0 THEN
            INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber)
            VALUES (v_asiento_cierre_id, v_linea_idx, r.cuenta_codigo, 0.00, ABS(r.saldo));
            v_linea_idx := v_linea_idx + 1;
        END IF;
    END LOOP;

    -- 6. Cancelar cuentas de Gastos y Costos (Se abonan al Haber para saldo 0)
    FOR r IN (
        SELECT al.cuenta_codigo, ROUND(SUM(al.debe) - SUM(al.haber), 2) AS saldo
        FROM catalogo_cuentas c
        JOIN asiento_linea al ON c.codigo = al.cuenta_codigo
        JOIN asiento a ON al.asiento_id = a.id
        WHERE a.estado = 'APLICADO' AND a.ejercicio = p_ejercicio AND c.tipo = 'gasto'
        GROUP BY al.cuenta_codigo
        HAVING ROUND(SUM(al.debe) - SUM(al.haber), 2) <> 0
    ) LOOP
        IF r.saldo > 0 THEN
            INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber)
            VALUES (v_asiento_cierre_id, v_linea_idx, r.cuenta_codigo, 0.00, r.saldo);
            v_linea_idx := v_linea_idx + 1;
        ELSIF r.saldo < 0 THEN
            INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber)
            VALUES (v_asiento_cierre_id, v_linea_idx, r.cuenta_codigo, ABS(r.saldo), 0.00);
            v_linea_idx := v_linea_idx + 1;
        END IF;
    END LOOP;

    -- 7. Ajuste de inventario en método analítico:
    -- Cancela el inventario inicial en 1104 e incorpora el inventario final certificado
    IF v_inv_final > 0 OR v_inv_inicial > 0 THEN
        IF v_inv_inicial > 0 THEN
            INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber)
            VALUES (v_asiento_cierre_id, v_linea_idx, '1104', 0.00, v_inv_inicial);
            v_linea_idx := v_linea_idx + 1;
        END IF;
        IF v_inv_final > 0 THEN
            INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber)
            VALUES (v_asiento_cierre_id, v_linea_idx, '1104', v_inv_final, 0.00);
            v_linea_idx := v_linea_idx + 1;
        END IF;
    END IF;

    -- 8. Imputar la utilidad o pérdida neta analítica a la cuenta de Capital
    IF v_utilidad > 0 THEN
        INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber)
        VALUES (v_asiento_cierre_id, v_linea_idx, v_cuenta_capital, 0.00, v_utilidad);
    ELSIF v_utilidad < 0 THEN
        INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber)
        VALUES (v_asiento_cierre_id, v_linea_idx, v_cuenta_capital, ABS(v_utilidad), 0.00);
    END IF;

    -- 9. Registrar en el Historial de Cierres Contables
    INSERT INTO cierre_contable (
        ejercicio, fecha_cierre, concepto,
        total_ingresos, total_gastos, utilidad,
        cuenta_capital_codigo, asiento_cierre_id
    ) VALUES (
        p_ejercicio, p_fecha_cierre, p_concepto,
        v_total_ingresos, v_total_gastos, v_utilidad,
        v_cuenta_capital, v_asiento_cierre_id
    );

    -- 10. Registrar en Historial de Auditoría
    INSERT INTO asiento_historial (
        asiento_id, accion, ejercicio, numero, concepto,
        total_debe, total_haber, motivo
    ) VALUES (
        v_asiento_cierre_id, 'CIERRE', p_ejercicio, v_proximo_numero, p_concepto,
        v_total_ingresos, v_total_ingresos, 'Liquidación y cierre formal del ejercicio fiscal'
    );

    -- 11. Actualizar estado del ejercicio fiscal a CERRADO
    UPDATE ejercicio_fiscal
    SET estado = 'CERRADO', cerrado_en = CURRENT_TIMESTAMP
    WHERE ejercicio = p_ejercicio;

    RETURN v_asiento_cierre_id;
END;
$$ LANGUAGE plpgsql;
