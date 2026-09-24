-- =============================================================================
-- MIGRACIÓN 002: Historial de Cierres + Catálogo Jerárquico Completo
-- =============================================================================

-- 1. TABLA: HISTORIAL DE CIERRES CONTABLES
CREATE TABLE IF NOT EXISTS cierre_contable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ejercicio INT NOT NULL,
    fecha_cierre DATE NOT NULL DEFAULT CURRENT_DATE,
    concepto TEXT NOT NULL DEFAULT 'Cierre del ejercicio fiscal',
    total_ingresos NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_gastos NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    utilidad NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    cuenta_capital_codigo VARCHAR(20) NOT NULL REFERENCES catalogo_cuentas(codigo),
    asiento_cierre_id UUID NOT NULL REFERENCES asiento(id),
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cierre_ejercicio ON cierre_contable(ejercicio);
CREATE INDEX IF NOT EXISTS idx_cierre_fecha ON cierre_contable(fecha_cierre);

-- 2. REEMPLAZAR sp_cerrar_ciclo_contable PARA QUE REGISTRE EN cierre_contable
CREATE OR REPLACE FUNCTION sp_cerrar_ciclo_contable(
    p_ejercicio INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT,
    p_fecha_cierre DATE DEFAULT CURRENT_DATE,
    p_concepto TEXT DEFAULT 'Asiento de liquidación y cierre del ejercicio fiscal'
)
RETURNS UUID AS $$
DECLARE
    v_asiento_cierre_id UUID;
    v_utilidad NUMERIC(14, 2);
    v_total_ingresos NUMERIC(14, 2);
    v_total_gastos NUMERIC(14, 2);
    v_cuenta_capital VARCHAR(20);
    v_linea_idx INT := 1;
    r RECORD;
BEGIN
    -- 1. Obtener totales del estado de resultados
    SELECT
        COALESCE(total_ingresos, 0.00),
        COALESCE(total_gastos, 0.00),
        COALESCE(utilidad, 0.00)
    INTO v_total_ingresos, v_total_gastos, v_utilidad
    FROM vista_estado_resultados;

    -- 2. Cuenta de capital para absorber la utilidad
    SELECT codigo INTO v_cuenta_capital
    FROM catalogo_cuentas
    WHERE activa = TRUE AND tipo = 'capital'
    ORDER BY CASE WHEN codigo = '3102' THEN 0 ELSE 1 END, codigo ASC
    LIMIT 1;

    IF v_cuenta_capital IS NULL THEN
        RAISE EXCEPTION 'No existe una cuenta de capital activa para transferir la utilidad.';
    END IF;

    -- 3. Insertar cabecera del asiento de cierre
    INSERT INTO asiento (ejercicio, fecha, concepto, tipo)
    VALUES (p_ejercicio, p_fecha_cierre, p_concepto, 'CIERRE')
    RETURNING id INTO v_asiento_cierre_id;

    -- 4. Cancelar cuentas de Ingresos
    FOR r IN (
        SELECT cuenta_codigo, (total_haber - total_debe) AS saldo
        FROM vista_libro_mayor
        WHERE cuenta_tipo = 'ingreso' AND (total_haber - total_debe) > 0
    ) LOOP
        INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber)
        VALUES (v_asiento_cierre_id, v_linea_idx, r.cuenta_codigo, r.saldo, 0.00);
        v_linea_idx := v_linea_idx + 1;
    END LOOP;

    -- 5. Cancelar cuentas de Gastos
    FOR r IN (
        SELECT cuenta_codigo, (total_debe - total_haber) AS saldo
        FROM vista_libro_mayor
        WHERE cuenta_tipo = 'gasto' AND (total_debe - total_haber) > 0
    ) LOOP
        INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber)
        VALUES (v_asiento_cierre_id, v_linea_idx, r.cuenta_codigo, 0.00, r.saldo);
        v_linea_idx := v_linea_idx + 1;
    END LOOP;

    -- 6. Imputar utilidad o pérdida a Capital
    IF v_utilidad > 0 THEN
        INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber)
        VALUES (v_asiento_cierre_id, v_linea_idx, v_cuenta_capital, 0.00, v_utilidad);
    ELSIF v_utilidad < 0 THEN
        INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber)
        VALUES (v_asiento_cierre_id, v_linea_idx, v_cuenta_capital, ABS(v_utilidad), 0.00);
    END IF;

    -- 7. REGISTRAR EN HISTORIAL DE CIERRES
    INSERT INTO cierre_contable (
        ejercicio, fecha_cierre, concepto,
        total_ingresos, total_gastos, utilidad,
        cuenta_capital_codigo, asiento_cierre_id
    ) VALUES (
        p_ejercicio, p_fecha_cierre, p_concepto,
        v_total_ingresos, v_total_gastos, v_utilidad,
        v_cuenta_capital, v_asiento_cierre_id
    );

    RETURN v_asiento_cierre_id;
END;
$$ LANGUAGE plpgsql;

-- 3. AMPLIAR CATÁLOGO CON CUENTAS PADRE (JERÁRQUICAS)
-- Cuentas de grupo (2 dígitos) y subgrupo (4 dígitos) adicionales
-- Las cuentas existentes (1101, 1102, etc.) ya están, solo agregamos las que faltan

INSERT INTO catalogo_cuentas (codigo, nombre, tipo, naturaleza, activa) VALUES
-- Activo corriente: subcuentas adicionales
('1106', 'Deudores diversos', 'activo', 'deudora', TRUE),
('1107', 'Papelería y útiles', 'activo', 'deudora', TRUE),
('1108', 'Pagos anticipados', 'activo', 'deudora', TRUE),
-- Activo no corriente: subcuentas adicionales
('1203', 'Equipo de cómputo', 'activo', 'deudora', TRUE),
('1204', 'Edificios', 'activo', 'deudora', TRUE),
('1205', 'Terrenos', 'activo', 'deudora', TRUE),
('1206', 'Depreciación acumulada', 'activo', 'deudora', TRUE),
-- Pasivo corriente: subcuentas adicionales
('2105', 'Acreedores diversos', 'pasivo', 'acreedora', TRUE),
('2106', 'Sueldos y salarios por pagar', 'pasivo', 'acreedora', TRUE),
('2107', 'Retenciones por pagar', 'pasivo', 'acreedora', TRUE),
-- Pasivo no corriente
('2201', 'Préstamos bancarios a largo plazo', 'pasivo', 'acreedora', TRUE),
('2202', 'Hipotecas por pagar', 'pasivo', 'acreedora', TRUE),
-- Capital contable adicionales
('3104', 'Pérdidas acumuladas', 'capital', 'acreedora', TRUE),
('3105', 'Donaciones', 'capital', 'acreedora', TRUE),
-- Costos y gastos adicionales
('4102', 'Costo de servicios', 'gasto', 'deudora', TRUE),
('4203', 'Gastos de depreciación', 'gasto', 'deudora', TRUE),
('4204', 'Gastos de alquiler', 'gasto', 'deudora', TRUE),
('4205', 'Gastos de servicios básicos', 'gasto', 'deudora', TRUE),
('4206', 'Gastos de sueldos y salarios', 'gasto', 'deudora', TRUE),
('4207', 'Gastos de papelería y útiles', 'gasto', 'deudora', TRUE),
('4208', 'Gastos de publicidad', 'gasto', 'deudora', TRUE),
('4302', 'Intereses pagados', 'gasto', 'deudora', TRUE),
('4303', 'Comisiones bancarias', 'gasto', 'deudora', TRUE),
-- Ingresos adicionales
('5103', 'Ingresos por servicios', 'ingreso', 'acreedora', TRUE),
('5104', 'Devoluciones y descuentos sobre ventas', 'ingreso', 'acreedora', TRUE),
('5202', 'Intereses cobrados', 'ingreso', 'acreedora', TRUE),
('5203', 'Utilidad en venta de activos', 'ingreso', 'acreedora', TRUE)
ON CONFLICT (codigo) DO NOTHING;
