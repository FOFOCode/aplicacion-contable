-- Jerarquía compatible: conserva códigos y asientos existentes.
ALTER TABLE catalogo_cuentas
  ADD COLUMN IF NOT EXISTS padre_codigo VARCHAR(20);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_catalogo_cuenta_padre'
  ) THEN
    ALTER TABLE catalogo_cuentas
      ADD CONSTRAINT fk_catalogo_cuenta_padre
      FOREIGN KEY (padre_codigo) REFERENCES catalogo_cuentas(codigo)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_catalogo_padre ON catalogo_cuentas(padre_codigo);

INSERT INTO catalogo_cuentas (codigo, nombre, tipo, naturaleza, padre_codigo, permite_movimiento, activa)
VALUES
  ('1100', 'Efectivo y equivalentes', 'activo', 'deudora', NULL, FALSE, TRUE),
  ('1200', 'Propiedad, planta y equipo', 'activo', 'deudora', NULL, FALSE, TRUE),
  ('2100', 'Pasivo corriente', 'pasivo', 'acreedora', NULL, FALSE, TRUE),
  ('2200', 'Pasivo no corriente', 'pasivo', 'acreedora', NULL, FALSE, TRUE),
  ('3100', 'Capital contable', 'capital', 'acreedora', NULL, FALSE, TRUE),
  ('4100', 'Costos y gastos analíticos', 'gasto', 'deudora', NULL, FALSE, TRUE),
  ('4200', 'Gastos de operación', 'gasto', 'deudora', NULL, FALSE, TRUE),
  ('4300', 'Gastos financieros', 'gasto', 'deudora', NULL, FALSE, TRUE),
  ('5100', 'Ingresos de operación', 'ingreso', 'acreedora', NULL, FALSE, TRUE),
  ('5200', 'Ingresos financieros', 'ingreso', 'acreedora', NULL, FALSE, TRUE)
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

UPDATE catalogo_cuentas
SET permite_movimiento = FALSE
WHERE codigo IN ('1100', '1200', '2100', '2200', '3100', '4100', '4200', '4300', '5100', '5200');