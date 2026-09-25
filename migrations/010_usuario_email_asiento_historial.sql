-- =============================================================================
-- MIGRACIÓN 010: AUDITORÍA FORMAL - COLUMNA usuario_email EN asiento_historial
-- Garantiza la trazabilidad contable del usuario responsable en cada transacción
-- =============================================================================

ALTER TABLE asiento_historial 
ADD COLUMN IF NOT EXISTS usuario_email VARCHAR(150) NOT NULL DEFAULT 'admin@contable.sv';

CREATE INDEX IF NOT EXISTS idx_historial_usuario_email ON asiento_historial(usuario_email);
