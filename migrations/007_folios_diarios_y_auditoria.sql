-- =============================================================================
-- MIGRACIÓN 005: CICLO DE VIDA DE FOLIOS DIARIOS, INMUTABILIDAD Y AUDITORÍA
-- =============================================================================

BEGIN;

-- 1. Columna documento_soporte en asiento
ALTER TABLE asiento ADD COLUMN IF NOT EXISTS documento_soporte VARCHAR(100);

-- 2. Función de inmutabilidad contable con bypass técnico para edición de líneas en sesión
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

-- 3. Tabla folio_diario
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

-- 4. Columna folio_diario_id en asiento
ALTER TABLE asiento ADD COLUMN IF NOT EXISTS folio_diario_id UUID REFERENCES folio_diario(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_asiento_folio_diario_id ON asiento(folio_diario_id);

-- 5. Columna ultimo_folio en ejercicio_fiscal
ALTER TABLE ejercicio_fiscal ADD COLUMN IF NOT EXISTS ultimo_folio INT NOT NULL DEFAULT 0;

-- 6. Función atómica para próximo correlativo de folios
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

-- 7. Bitácora de auditoría de folios
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

-- 8. Procedimiento formal de reapertura de folio diario
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

-- 9. Procedimiento formal de cierre de folio diario
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

-- 10. Función y triggers de protección contra modificación de folios cerrados
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

COMMIT;
