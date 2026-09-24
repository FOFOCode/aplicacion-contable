-- =============================================================================
-- MIGRACIÓN 008: Kardex Valorado de Bodega (Costo Promedio Ponderado)
-- Integración completa con el Método Analítico (Toma Física / Inventario Final)
-- =============================================================================

-- 1. TABLA DE ARTÍCULOS DE INVENTARIO
CREATE TABLE IF NOT EXISTS articulo_kardex (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(255) NOT NULL,
    unidad VARCHAR(50) NOT NULL DEFAULT 'Unidades',
    cuenta_codigo VARCHAR(20) NOT NULL DEFAULT '1104' REFERENCES catalogo_cuentas(codigo),
    ubicacion VARCHAR(150),
    stock_minimo NUMERIC(12, 2) DEFAULT 0,
    stock_maximo NUMERIC(12, 2) DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLA DE MOVIMIENTOS DE KARDEX (CONTROL FÍSICO Y VALORADO)
CREATE TABLE IF NOT EXISTS kardex_movimiento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    articulo_id UUID NOT NULL REFERENCES articulo_kardex(id) ON DELETE CASCADE,
    ejercicio INT NOT NULL REFERENCES ejercicio_fiscal(ejercicio) ON DELETE RESTRICT,
    fecha DATE NOT NULL,
    comprobante VARCHAR(100),
    concepto TEXT NOT NULL,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA', 'DEVOLUCION_COMPRA', 'DEVOLUCION_VENTA', 'AJUSTE')),
    unidades_entrada NUMERIC(12, 2) NOT NULL DEFAULT 0,
    unidades_salida NUMERIC(12, 2) NOT NULL DEFAULT 0,
    unidades_saldo NUMERIC(12, 2) NOT NULL DEFAULT 0,
    costo_unitario NUMERIC(14, 4) NOT NULL DEFAULT 0,
    debe NUMERIC(14, 2) NOT NULL DEFAULT 0,
    haber NUMERIC(14, 2) NOT NULL DEFAULT 0,
    saldo NUMERIC(14, 2) NOT NULL DEFAULT 0,
    asiento_id UUID REFERENCES asiento(id) ON DELETE SET NULL,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kardex_art_ejercicio ON kardex_movimiento(articulo_id, ejercicio);
CREATE INDEX IF NOT EXISTS idx_kardex_fecha ON kardex_movimiento(fecha);

-- 3. SEMILLAS DE ARTÍCULOS INICIALES
INSERT INTO articulo_kardex (codigo, nombre, unidad, cuenta_codigo, ubicacion, stock_minimo, stock_maximo)
VALUES 
    ('ART-001', 'Mercaderías Generales para la Venta (Lote Central)', 'Unidades', '1104', 'Bodega Principal - Estante A-3', 200, 2500),
    ('ART-002', 'Suministros y Accesorios Comerciales', 'Cajas', '1104', 'Bodega Principal - Estante B-1', 50, 800)
ON CONFLICT (codigo) DO UPDATE 
SET nombre = EXCLUDED.nombre,
    unidad = EXCLUDED.unidad,
    ubicacion = EXCLUDED.ubicacion;

-- 4. MOVIMIENTOS BASE PARA EJERCICIO 2026 (RECONCILIADOS CON TOMA FÍSICA $6,500.00)
DO $$
DECLARE
    v_art_id UUID;
BEGIN
    SELECT id INTO v_art_id FROM articulo_kardex WHERE codigo = 'ART-001' LIMIT 1;
    
    IF v_art_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM kardex_movimiento WHERE articulo_id = v_art_id AND ejercicio = 2026) THEN
        INSERT INTO kardex_movimiento (
            articulo_id, ejercicio, fecha, comprobante, concepto, tipo,
            unidades_entrada, unidades_salida, unidades_saldo,
            costo_unitario, debe, haber, saldo
        ) VALUES 
        (v_art_id, 2026, '2026-01-02', 'P-001 (Apertura)', 'Inventario inicial de mercaderías para apertura de operaciones', 'ENTRADA', 1000, 0, 1000, 5.0000, 5000.00, 0.00, 5000.00),
        (v_art_id, 2026, '2026-01-05', 'CCF-1045', 'Compra de mercadería al contado según factura comercial', 'ENTRADA', 800, 0, 1800, 5.0000, 4000.00, 0.00, 9000.00),
        (v_art_id, 2026, '2026-01-09', 'NC-102', 'Devolución de mercadería dañada al proveedor según nota de crédito', 'DEVOLUCION_COMPRA', 0, 80, 1720, 5.0000, 0.00, 400.00, 8600.00),
        (v_art_id, 2026, '2026-01-12', 'FAC-1001', 'Venta de mercaderías al contado (Despacho de almacén)', 'SALIDA', 0, 800, 920, 5.0000, 0.00, 4000.00, 4600.00),
        (v_art_id, 2026, '2026-01-15', 'NC-001', 'Reingreso por devolución de cliente por especificaciones técnicas', 'DEVOLUCION_VENTA', 40, 0, 960, 5.0000, 200.00, 0.00, 4800.00),
        (v_art_id, 2026, '2026-12-31', 'TF-2026', 'Ajuste e incorporación de inventario final según toma física de auditoría', 'AJUSTE', 340, 0, 1300, 5.0000, 1700.00, 0.00, 6500.00);
    END IF;
END $$;

-- 5. FUNCIÓN STORED PROCEDURE: SINCRONIZAR KARDEX CON TOMA FÍSICA ANALÍTICA
DROP FUNCTION IF EXISTS sp_sincronizar_kardex_con_toma_fisica(INT, VARCHAR, TEXT);
DROP FUNCTION IF EXISTS sp_sincronizar_kardex_con_toma_fisica(INT);

CREATE OR REPLACE FUNCTION sp_sincronizar_kardex_con_toma_fisica(
    p_ejercicio INT,
    p_responsable VARCHAR(150) DEFAULT 'Comité de Auditoría y Control de Inventarios',
    p_observaciones TEXT DEFAULT 'Inventario final conciliado directamente desde las tarjetas de Kardex (Método Analítico)'
)
RETURNS TABLE (
    r_ejercicio INT,
    r_fecha_toma DATE,
    r_valor_inventario_final NUMERIC(14, 2),
    r_responsable VARCHAR(150),
    r_observaciones TEXT
) AS $$
DECLARE
    v_total_kardex NUMERIC(14, 2) := 0.00;
    v_fecha DATE := CURRENT_DATE;
BEGIN
    -- Sumar el último saldo monetario de cada artículo activo en el ejercicio
    SELECT COALESCE(SUM(ultimo_mov.saldo), 0.00)
    INTO v_total_kardex
    FROM articulo_kardex a
    CROSS JOIN LATERAL (
        SELECT m.saldo, m.fecha
        FROM kardex_movimiento m
        WHERE m.articulo_id = a.id AND m.ejercicio = p_ejercicio
        ORDER BY m.fecha DESC, m.creado_en DESC
        LIMIT 1
    ) ultimo_mov
    WHERE a.activo = TRUE;

    IF v_total_kardex <= 0 THEN
        -- Si no hay movimientos en kardex para ese ejercicio, mantener el que esté o 0.00
        SELECT COALESCE(itf.valor_inventario_final, 0.00)
        INTO v_total_kardex
        FROM inventario_toma_fisica itf
        WHERE itf.ejercicio = p_ejercicio;
    END IF;

    -- Upsert en inventario_toma_fisica
    INSERT INTO inventario_toma_fisica (
        ejercicio, fecha_toma, valor_inventario_final, responsable, observaciones
    ) VALUES (
        p_ejercicio, v_fecha, v_total_kardex, p_responsable, p_observaciones
    )
    ON CONFLICT (ejercicio) DO UPDATE
    SET valor_inventario_final = EXCLUDED.valor_inventario_final,
        fecha_toma = EXCLUDED.fecha_toma,
        responsable = EXCLUDED.responsable,
        observaciones = EXCLUDED.observaciones,
        actualizado_en = CURRENT_TIMESTAMP;

    RETURN QUERY
    SELECT 
        itf.ejercicio, 
        itf.fecha_toma, 
        itf.valor_inventario_final, 
        itf.responsable, 
        itf.observaciones
    FROM inventario_toma_fisica itf
    WHERE itf.ejercicio = p_ejercicio;
END;
$$ LANGUAGE plpgsql;
