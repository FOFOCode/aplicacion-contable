-- =============================================================================
-- TEST DRAFT: SISTEMA CONTABLE AUTOMATIZADO (POSTGRESQL 14+)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. LIMPIEZA
DROP VIEW IF EXISTS vista_balance_general CASCADE;
DROP VIEW IF EXISTS vista_estado_resultados_analitico CASCADE;
DROP VIEW IF EXISTS vista_estado_resultados CASCADE;
DROP VIEW IF EXISTS vista_estado_resultados_detalle CASCADE;
DROP VIEW IF EXISTS vista_balance_comprobacion CASCADE;
DROP VIEW IF EXISTS vista_libro_mayor CASCADE;
DROP VIEW IF EXISTS vista_libro_diario CASCADE;

DROP TABLE IF EXISTS inventario_toma_fisica CASCADE;
DROP TABLE IF EXISTS asiento_historial CASCADE;
DROP TABLE IF EXISTS cierre_contable CASCADE;
DROP TABLE IF EXISTS asiento_linea CASCADE;
DROP TABLE IF EXISTS asiento CASCADE;
DROP TABLE IF EXISTS usuario CASCADE;
DROP TABLE IF EXISTS ejercicio_fiscal CASCADE;
DROP TABLE IF EXISTS catalogo_cuentas CASCADE;

-- 2. TABLA: USUARIOS DEL SISTEMA (SEGURIDAD Y ROLES)
CREATE TABLE usuario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL DEFAULT 'contador' CHECK (tipo IN ('contador')),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_acceso TIMESTAMP WITH TIME ZONE,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usuario_email ON usuario(email);
CREATE INDEX idx_usuario_tipo ON usuario(tipo);
CREATE INDEX idx_usuario_activo ON usuario(activo);

-- 3. TABLA: CATÁLOGO DE CUENTAS
CREATE TABLE catalogo_cuentas (
    codigo VARCHAR(20) PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('activo', 'pasivo', 'capital', 'gasto', 'ingreso')),
    naturaleza VARCHAR(20) NOT NULL CHECK (naturaleza IN ('deudora', 'acreedora')),
    padre_codigo VARCHAR(20) REFERENCES catalogo_cuentas(codigo) ON DELETE RESTRICT,
    permite_movimiento BOOLEAN NOT NULL DEFAULT TRUE,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_catalogo_tipo_naturaleza CHECK (
        -- Activo: deudora habitual, acreedora para complementarias (ej. 1206 Depreciación acumulada)
        (codigo LIKE '1%' AND tipo = 'activo'  AND naturaleza IN ('deudora', 'acreedora')) OR
        -- Pasivo: acreedora habitual, deudora para complementarias
        (codigo LIKE '2%' AND tipo = 'pasivo'  AND naturaleza IN ('acreedora', 'deudora')) OR
        -- Capital: acreedora habitual, deudora para cuentas de déficit o pérdidas (ej. 3104)
        (codigo LIKE '3%' AND tipo = 'capital' AND naturaleza IN ('acreedora', 'deudora')) OR
        -- Costos y Gastos: deudora habitual, acreedora para complementarias de compras
        (codigo LIKE '4%' AND tipo = 'gasto'   AND naturaleza IN ('deudora', 'acreedora')) OR
        -- Cuentas complementarias de compras en subgrupo 51 (5102, 5103) clasificadas como costo/gasto acreedor
        (codigo LIKE '5%' AND tipo = 'gasto'   AND naturaleza = 'acreedora') OR
        -- Ingresos: acreedora habitual, deudora para complementarias de ventas si estuvieran en 5%
        (codigo LIKE '5%' AND tipo = 'ingreso' AND naturaleza IN ('acreedora', 'deudora'))
    )
);

CREATE INDEX idx_catalogo_tipo ON catalogo_cuentas(tipo);
CREATE INDEX idx_catalogo_activa ON catalogo_cuentas(activa);
CREATE INDEX idx_catalogo_permite_mov ON catalogo_cuentas(permite_movimiento);
CREATE INDEX idx_catalogo_padre ON catalogo_cuentas(padre_codigo);

-- 3. TABLA: CONTROL DE EJERCICIOS FISCALES Y CONCURRENCIA ATÓMICA
CREATE TABLE ejercicio_fiscal (
    ejercicio INT PRIMARY KEY,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    ultimo_numero INT NOT NULL DEFAULT 0 CHECK (ultimo_numero >= 0),
    estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTO' CHECK (estado IN ('ABIERTO', 'CERRADO', 'BLOQUEADO')),
    cerrado_en TIMESTAMP WITH TIME ZONE,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_fechas_ejercicio CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX idx_ejercicio_estado ON ejercicio_fiscal(estado);

-- Función atómica para generación concurrente de correlativos por ejercicio
CREATE OR REPLACE FUNCTION fn_proximo_numero_asiento(p_ejercicio INT)
RETURNS INT AS $$
DECLARE
    v_nuevo_numero INT;
BEGIN
    -- 1. Intentar actualizar atómicamente el ejercicio si ya existe
    UPDATE ejercicio_fiscal
    SET ultimo_numero = ultimo_numero + 1
    WHERE ejercicio = p_ejercicio AND estado = 'ABIERTO'
    RETURNING ultimo_numero INTO v_nuevo_numero;
    
    IF FOUND THEN
        RETURN v_nuevo_numero;
    END IF;

    -- 2. Si existe pero no está abierto, bloquear inserciones
    IF EXISTS (SELECT 1 FROM ejercicio_fiscal WHERE ejercicio = p_ejercicio) THEN
        RAISE EXCEPTION 'El ejercicio fiscal % no se encuentra ABIERTO para nuevas operaciones.', p_ejercicio;
    END IF;

    -- 3. Si no existe, crearlo atómicamente iniciando el correlativo en 1
    INSERT INTO ejercicio_fiscal (ejercicio, fecha_inicio, fecha_fin, ultimo_numero, estado)
    VALUES (
        p_ejercicio,
        MAKE_DATE(p_ejercicio, 1, 1),
        MAKE_DATE(p_ejercicio, 12, 31),
        1,
        'ABIERTO'
    )
    ON CONFLICT (ejercicio) DO UPDATE
    SET ultimo_numero = ejercicio_fiscal.ultimo_numero + 1
    WHERE ejercicio_fiscal.estado = 'ABIERTO'
    RETURNING ultimo_numero INTO v_nuevo_numero;

    RETURN v_nuevo_numero;
END;
$$ LANGUAGE plpgsql;

-- 4. TABLA: ASIENTOS (CABECERA LIBRO DIARIO)
CREATE TABLE asiento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlativo_global INT GENERATED BY DEFAULT AS IDENTITY UNIQUE,
    ejercicio INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT REFERENCES ejercicio_fiscal(ejercicio) ON DELETE RESTRICT,
    numero INT NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    concepto TEXT NOT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'OPERACION' CHECK (tipo IN ('APERTURA', 'OPERACION', 'AJUSTE', 'CIERRE')),
    estado VARCHAR(20) NOT NULL DEFAULT 'APLICADO' CHECK (estado IN ('APLICADO', 'ANULADO')),
    anulado_en TIMESTAMP WITH TIME ZONE,
    motivo_anulacion TEXT,
    documento_soporte VARCHAR(100),
    usuario_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_asiento_ejercicio_numero UNIQUE (ejercicio, numero),
    CONSTRAINT chk_asiento_anulacion CHECK (
        (estado = 'ANULADO' AND anulado_en IS NOT NULL) OR 
        (estado = 'APLICADO' AND anulado_en IS NULL)
    )
);

CREATE INDEX idx_asiento_ejercicio ON asiento(ejercicio);
CREATE INDEX idx_asiento_fecha ON asiento(fecha);
CREATE INDEX idx_asiento_estado ON asiento(estado);
CREATE INDEX idx_asiento_tipo ON asiento(tipo);
CREATE INDEX idx_asiento_correlativo ON asiento(correlativo_global);
CREATE INDEX idx_asiento_usuario ON asiento(usuario_id);

-- Trigger BEFORE INSERT para asegurar sincronización de correlativo y estado de ejercicio
CREATE OR REPLACE FUNCTION trg_fn_asiento_validar_ejercicio_y_numero()
RETURNS TRIGGER AS $$
BEGIN
    -- Validar que el ejercicio fiscal esté abierto si se intenta registrar una nueva partida
    IF EXISTS (SELECT 1 FROM ejercicio_fiscal WHERE ejercicio = NEW.ejercicio AND estado <> 'ABIERTO') THEN
        RAISE EXCEPTION 'Operación rechazada: El ejercicio fiscal % se encuentra cerrado o bloqueado.', NEW.ejercicio;
    END IF;

    -- Si el número no fue indicado, obtenerlo atómicamente
    IF NEW.numero IS NULL OR NEW.numero <= 0 THEN
        NEW.numero := fn_proximo_numero_asiento(NEW.ejercicio);
    ELSE
        -- Si fue provisto, garantizar que la tabla ejercicio_fiscal registre o actualice el correlativo
        INSERT INTO ejercicio_fiscal (ejercicio, fecha_inicio, fecha_fin, ultimo_numero, estado)
        VALUES (NEW.ejercicio, MAKE_DATE(NEW.ejercicio, 1, 1), MAKE_DATE(NEW.ejercicio, 12, 31), NEW.numero, 'ABIERTO')
        ON CONFLICT (ejercicio) DO UPDATE
        SET ultimo_numero = GREATEST(ejercicio_fiscal.ultimo_numero, EXCLUDED.ultimo_numero);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_asiento_validar_numero
BEFORE INSERT ON asiento
FOR EACH ROW EXECUTE FUNCTION trg_fn_asiento_validar_ejercicio_y_numero();

-- 5. TABLA: LÍNEAS DEL ASIENTO
CREATE TABLE asiento_linea (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asiento_id UUID NOT NULL REFERENCES asiento(id) ON DELETE RESTRICT,
    linea_numero INT NOT NULL DEFAULT 1,
    cuenta_codigo VARCHAR(20) NOT NULL REFERENCES catalogo_cuentas(codigo) ON DELETE RESTRICT,
    debe NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (debe >= 0),
    haber NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (haber >= 0),
    CONSTRAINT uq_asiento_linea UNIQUE (asiento_id, linea_numero),
    CONSTRAINT chk_linea_exclusiva CHECK (
        (debe > 0 AND haber = 0) OR 
        (haber > 0 AND debe = 0)
    )
);

CREATE INDEX idx_linea_asiento ON asiento_linea(asiento_id);
CREATE INDEX idx_linea_cuenta ON asiento_linea(cuenta_codigo);

-- Validar que la cuenta imputada permita movimientos y esté activa
CREATE OR REPLACE FUNCTION trg_fn_linea_validar_cuenta()
RETURNS TRIGGER AS $$
DECLARE
    v_permite BOOLEAN;
    v_activa BOOLEAN;
BEGIN
    SELECT permite_movimiento, activa INTO v_permite, v_activa
    FROM catalogo_cuentas
    WHERE codigo = NEW.cuenta_codigo;

    IF v_activa IS NOT TRUE THEN
        RAISE EXCEPTION 'La cuenta % no está activa para registros contables.', NEW.cuenta_codigo;
    END IF;

    IF v_permite IS NOT TRUE THEN
        RAISE EXCEPTION 'La cuenta % es de título/acumulación y no permite movimientos directos.', NEW.cuenta_codigo;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_linea_validar_cuenta
BEFORE INSERT OR UPDATE OF cuenta_codigo ON asiento_linea
FOR EACH ROW EXECUTE FUNCTION trg_fn_linea_validar_cuenta();

-- 6. TRIGGER DIFERIDO DE PARTIDA DOBLE Y MÍNIMO DE LÍNEAS (DEFERRABLE INITIALLY DEFERRED)
CREATE OR REPLACE FUNCTION fn_trg_validar_partida_doble()
RETURNS TRIGGER AS $$
DECLARE
    v_asiento_id UUID;
    v_total_debe NUMERIC(14, 2);
    v_total_haber NUMERIC(14, 2);
    v_num_lineas INT;
    v_numero INT;
    v_ejercicio INT;
BEGIN
    IF TG_TABLE_NAME = 'asiento' THEN
        v_asiento_id := NEW.id;
        v_numero := NEW.numero;
        v_ejercicio := NEW.ejercicio;
    ELSE
        v_asiento_id := COALESCE(NEW.asiento_id, OLD.asiento_id);
        SELECT numero, ejercicio INTO v_numero, v_ejercicio
        FROM asiento WHERE id = v_asiento_id;
    END IF;

    IF v_asiento_id IS NULL OR NOT EXISTS (SELECT 1 FROM asiento WHERE id = v_asiento_id) THEN
        RETURN NULL;
    END IF;

    SELECT 
        COUNT(*),
        COALESCE(SUM(debe), 0.00),
        COALESCE(SUM(haber), 0.00)
    INTO v_num_lineas, v_total_debe, v_total_haber
    FROM asiento_linea
    WHERE asiento_id = v_asiento_id;

    -- Validar mínimo 2 líneas por partida
    IF v_num_lineas < 2 THEN
        RAISE EXCEPTION 'Violación Contable: El asiento #% del ejercicio % debe contener al menos 2 líneas (cargos y abonos). Líneas registradas: %',
            v_numero, v_ejercicio, v_num_lineas;
    END IF;

    -- Validar balance exacto de partida doble (Debe = Haber)
    IF ABS(v_total_debe - v_total_haber) > 0.0001 THEN
        RAISE EXCEPTION 'Descuadre de Partida Doble en asiento #% del ejercicio %: Total Debe ($%) <> Total Haber ($%). Diferencia: $%',
            v_numero, v_ejercicio, v_total_debe, v_total_haber, (v_total_debe - v_total_haber);
    END IF;

    IF v_total_debe = 0.00 THEN
        RAISE EXCEPTION 'Violación Contable: El asiento #% del ejercicio % no puede registrar importe total de cero.',
            v_numero, v_ejercicio;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_asiento_partida_doble
AFTER INSERT OR UPDATE ON asiento
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION fn_trg_validar_partida_doble();

CREATE CONSTRAINT TRIGGER trg_linea_partida_doble
AFTER INSERT OR UPDATE OR DELETE ON asiento_linea
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION fn_trg_validar_partida_doble();

-- 7. TABLA: HISTORIAL DE CIERRES CONTABLES
CREATE TABLE cierre_contable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ejercicio INT NOT NULL REFERENCES ejercicio_fiscal(ejercicio) ON DELETE RESTRICT,
    fecha_cierre DATE NOT NULL DEFAULT CURRENT_DATE,
    concepto TEXT NOT NULL DEFAULT 'Cierre del ejercicio fiscal',
    total_ingresos NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_gastos NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    utilidad NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    cuenta_capital_codigo VARCHAR(20) NOT NULL REFERENCES catalogo_cuentas(codigo) ON DELETE RESTRICT,
    asiento_cierre_id UUID NOT NULL REFERENCES asiento(id) ON DELETE RESTRICT,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_cierre_ejercicio UNIQUE (ejercicio)
);

CREATE INDEX idx_cierre_ejercicio ON cierre_contable(ejercicio);

-- 8. TABLA: HISTORIAL Y AUDITORÍA DE PARTIDAS
CREATE TABLE asiento_historial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asiento_id UUID NOT NULL REFERENCES asiento(id) ON DELETE RESTRICT,
    accion VARCHAR(20) NOT NULL CHECK (accion IN ('CREACION', 'MODIFICACION', 'ANULACION', 'CIERRE')),
    ejercicio INT NOT NULL,
    numero INT NOT NULL,
    concepto TEXT,
    total_debe NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_haber NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    motivo TEXT,
    usuario_email VARCHAR(150) NOT NULL DEFAULT 'admin@contable.sv',
    usuario_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_historial_asiento ON asiento_historial(asiento_id);
CREATE INDEX idx_historial_ejercicio ON asiento_historial(ejercicio);
CREATE INDEX idx_historial_accion ON asiento_historial(accion);
CREATE INDEX idx_historial_usuario ON asiento_historial(usuario_id);

-- 9. TABLA: TOMA FÍSICA DE INVENTARIO POR EJERCICIO (MÉTODO ANALÍTICO)
CREATE TABLE inventario_toma_fisica (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ejercicio INT NOT NULL REFERENCES ejercicio_fiscal(ejercicio) ON DELETE RESTRICT,
    fecha_toma DATE NOT NULL DEFAULT CURRENT_DATE,
    valor_inventario_final NUMERIC(14, 2) NOT NULL CHECK (valor_inventario_final >= 0),
    responsable VARCHAR(150),
    observaciones TEXT,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_inventario_ejercicio UNIQUE (ejercicio)
);

CREATE INDEX idx_inventario_toma_ejercicio ON inventario_toma_fisica(ejercicio);

-- 10. PROTECCIÓN DE AUDITORÍA: PROHIBICIÓN TOTAL DE DELETE FÍSICO
CREATE OR REPLACE FUNCTION fn_prohibir_delete_contable()
RETURNS TRIGGER AS $$
DECLARE
    v_permitido BOOLEAN;
BEGIN
    BEGIN
        v_permitido := current_setting('contabilidad.permitir_modificacion_lineas', true)::BOOLEAN;
    EXCEPTION WHEN OTHERS THEN
        v_permitido := false;
    END;

    IF v_permitido IS TRUE THEN
        RETURN OLD;
    END IF;

    RAISE EXCEPTION 'Operación Denegada por Auditoría: Prohibida la eliminación física (DELETE) en la tabla %. El sistema opera bajo inmutabilidad contable; proceda con la anulación formal (sp_anular_asiento).', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_no_delete_asiento
BEFORE DELETE ON asiento
FOR EACH ROW EXECUTE FUNCTION fn_prohibir_delete_contable();

CREATE TRIGGER trg_no_delete_asiento_linea
BEFORE DELETE ON asiento_linea
FOR EACH ROW EXECUTE FUNCTION fn_prohibir_delete_contable();

CREATE TRIGGER trg_no_delete_cierre_contable
BEFORE DELETE ON cierre_contable
FOR EACH ROW EXECUTE FUNCTION fn_prohibir_delete_contable();

CREATE TRIGGER trg_no_delete_asiento_historial
BEFORE DELETE ON asiento_historial
FOR EACH ROW EXECUTE FUNCTION fn_prohibir_delete_contable();

-- 11. PROCEDIMIENTO DE ANULACIÓN FORMAL DE ASIENTOS
CREATE OR REPLACE FUNCTION sp_anular_asiento(
    p_asiento_id UUID,
    p_motivo TEXT DEFAULT 'Anulación contable por corrección/auditoría',
    p_usuario_email TEXT DEFAULT 'admin@contable.sv'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_ejercicio INT;
    v_numero INT;
    v_concepto TEXT;
    v_total_debe NUMERIC(14, 2);
    v_total_haber NUMERIC(14, 2);
    v_estado VARCHAR(20);
    v_ejercicio_estado VARCHAR(20);
BEGIN
    SELECT a.ejercicio, a.numero, a.concepto, a.estado, e.estado
    INTO v_ejercicio, v_numero, v_concepto, v_estado, v_ejercicio_estado
    FROM asiento a
    JOIN ejercicio_fiscal e ON a.ejercicio = e.ejercicio
    WHERE a.id = p_asiento_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El asiento con ID % no existe.', p_asiento_id;
    END IF;

    IF v_ejercicio_estado <> 'ABIERTO' THEN
        RAISE EXCEPTION 'No es posible anular la partida #% del ejercicio % porque el ejercicio fiscal está %.', v_numero, v_ejercicio, v_ejercicio_estado;
    END IF;

    IF v_estado = 'ANULADO' THEN
        RAISE EXCEPTION 'La partida #% del ejercicio % ya se encuentra anulada.', v_numero, v_ejercicio;
    END IF;

    SELECT COALESCE(SUM(debe), 0.00), COALESCE(SUM(haber), 0.00)
    INTO v_total_debe, v_total_haber
    FROM asiento_linea
    WHERE asiento_id = p_asiento_id;

    UPDATE asiento
    SET estado = 'ANULADO',
        anulado_en = CURRENT_TIMESTAMP,
        motivo_anulacion = p_motivo
    WHERE id = p_asiento_id;

    INSERT INTO asiento_historial (
        asiento_id, accion, ejercicio, numero, concepto,
        total_debe, total_haber, motivo, usuario_email
    ) VALUES (
        p_asiento_id, 'ANULACION', v_ejercicio, v_numero, v_concepto,
        v_total_debe, v_total_haber, p_motivo, COALESCE(p_usuario_email, 'admin@contable.sv')
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 12. VISTAS DEL CICLO CONTABLE PARTICIONADAS POR EJERCICIO

-- 12.1. Libro Diario
CREATE OR REPLACE VIEW vista_libro_diario AS
SELECT 
    a.ejercicio,
    a.numero AS partida_numero,
    al.linea_numero,
    a.id AS asiento_id,
    a.correlativo_global,
    a.fecha,
    a.concepto,
    a.tipo AS tipo_asiento,
    a.estado AS estado_asiento,
    a.anulado_en,
    a.motivo_anulacion,
    c.codigo AS cuenta_codigo,
    c.nombre AS cuenta_nombre,
    c.tipo AS cuenta_tipo,
    c.naturaleza AS cuenta_naturaleza,
    al.debe,
    al.haber
FROM asiento a
JOIN asiento_linea al ON a.id = al.asiento_id
JOIN catalogo_cuentas c ON al.cuenta_codigo = c.codigo
ORDER BY a.ejercicio DESC, a.numero DESC, al.linea_numero ASC;

-- 12.2. Libro Mayor (Agrupado por ejercicio y cuenta, excluye anulados y partidas de cierre)
CREATE OR REPLACE VIEW vista_libro_mayor AS
SELECT 
    a.ejercicio,
    c.codigo AS cuenta_codigo,
    c.nombre AS cuenta_nombre,
    c.tipo AS cuenta_tipo,
    c.naturaleza AS cuenta_naturaleza,
    c.permite_movimiento,
    c.activa,
    ROUND(SUM(al.debe), 2) AS total_debe,
    ROUND(SUM(al.haber), 2) AS total_haber,
    ROUND(SUM(al.debe) - SUM(al.haber), 2) AS saldo_neto,
    CASE 
        WHEN ROUND(SUM(al.debe) - SUM(al.haber), 2) > 0 THEN 'deudora'
        WHEN ROUND(SUM(al.debe) - SUM(al.haber), 2) < 0 THEN 'acreedora'
        ELSE NULL 
    END AS naturaleza_saldo,
    CASE 
        WHEN c.naturaleza = 'deudora' THEN ROUND(SUM(al.debe) - SUM(al.haber), 2)
        ELSE ROUND(SUM(al.haber) - SUM(al.debe), 2)
    END AS saldo_normalizado
FROM catalogo_cuentas c
JOIN asiento_linea al ON c.codigo = al.cuenta_codigo
JOIN asiento a ON al.asiento_id = a.id
WHERE a.estado = 'APLICADO'
  AND a.tipo <> 'CIERRE'
GROUP BY a.ejercicio, c.codigo, c.nombre, c.tipo, c.naturaleza, c.permite_movimiento, c.activa
HAVING SUM(al.debe) <> 0 OR SUM(al.haber) <> 0;

-- 12.3. Balance de Comprobación por Ejercicio
CREATE OR REPLACE VIEW vista_balance_comprobacion AS
SELECT 
    ejercicio,
    cuenta_codigo,
    cuenta_nombre,
    cuenta_tipo,
    cuenta_naturaleza,
    total_debe,
    total_haber,
    CASE WHEN saldo_neto > 0 THEN saldo_neto ELSE 0.00 END AS saldo_deudor,
    CASE WHEN saldo_neto < 0 THEN ABS(saldo_neto) ELSE 0.00 END AS saldo_acreedor
FROM vista_libro_mayor
ORDER BY ejercicio DESC, cuenta_codigo ASC;

-- 12.4. Detalle y Resumen de Estado de Resultados por Ejercicio (compatibilidad frontend)
CREATE OR REPLACE VIEW vista_estado_resultados_detalle AS
SELECT 
    ejercicio,
    cuenta_codigo,
    cuenta_nombre,
    cuenta_tipo,
    CASE 
        WHEN cuenta_tipo = 'ingreso' AND LEFT(cuenta_codigo, 2) = '52' THEN 'ingresosFinancieros'
        WHEN cuenta_tipo = 'ingreso' THEN 'ventas'
        WHEN cuenta_tipo = 'gasto' AND LEFT(cuenta_codigo, 2) = '41' THEN 'costoVentas'
        WHEN cuenta_tipo = 'gasto' AND LEFT(cuenta_codigo, 2) = '43' THEN 'gastosFinancieros'
        WHEN cuenta_tipo = 'gasto' THEN 'gastosOperacion'
        ELSE NULL 
    END AS subgrupo,
    CASE 
        WHEN cuenta_tipo = 'ingreso' THEN ROUND(total_haber - total_debe, 2)
        WHEN cuenta_tipo = 'gasto' THEN ROUND(total_debe - total_haber, 2)
        ELSE 0.00
    END AS monto
FROM vista_libro_mayor
WHERE cuenta_tipo IN ('ingreso', 'gasto');

CREATE OR REPLACE VIEW vista_estado_resultados AS
WITH totales AS (
    SELECT 
        ejercicio,
        COALESCE(SUM(CASE WHEN subgrupo = 'ventas' THEN monto ELSE 0 END), 0.00) AS total_ventas,
        COALESCE(SUM(CASE WHEN subgrupo = 'costoVentas' THEN monto ELSE 0 END), 0.00) AS total_costo_ventas,
        COALESCE(SUM(CASE WHEN subgrupo = 'gastosOperacion' THEN monto ELSE 0 END), 0.00) AS total_gastos_operacion,
        COALESCE(SUM(CASE WHEN subgrupo = 'ingresosFinancieros' THEN monto ELSE 0 END), 0.00) AS total_ingresos_financieros,
        COALESCE(SUM(CASE WHEN subgrupo = 'gastosFinancieros' THEN monto ELSE 0 END), 0.00) AS total_gastos_financieros,
        COALESCE(SUM(CASE WHEN cuenta_tipo = 'ingreso' THEN monto ELSE 0 END), 0.00) AS total_ingresos,
        COALESCE(SUM(CASE WHEN cuenta_tipo = 'gasto' THEN monto ELSE 0 END), 0.00) AS total_gastos
    FROM vista_estado_resultados_detalle
    GROUP BY ejercicio
)
SELECT 
    ejercicio,
    total_ventas,
    total_costo_ventas,
    ROUND(total_ventas - total_costo_ventas, 2) AS utilidad_bruta,
    total_gastos_operacion,
    ROUND((total_ventas - total_costo_ventas) - total_gastos_operacion, 2) AS utilidad_operacion,
    total_ingresos_financieros,
    total_gastos_financieros,
    ROUND(total_ingresos_financieros - total_gastos_financieros, 2) AS resultado_financiero,
    total_ingresos,
    total_gastos,
    ROUND(total_ingresos - total_gastos, 2) AS utilidad
FROM totales;

-- 12.5. Estado de Resultados Detallado por el Método Analítico (Pormenorizado)
CREATE OR REPLACE VIEW vista_estado_resultados_analitico AS
WITH ejercicios_activos AS (
    SELECT DISTINCT ejercicio FROM vista_libro_mayor
),
tomas_inventario AS (
    SELECT DISTINCT ON (ejercicio)
        ejercicio,
        valor_inventario_final,
        fecha_toma
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
        COALESCE(ti.valor_inventario_final, (SELECT saldo_normalizado FROM vista_libro_mayor m WHERE m.ejercicio = e.ejercicio AND m.cuenta_codigo = '1104'), 0.00) AS inventario_final,
        ti.fecha_toma AS fecha_inventario_final,
        COALESCE((SELECT SUM(saldo_normalizado) FROM vista_libro_mayor m WHERE m.ejercicio = e.ejercicio AND m.cuenta_codigo LIKE '42%'), 0.00) AS gastos_operacion,
        COALESCE((SELECT SUM(saldo_normalizado) FROM vista_libro_mayor m WHERE m.ejercicio = e.ejercicio AND m.cuenta_codigo LIKE '43%'), 0.00) AS gastos_financieros,
        COALESCE((SELECT SUM(saldo_normalizado) FROM vista_libro_mayor m WHERE m.ejercicio = e.ejercicio AND m.cuenta_codigo LIKE '52%'), 0.00) AS productos_financieros,
        COALESCE((SELECT saldo_normalizado FROM vista_libro_mayor m WHERE m.ejercicio = e.ejercicio AND m.cuenta_codigo = '5104'), 0.00) AS otros_ingresos
    FROM ejercicios_activos e
    LEFT JOIN tomas_inventario ti ON e.ejercicio = ti.ejercicio
)
SELECT 
    ejercicio,
    ventas_totales,
    devoluciones_sobre_ventas,
    rebajas_sobre_ventas,
    -- 1. Ventas Netas
    ROUND(ventas_totales - devoluciones_sobre_ventas - rebajas_sobre_ventas, 2) AS ventas_netas,
    inventario_inicial,
    compras,
    gastos_sobre_compras,
    -- 2. Compras Totales
    ROUND(compras + gastos_sobre_compras, 2) AS compras_totales,
    devoluciones_sobre_compras,
    rebajas_sobre_compras,
    -- 3. Compras Netas
    ROUND((compras + gastos_sobre_compras) - devoluciones_sobre_compras - rebajas_sobre_compras, 2) AS compras_netas,
    -- 4. Total Mercancías Disponibles
    ROUND(inventario_inicial + ((compras + gastos_sobre_compras) - devoluciones_sobre_compras - rebajas_sobre_compras), 2) AS total_mercancias,
    inventario_final,
    fecha_inventario_final,
    -- 5. Costo de Ventas
    ROUND(
        (inventario_inicial + ((compras + gastos_sobre_compras) - devoluciones_sobre_compras - rebajas_sobre_compras)) - inventario_final,
        2
    ) AS costo_ventas,
    -- 6. Utilidades Cascada
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

-- 12.6. Balance General y Verificación de Ecuación Patrimonial por Ejercicio
CREATE OR REPLACE VIEW vista_balance_general AS
WITH ejercicios_activos AS (
    SELECT DISTINCT ejercicio FROM vista_libro_mayor
),
saldos AS (
    SELECT 
        e.ejercicio,
        COALESCE(SUM(CASE WHEN m.cuenta_tipo = 'activo' THEN (m.total_debe - m.total_haber) ELSE 0 END), 0.00) AS total_activo,
        COALESCE(SUM(CASE WHEN m.cuenta_tipo = 'pasivo' THEN (m.total_haber - m.total_debe) ELSE 0 END), 0.00) AS total_pasivo,
        COALESCE(SUM(CASE WHEN m.cuenta_tipo = 'capital' THEN (m.total_haber - m.total_debe) ELSE 0 END), 0.00) AS total_capital_cuentas
    FROM ejercicios_activos e
    JOIN vista_libro_mayor m ON e.ejercicio = m.ejercicio
    WHERE m.cuenta_tipo IN ('activo', 'pasivo', 'capital')
    GROUP BY e.ejercicio
),
resultado AS (
    SELECT 
        ejercicio,
        COALESCE(utilidad, 0.00) AS utilidad_ejercicio
    FROM vista_estado_resultados
)
SELECT 
    s.ejercicio,
    ROUND(s.total_activo, 2) AS total_activo,
    ROUND(s.total_pasivo, 2) AS total_pasivo,
    ROUND(s.total_capital_cuentas, 2) AS total_capital_cuentas,
    ROUND(r.utilidad_ejercicio, 2) AS utilidad_ejercicio,
    ROUND(s.total_capital_cuentas + r.utilidad_ejercicio, 2) AS total_capital_contable,
    ROUND(s.total_pasivo + (s.total_capital_cuentas + r.utilidad_ejercicio), 2) AS total_pasivo_mas_capital,
    ROUND(s.total_activo - (s.total_pasivo + (s.total_capital_cuentas + r.utilidad_ejercicio)), 2) AS diferencia_patrimonial,
    (ABS(ROUND(s.total_activo, 2) - ROUND(s.total_pasivo + (s.total_capital_cuentas + r.utilidad_ejercicio), 2)) < 0.01) AS cuadra
FROM saldos s
JOIN resultado r ON s.ejercicio = r.ejercicio;

-- 13. PROCEDIMIENTO DE CIERRE CONTABLE (NO DESTRUCTIVO)
CREATE OR REPLACE FUNCTION sp_cerrar_ciclo_contable(
    p_ejercicio INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT,
    p_fecha_cierre DATE DEFAULT NULL,
    p_concepto TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_asiento_cierre_id UUID;
    v_proximo_numero INT;
    v_utilidad NUMERIC(14, 2);
    v_total_ingresos NUMERIC(14, 2);
    v_total_gastos NUMERIC(14, 2);
    v_cuenta_capital VARCHAR(20);
    v_linea_idx INT := 1;
    v_fecha DATE;
    v_concepto TEXT;
    r RECORD;
BEGIN
    -- 1. Validar que el ejercicio no esté ya cerrado
    IF EXISTS (SELECT 1 FROM ejercicio_fiscal WHERE ejercicio = p_ejercicio AND estado = 'CERRADO') THEN
        RAISE EXCEPTION 'El ejercicio fiscal % ya ha sido cerrado formalmente con anterioridad.', p_ejercicio;
    END IF;

    IF EXISTS (SELECT 1 FROM asiento WHERE ejercicio = p_ejercicio AND tipo = 'CIERRE' AND estado = 'APLICADO') THEN
        RAISE EXCEPTION 'Ya existe una partida de cierre contable aplicada para el ejercicio fiscal %.', p_ejercicio;
    END IF;

    -- Parámetros por defecto
    v_fecha := COALESCE(p_fecha_cierre, MAKE_DATE(p_ejercicio, 12, 31));
    v_concepto := COALESCE(p_concepto, FORMAT('Asiento de liquidación y cierre contable del ejercicio fiscal %s', p_ejercicio));

    -- 2. Obtener sumatorias de resultados del ejercicio
    SELECT 
        COALESCE(total_ingresos, 0.00),
        COALESCE(total_gastos, 0.00),
        COALESCE(utilidad, 0.00)
    INTO v_total_ingresos, v_total_gastos, v_utilidad
    FROM vista_estado_resultados
    WHERE ejercicio = p_ejercicio;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existen movimientos de ingresos o gastos para liquidar en el ejercicio %.', p_ejercicio;
    END IF;

    -- 3. Cuenta de capital que absorbe el resultado
    IF v_utilidad >= 0 THEN
        SELECT codigo INTO v_cuenta_capital 
        FROM catalogo_cuentas 
        WHERE activa = TRUE AND tipo = 'capital' AND permite_movimiento = TRUE
        ORDER BY CASE WHEN codigo = '3102' THEN 0 ELSE 1 END, codigo ASC
        LIMIT 1;
    ELSE
        SELECT codigo INTO v_cuenta_capital 
        FROM catalogo_cuentas 
        WHERE activa = TRUE AND tipo = 'capital' AND permite_movimiento = TRUE
        ORDER BY CASE WHEN codigo = '3104' THEN 0 ELSE 1 END, codigo ASC
        LIMIT 1;
    END IF;

    IF v_cuenta_capital IS NULL THEN
        RAISE EXCEPTION 'No existe una cuenta de capital activa para transferir el resultado del ejercicio.';
    END IF;

    -- 4. Generar número correlativo
    v_proximo_numero := fn_proximo_numero_asiento(p_ejercicio);

    -- 5. Crear cabecera del asiento de cierre
    INSERT INTO asiento (ejercicio, numero, fecha, concepto, tipo, estado)
    VALUES (p_ejercicio, v_proximo_numero, v_fecha, v_concepto, 'CIERRE', 'APLICADO')
    RETURNING id INTO v_asiento_cierre_id;

    -- 6. Cancelar cuentas con saldo neto acreedor (saldo_neto < 0): Se cargan al Debe
    FOR r IN (
        SELECT cuenta_codigo, ABS(saldo_neto) AS monto
        FROM vista_libro_mayor
        WHERE ejercicio = p_ejercicio 
          AND cuenta_tipo IN ('ingreso', 'gasto')
          AND saldo_neto < 0
    ) LOOP
        INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber)
        VALUES (v_asiento_cierre_id, v_linea_idx, r.cuenta_codigo, r.monto, 0.00);
        v_linea_idx := v_linea_idx + 1;
    END LOOP;

    -- 7. Cancelar cuentas con saldo neto deudor (saldo_neto > 0): Se abonan al Haber
    FOR r IN (
        SELECT cuenta_codigo, saldo_neto AS monto
        FROM vista_libro_mayor
        WHERE ejercicio = p_ejercicio 
          AND cuenta_tipo IN ('ingreso', 'gasto')
          AND saldo_neto > 0
    ) LOOP
        INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber)
        VALUES (v_asiento_cierre_id, v_linea_idx, r.cuenta_codigo, 0.00, r.monto);
        v_linea_idx := v_linea_idx + 1;
    END LOOP;

    -- 8. Registrar saldo a cuenta de capital
    IF v_utilidad > 0 THEN
        INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber)
        VALUES (v_asiento_cierre_id, v_linea_idx, v_cuenta_capital, 0.00, v_utilidad);
    ELSIF v_utilidad < 0 THEN
        INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber)
        VALUES (v_asiento_cierre_id, v_linea_idx, v_cuenta_capital, ABS(v_utilidad), 0.00);
    END IF;

    -- 9. Registrar en tabla cierre_contable
    INSERT INTO cierre_contable (
        ejercicio, fecha_cierre, concepto,
        total_ingresos, total_gastos, utilidad,
        cuenta_capital_codigo, asiento_cierre_id
    ) VALUES (
        p_ejercicio, v_fecha, v_concepto,
        v_total_ingresos, v_total_gastos, v_utilidad,
        v_cuenta_capital, v_asiento_cierre_id
    );

    -- 10. Registrar en historial de auditoría
    INSERT INTO asiento_historial (
        asiento_id, accion, ejercicio, numero, concepto,
        total_debe, total_haber, motivo
    ) VALUES (
        v_asiento_cierre_id, 'CIERRE', p_ejercicio, v_proximo_numero, v_concepto,
        GREATEST(v_total_ingresos, v_total_gastos), GREATEST(v_total_ingresos, v_total_gastos),
        'Liquidación anual de resultados y cierre no destructivo'
    );

    -- 11. Cerrar el ejercicio fiscal
    UPDATE ejercicio_fiscal
    SET estado = 'CERRADO', cerrado_en = CURRENT_TIMESTAMP
    WHERE ejercicio = p_ejercicio;

    RETURN v_asiento_cierre_id;
END;
$$ LANGUAGE plpgsql;

-- 14. DATOS SEMILLA: CATÁLOGO ESENCIAL (MÉTODO ANALÍTICO)
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

-- Cuentas analíticas complementarias de compras (clasificadas como gasto con naturaleza ACREEDORA para no distorsionar ingresos)
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

-- 15. DATOS SEMILLA: EJERCICIO FISCAL 2026 Y 7 PARTIDAS CONTABLES
INSERT INTO ejercicio_fiscal (ejercicio, fecha_inicio, fecha_fin, ultimo_numero, estado)
VALUES (2026, '2026-01-01', '2026-12-31', 7, 'ABIERTO')
ON CONFLICT (ejercicio) DO UPDATE SET ultimo_numero = GREATEST(ejercicio_fiscal.ultimo_numero, 7);

DO $$
DECLARE
    v1 UUID; v2 UUID; v3 UUID; v4 UUID; v5 UUID; v6 UUID; v7 UUID;
BEGIN
    -- Evitar duplicados si ya existen partidas
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

    -- Partida 5: Venta de mercaderías con IVA débito fiscal (Método Analítico: abono a Ventas)
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
    VALUES (2026, 7, '2026-01-20', 'Pago de servicios contables y gastos administrativos con cheque.', 'OPERACION', 'APLICADO') 
    RETURNING id INTO v7;
    INSERT INTO asiento_linea (asiento_id, linea_numero, cuenta_codigo, debe, haber) VALUES
    (v7, 1, '4201', 800.00, 0.00),
    (v7, 2, '1102', 0.00, 800.00);

    -- Trazabilidad inicial en asiento_historial
    INSERT INTO asiento_historial (asiento_id, accion, ejercicio, numero, concepto, total_debe, total_haber, motivo)
    SELECT a.id, 'CREACION', a.ejercicio, a.numero, a.concepto, SUM(al.debe), SUM(al.haber), 'Partida inicial cargada bajo el Método Analítico'
    FROM asiento a
    JOIN asiento_linea al ON a.id = al.asiento_id
    WHERE a.ejercicio = 2026
    GROUP BY a.id, a.ejercicio, a.numero, a.concepto;

    -- Registrar la toma física oficial de inventario final para 2026 ($6,500.00)
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
END $$;

-- =============================================================================
-- 15. CICLO DE VIDA DE FOLIOS DIARIOS OPERATIVOS (folio_diario)
-- =============================================================================

CREATE TABLE IF NOT EXISTS folio_diario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ejercicio INT NOT NULL,
    numero_folio INT NOT NULL,
    fecha DATE NOT NULL UNIQUE,
    estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTO' CHECK (estado IN ('ABIERTO', 'CERRADO')),
    total_debe NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (total_debe >= 0),
    total_haber NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (total_haber >= 0),
    cerrado_en TIMESTAMPTZ NULL,
    cerrado_por VARCHAR(100) NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_folio_ejercicio_numero UNIQUE (ejercicio, numero_folio)
);

ALTER TABLE asiento ADD COLUMN IF NOT EXISTS folio_diario_id UUID REFERENCES folio_diario(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_asiento_folio_diario_id ON asiento(folio_diario_id);

-- Columna atómica de folios en ejercicio_fiscal
ALTER TABLE ejercicio_fiscal ADD COLUMN IF NOT EXISTS ultimo_folio INT NOT NULL DEFAULT 0;

-- 2. FUNCIÓN ATÓMICA Y SEGURA PARA CORRELATIVOS DE FOLIO (SIN CONDICIÓN DE CARRERA)
CREATE OR REPLACE FUNCTION fn_proximo_numero_folio(p_ejercicio INT)
RETURNS INT AS $$
DECLARE
    v_proximo INT;
BEGIN
    UPDATE ejercicio_fiscal
    SET ultimo_folio = ultimo_folio + 1
    WHERE ejercicio = p_ejercicio AND estado = 'ABIERTO'
    RETURNING ultimo_folio INTO v_proximo;

    IF FOUND THEN
        RETURN v_proximo;
    END IF;

    INSERT INTO ejercicio_fiscal (ejercicio, fecha_inicio, fecha_fin, ultimo_numero, ultimo_folio, estado)
    VALUES (
        p_ejercicio,
        MAKE_DATE(p_ejercicio, 1, 1),
        MAKE_DATE(p_ejercicio, 12, 31),
        0,
        1,
        'ABIERTO'
    )
    ON CONFLICT (ejercicio) DO UPDATE
    SET ultimo_folio = ejercicio_fiscal.ultimo_folio + 1
    WHERE ejercicio_fiscal.estado = 'ABIERTO'
    RETURNING ultimo_folio INTO v_proximo;

    RETURN v_proximo;
END;
$$ LANGUAGE plpgsql;

-- 3. BITÁCORA DE AUDITORÍA DE FOLIOS
CREATE TABLE IF NOT EXISTS folio_historial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio_id UUID NOT NULL REFERENCES folio_diario(id) ON DELETE RESTRICT,
    accion VARCHAR(20) NOT NULL CHECK (accion IN ('APERTURA', 'CIERRE', 'REAPERTURA', 'AJUSTE')),
    usuario VARCHAR(100) NOT NULL,
    rol VARCHAR(50) DEFAULT 'USUARIO',
    motivo TEXT NOT NULL,
    total_debe NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    total_haber NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_folio_historial_folio ON folio_historial(folio_id);

-- 4. PROCEDIMIENTO FORMAL DE REAPERTURA DE FOLIO DIARIO
CREATE OR REPLACE FUNCTION sp_reabrir_folio_diario(
    p_folio_id UUID,
    p_motivo TEXT,
    p_usuario VARCHAR DEFAULT 'AUDITOR_SUPERVISOR',
    p_rol VARCHAR DEFAULT 'AUDITOR'
)
RETURNS TABLE (
    folio_id UUID,
    numero_folio INT,
    fecha DATE,
    estado VARCHAR
) AS $$
#variable_conflict use_column
DECLARE
    v_folio RECORD;
BEGIN
    IF p_motivo IS NULL OR LENGTH(TRIM(p_motivo)) < 10 THEN
        RAISE EXCEPTION 'Para reabrir un Folio Diario se requiere un motivo formal de auditoría de al menos 10 caracteres.';
    END IF;

    SELECT * INTO v_folio FROM folio_diario WHERE id = p_folio_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el Folio Diario con ID %', p_folio_id;
    END IF;

    IF v_folio.estado = 'ABIERTO' THEN
        RAISE EXCEPTION 'El Folio Diario #% ya se encuentra ABIERTO.', v_folio.numero_folio;
    END IF;

    IF EXISTS (SELECT 1 FROM ejercicio_fiscal ef WHERE ef.ejercicio = v_folio.ejercicio AND ef.estado <> 'ABIERTO') THEN
        RAISE EXCEPTION 'No se puede reabrir el folio porque el ejercicio fiscal % está cerrado.', v_folio.ejercicio;
    END IF;

    UPDATE folio_diario
    SET estado = 'ABIERTO',
        cerrado_en = NULL,
        cerrado_por = NULL
    WHERE id = p_folio_id;

    INSERT INTO folio_historial (folio_id, accion, usuario, rol, motivo, total_debe, total_haber)
    VALUES (p_folio_id, 'REAPERTURA', p_usuario, p_rol, p_motivo, v_folio.total_debe, v_folio.total_haber);

    RETURN QUERY
    SELECT v_folio.id, v_folio.numero_folio, v_folio.fecha, 'ABIERTO'::VARCHAR;
END;
$$ LANGUAGE plpgsql;

-- 5. BLINDAJE CONTRA EL BYPASS DE FOLIOS CERRADOS EN ASIENTOS
CREATE OR REPLACE FUNCTION fn_bloquear_modificacion_folio_cerrado()
RETURNS TRIGGER AS $$
DECLARE
    v_estado VARCHAR(20);
    v_folio_id UUID;
    v_fecha DATE;
BEGIN
    IF TG_TABLE_NAME = 'asiento' THEN
        v_folio_id := COALESCE(NEW.folio_diario_id, OLD.folio_diario_id);
        v_fecha := COALESCE(NEW.fecha, OLD.fecha);

        -- Bloqueo contra bypass: Si el asiento no tiene folio_diario_id, verificar si la fecha ya tiene folio cerrado
        IF v_folio_id IS NULL AND v_fecha IS NOT NULL THEN
            SELECT id, estado INTO v_folio_id, v_estado 
            FROM folio_diario WHERE fecha = v_fecha;
            
            IF FOUND AND v_estado = 'CERRADO' THEN
                RAISE EXCEPTION 'Operación rechazada: La fecha % corresponde al Folio Diario CERRADO %. No se permiten asientos huérfanos ni extemporáneos en fechas cerradas.', v_fecha, v_folio_id;
            END IF;
        END IF;

    ELSIF TG_TABLE_NAME = 'asiento_linea' THEN
        SELECT folio_diario_id INTO v_folio_id
        FROM asiento
        WHERE id = COALESCE(NEW.asiento_id, OLD.asiento_id);
    END IF;

    IF v_folio_id IS NOT NULL THEN
        SELECT estado INTO v_estado FROM folio_diario WHERE id = v_folio_id;
        IF v_estado = 'CERRADO' THEN
            RAISE EXCEPTION 'Operación denegada: El Folio Diario % se encuentra CERRADO y es inmutable.', v_folio_id;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bloquear_asiento_folio_cerrado ON asiento;
CREATE TRIGGER trg_bloquear_asiento_folio_cerrado
BEFORE INSERT OR UPDATE OR DELETE ON asiento
FOR EACH ROW
EXECUTE FUNCTION fn_bloquear_modificacion_folio_cerrado();

DROP TRIGGER IF EXISTS trg_bloquear_linea_folio_cerrado ON asiento_linea;
CREATE TRIGGER trg_bloquear_linea_folio_cerrado
BEFORE INSERT OR UPDATE OR DELETE ON asiento_linea
FOR EACH ROW
EXECUTE FUNCTION fn_bloquear_modificacion_folio_cerrado();

CREATE OR REPLACE FUNCTION sp_cerrar_folio_diario(p_folio_id UUID, p_usuario VARCHAR DEFAULT 'AUDITOR')
RETURNS TABLE (
    folio_id UUID,
    numero_folio INT,
    fecha DATE,
    total_debe NUMERIC(14,2),
    total_haber NUMERIC(14,2),
    partidas_cerradas INT
) AS $$
DECLARE
    v_folio RECORD;
    v_totales RECORD;
    v_asientos_descuadrados INT;
    v_cantidad_partidas INT;
BEGIN
    SELECT * INTO v_folio FROM folio_diario WHERE id = p_folio_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el Folio Diario con ID %', p_folio_id;
    END IF;

    IF v_folio.estado = 'CERRADO' THEN
        RAISE EXCEPTION 'El Folio Diario #% ya fue cerrado previamente el %.', v_folio.numero_folio, v_folio.cerrado_en;
    END IF;

    SELECT COUNT(*) INTO v_cantidad_partidas FROM asiento WHERE folio_diario_id = p_folio_id AND estado != 'ANULADO';
    IF v_cantidad_partidas = 0 THEN
        RAISE EXCEPTION 'No se puede cerrar un Folio Diario sin partidas activas registradas.';
    END IF;

    SELECT COUNT(*) INTO v_asientos_descuadrados
    FROM (
        SELECT a.id,
               ROUND(COALESCE(SUM(al.debe), 0), 2) AS sum_debe,
               ROUND(COALESCE(SUM(al.haber), 0), 2) AS sum_haber
        FROM asiento a
        JOIN asiento_linea al ON al.asiento_id = a.id
        WHERE a.folio_diario_id = p_folio_id AND a.estado != 'ANULADO'
        GROUP BY a.id
        HAVING ROUND(COALESCE(SUM(al.debe), 0), 2) != ROUND(COALESCE(SUM(al.haber), 0), 2)
           OR ROUND(COALESCE(SUM(al.debe), 0), 2) = 0
    ) descuadres;

    IF v_asientos_descuadrados > 0 THEN
        RAISE EXCEPTION 'El folio contiene % asiento(s) con descuadre en partida doble o importes en cero.', v_asientos_descuadrados;
    END IF;

    SELECT
        ROUND(COALESCE(SUM(al.debe), 0), 2) AS total_debe,
        ROUND(COALESCE(SUM(al.haber), 0), 2) AS total_haber
    INTO v_totales
    FROM asiento a
    JOIN asiento_linea al ON al.asiento_id = a.id
    WHERE a.folio_diario_id = p_folio_id AND a.estado != 'ANULADO';

    IF v_totales.total_debe != v_totales.total_haber THEN
        RAISE EXCEPTION 'Descuadre global en Folio: Débitos (%) != Créditos (%)', v_totales.total_debe, v_totales.total_haber;
    END IF;

    UPDATE folio_diario
    SET estado = 'CERRADO',
        total_debe = v_totales.total_debe,
        total_haber = v_totales.total_haber,
        cerrado_en = CURRENT_TIMESTAMP,
        cerrado_por = COALESCE(p_usuario, 'AUDITOR')
    WHERE id = p_folio_id;

    UPDATE asiento
    SET estado = 'APLICADO'
    WHERE folio_diario_id = p_folio_id AND estado = 'BORRADOR';

    RETURN QUERY
    SELECT
        p_folio_id,
        v_folio.numero_folio,
        v_folio.fecha,
        v_totales.total_debe,
        v_totales.total_haber,
        v_cantidad_partidas;
END;
$$ LANGUAGE plpgsql;

