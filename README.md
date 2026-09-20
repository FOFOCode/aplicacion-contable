# Sistema de Gestión y Módulo Contable Automatizado

> **Universidad Católica de El Salvador (UNICAES)**  
> **Actividad:** Ciclo Contable Automático con Partida Doble y Estados Financieros  
> **Rama de desarrollo:** `harry`  
> **Tecnologías:** Next.js 16 (Turbopack, App Router), React 19, Tailwind CSS v4, TypeScript, PostgreSQL 14+

---

## 1. Descripción del Proyecto

Sistema integral para la automatización del ciclo contable, desarrollado para procesar transacciones financieras garantizando el principio universal de la **Partida Doble**, consolidando en tiempo real el **Libro Mayor** y generando de manera dinámica los **Estados Financieros** a partir de la codificación y naturaleza de cada cuenta contable.

### Características Principales:
1. **Libro Diario (Registro de Asientos):**
   - Formulario transaccional dinámico con soporte de múltiples cargos (Debe) y abonos (Haber).
   - **Validación obligatoria de Partida Doble:** El sistema bloquea el registro si $\sum \text{Debe} \neq \sum \text{Haber}$, si hay importes negativos, o si se intenta registrar una cuenta con Debe y Haber simultáneamente.
2. **Mayorización Automática en Tiempo Real (Libro Mayor):**
   - Consolidación instantánea de débitos y créditos por cada cuenta del catálogo sin cálculos manuales.
   - Determinación automática del saldo neto y su naturaleza (**Deudor** o **Acreedor**).
   - Generación automática del **Balance de Comprobación** cuadrado.
3. **Estados Financieros Dinámicos:**
   - **Balance General:** Agrupación automática por código `1` (Activo) = `2` (Pasivo) + `3` (Capital contable) + Utilidad del Ejercicio, con indicador visual de cuadratura patrimonial.
   - **Estado de Resultados en Cascada:**
     - Ingresos por ventas (Código `51`)
     - Costo de ventas (Código `41`) $\rightarrow$ *Utilidad Bruta*
     - Gastos de operación (Código `42`) $\rightarrow$ *Utilidad de Operación*
     - Resultados financieros (Códigos `52` y `43`) $\rightarrow$ *Utilidad Neta del Ejercicio*
4. **Catálogo de Cuentas Configurable:**
   - Codificación jerárquica con reglas contables validadas por dígito inicial.
   - Regla de negocio de *Soft Delete*: Si una cuenta posee movimientos históricos registrados en el diario, el sistema bloquea su eliminación física y permite marcarla como inactiva para preservar la trazabilidad.
5. **Cierre de Ejercicio Contable:**
   - Función para liquidar las cuentas nominales de resultado y trasladar la utilidad o pérdida a las cuentas de capital.
   - Exportación de reportes financieros a **PDF** listos para impresión.

---

## 2. Requisitos del Sistema

- **Node.js:** Versión 18.18+ (recomendado Node.js 20 LTS o 24)
- **Gestor de paquetes:** `pnpm` versión 9+ / 12+ (o `npm` / `yarn`)
- **Base de Datos (opcional / producción):** PostgreSQL 14 o superior

---

## 3. Instalación y Puesta en Marcha

### Paso 1: Clonar o ingresar al repositorio
```bash
git clone <URL_DEL_REPOSITORIO>
cd aplicacion-contable
git checkout harry
```

### Paso 2: Instalar dependencias
```bash
pnpm install
```
*(Si utilizas pnpm v12 en entornos estrictos, puedes ejecutar: `pnpm install --dangerously-allow-all-builds`)*

### Paso 3: Ejecutar en entorno de desarrollo
```bash
pnpm dev
```
La aplicación estará disponible de inmediato en [http://localhost:3000](http://localhost:3000).

### Paso 4: Construir para producción y verificar tipos
```bash
pnpm run build
pnpm start
```

### Alternativa: Levantar todo con Docker (Recomendado)
Para iniciar la base de datos PostgreSQL 16 y la aplicación web compilada con un solo comando:

```bash
docker compose up -d --build
```
- **Aplicación web:** Disponible en [http://localhost:3000](http://localhost:3000)
- **Base de datos PostgreSQL:** Puerto `5432` (Base de datos: `contabilidad`, Usuario: `postgres`, Contraseña: `postgrespassword`)
- **Inicialización automática:** Carga automáticamente `schema.sql` y `data.sql` al iniciar por primera vez.

Para detener los contenedores:
```bash
docker compose down
```

---

## 4. Base de Datos Relacional (SQL)

El proyecto incluye los scripts SQL estándar de nivel de producción en la raíz del repositorio:

| Archivo | Descripción |
| :--- | :--- |
| [`schema.sql`](./schema.sql) | Esquema DDL para PostgreSQL con restricciones de integridad, `CHECK` de exclusividad Debe/Haber, vistas del Libro Mayor, Balance de Comprobación, Estado de Resultados, Balance General y función no destructiva de cierre de ejercicio (`sp_cerrar_ciclo_contable`). |
| [`data.sql`](./data.sql) | Catálogo oficial de 21 cuentas contables base y las partidas de apertura y operaciones de ejemplo. |
| [`SCRIPT_BD.md`](./SCRIPT_BD.md) | Documentación técnica profunda de la base de datos, diagrama Entidad-Relación (Mermaid) y justificación de arquitectura. |

---

## 5. Tabla de Roles y Matriz de Accesos

| Módulo / Ruta | Rol Contador | Rol Auxiliar Contable | Rol Auditor / Gerencia |
| :--- | :---: | :---: | :---: |
| **Panel Principal (`/`)** | Lectura / Métricas | Lectura / Métricas | Lectura / Métricas |
| **Libro Diario (`/libro-diario`)** | Registro / Edición / Eliminación | Registro de Asientos | Solo Lectura |
| **Libro Mayor (`/libro-mayor`)** | Consulta / Verificación | Consulta | Consulta / Auditoría |
| **Estados Financieros (`/estados-financieros`)** | Cierre de Ciclo / Exportar PDF | Consulta / Exportar PDF | Consulta / Exportar PDF |
| **Catálogo de Cuentas (`/catalogo`)** | Crear / Modificar / Desactivar | Consulta | Solo Lectura |

---

## 6. Estructura del Proyecto

```text
aplicacion-contable/
├── app/                            # Rutas principales (Next.js App Router)
│   ├── catalogo/                   # Gestión del Catálogo de Cuentas
│   ├── estados-financieros/        # Balance General y Estado de Resultados
│   ├── libro-diario/               # Registro y listado de partidas contables
│   ├── libro-mayor/                # Mayorización y Balance de Comprobación
│   ├── layout.tsx                  # Envoltura global y AppShell
│   └── page.tsx                    # Dashboard principal con métricas y alertas
├── components/                     # Componentes modulares de interfaz de usuario
│   ├── ui/                         # Componentes base (Badge, Button, Card, Field)
│   ├── app-shell.tsx               # Barra de navegación lateral y encabezado
│   ├── asiento-form.tsx            # Formulario de captura y validación de asientos
│   └── contabilidad-provider.tsx   # Contexto global y lógica de cálculo contable
├── lib/                            # Lógica de dominio contable y utilidades
│   ├── catalogo.ts                 # Catálogo predeterminado de cuentas
│   ├── contabilidad.ts             # Cálculos de mayorización, partida doble y estados
│   ├── types.ts                    # Definiciones TypeScript de entidades contables
│   └── utils.ts                    # Helpers de formato y estilos
├── data.sql                        # Script de inicialización y catálogo de cuentas (SQL)
├── schema.sql                      # Esquema DDL con vistas y funciones (SQL)
├── SCRIPT_BD.md                    # Documentación y justificación técnica de la BD
└── README.md                       # Manual de instalación y documentación de entrega
```

---

## 7. Control de Versiones e Historial Git

- **Rama principal de trabajo:** `harry`
- **Flujo de trabajo sugerido:**
  ```bash
  # Verificar estado y rama actual
  git status
  git branch

  # Crear o confirmar cambios en la rama harry
  git checkout -b harry
  git add .
  git commit -m "feat: modulo contable completado con partida doble, estados financieros y scripts sql"
  git push origin harry
  ```
