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
-- 41. Compras y cuentas analíticas deudoras
('4101', 'Compras', 'gasto', 'deudora', TRUE),
('4102', 'Gastos sobre compras', 'gasto', 'deudora', TRUE),
('4103', 'Devoluciones sobre ventas', 'gasto', 'deudora', TRUE),
('4104', 'Rebajas y descuentos sobre ventas', 'gasto', 'deudora', TRUE),
('4105', 'Costo de servicios', 'gasto', 'deudora', TRUE),
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
-- 51. Ventas y cuentas analíticas acreedoras
('5101', 'Ventas', 'ingreso', 'acreedora', TRUE),
('5102', 'Devoluciones sobre compras', 'ingreso', 'acreedora', TRUE),
('5103', 'Rebajas y descuentos sobre compras', 'ingreso', 'acreedora', TRUE),
('5104', 'Otros ingresos operativos', 'ingreso', 'acreedora', TRUE),
('5105', 'Ingresos por servicios', 'ingreso', 'acreedora', TRUE),
-- 52. Financieros
('5201', 'Productos financieros', 'ingreso', 'acreedora', TRUE),
('5202', 'Intereses cobrados', 'ingreso', 'acreedora', TRUE),
('5203', 'Utilidad en venta de activos', 'ingreso', 'acreedora', TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- 2. Asientos iniciales de ejemplo (Método Analítico o Pormenorizado)
DO $$
DECLARE
    v1 UUID; v2 UUID; v3 UUID; v4 UUID; v5 UUID; v6 UUID; v7 UUID;
BEGIN
    -- Evitar duplicación si ya existen asientos
    IF EXISTS (SELECT 1 FROM asiento LIMIT 1) THEN
        RETURN;
    END IF;

    -- Partida 1: Aportación inicial con Inventario Inicial ($20,000.00)
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) 
    VALUES (2026, 1, '2026-01-02', 'Aportación inicial de los socios en efectivo, banco e inventario inicial de mercadería.', 'APERTURA', 'APLICADO') 
    RETURNING id INTO v1;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v1, 1, '1101', 10000.00, 0.00),
    (v1, 2, '1102', 5000.00, 0.00),
    (v1, 3, '1104', 5000.00, 0.00),
    (v1, 4, '3101', 0.00, 20000.00);

    -- Partida 2: Compra de mercadería al contado según factura (Método Analítico)
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) 
    VALUES (2026, 2, '2026-01-05', 'Compra de mercadería al contado según factura (Método Analítico).', 'OPERACION', 'APLICADO') 
    RETURNING id INTO v2;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v2, 1, '4101', 4000.00, 0.00),
    (v2, 2, '1105', 520.00, 0.00),
    (v2, 3, '1102', 0.00, 4520.00);

    -- Partida 3: Gastos sobre compras por fletes y transporte (Método Analítico)
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) 
    VALUES (2026, 3, '2026-01-07', 'Pago de fletes y transporte de mercadería comprada (Método Analítico).', 'OPERACION', 'APLICADO') 
    RETURNING id INTO v3;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v3, 1, '4102', 300.00, 0.00),
    (v3, 2, '1105', 39.00, 0.00),
    (v3, 3, '1101', 0.00, 339.00);

    -- Partida 4: Devolución de mercadería sobre compras al proveedor (Método Analítico)
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) 
    VALUES (2026, 4, '2026-01-09', 'Devolución de mercadería dañada al proveedor (Método Analítico).', 'OPERACION', 'APLICADO') 
    RETURNING id INTO v4;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v4, 1, '1102', 452.00, 0.00),
    (v4, 2, '5102', 0.00, 400.00),
    (v4, 3, '1105', 0.00, 52.00);

    -- Partida 5: Venta de mercaderías al contado con IVA débito fiscal (Método Analítico)
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) 
    VALUES (2026, 5, '2026-01-12', 'Venta de mercaderías al contado con IVA débito fiscal (Método Analítico).', 'OPERACION', 'APLICADO') 
    RETURNING id INTO v5;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v5, 1, '1102', 9040.00, 0.00),
    (v5, 2, '5101', 0.00, 8000.00),
    (v5, 3, '2103', 0.00, 1040.00);

    -- Partida 6: Devolución de mercadería sobre ventas por cliente (Método Analítico)
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) 
    VALUES (2026, 6, '2026-01-15', 'Cliente devuelve mercadería por no cumplir especificaciones (Método Analítico).', 'OPERACION', 'APLICADO') 
    RETURNING id INTO v6;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v6, 1, '4103', 500.00, 0.00),
    (v6, 2, '2103', 65.00, 0.00),
    (v6, 3, '1102', 0.00, 565.00);

    -- Partida 7: Gastos de administración ($800.00)
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) 
    VALUES (2026, 7, '2026-01-20', 'Pago de gastos administrativos y servicios con cheque.', 'OPERACION', 'APLICADO') 
    RETURNING id INTO v7;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v7, 1, '4201', 800.00, 0.00),
    (v7, 2, '1102', 0.00, 800.00);

    -- Registrar en historial de auditoría
    INSERT INTO asiento_historial (asiento_id, accion, ejercicio, numero, concepto, total_debe, total_haber, motivo)
    SELECT id, 'CREACION', ejercicio, numero, concepto, 0.00, 0.00, 'Partida inicial configurada en Método Analítico'
    FROM asiento;
END $$;
