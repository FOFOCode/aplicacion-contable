-- =============================================================================
-- DATOS SEMILLA (data.sql)
-- Proyecto: Sistema Contable Automatizado
-- Inicialización con Catálogo de Cuentas oficial y Asientos de Ejemplo
-- =============================================================================

-- Constantes de UUID para reproducibilidad exacta
DO $$
DECLARE
    v_empresa_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
    v_periodo_id UUID := '00000000-0000-0000-0000-000000002026'::UUID;

    -- IDs de cuentas
    v_c_1101 UUID; v_c_1102 UUID; v_c_1103 UUID; v_c_1104 UUID; v_c_1105 UUID;
    v_c_1201 UUID; v_c_1202 UUID;
    v_c_2101 UUID; v_c_2102 UUID; v_c_2103 UUID; v_c_2104 UUID;
    v_c_3101 UUID; v_c_3102 UUID; v_c_3103 UUID;
    v_c_4101 UUID; v_c_4201 UUID; v_c_4202 UUID; v_c_4301 UUID;
    v_c_5101 UUID; v_c_5102 UUID; v_c_5201 UUID;

    -- IDs de asientos
    v_asiento1_id UUID; v_asiento2_id UUID; v_asiento3_id UUID;
    v_asiento4_id UUID; v_asiento5_id UUID;
BEGIN
    -- 1. Insertar Empresa
    INSERT INTO empresa (id, nombre, numero_registro, nit, moneda, simbolo_moneda, pais)
    VALUES (v_empresa_id, 'Comercializadora y Servicios del Sur, S.A. de C.V.', 'NRC-123456-7', '0614-010126-101-1', 'USD', '$', 'El Salvador')
    ON CONFLICT (id) DO NOTHING;

    -- 2. Insertar Período Fiscal 2026
    INSERT INTO periodo_contable (id, empresa_id, anio, numero_periodo, nombre, fecha_inicio, fecha_fin, estado)
    VALUES (v_periodo_id, v_empresa_id, 2026, 1, 'Ejercicio Fiscal 2026', '2026-01-01', '2026-12-31', 'ABIERTO')
    ON CONFLICT (id) DO NOTHING;

    -- 3. Catálogo de Cuentas (21 cuentas base de la aplicación)
    -- Activo (1)
    INSERT INTO catalogo_cuentas (empresa_id, codigo, nombre, tipo, naturaleza, activa) VALUES
    (v_empresa_id, '1101', 'Caja general', 'activo', 'deudora', TRUE),
    (v_empresa_id, '1102', 'Bancos', 'activo', 'deudora', TRUE),
    (v_empresa_id, '1103', 'Cuentas por cobrar', 'activo', 'deudora', TRUE),
    (v_empresa_id, '1104', 'Inventario de mercadería', 'activo', 'deudora', TRUE),
    (v_empresa_id, '1105', 'IVA crédito fiscal', 'activo', 'deudora', TRUE),
    (v_empresa_id, '1201', 'Mobiliario y equipo', 'activo', 'deudora', TRUE),
    (v_empresa_id, '1202', 'Equipo de transporte', 'activo', 'deudora', TRUE),
    -- Pasivo (2)
    (v_empresa_id, '2101', 'Cuentas por pagar', 'pasivo', 'acreedora', TRUE),
    (v_empresa_id, '2102', 'Préstamos bancarios por pagar', 'pasivo', 'acreedora', TRUE),
    (v_empresa_id, '2103', 'IVA débito fiscal', 'pasivo', 'acreedora', TRUE),
    (v_empresa_id, '2104', 'Impuestos por pagar', 'pasivo', 'acreedora', TRUE),
    -- Capital contable (3)
    (v_empresa_id, '3101', 'Capital social', 'capital', 'acreedora', TRUE),
    (v_empresa_id, '3102', 'Utilidades acumuladas', 'capital', 'acreedora', TRUE),
    (v_empresa_id, '3103', 'Reserva legal', 'capital', 'acreedora', TRUE),
    -- Costos y gastos (4)
    (v_empresa_id, '4101', 'Costo de venta', 'gasto', 'deudora', TRUE),
    (v_empresa_id, '4201', 'Gastos de administración', 'gasto', 'deudora', TRUE),
    (v_empresa_id, '4202', 'Gastos de venta', 'gasto', 'deudora', TRUE),
    (v_empresa_id, '4301', 'Gastos financieros', 'gasto', 'deudora', TRUE),
    -- Ingresos (5)
    (v_empresa_id, '5101', 'Ventas', 'ingreso', 'acreedora', TRUE),
    (v_empresa_id, '5102', 'Otros ingresos operativos', 'ingreso', 'acreedora', TRUE),
    (v_empresa_id, '5201', 'Productos financieros', 'ingreso', 'acreedora', TRUE)
    ON CONFLICT (empresa_id, codigo) DO NOTHING;

    -- Obtener referencias a los IDs de las cuentas
    SELECT id INTO v_c_1101 FROM catalogo_cuentas WHERE empresa_id = v_empresa_id AND codigo = '1101';
    SELECT id INTO v_c_1102 FROM catalogo_cuentas WHERE empresa_id = v_empresa_id AND codigo = '1102';
    SELECT id INTO v_c_1104 FROM catalogo_cuentas WHERE empresa_id = v_empresa_id AND codigo = '1104';
    SELECT id INTO v_c_1105 FROM catalogo_cuentas WHERE empresa_id = v_empresa_id AND codigo = '1105';
    SELECT id INTO v_c_2103 FROM catalogo_cuentas WHERE empresa_id = v_empresa_id AND codigo = '2103';
    SELECT id INTO v_c_3101 FROM catalogo_cuentas WHERE empresa_id = v_empresa_id AND codigo = '3101';
    SELECT id INTO v_c_4101 FROM catalogo_cuentas WHERE empresa_id = v_empresa_id AND codigo = '4101';
    SELECT id INTO v_c_4201 FROM catalogo_cuentas WHERE empresa_id = v_empresa_id AND codigo = '4201';
    SELECT id INTO v_c_5101 FROM catalogo_cuentas WHERE empresa_id = v_empresa_id AND codigo = '5101';

    -- 4. Insertar Asientos de Ejemplo (Libro Diario)
    -- Partida 1: Aportación inicial
    INSERT INTO asiento_contable (empresa_id, periodo_id, numero, fecha, concepto, tipo, estado)
    VALUES (v_empresa_id, v_periodo_id, 1, '2026-01-02', 'Aportación inicial de los socios en efectivo y banco.', 'APERTURA', 'APLICADO')
    RETURNING id INTO v_asiento1_id;

    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_id, debe, haber, referencia) VALUES
    (v_asiento1_id, 1, v_c_1101, 10000.00, 0.00, 'Aporte en efectivo'),
    (v_asiento1_id, 2, v_c_1102, 5000.00, 0.00, 'Aporte depósito bancario'),
    (v_asiento1_id, 3, v_c_3101, 0.00, 15000.00, 'Suscripción y pago de capital');

    -- Partida 2: Compra de mercadería con IVA crédito fiscal
    INSERT INTO asiento_contable (empresa_id, periodo_id, numero, fecha, concepto, tipo, estado)
    VALUES (v_empresa_id, v_periodo_id, 2, '2026-01-05', 'Compra de mercadería al crédito fiscal, pagada con banco.', 'OPERACION', 'APLICADO')
    RETURNING id INTO v_asiento2_id;

    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_id, debe, haber, referencia) VALUES
    (v_asiento2_id, 1, v_c_1104, 4000.00, 0.00, 'Mercadería para reventa'),
    (v_asiento2_id, 2, v_c_1105, 520.00, 0.00, 'IVA 13% crédito fiscal'),
    (v_asiento2_id, 3, v_c_1102, 0.00, 4520.00, 'Pago con transferencia bancaria');

    -- Partida 3: Venta de mercadería con IVA débito fiscal
    INSERT INTO asiento_contable (empresa_id, periodo_id, numero, fecha, concepto, tipo, estado)
    VALUES (v_empresa_id, v_periodo_id, 3, '2026-01-12', 'Venta de mercadería con IVA débito fiscal, cobrada en banco.', 'OPERACION', 'APLICADO')
    RETURNING id INTO v_asiento3_id;

    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_id, debe, haber, referencia) VALUES
    (v_asiento3_id, 1, v_c_1102, 6780.00, 0.00, 'Cobro total depositado en banco'),
    (v_asiento3_id, 2, v_c_5101, 0.00, 6000.00, 'Ingreso por venta de mercadería'),
    (v_asiento3_id, 3, v_c_2103, 0.00, 780.00, 'IVA 13% débito fiscal');

    -- Partida 4: Registro del costo de la mercadería vendida
    INSERT INTO asiento_contable (empresa_id, periodo_id, numero, fecha, concepto, tipo, estado)
    VALUES (v_empresa_id, v_periodo_id, 4, '2026-01-12', 'Registro del costo de la mercadería vendida.', 'OPERACION', 'APLICADO')
    RETURNING id INTO v_asiento4_id;

    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_id, debe, haber, referencia) VALUES
    (v_asiento4_id, 1, v_c_4101, 3000.00, 0.00, 'Costo de ventas devengado'),
    (v_asiento4_id, 2, v_c_1104, 0.00, 3000.00, 'Salida de inventario');

    -- Partida 5: Pago de gastos de administración
    INSERT INTO asiento_contable (empresa_id, periodo_id, numero, fecha, concepto, tipo, estado)
    VALUES (v_empresa_id, v_periodo_id, 5, '2026-01-20', 'Pago de gastos de administración con banco.', 'OPERACION', 'APLICADO')
    RETURNING id INTO v_asiento5_id;

    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_id, debe, haber, referencia) VALUES
    (v_asiento5_id, 1, v_c_4201, 800.00, 0.00, 'Servicios administrativos y suministros'),
    (v_asiento5_id, 2, v_c_1102, 0.00, 800.00, 'Cheque / transferencia bancaria');

END $$;
