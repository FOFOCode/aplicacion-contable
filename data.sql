-- =============================================================================
-- DATOS SEMILLA (data.sql) - SISTEMA CONTABLE AUTOMATIZADO
-- Inicialización del Catálogo Completo, Ejercicio 2026, Toma Física y 7 Partidas
-- =============================================================================

-- 1. Catálogo Completo de Cuentas (Método Analítico & Clasificación Estricta)
INSERT INTO catalogo_cuentas (codigo, nombre, tipo, naturaleza, permite_movimiento, activa) VALUES
-- 1. Activo
('1101', 'Caja general', 'activo', 'deudora', TRUE, TRUE),
('1102', 'Bancos', 'activo', 'deudora', TRUE, TRUE),
('1103', 'Cuentas por cobrar', 'activo', 'deudora', TRUE, TRUE),
('1104', 'Inventario de mercadería (Inicial)', 'activo', 'deudora', TRUE, TRUE),
('1105', 'IVA crédito fiscal', 'activo', 'deudora', TRUE, TRUE),
('1106', 'Deudores diversos', 'activo', 'deudora', TRUE, TRUE),
('1107', 'Papelería y útiles', 'activo', 'deudora', TRUE, TRUE),
('1108', 'Pagos anticipados', 'activo', 'deudora', TRUE, TRUE),
('1201', 'Mobiliario y equipo', 'activo', 'deudora', TRUE, TRUE),
('1202', 'Equipo de transporte', 'activo', 'deudora', TRUE, TRUE),
('1203', 'Equipo de cómputo', 'activo', 'deudora', TRUE, TRUE),
('1204', 'Edificios', 'activo', 'deudora', TRUE, TRUE),
('1205', 'Terrenos', 'activo', 'deudora', TRUE, TRUE),
('1206', 'Depreciación acumulada', 'activo', 'acreedora', TRUE, TRUE),

-- 2. Pasivo
('2101', 'Cuentas por pagar', 'pasivo', 'acreedora', TRUE, TRUE),
('2102', 'Préstamos bancarios por pagar', 'pasivo', 'acreedora', TRUE, TRUE),
('2103', 'IVA débito fiscal', 'pasivo', 'acreedora', TRUE, TRUE),
('2104', 'Impuestos por pagar', 'pasivo', 'acreedora', TRUE, TRUE),
('2105', 'Acreedores diversos', 'pasivo', 'acreedora', TRUE, TRUE),
('2106', 'Sueldos y salarios por pagar', 'pasivo', 'acreedora', TRUE, TRUE),
('2107', 'Retenciones por pagar', 'pasivo', 'acreedora', TRUE, TRUE),
('2201', 'Préstamos bancarios a largo plazo', 'pasivo', 'acreedora', TRUE, TRUE),
('2202', 'Hipotecas por pagar', 'pasivo', 'acreedora', TRUE, TRUE),

-- 3. Capital Contable
('3101', 'Capital social', 'capital', 'acreedora', TRUE, TRUE),
('3102', 'Utilidades acumuladas', 'capital', 'acreedora', TRUE, TRUE),
('3103', 'Reserva legal', 'capital', 'acreedora', TRUE, TRUE),
('3104', 'Pérdidas acumuladas', 'capital', 'deudora', TRUE, TRUE),
('3105', 'Donaciones', 'capital', 'acreedora', TRUE, TRUE),

-- 4. Costos y Gastos (Método Analítico)
('4101', 'Compras', 'gasto', 'deudora', TRUE, TRUE),
('4102', 'Gastos sobre compras', 'gasto', 'deudora', TRUE, TRUE),
('4103', 'Devoluciones sobre ventas', 'gasto', 'deudora', TRUE, TRUE),
('4104', 'Rebajas y descuentos sobre ventas', 'gasto', 'deudora', TRUE, TRUE),
('4105', 'Costo de servicios', 'gasto', 'deudora', TRUE, TRUE),
('4201', 'Gastos de administración', 'gasto', 'deudora', TRUE, TRUE),
('4202', 'Gastos de venta', 'gasto', 'deudora', TRUE, TRUE),
('4203', 'Gastos de depreciación', 'gasto', 'deudora', TRUE, TRUE),
('4204', 'Gastos de alquiler', 'gasto', 'deudora', TRUE, TRUE),
('4205', 'Gastos de servicios básicos', 'gasto', 'deudora', TRUE, TRUE),
('4206', 'Gastos de sueldos y salarios', 'gasto', 'deudora', TRUE, TRUE),
('4207', 'Gastos de papelería y útiles', 'gasto', 'deudora', TRUE, TRUE),
('4208', 'Gastos de publicidad', 'gasto', 'deudora', TRUE, TRUE),
('4301', 'Gastos financieros', 'gasto', 'deudora', TRUE, TRUE),
('4302', 'Intereses pagados', 'gasto', 'deudora', TRUE, TRUE),
('4303', 'Comisiones bancarias', 'gasto', 'deudora', TRUE, TRUE),

-- Cuentas analíticas complementarias de compras (clasificadas como GASTO ACREEDOR)
('5102', 'Devoluciones sobre compras', 'gasto', 'acreedora', TRUE, TRUE),
('5103', 'Rebajas y descuentos sobre compras', 'gasto', 'acreedora', TRUE, TRUE),

-- 5. Ingresos
('5101', 'Ventas', 'ingreso', 'acreedora', TRUE, TRUE),
('5104', 'Otros ingresos operativos', 'ingreso', 'acreedora', TRUE, TRUE),
('5105', 'Ingresos por servicios', 'ingreso', 'acreedora', TRUE, TRUE),
('5201', 'Productos financieros', 'ingreso', 'acreedora', TRUE, TRUE),
('5202', 'Intereses cobrados', 'ingreso', 'acreedora', TRUE, TRUE),
('5203', 'Utilidad en venta de activos', 'ingreso', 'acreedora', TRUE, TRUE)
ON CONFLICT (codigo) DO UPDATE 
SET nombre = EXCLUDED.nombre,
    tipo = EXCLUDED.tipo,
    naturaleza = EXCLUDED.naturaleza,
    permite_movimiento = EXCLUDED.permite_movimiento,
    activa = EXCLUDED.activa;

INSERT INTO catalogo_cuentas (codigo, nombre, tipo, naturaleza, permite_movimiento, activa) VALUES
('1100', 'Efectivo y equivalentes', 'activo', 'deudora', FALSE, TRUE),
('1200', 'Propiedad, planta y equipo', 'activo', 'deudora', FALSE, TRUE),
('2100', 'Pasivo corriente', 'pasivo', 'acreedora', FALSE, TRUE),
('2200', 'Pasivo no corriente', 'pasivo', 'acreedora', FALSE, TRUE),
('3100', 'Capital contable', 'capital', 'acreedora', FALSE, TRUE),
('4100', 'Costos y gastos analíticos', 'gasto', 'deudora', FALSE, TRUE),
('4200', 'Gastos de operación', 'gasto', 'deudora', FALSE, TRUE),
('4300', 'Gastos financieros', 'gasto', 'deudora', FALSE, TRUE),
('5100', 'Ingresos de operación', 'ingreso', 'acreedora', FALSE, TRUE),
('5200', 'Ingresos financieros', 'ingreso', 'acreedora', FALSE, TRUE)
ON CONFLICT (codigo) DO UPDATE SET permite_movimiento = FALSE, activa = TRUE;

UPDATE catalogo_cuentas
SET padre_codigo = CASE
    WHEN codigo IN ('1101', '1102') THEN '1100'
    WHEN codigo LIKE '12%' THEN '1200'
    WHEN codigo LIKE '21%' THEN '2100'
    WHEN codigo LIKE '22%' THEN '2200'
    WHEN codigo LIKE '31%' THEN '3100'
    WHEN codigo LIKE '41%' THEN '4100'
    WHEN codigo LIKE '42%' THEN '4200'
    WHEN codigo LIKE '43%' THEN '4300'
    WHEN codigo LIKE '51%' THEN '5100'
    WHEN codigo LIKE '52%' THEN '5200'
    ELSE padre_codigo
END
WHERE codigo NOT IN ('1100', '1200', '2100', '2200', '3100', '4100', '4200', '4300', '5100', '5200');

-- 2. Ejercicio Fiscal 2026
INSERT INTO ejercicio_fiscal (ejercicio, fecha_inicio, fecha_fin, ultimo_numero, estado)
VALUES (2026, '2026-01-01', '2026-12-31', 7, 'ABIERTO')
ON CONFLICT (ejercicio) DO UPDATE SET ultimo_numero = GREATEST(ejercicio_fiscal.ultimo_numero, 7);

-- 3. Toma Física de Inventario Final 2026 ($6,500.00)
INSERT INTO inventario_toma_fisica (ejercicio, fecha_toma, valor_inventario_final, responsable, observaciones)
VALUES (
    2026,
    '2026-12-31',
    6500.00,
    'Comité de Auditoría y Control de Inventarios',
    'Toma física de existencias y conteo al cierre del ejercicio 2026 (Método Analítico)'
) ON CONFLICT (ejercicio) DO UPDATE
SET valor_inventario_final = EXCLUDED.valor_inventario_final,
    responsable = EXCLUDED.responsable;

-- 4. Partidas Iniciales de Ejemplo (Método Analítico)
DO $$
DECLARE
    v1 UUID; v2 UUID; v3 UUID; v4 UUID; v5 UUID; v6 UUID; v7 UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM asiento WHERE ejercicio = 2026) THEN
        RETURN;
    END IF;

    -- Partida 1: Apertura con Inventario Inicial ($5,000.00)
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) 
    VALUES (2026, 1, '2026-01-02', 'Aportación inicial de los socios en efectivo, banco e inventario inicial de mercaderías.', 'APERTURA', 'APLICADO') 
    RETURNING id INTO v1;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v1, 1, '1101', 10000.00, 0.00),
    (v1, 2, '1102', 5000.00, 0.00),
    (v1, 3, '1104', 5000.00, 0.00),
    (v1, 4, '3101', 0.00, 20000.00);

    -- Partida 2: Compra de mercadería al contado según factura (Método Analítico: Compras)
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) 
    VALUES (2026, 2, '2026-01-05', 'Compra de mercadería al contado según factura de proveedor (Método Analítico).', 'OPERACION', 'APLICADO') 
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
    VALUES (2026, 4, '2026-01-09', 'Devolución de mercadería dañada al proveedor según nota de crédito bancaria (Método Analítico).', 'OPERACION', 'APLICADO') 
    RETURNING id INTO v4;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v4, 1, '1102', 452.00, 0.00),
    (v4, 2, '5102', 0.00, 400.00),
    (v4, 3, '1105', 0.00, 52.00);

    -- Partida 5: Venta de mercaderías con IVA débito fiscal (Método Analítico)
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) 
    VALUES (2026, 5, '2026-01-12', 'Venta de mercaderías al contado con IVA débito fiscal (Método Analítico).', 'OPERACION', 'APLICADO') 
    RETURNING id INTO v5;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v5, 1, '1102', 9040.00, 0.00),
    (v5, 2, '5101', 0.00, 8000.00),
    (v5, 3, '2103', 0.00, 1040.00);

    -- Partida 6: Devolución de mercadería sobre ventas por cliente (Método Analítico)
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) 
    VALUES (2026, 6, '2026-01-15', 'Cliente devuelve mercadería por no cumplir especificaciones técnicas (Método Analítico).', 'OPERACION', 'APLICADO') 
    RETURNING id INTO v6;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v6, 1, '4103', 500.00, 0.00),
    (v6, 2, '2103', 65.00, 0.00),
    (v6, 3, '1102', 0.00, 565.00);

    -- Partida 7: Gastos de administración ($800.00)
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) 
    VALUES (2026, 7, '2026-01-20', 'Pago de servicios contables y gastos administrativos con cheque bancario.', 'OPERACION', 'APLICADO') 
    RETURNING id INTO v7;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v7, 1, '4201', 800.00, 0.00),
    (v7, 2, '1102', 0.00, 800.00);

    -- Trazabilidad en asiento_historial
    INSERT INTO asiento_historial (asiento_id, accion, ejercicio, numero, concepto, total_debe, total_haber, motivo)
    SELECT a.id, 'CREACION', a.ejercicio, a.numero, a.concepto, SUM(al.debe), SUM(al.haber), 'Partida inicial cargada bajo el Método Analítico'
    FROM asiento a
    JOIN asiento_linea al ON a.id = al.asiento_id
    WHERE a.ejercicio = 2026
    GROUP BY a.id, a.ejercicio, a.numero, a.concepto;
END $$;
