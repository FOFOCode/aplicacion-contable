-- =============================================================================
-- MIGRACIÓN 006: MÓDULO DE USUARIOS, CONTRASEÑA Y ROLES (SOLO CONTADOR)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABLA: USUARIOS DEL SISTEMA CONTABLE
CREATE TABLE IF NOT EXISTS usuario (
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

CREATE INDEX IF NOT EXISTS idx_usuario_email ON usuario(email);
CREATE INDEX IF NOT EXISTS idx_usuario_tipo ON usuario(tipo);
CREATE INDEX IF NOT EXISTS idx_usuario_activo ON usuario(activo);

-- 2. RELACIONAR ASIENTO Y AUDITORÍA CON USUARIO (OPCIONAL / NULLABLE)
ALTER TABLE asiento 
ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuario(id) ON DELETE SET NULL;

ALTER TABLE asiento_historial 
ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuario(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_asiento_usuario ON asiento(usuario_id);
CREATE INDEX IF NOT EXISTS idx_historial_usuario ON asiento_historial(usuario_id);

-- 3. FUNCIONES DE SEGURIDAD Y AUTENTICACIÓN

-- Registrar nuevo usuario con contraseña cifrada (bcrypt / blowfish)
CREATE OR REPLACE FUNCTION sp_registrar_usuario(
    p_nombre TEXT,
    p_email TEXT,
    p_password TEXT,
    p_tipo VARCHAR(50) DEFAULT 'contador'
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
    v_email_limpio TEXT;
BEGIN
    v_email_limpio := LOWER(TRIM(p_email));

    IF v_email_limpio !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'El correo electrónico % no tiene un formato válido.', p_email;
    END IF;

    IF LENGTH(p_password) < 6 THEN
        RAISE EXCEPTION 'La contraseña debe tener un mínimo de 6 caracteres.';
    END IF;

    INSERT INTO usuario (nombre, email, password_hash, tipo)
    VALUES (
        TRIM(p_nombre),
        v_email_limpio,
        crypt(p_password, gen_salt('bf', 10)),
        p_tipo
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Autenticar usuario por credenciales
CREATE OR REPLACE FUNCTION fn_autenticar_usuario(
    p_email TEXT,
    p_password TEXT
)
RETURNS TABLE (
    id UUID,
    nombre VARCHAR(150),
    email VARCHAR(150),
    tipo VARCHAR(50),
    activo BOOLEAN
) AS $$
BEGIN
    -- Actualizar timestamp de último acceso si las credenciales son válidas
    UPDATE usuario u
    SET ultimo_acceso = CURRENT_TIMESTAMP
    WHERE u.email = LOWER(TRIM(p_email))
      AND u.activo = TRUE
      AND u.password_hash = crypt(p_password, u.password_hash);

    RETURN QUERY
    SELECT u.id, u.nombre, u.email, u.tipo, u.activo
    FROM usuario u
    WHERE u.email = LOWER(TRIM(p_email))
      AND u.activo = TRUE
      AND u.password_hash = crypt(p_password, u.password_hash);
END;
$$ LANGUAGE plpgsql;

-- 4. INSERTAR USUARIOS CONTADOR INICIALES / DEMO
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM usuario WHERE email = 'contador@contable.sv') THEN
        PERFORM sp_registrar_usuario(
            'Contador General',
            'contador@contable.sv',
            'Contador2026!',
            'contador'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM usuario WHERE email = 'finexa@contable.sv') THEN
        PERFORM sp_registrar_usuario(
            'Usuario Finexa',
            'finexa@contable.sv',
            'finexa123',
            'contador'
        );
    END IF;
END $$;

