-- =============================================================================
-- MIGRACIÓN 004: ADOPCIÓN TOTAL DEL MÉTODO ANALÍTICO O PORMENORIZADO
-- =============================================================================
-- En el Método Analítico:
-- 1. Las adquisiciones se registran en 'Compras' y 'Gastos sobre compras' (NO en Inventario continuo).
-- 2. Las salidas por venta no registran costo de venta en cada transacción (se registran en 'Ventas').
-- 3. Se usan cuentas analíticas: Devoluciones s/ventas, Rebajas s/ventas, Devoluciones s/compras, Rebajas s/compras.
-- 4. El Costo de Ventas y la Utilidad Bruta se determinan por fórmula analítica con el Inventario Final.

-- 1. ACTUALIZAR Y AGREGAR CUENTAS DEL MÉTODO ANALÍTICO EN EL CATÁLOGO
-- Costos y Gastos (Grupo 41 - Cuentas de Compras y Disminuciones de Ventas)
UPDATE catalogo_cuentas SET nombre = 'Compras' WHERE codigo = '4101';
UPDATE catalogo_cuentas SET nombre = 'Gastos sobre compras' WHERE codigo = '4102';

INSERT INTO catalogo_cuentas (codigo, nombre, tipo, naturaleza, activa) VALUES
('4103', 'Devoluciones sobre ventas', 'gasto', 'deudora', TRUE),
('4104', 'Rebajas y descuentos sobre ventas', 'gasto', 'deudora', TRUE),
('4105', 'Costo de servicios', 'gasto', 'deudora', TRUE)
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, activa = TRUE;

-- Ingresos (Grupo 51 - Ventas y Disminuciones de Compras)
UPDATE catalogo_cuentas SET nombre = 'Ventas' WHERE codigo = '5101';
UPDATE catalogo_cuentas SET nombre = 'Devoluciones sobre compras' WHERE codigo = '5102';

INSERT INTO catalogo_cuentas (codigo, nombre, tipo, naturaleza, activa) VALUES
('5103', 'Rebajas y descuentos sobre compras', 'ingreso', 'acreedora', TRUE),
('5104', 'Otros ingresos operativos', 'ingreso', 'acreedora', TRUE),
('5105', 'Ingresos por servicios', 'ingreso', 'acreedora', TRUE)
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, activa = TRUE;

-- 2. ACTUALIZAR LAS PARTIDAS DE EJEMPLO AL MÉTODO ANALÍTICO
DO $$
DECLARE
    v_a1 UUID; v_a2 UUID; v_a3 UUID; v_a4 UUID; v_a5 UUID; v_a6 UUID;
BEGIN
    -- Limpiar líneas y asientos anteriores para reestructurar al método analítico
    DELETE FROM asiento_historial;
    DELETE FROM cierre_contable;
    DELETE FROM asiento_linea;
    DELETE FROM asiento;

    -- Partida 1: Aportación inicial de los socios con Inventario Inicial ($20,000.00)
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) 
    VALUES (2026, 1, '2026-01-02', 'Aportación inicial de los socios en efectivo, banco e inventario inicial de mercadería.', 'APERTURA', 'APLICADO') 
    RETURNING id INTO v_a1;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v_a1, 1, '1101', 10000.00, 0.00),
    (v_a1, 2, '1102', 5000.00, 0.00),
    (v_a1, 3, '1104', 5000.00, 0.00), -- Inventario inicial
    (v_a1, 4, '3101', 0.00, 20000.00);

    -- Partida 2: Compra de mercadería al contado según factura (Método Analítico: cargo a Compras)
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) 
    VALUES (2026, 2, '2026-01-05', 'Compra de mercadería al contado según factura (Método Analítico).', 'OPERACION', 'APLICADO') 
    RETURNING id INTO v_a2;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v_a2, 1, '4101', 4000.00, 0.00), -- Compras
    (v_a2, 2, '1105', 520.00, 0.00),
    (v_a2, 3, '1102', 0.00, 4520.00);

    -- Partida 3: Gastos sobre compras por flete y acarreo (Método Analítico)
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) 
    VALUES (2026, 3, '2026-01-07', 'Pago de fletes y transporte de mercadería comprada (Método Analítico).', 'OPERACION', 'APLICADO') 
    RETURNING id INTO v_a3;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v_a3, 1, '4102', 300.00, 0.00), -- Gastos sobre compras
    (v_a3, 2, '1105', 39.00, 0.00),
    (v_a3, 3, '1101', 0.00, 339.00);

    -- Partida 4: Devolución de mercadería sobre compras al proveedor (Método Analítico)
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) 
    VALUES (2026, 4, '2026-01-09', 'Devolución de mercadería dañada al proveedor (Método Analítico).', 'OPERACION', 'APLICADO') 
    RETURNING id INTO v_a4;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v_a4, 1, '1102', 452.00, 0.00),
    (v_a4, 2, '5102', 0.00, 400.00), -- Devoluciones sobre compras
    (v_a4, 3, '1105', 0.00, 52.00);

    -- Partida 5: Venta de mercaderías al contado (Método Analítico: abono a Ventas sin costo de venta continuo)
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) 
    VALUES (2026, 5, '2026-01-12', 'Venta de mercaderías al contado con IVA débito fiscal (Método Analítico).', 'OPERACION', 'APLICADO') 
    RETURNING id INTO v_a5;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v_a5, 1, '1102', 9040.00, 0.00),
    (v_a5, 2, '5101', 0.00, 8000.00), -- Ventas
    (v_a5, 3, '2103', 0.00, 1040.00);

    -- Partida 6: Devolución de mercadería sobre ventas por cliente (Método Analítico)
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) 
    VALUES (2026, 6, '2026-01-15', 'Cliente devuelve mercadería por no cumplir especificaciones (Método Analítico).', 'OPERACION', 'APLICADO') 
    RETURNING id INTO v_a6;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v_a6, 1, '4103', 500.00, 0.00), -- Devoluciones sobre ventas
    (v_a6, 2, '2103', 65.00, 0.00),
    (v_a6, 3, '1102', 0.00, 565.00);

    -- Partida 7: Gastos de administración
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado) 
    VALUES (2026, 7, '2026-01-20', 'Pago de gastos administrativos y servicios con cheque.', 'OPERACION', 'APLICADO') 
    RETURNING id INTO v_a1;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v_a1, 1, '4201', 800.00, 0.00),
    (v_a1, 2, '1102', 0.00, 800.00);

    -- Registrar las partidas iniciales en el historial de auditoría
    INSERT INTO asiento_historial (asiento_id, accion, ejercicio, numero, concepto, total_debe, total_haber, motivo)
    SELECT id, 'CREACION', ejercicio, numero, concepto, 0.00, 0.00, 'Partida inicial configurada en Método Analítico'
    FROM asiento;
END $$;
