-- =============================================================================
-- DATOS SEMILLA (data.sql)
-- Proyecto: Sistema Contable Automatizado (UNICAES)
-- Inicialización del Catálogo Completo (48 cuentas) y Asientos Contables Base
-- =============================================================================

-- 1. Catálogo Completo de Cuentas (48 cuentas clasificadas por grupo y subgrupo)
INSERT INTO catalogo_cuentas (codigo, nombre, tipo, naturaleza, activa) VALUES
-- 1. Activo (Naturaleza deudora)
-- 11. Activo corriente
('1101', 'Caja general', 'activo', 'deudora', TRUE),
('1102', 'Bancos', 'activo', 'deudora', TRUE),
('1103', 'Cuentas por cobrar', 'activo', 'deudora', TRUE),
('1104', 'Inventario de mercadería', 'activo', 'deudora', TRUE),
('1105', 'IVA crédito fiscal', 'activo', 'deudora', TRUE),
('1106', 'Deudores diversos', 'activo', 'deudora', TRUE),
('1107', 'Papelería y útiles', 'activo', 'deudora', TRUE),
('1108', 'Pagos anticipados', 'activo', 'deudora', TRUE),
-- 12. Activo no corriente
('1201', 'Mobiliario y equipo', 'activo', 'deudora', TRUE),
('1202', 'Equipo de transporte', 'activo', 'deudora', TRUE),
('1203', 'Equipo de cómputo', 'activo', 'deudora', TRUE),
('1204', 'Edificios', 'activo', 'deudora', TRUE),
('1205', 'Terrenos', 'activo', 'deudora', TRUE),
('1206', 'Depreciación acumulada', 'activo', 'deudora', TRUE),

-- 2. Pasivo (Naturaleza acreedora)
-- 21. Pasivo corriente
('2101', 'Cuentas por pagar', 'pasivo', 'acreedora', TRUE),
('2102', 'Préstamos bancarios por pagar', 'pasivo', 'acreedora', TRUE),
('2103', 'IVA débito fiscal', 'pasivo', 'acreedora', TRUE),
('2104', 'Impuestos por pagar', 'pasivo', 'acreedora', TRUE),
('2105', 'Acreedores diversos', 'pasivo', 'acreedora', TRUE),
('2106', 'Sueldos y salarios por pagar', 'pasivo', 'acreedora', TRUE),
('2107', 'Retenciones por pagar', 'pasivo', 'acreedora', TRUE),
-- 22. Pasivo no corriente
('2201', 'Préstamos bancarios a largo plazo', 'pasivo', 'acreedora', TRUE),
('2202', 'Hipotecas por pagar', 'pasivo', 'acreedora', TRUE),

-- 3. Capital contable (Naturaleza acreedora)
('3101', 'Capital social', 'capital', 'acreedora', TRUE),
('3102', 'Utilidades acumuladas', 'capital', 'acreedora', TRUE),
('3103', 'Reserva legal', 'capital', 'acreedora', TRUE),
('3104', 'Pérdidas acumuladas', 'capital', 'acreedora', TRUE),
('3105', 'Donaciones', 'capital', 'acreedora', TRUE),

-- 4. Costos y gastos (Naturaleza deudora)
-- 41. Costo de venta
('4101', 'Costo de venta', 'gasto', 'deudora', TRUE),
('4102', 'Costo de servicios', 'gasto', 'deudora', TRUE),
-- 42. Gastos de operación
('4201', 'Gastos de administración', 'gasto', 'deudora', TRUE),
('4202', 'Gastos de venta', 'gasto', 'deudora', TRUE),
('4203', 'Gastos de depreciación', 'gasto', 'deudora', TRUE),
('4204', 'Gastos de alquiler', 'gasto', 'deudora', TRUE),
('4205', 'Gastos de servicios básicos', 'gasto', 'deudora', TRUE),
('4206', 'Gastos de sueldos y salarios', 'gasto', 'deudora', TRUE),
('4207', 'Gastos de papelería y útiles', 'gasto', 'deudora', TRUE),
('4208', 'Gastos de publicidad', 'gasto', 'deudora', TRUE),
-- 43. Gastos financieros
('4301', 'Gastos financieros', 'gasto', 'deudora', TRUE),
('4302', 'Intereses pagados', 'gasto', 'deudora', TRUE),
('4303', 'Comisiones bancarias', 'gasto', 'deudora', TRUE),

-- 5. Ingresos (Naturaleza acreedora)
-- 51. Ventas y operativos
('5101', 'Ventas', 'ingreso', 'acreedora', TRUE),
('5102', 'Otros ingresos operativos', 'ingreso', 'acreedora', TRUE),
('5103', 'Ingresos por servicios', 'ingreso', 'acreedora', TRUE),
('5104', 'Devoluciones y descuentos sobre ventas', 'ingreso', 'acreedora', TRUE),
-- 52. Financieros
('5201', 'Productos financieros', 'ingreso', 'acreedora', TRUE),
('5202', 'Intereses cobrados', 'ingreso', 'acreedora', TRUE),
('5203', 'Utilidad en venta de activos', 'ingreso', 'acreedora', TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- 2. Asientos iniciales de ejemplo (Partida Doble)
DO $$
DECLARE
    v1 UUID; v2 UUID; v3 UUID; v4 UUID; v5 UUID;
BEGIN
    -- Evitar duplicación si ya existen asientos
    IF EXISTS (SELECT 1 FROM asiento LIMIT 1) THEN
        RETURN;
    END IF;

    -- Partida 1: Aporte inicial ($15,000.00)
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) 
    VALUES (2026, 1, '2026-01-02', 'Aportación inicial de los socios en efectivo y banco.', 'APERTURA', 'APLICADO') 
    RETURNING id INTO v1;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v1, 1, '1101', 10000.00, 0.00),
    (v1, 2, '1102', 5000.00, 0.00),
    (v1, 3, '3101', 0.00, 15000.00);

    -- Partida 2: Compra de mercadería con IVA crédito fiscal ($4,520.00)
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) 
    VALUES (2026, 2, '2026-01-05', 'Compra de mercadería al crédito fiscal, pagada con banco.', 'OPERACION', 'APLICADO') 
    RETURNING id INTO v2;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v2, 1, '1104', 4000.00, 0.00),
    (v2, 2, '1105', 520.00, 0.00),
    (v2, 3, '1102', 0.00, 4520.00);

    -- Partida 3: Venta de mercadería con IVA débito fiscal ($6,780.00)
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) 
    VALUES (2026, 3, '2026-01-12', 'Venta de mercadería con IVA débito fiscal, cobrada en banco.', 'OPERACION', 'APLICADO') 
    RETURNING id INTO v3;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v3, 1, '1102', 6780.00, 0.00),
    (v3, 2, '5101', 0.00, 6000.00),
    (v3, 3, '2103', 0.00, 780.00);

    -- Partida 4: Costo de ventas ($3,000.00)
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) 
    VALUES (2026, 4, '2026-01-12', 'Registro del costo de la mercadería vendida.', 'OPERACION', 'APLICADO') 
    RETURNING id INTO v4;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v4, 1, '4101', 3000.00, 0.00),
    (v4, 2, '1104', 0.00, 3000.00);

    -- Partida 5: Gastos de administración ($800.00)
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) 
    VALUES (2026, 5, '2026-01-20', 'Pago de gastos de administración con banco.', 'OPERACION', 'APLICADO') 
    RETURNING id INTO v5;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v5, 1, '4201', 800.00, 0.00),
    (v5, 2, '1102', 0.00, 800.00);
END $$;
