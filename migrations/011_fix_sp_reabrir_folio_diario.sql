-- =============================================================================
-- MIGRACIÓN 011: Corrección de ambigüedad en columna 'estado' al reabrir folios
-- =============================================================================

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
