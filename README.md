# Finexa — Sistema Contable en la Nube

> Aplicación web contable moderna, rápida y accesible desde cualquier navegador. Diseñada con foliación legal, partida doble estricta, método analítico de inventarios, Kardex permanente y Estados Financieros automáticos.

---

## 1. Guía de Acceso (Sin Instalación)

**Finexa es una aplicación 100% en la nube; no requiere instalar ningún software, ejecutable ni archivo en tu computadora.**

### Requisitos Mínimos:
- **Conexión a Internet** estable.
- **Navegador web moderno**: Google Chrome, Microsoft Edge, Safari, Mozilla Firefox, Opera o Brave.
- **Dispositivo**: Funciona en computadoras de escritorio, laptops y tablets sin configuraciones previas.

### Pasos para Ingresar:
1. Abre tu navegador web habitual.
2. Ingresa a la dirección del sistema:
   - **Enlace de Producción (Vercel)**: `https://<tu-proyecto>.vercel.app`
   - *(Entorno local de desarrollo: `http://localhost:3000`)*
3. Inicia sesión haciendo clic en el icono de usuario (arriba a la derecha) con tus credenciales asignadas.

---

## 2. Accesos y Credenciales

### Credenciales de Acceso al Sistema:

| Rol / Cargo | Correo Electrónico | Contraseña | Módulos Disponibles |
| :--- | :--- | :--- | :--- |
| **Contador General** | `contador@contable.sv` | `Contador2026!` | Libro Diario, Cierre de Folios, Asientos de Ajuste, Mayor, Balances |
| **Operador / Finexa** | `finexa@contable.sv` | `finexa123` | Captura de Comprobantes, Kardex de Almacén, Consultas y Reportes |

---

## 3. Manual de Usuario (Paso a Paso)

A continuación se detalla cómo operar cada uno de los módulos principales del sistema:

### 3.1. Libro Diario (Registro de Pólizas Contables)
El Libro Diario registra todas las operaciones económicas del día garantizando la partida doble y la foliación legal inmutable.

1. **Iniciar la Jornada Contable**:
   - Selecciona la fecha en el selector superior.
   - Si el día no ha iniciado, haz clic en **"Iniciar Folio Diario"**.
2. **Registrar una Nueva Partida**:
   - Pulsa el botón **"+ Agregar Partida"**.
   - Escribe el **Concepto o Glosa** (ej: *"Venta de mercaderías según Factura #045"*) y el **Documento de Soporte** opcional.
   - Agrega las cuentas contables:
     - **Modo SMART**: Infiere automáticamente el IVA y cargos/abonos según la naturaleza de la cuenta.
     - **Modo Clásico**: Permite escribir directamente los importes en las columnas **Debe** y **Haber**.
   - Si te falta cuadrar un importe, pulsa **"Auto-cuadrar"** para calcular la diferencia automáticamente.
   - Pulsa **"Guardar en Folio"**.
3. **Corregir o Modificar una Partida Errónea (Principio de Inmutabilidad)**:
   - Los registros contables asentados no se eliminan arbitrariamente para cumplir con las normas de auditoría.
   - Haz clic en el icono del **lápiz (`✏️`)** en la partida que deseas corregir.
   - Se abrirá el modal de **Asiento de Ajuste Contable**: escribe una **Nota de Justificación** (mínimo 5 caracteres) explicando el motivo del ajuste.
   - Se abrirá el comprobante precargado: modifica los importes o cuentas correspondientes y pulsa **"Guardar Asiento de Ajuste"**.
   - **Resultado**: El sistema generará el nuevo asiento de ajuste y marcará la partida original previa como `AJUSTADO` (tachada), asegurando que **solo el nuevo asiento de ajuste sume en los totales del día**.
4. **Anular una Partida**:
   - Haz clic en el icono de **basura (`🗑️`)** en la partida.
   - Ingresa el motivo formal de la anulación contable. La partida quedará marcada como `ANULADO` con saldo neutro.
5. **Cerrar y Foliar el Día**:
   - Al finalizar la jornada y verificar que la diferencia esté en `$0.00`, pulsa **"Cerrar y Foliar Jornada"**.
   - El folio quedará sellado con número correlativo legal. Solo un **Auditor** podrá solicitar una reapertura formal.

---

### 3.2. Libro Mayor (Cuentas T y Balances)
Permite visualizar la acumulación de débitos, créditos y saldos netos por cada cuenta contable:

1. **Navegación de Cuentas T**:
   - Explora las tarjetas en formato de Cuenta T: la columna izquierda muestra los **Cargos (Debe)** y la derecha los **Abonos (Haber)**.
   - El pie de cada tarjeta muestra el saldo final: **Deudor** (en azul) o **Acreedor** (en verde/neutral).
2. **Búsqueda Rápida de Cuentas**:
   - Usa la barra de búsqueda o presiona la tecla de búsqueda rápida para abrir el buscador Spotlight y localizar cualquier cuenta por código o nombre.
3. **Verificación de Cuadre**:
   - En la parte superior encontrarás el indicador de **Estado de Balance** (`Total Débitos = Total Créditos`), garantizando que el mayor esté 100% equilibrado.

---

### 3.3. Kardex de Inventario Permanente
Controla las entradas, salidas y existencias de mercadería valoradas bajo métodos contables aceptados:

1. **Método de Valuación**:
   - Selecciona en el encabezado tu método preferido: **Promedio Ponderado** o **PEPS / FIFO**.
2. **Cargar Movimientos desde Pólizas**:
   - Haz clic en **"Cargar Pólizas"**: el sistema leerá automáticamente todas las compras y ventas registradas en el Libro Diario para construir el historial del Kardex.
3. **Conciliación con Toma Física**:
   - En el recuadro superior puedes registrar el valor del inventario final físico para verificar que coincida al 100% con el saldo teórico del Kardex (*"100% Conciliado"*).

---

### 3.4. Estados Financieros
Genera en tiempo real los dos estados financieros fundamentales de la empresa:

1. **Estado de Resultados (Método Analítico)**:
   - Presenta la determinación escalonada de resultados:
     - `Ventas Netas = Ventas Totales − Devoluciones − Rebajas s/Ventas`
     - `Compras Netas = Compras + Gastos de Compra − Devoluciones − Rebajas s/Compras`
     - `Costo de Ventas = Inventario Inicial + Compras Netas − Inventario Final`
     - `Utilidad Bruta = Ventas Netas − Costo de Ventas`
     - `Utilidad de Operación = Utilidad Bruta − Gastos de Operación (Venta y Administración)`
   - Puedes usar la opción **"Ver por Cuentas"** al expandir para analizar cada subcuenta en detalle.
2. **Balance General**:
   - Estructurado en forma de reporte formal: **Activo**, **Pasivo** y **Capital Contable**.
   - Muestra la verificación automática de la ecuación contable fundamental: `Activo = Pasivo + Capital Contable`.

---

### 3.5. Exportación de Documentos (PDF y Excel)
En todas las vistas (Libro Diario, Libro Mayor, Estados Financieros, Kardex y Archivo Contable):

1. Ubica el botón unificado **"Exportar"** en la esquina superior derecha.
2. Selecciona tu formato:
   - **Imprimir / Guardar como PDF**: Genera un documento listo para impresión con membrete corporativo, líneas formales y espacios para firmas legales (Contador, Auditor y Representante Legal).
   - **Exportar a Excel (.xlsx)**: Descarga una hoja de cálculo nativa formateada con tipografía, celdas numéricas y encabezados listos para auditoría.

---

## 4. Tabla de Roles y Permisos

El sistema cuenta con control de acceso y bitácora de auditoría legal conforme a la normativa contable:

| Función / Módulo | Auxiliar / Operador | Contador Principal | Auditor Supervisor | Administrador |
| :--- | :---: | :---: | :---: | :---: |
| **Registrar Partidas (Smart / Clásico)** | ✅ Permitido | ✅ Permitido | 👁️ Solo Lectura | ✅ Permitido |
| **Modificar Partida con Ajuste Contable** | ❌ Restringido | ✅ Requiere Nota | 👁️ Fiscaliza | ✅ Permitido |
| **Cerrar y Sellar Folio Diario** | ❌ Restringido | ✅ Cierre Oficial | 👁️ Fiscaliza | ✅ Permitido |
| **Reapertura de Folios Sellados** | ❌ Prohibido | ❌ Prohibido | ✅ **Autoridad Exclusiva** | ✅ Supervisor |
| **Kardex y Toma Física de Inventario** | ✅ Registra | ✅ Concilia Cuentas | 👁️ Audita | ✅ Valida |
| **Cierre Anual del Ejercicio Fiscal** | ❌ Prohibido | ✅ Genera Cierre | 👁️ Dictamen | ✅ Aprueba |
| **Exportación de Balances (PDF / Excel)** | ✅ Permitido | ✅ Con Firma | ✅ Con Sello | ✅ Con Firma |

---

## 5. Historial Git

### Hitos de Versión:
- **v1.4.0 (Septiembre 2026)**: Corrección de cálculo de totales en ajustes y anulaciones de Libro Diario, eliminación de recargas automáticas en segundo plano, unificación de botones de exportación institucional (PDF / Excel) y mejoras en Kardex.
- **v1.3.0 (Septiembre 2026)**: Rediseño ejecutivo minimalista de Estados Financieros, vista expandible/contraíble y selector analítico por cuentas.
- **v1.2.0 (Septiembre 2026)**: Libro Mayor General con cuentas T interactivas simétricas y buscador rápido Spotlight.
- **v1.1.0 (Septiembre 2026)**: Sistema de foliación legal diaria con inmutabilidad y procedimientos transaccionales de auditoría.
- **v1.0.0 (Septiembre 2026)**: Lanzamiento base con Next.js 16, React 19, Supabase PostgreSQL y catálogo salvadoreño.

### Registro de Commits Recientes:

| Hash | Autor | Fecha | Descripción del Cambio |
| :--- | :--- | :--- | :--- |
| `de03854` | Alfredo Montoya | 2026-09-26 | `feat: nuevas vistas + solucion de bugs` — Actualización integral de vistas y corrección de flujos |
| `b054591` | Alfredo Montoya | 2026-09-26 | `feat(estados-financieros)` — Soporte de contracción/expansión y resumen ejecutivo |
| `4d33d44` | Alfredo Montoya | 2026-09-26 | `fix(libro-mayor)` — Uniformar altura simétrica de tarjetas de cuentas T expandidas |
| `0cfee60` | Damian | 2026-09-26 | `Mejoras en UI y exportación de Excel nativo (#8)` — Estilos institucionales en hojas de cálculo |
| `fa48cf8` | Diego Hernandez | 2026-09-25 | `Merge pull request #7` — Integración final del módulo de Libro Mayor |
| `629ee99` | Diegosv00 | 2026-09-25 | `Actualiza Finexa, favicon y limpieza del proyecto` |
| `38db607` | Diegosv00 | 2026-09-25 | `Mejora archivo contable, formulas Excel y validaciones` |
| `f0cb604` | Alfredo Montoya | 2026-09-25 | `Nueva interfaz en libro diario, nuevas funciones visuales + correcion de errores (#5)` |
| `a9b3955` | Rodolfo Rivas | 2026-09-24 | `Merge branch 'Rodolfo'` — Integración de Kardex analítico y folios por ejercicio |

---

## 6. Estructura Rápida de Módulos

- `/` — Panel de Control y Resumen Financiero.
- `/libro-diario` — Registro de comprobantes, foliación diaria e inmutabilidad legal.
- `/libro-mayor` — Cuentas T interactivas y balance de comprobación.
- `/estados-financieros` — Estado de Resultados (Método Analítico) y Balance General.
- `/kardex` — Control permanente de existencias y costos de mercadería.
- `/catalogo` — Catálogo general de cuentas contables.
- `/ciclos` — Cierre y apertura formal de ejercicios fiscales.
- `/archivo-contable` — Historial de auditoría y descargas centralizadas.
