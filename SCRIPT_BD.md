# Arquitectura de Base de Datos y Manual Contable (PostgreSQL 14+)

> **Sistema Contable Automatizado — Grado Producción**  
> **Motor:** PostgreSQL 14+ (Soporte nativo para Docker, Supabase, Neon, AWS RDS)  
> **Paradigma Contable:** Partida Doble Rigurosa & Método Analítico (Pormenorizado)  
> **Enfoque de Auditoría:** Inmutabilidad Contable Absoluta (DELETE Prohibido, Trazabilidad 100%)

---

## 1. Fundamentos Contables y Decisiones de Arquitectura

### 1.1. Principios del Método Analítico o Pormenorizado
A diferencia del método de Inventarios Perpetuos, el **Método Analítico** no utiliza la cuenta *"Costo de Ventas"* en los asientos rutinarios ni actualiza la cuenta *"Inventario"* con cada compra o venta del ejercicio:
1. **Cuenta `1104 Inventario de mercadería`:** Registra exclusivamente el saldo del **Inventario Inicial** y permanece estática durante todo el período operativo.
2. **Adquisiciones:** Se registran al costo directo en `4101 Compras` y los costos incidentales (fletes, seguros, aduanas) en `4102 Gastos sobre compras`.
3. **Ventas:** Se registran al precio pactado con clientes en `5101 Ventas` (sin asiento simultáneo de costo de lo vendido).
4. **Cuentas Analíticas Complementarias:**
   - `4103 Devoluciones sobre ventas` y `4104 Rebajas sobre ventas`: Cuentas complementarias de ingresos con naturaleza **DEUDORA** (clasificadas contablemente en el grupo de resultados para reflejar deducciones a los ingresos brutos).
   - `5102 Devoluciones sobre compras` y `5103 Rebajas sobre compras`: Cuentas complementarias de compras con naturaleza **ACREEDORA**. Se clasifican como cuentas de **costo/gasto** (correctoras de compras) para no inflar artificialmente los ingresos brutos operacionales.
5. **Determinación del Costo de Ventas:** Al término del período, el Costo de Ventas se obtiene de forma analítica incorporando el **Inventario Final** obtenido de la toma física real (`inventario_toma_fisica`):
   $$\text{Ventas Netas} = \text{Ventas Totales} - \text{Devoluciones s/Ventas} - \text{Rebajas s/Ventas}$$
   $$\text{Compras Totales} = \text{Compras} + \text{Gastos sobre Compras}$$
   $$\text{Compras Netas} = \text{Compras Totales} - \text{Devoluciones s/Compras} - \text{Rebajas s/Compras}$$
   $$\text{Total Mercancías Disponibles} = \text{Inventario Inicial} + \text{Compras Netas}$$
   $$\text{Costo de Ventas} = \text{Total Mercancías Disponibles} - \text{Inventario Final}$$
   $$\text{Utilidad Bruta} = \text{Ventas Netas} - \text{Costo de Ventas}$$
   $$\text{Utilidad de Operación} = \text{Utilidad Bruta} - \text{Gastos de Operación}$$
   $$\text{Utilidad Neta} = \text{Utilidad de Operación} \pm \text{Resultados Financieros y Otros}$$

---

### 1.2. Integridad DDL y Mitigación de Condiciones de Carrera
1. **Control Atómico de Correlativos (`ejercicio_fiscal`):**
   - Para evitar bloqueos globales o números duplicados cuando múltiples usuarios registran asientos simultáneamente, el correlativo anual se gestiona atómicamente mediante `UPDATE ... RETURNING` o secuencias parametrizadas en la tabla `ejercicio_fiscal`.
   - Se asegura que cada año fiscal reinicie su numeración en `1..N` y conserve la unicidad mediante `UNIQUE(ejercicio, numero)`.
2. **Trigger Diferido de Partida Doble (`DEFERRABLE INITIALLY DEFERRED`):**
   - Garantiza que toda transacción contable cumpla con $\sum Debe = \sum Haber$ con precisión de centavos y contenga al menos 2 líneas de movimiento.
   - Al ser diferido, se evalúa estrictamente al momento del `COMMIT`, permitiendo a los ORMs o clientes API insertar renglones secuencialmente sin abortos prematuros.
3. **Inmutabilidad y Auditoría (DELETE Prohibido):**
   - Ningún usuario ni proceso puede ejecutar `DELETE` sobre asientos, líneas, históricos o cierres. Los triggers `BEFORE DELETE` abortan cualquier intento de borrado físico.
   - Las correcciones se canalizan mediante `sp_anular_asiento`, dejando intacta la traza con marca temporal y motivo en `asiento_historial`.
4. **Vistas Particionadas por Ejercicio Fiscal:**
   - Todas las vistas contables agrupan y filtran por `ejercicio`, garantizando aislamiento temporal estricto.
   - `vista_libro_mayor` excluye las partidas con `tipo = 'CIERRE'` y `estado = 'ANULADO'` para no distorsionar el historial de movimientos operativos del ejercicio.

---

## 2. Diagrama Entidad-Relación (ERD)

```mermaid
erDiagram
    EJERCICIO_FISCAL ||--o{ ASIENTO : "agrupa"
    EJERCICIO_FISCAL ||--o| INVENTARIO_TOMA_FISICA : "registra toma de"
    EJERCICIO_FISCAL ||--o| CIERRE_CONTABLE : "liquida"
    CATALOGO_CUENTAS ||--o{ ASIENTO_LINEA : "se imputa en"
    ASIENTO ||--|{ ASIENTO_LINEA : "se compone de (RESTRICT)"
    ASIENTO ||--o{ ASIENTO_HISTORIAL : "audita cambios"
    ASIENTO ||--o| CIERRE_CONTABLE : "genera partida de cierre"
    CATALOGO_CUENTAS ||--o{ CIERRE_CONTABLE : "absorbe utilidad en"

    CATALOGO_CUENTAS {
        varchar codigo PK "Código contable (1101, 4101, etc.)"
        varchar nombre "Nombre oficial de la cuenta"
        varchar tipo "activo, pasivo, capital, gasto, ingreso"
        varchar naturaleza "deudora, acreedora"
        boolean permite_movimiento "Falso si es de título/acumulación"
        boolean activa "Soft delete"
        timestamptz creado_en
    }

    EJERCICIO_FISCAL {
        int ejercicio PK "Año fiscal (2026, 2027...)"
        date fecha_inicio "Inicio del período"
        date fecha_fin "Fin del período"
        int ultimo_numero "Último correlativo emitido"
        varchar estado "ABIERTO, CERRADO, BLOQUEADO"
        timestamptz cerrado_en
    }

    ASIENTO {
        uuid id PK
        int correlativo_global UK "Correlativo fiscal único perpetuo"
        int ejercicio FK "Año fiscal"
        int numero "Número consecutivo anual (#1..N)"
        date fecha
        text concepto "Glosa descriptiva"
        varchar tipo "APERTURA, OPERACION, AJUSTE, CIERRE"
        varchar estado "APLICADO, ANULADO"
        timestamptz anulado_en
        text motivo_anulacion
        timestamptz creado_en
    }

    ASIENTO_LINEA {
        uuid id PK
        uuid asiento_id FK "ON DELETE RESTRICT"
        int linea_numero "Renglón (#1..N)"
        varchar cuenta_codigo FK "ON DELETE RESTRICT"
        numeric debe ">= 0"
        numeric haber ">= 0"
    }

    INVENTARIO_TOMA_FISICA {
        uuid id PK
        int ejercicio FK UK "Año fiscal asociado"
        date fecha_toma "Fecha del levantamiento físico"
        numeric valor_inventario_final "Valuación real de existencias"
        varchar responsable "Auditor / Encargado"
        text observaciones
    }

    CIERRE_CONTABLE {
        uuid id PK
        int ejercicio FK UK "Año fiscal liquidado"
        date fecha_cierre
        numeric total_ingresos
        numeric total_gastos
        numeric utilidad
        varchar cuenta_capital_codigo FK
        uuid asiento_cierre_id FK
    }

    ASIENTO_HISTORIAL {
        uuid id PK
        uuid asiento_id FK
        varchar accion "CREACION, MODIFICACION, ANULACION, CIERRE"
        int ejercicio
        int numero
        numeric total_debe
        numeric total_haber
        text motivo
        timestamptz creado_en
    }
```

---

## 3. Matriz de Vistas del Ciclo Contable

| Vista SQL | Propósito Contable | Criterio de Agrupación / Filtro |
| :--- | :--- | :--- |
| `vista_libro_diario` | Registro cronológico oficial de todas las partidas. | Particionado por `ejercicio`, ordenado por `numero` y `linea_numero`. Muestra estado y motivos de anulación. |
| `vista_libro_mayor` | Saldos acumulados por cuenta. | Agrupado por `ejercicio` y `cuenta_codigo`. Excluye partidas con `estado = 'ANULADO'` y partidas `tipo = 'CIERRE'`. |
| `vista_balance_comprobacion` | Comprobación de sumas y saldos deudores y acreedores. | Particionado por `ejercicio`. Verifica que $\sum Debe = \sum Haber$ y $\sum Saldo\ Deudor = \sum Saldo\ Acreedor$. |
| `vista_estado_resultados_analitico` | Estado de Resultados por el Método Analítico en cascada. | Particionado por `ejercicio`. Cruza compras, gastos s/compras, devoluciones y la toma física de inventario final. |
| `vista_balance_general` | Ecuación patrimonial fundamental ($A = P + C + U$). | Agrupado por `ejercicio`. Verifica que la diferencia patrimonial sea cero ($0.00$) con indicador booleano `cuadra`. |
