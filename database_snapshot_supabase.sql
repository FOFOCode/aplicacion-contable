-- =============================================================================
-- SNAPSHOT EN VIVO DE BASE DE DATOS SUPABASE (qtrvlpdedbcmurgovsbn)
-- Fecha: 2026-09-23T06:31:33.273Z
-- Metodo Contable: Analitico o Pormenorizado con Ejercicios, Toma Fisica y Auditoria
-- =============================================================================

-- 1. EJERCICIOS FISCALES
INSERT INTO ejercicio_fiscal (ejercicio, fecha_inicio, fecha_fin, ultimo_numero, estado) VALUES (2026, '2026-01-01', '2026-12-31', 7, 'ABIERTO') ON CONFLICT (ejercicio) DO UPDATE SET ultimo_numero = EXCLUDED.ultimo_numero, estado = EXCLUDED.estado;

-- 2. CATALOGO DE CUENTAS (52 cuentas registradas)
INSERT INTO catalogo_cuentas (codigo, nombre, tipo, naturaleza, permite_movimiento, activa) VALUES
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
  ('2101', 'Cuentas por pagar', 'pasivo', 'acreedora', TRUE, TRUE),
  ('2102', 'Préstamos bancarios por pagar', 'pasivo', 'acreedora', TRUE, TRUE),
  ('2103', 'IVA débito fiscal', 'pasivo', 'acreedora', TRUE, TRUE),
  ('2104', 'Impuestos por pagar', 'pasivo', 'acreedora', TRUE, TRUE),
  ('2105', 'Acreedores diversos', 'pasivo', 'acreedora', TRUE, TRUE),
  ('2106', 'Sueldos y salarios por pagar', 'pasivo', 'acreedora', TRUE, TRUE),
  ('2107', 'Retenciones por pagar', 'pasivo', 'acreedora', TRUE, TRUE),
  ('2201', 'Préstamos bancarios a largo plazo', 'pasivo', 'acreedora', TRUE, TRUE),
  ('2202', 'Hipotecas por pagar', 'pasivo', 'acreedora', TRUE, TRUE),
  ('3101', 'Capital social', 'capital', 'acreedora', TRUE, TRUE),
  ('3102', 'Utilidades acumuladas', 'capital', 'acreedora', TRUE, TRUE),
  ('3103', 'Reserva legal', 'capital', 'acreedora', TRUE, TRUE),
  ('3104', 'Pérdidas acumuladas', 'capital', 'deudora', TRUE, TRUE),
  ('3105', 'Donaciones', 'capital', 'acreedora', TRUE, TRUE),
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
  ('5101', 'Ventas', 'ingreso', 'acreedora', TRUE, TRUE),
  ('5102', 'Devoluciones sobre compras', 'gasto', 'acreedora', TRUE, TRUE),
  ('5103', 'Rebajas y descuentos sobre compras', 'gasto', 'acreedora', TRUE, TRUE),
  ('5104', 'Otros ingresos operativos', 'ingreso', 'acreedora', TRUE, TRUE),
  ('5105', 'Ingresos por servicios', 'ingreso', 'acreedora', TRUE, TRUE),
  ('5201', 'Productos financieros', 'ingreso', 'acreedora', TRUE, TRUE),
  ('5202', 'Intereses cobrados', 'ingreso', 'acreedora', TRUE, TRUE),
  ('5203', 'Utilidad en venta de activos', 'ingreso', 'acreedora', TRUE, TRUE)
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo, naturaleza = EXCLUDED.naturaleza, permite_movimiento = EXCLUDED.permite_movimiento, activa = EXCLUDED.activa;

-- 3. ASIENTOS / PARTIDAS CONTABLES (7 asientos registrados)
-- Partida 1 (Ejercicio 2026, Correlativo Global: 1, Tipo: APERTURA, Estado: APLICADO)
INSERT INTO asiento (id, correlativo_global, ejercicio, numero, fecha, concepto, tipo, estado) VALUES ('a941d4cb-7f7a-4ce0-b553-68a90f05a87b', 1, 2026, 1, '2026-01-02', 'Aportación inicial de los socios en efectivo, banco e inventario inicial de mercaderías.', 'APERTURA', 'APLICADO') ON CONFLICT (id) DO NOTHING;
INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
  ('a941d4cb-7f7a-4ce0-b553-68a90f05a87b', 1, '1101', 10000.00, 0.00),
  ('a941d4cb-7f7a-4ce0-b553-68a90f05a87b', 2, '1102', 5000.00, 0.00),
  ('a941d4cb-7f7a-4ce0-b553-68a90f05a87b', 3, '1104', 5000.00, 0.00),
  ('a941d4cb-7f7a-4ce0-b553-68a90f05a87b', 4, '3101', 0.00, 20000.00)
ON CONFLICT (asiento_id, linea_numero) DO NOTHING;

-- Partida 2 (Ejercicio 2026, Correlativo Global: 2, Tipo: OPERACION, Estado: APLICADO)
INSERT INTO asiento (id, correlativo_global, ejercicio, numero, fecha, concepto, tipo, estado) VALUES ('087f0c3e-5842-490a-8521-9a0c9bc05c4b', 2, 2026, 2, '2026-01-05', 'Compra de mercadería al contado según factura de proveedor (Método Analítico).', 'OPERACION', 'APLICADO') ON CONFLICT (id) DO NOTHING;
INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
  ('087f0c3e-5842-490a-8521-9a0c9bc05c4b', 1, '4101', 4000.00, 0.00),
  ('087f0c3e-5842-490a-8521-9a0c9bc05c4b', 2, '1105', 520.00, 0.00),
  ('087f0c3e-5842-490a-8521-9a0c9bc05c4b', 3, '1102', 0.00, 4520.00)
ON CONFLICT (asiento_id, linea_numero) DO NOTHING;

-- Partida 3 (Ejercicio 2026, Correlativo Global: 3, Tipo: OPERACION, Estado: APLICADO)
INSERT INTO asiento (id, correlativo_global, ejercicio, numero, fecha, concepto, tipo, estado) VALUES ('ee159146-c0a8-4ad6-a50b-386284b8dabe', 3, 2026, 3, '2026-01-07', 'Pago de fletes y transporte de mercadería comprada (Método Analítico).', 'OPERACION', 'APLICADO') ON CONFLICT (id) DO NOTHING;
INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
  ('ee159146-c0a8-4ad6-a50b-386284b8dabe', 1, '4102', 300.00, 0.00),
  ('ee159146-c0a8-4ad6-a50b-386284b8dabe', 2, '1105', 39.00, 0.00),
  ('ee159146-c0a8-4ad6-a50b-386284b8dabe', 3, '1101', 0.00, 339.00)
ON CONFLICT (asiento_id, linea_numero) DO NOTHING;

-- Partida 4 (Ejercicio 2026, Correlativo Global: 4, Tipo: OPERACION, Estado: APLICADO)
INSERT INTO asiento (id, correlativo_global, ejercicio, numero, fecha, concepto, tipo, estado) VALUES ('748a03cc-a733-435f-8010-10e693eef1b0', 4, 2026, 4, '2026-01-09', 'Devolución de mercadería dañada al proveedor según nota de crédito bancaria (Método Analítico).', 'OPERACION', 'APLICADO') ON CONFLICT (id) DO NOTHING;
INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
  ('748a03cc-a733-435f-8010-10e693eef1b0', 1, '1102', 452.00, 0.00),
  ('748a03cc-a733-435f-8010-10e693eef1b0', 2, '5102', 0.00, 400.00),
  ('748a03cc-a733-435f-8010-10e693eef1b0', 3, '1105', 0.00, 52.00)
ON CONFLICT (asiento_id, linea_numero) DO NOTHING;

-- Partida 5 (Ejercicio 2026, Correlativo Global: 5, Tipo: OPERACION, Estado: APLICADO)
INSERT INTO asiento (id, correlativo_global, ejercicio, numero, fecha, concepto, tipo, estado) VALUES ('f615a46c-aed9-4c08-89c0-2f133f7ecd40', 5, 2026, 5, '2026-01-12', 'Venta de mercaderías al contado con IVA débito fiscal (Método Analítico).', 'OPERACION', 'APLICADO') ON CONFLICT (id) DO NOTHING;
INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
  ('f615a46c-aed9-4c08-89c0-2f133f7ecd40', 1, '1102', 9040.00, 0.00),
  ('f615a46c-aed9-4c08-89c0-2f133f7ecd40', 2, '5101', 0.00, 8000.00),
  ('f615a46c-aed9-4c08-89c0-2f133f7ecd40', 3, '2103', 0.00, 1040.00)
ON CONFLICT (asiento_id, linea_numero) DO NOTHING;

-- Partida 6 (Ejercicio 2026, Correlativo Global: 6, Tipo: OPERACION, Estado: APLICADO)
INSERT INTO asiento (id, correlativo_global, ejercicio, numero, fecha, concepto, tipo, estado) VALUES ('487fa400-022a-4edb-b5de-0916a1e6d9eb', 6, 2026, 6, '2026-01-15', 'Cliente devuelve mercadería por no cumplir especificaciones técnicas (Método Analítico).', 'OPERACION', 'APLICADO') ON CONFLICT (id) DO NOTHING;
INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
  ('487fa400-022a-4edb-b5de-0916a1e6d9eb', 1, '4103', 500.00, 0.00),
  ('487fa400-022a-4edb-b5de-0916a1e6d9eb', 2, '2103', 65.00, 0.00),
  ('487fa400-022a-4edb-b5de-0916a1e6d9eb', 3, '1102', 0.00, 565.00)
ON CONFLICT (asiento_id, linea_numero) DO NOTHING;

-- Partida 7 (Ejercicio 2026, Correlativo Global: 7, Tipo: OPERACION, Estado: APLICADO)
INSERT INTO asiento (id, correlativo_global, ejercicio, numero, fecha, concepto, tipo, estado) VALUES ('3d068a71-93d2-49fc-99c6-3048b8ece8a9', 7, 2026, 7, '2026-01-20', 'Pago de servicios contables y gastos administrativos con cheque.', 'OPERACION', 'APLICADO') ON CONFLICT (id) DO NOTHING;
INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
  ('3d068a71-93d2-49fc-99c6-3048b8ece8a9', 1, '4201', 800.00, 0.00),
  ('3d068a71-93d2-49fc-99c6-3048b8ece8a9', 2, '1102', 0.00, 800.00)
ON CONFLICT (asiento_id, linea_numero) DO NOTHING;

-- 4. TOMA FISICA DE INVENTARIOS (1 registros)
INSERT INTO inventario_toma_fisica (ejercicio, fecha_toma, valor_inventario_final, responsable, observaciones) VALUES (2026, '2026-12-31', 6500.00, 'Comité de Auditoría y Control de Inventarios', 'Toma física de existencias y conteo al cierre del ejercicio 2026 (Método Analítico)') ON CONFLICT (ejercicio) DO UPDATE SET valor_inventario_final = EXCLUDED.valor_inventario_final;

-- 5. HISTORIAL DE AUDITORIA (7 registros)
INSERT INTO asiento_historial (asiento_id, accion, ejercicio, numero, concepto, total_debe, total_haber, motivo, usuario_email, creado_en) VALUES ('087f0c3e-5842-490a-8521-9a0c9bc05c4b', 'CREACION', 2026, 2, 'Compra de mercadería al contado según factura de proveedor (Método Analítico).', 4520.00, 4520.00, 'Partida inicial cargada bajo el Método Analítico', 'admin@contable.sv', '2026-09-23T06:17:01.040Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO asiento_historial (asiento_id, accion, ejercicio, numero, concepto, total_debe, total_haber, motivo, usuario_email, creado_en) VALUES ('3d068a71-93d2-49fc-99c6-3048b8ece8a9', 'CREACION', 2026, 7, 'Pago de servicios contables y gastos administrativos con cheque.', 800.00, 800.00, 'Partida inicial cargada bajo el Método Analítico', 'admin@contable.sv', '2026-09-23T06:17:01.040Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO asiento_historial (asiento_id, accion, ejercicio, numero, concepto, total_debe, total_haber, motivo, usuario_email, creado_en) VALUES ('487fa400-022a-4edb-b5de-0916a1e6d9eb', 'CREACION', 2026, 6, 'Cliente devuelve mercadería por no cumplir especificaciones técnicas (Método Analítico).', 565.00, 565.00, 'Partida inicial cargada bajo el Método Analítico', 'admin@contable.sv', '2026-09-23T06:17:01.040Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO asiento_historial (asiento_id, accion, ejercicio, numero, concepto, total_debe, total_haber, motivo, usuario_email, creado_en) VALUES ('748a03cc-a733-435f-8010-10e693eef1b0', 'CREACION', 2026, 4, 'Devolución de mercadería dañada al proveedor según nota de crédito bancaria (Método Analítico).', 452.00, 452.00, 'Partida inicial cargada bajo el Método Analítico', 'admin@contable.sv', '2026-09-23T06:17:01.040Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO asiento_historial (asiento_id, accion, ejercicio, numero, concepto, total_debe, total_haber, motivo, usuario_email, creado_en) VALUES ('a941d4cb-7f7a-4ce0-b553-68a90f05a87b', 'CREACION', 2026, 1, 'Aportación inicial de los socios en efectivo, banco e inventario inicial de mercaderías.', 20000.00, 20000.00, 'Partida inicial cargada bajo el Método Analítico', 'admin@contable.sv', '2026-09-23T06:17:01.040Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO asiento_historial (asiento_id, accion, ejercicio, numero, concepto, total_debe, total_haber, motivo, usuario_email, creado_en) VALUES ('ee159146-c0a8-4ad6-a50b-386284b8dabe', 'CREACION', 2026, 3, 'Pago de fletes y transporte de mercadería comprada (Método Analítico).', 339.00, 339.00, 'Partida inicial cargada bajo el Método Analítico', 'admin@contable.sv', '2026-09-23T06:17:01.040Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO asiento_historial (asiento_id, accion, ejercicio, numero, concepto, total_debe, total_haber, motivo, usuario_email, creado_en) VALUES ('f615a46c-aed9-4c08-89c0-2f133f7ecd40', 'CREACION', 2026, 5, 'Venta de mercaderías al contado con IVA débito fiscal (Método Analítico).', 9040.00, 9040.00, 'Partida inicial cargada bajo el Método Analítico', 'admin@contable.sv', '2026-09-23T06:17:01.040Z') ON CONFLICT (id) DO NOTHING;
