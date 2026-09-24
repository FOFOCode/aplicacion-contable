/**
 * CONFIGURACIÓN DE PLANTILLAS COMERCIALES (SISTEMA ANALÍTICO)
 * 
 * Define la estructura declarativa de eventos de negocio frecuentes.
 * Cada plantilla guía al usuario solicitando solo los datos de negocio
 * y abstrayendo la imputación de la Partida Doble.
 */

export type CategoriaPlantilla = "compras" | "ventas" | "gastos" | "tesoreria" | "devoluciones"

export interface CampoParametroPlantilla {
  id: string
  label: string
  tipo: "monto" | "select" | "boolean" | "texto"
  placeholder?: string
  valorPorDefecto?: any
  opciones?: Array<{ label: string; valor: string }>
  ayuda?: string
}

export interface PlantillaAsiento {
  id: string
  nombre: string
  categoria: CategoriaPlantilla
  descripcion: string
  icono: string
  colorBadge: string
  defaultTipo: "OPERACION" | "AJUSTE"
  documentoDefaultPrefijo: string
  campos: CampoParametroPlantilla[]
  generarGlosa: (valores: Record<string, any>) => string
}

export const PLANTILLAS_CONTABLES: PlantillaAsiento[] = [
  // 1. COMPRAS
  {
    id: "compra_mercaderia_contado",
    nombre: "Compra de Mercadería (Contado)",
    categoria: "compras",
    descripcion: "Registro de compra rutinaria bajo Sistema Analítico con IVA Crédito Fiscal y pago inmediato.",
    icono: "ShoppingBag",
    colorBadge: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    defaultTipo: "OPERACION",
    documentoDefaultPrefijo: "CCF-",
    campos: [
      {
        id: "monto",
        label: "Monto Neto (Base Imponible)",
        tipo: "monto",
        placeholder: "0.00",
        valorPorDefecto: 1000,
        ayuda: "Monto antes de impuestos. El sistema calculará el 13% de IVA Crédito Fiscal.",
      },
      {
        id: "aplicaIva",
        label: "Aplica IVA (13% Crédito Fiscal)",
        tipo: "boolean",
        valorPorDefecto: true,
      },
      {
        id: "medioPago",
        label: "Medio de Pago",
        tipo: "select",
        valorPorDefecto: "1101",
        opciones: [
          { label: "1101 - Caja General (Efectivo)", valor: "1101" },
          { label: "1102 - Bancos (Transferencia / Cheque)", valor: "1102" },
        ],
      },
      {
        id: "proveedor",
        label: "Nombre del Proveedor",
        tipo: "texto",
        placeholder: "Distribuidora La Central S.A. de C.V.",
        valorPorDefecto: "Distribuidora Mayorista S.A.",
      },
    ],
    generarGlosa: (v) =>
      `Compra de mercaderías al contado según CCF a ${v.proveedor || "proveedor"} (Método Analítico).`,
  },
  {
    id: "compra_mercaderia_credito",
    nombre: "Compra de Mercadería (Crédito)",
    categoria: "compras",
    descripcion: "Adquisición de mercancías a plazo. Registra pasivo en Cuentas por Pagar (Proveedores).",
    icono: "ReceiptText",
    colorBadge: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
    defaultTipo: "OPERACION",
    documentoDefaultPrefijo: "CCF-",
    campos: [
      {
        id: "monto",
        label: "Monto Neto (Base Imponible)",
        tipo: "monto",
        placeholder: "0.00",
        valorPorDefecto: 2500,
        ayuda: "Base imponible de la compra sujeta a crédito.",
      },
      {
        id: "aplicaIva",
        label: "Aplica IVA (13% Crédito Fiscal)",
        tipo: "boolean",
        valorPorDefecto: true,
      },
      {
        id: "cuentaPasivo",
        label: "Cuenta de Pasivo",
        tipo: "select",
        valorPorDefecto: "2101",
        opciones: [
          { label: "2101 - Cuentas por pagar (Proveedores)", valor: "2101" },
          { label: "2105 - Acreedores diversos", valor: "2105" },
        ],
      },
      {
        id: "plazoDias",
        label: "Plazo de Crédito (Días)",
        tipo: "texto",
        placeholder: "30 días",
        valorPorDefecto: "30 días",
      },
      {
        id: "proveedor",
        label: "Nombre del Proveedor",
        tipo: "texto",
        placeholder: "Importaciones Globales S.A.",
        valorPorDefecto: "Importaciones Globales S.A.",
      },
    ],
    generarGlosa: (v) =>
      `Compra de mercaderías a crédito (${v.plazoDias || "30 días"}) según factura de ${v.proveedor || "proveedor"}.`,
  },
  {
    id: "gastos_sobre_compras",
    nombre: "Gastos sobre Compras (Fletes / Acarreos)",
    categoria: "compras",
    descripcion: "Fletes, transportes y seguros anexos a la adquisición de mercancías.",
    icono: "Truck",
    colorBadge: "bg-sky-500/10 text-sky-500 border-sky-500/20",
    defaultTipo: "OPERACION",
    documentoDefaultPrefijo: "FAC-",
    campos: [
      {
        id: "monto",
        label: "Costo del Transporte / Flete",
        tipo: "monto",
        placeholder: "0.00",
        valorPorDefecto: 150,
      },
      {
        id: "aplicaIva",
        label: "Aplica IVA (13%)",
        tipo: "boolean",
        valorPorDefecto: true,
      },
      {
        id: "medioPago",
        label: "Medio de Pago",
        tipo: "select",
        valorPorDefecto: "1101",
        opciones: [
          { label: "1101 - Caja General", valor: "1101" },
          { label: "1102 - Bancos", valor: "1102" },
        ],
      },
      {
        id: "transportista",
        label: "Empresa de Transporte",
        tipo: "texto",
        placeholder: "Transportes Rápidos S.A.",
        valorPorDefecto: "Transportes Rápidos",
      },
    ],
    generarGlosa: (v) =>
      `Pago de flete y transporte de mercancías a ${v.transportista || "transportista"} según comprobante.`,
  },

  // 2. VENTAS
  {
    id: "venta_mercaderia_contado",
    nombre: "Venta de Mercadería (Contado)",
    categoria: "ventas",
    descripcion: "Venta de mercancías al contado con retención de IVA Débito Fiscal e ingreso a caja/banco.",
    icono: "TrendingUp",
    colorBadge: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    defaultTipo: "OPERACION",
    documentoDefaultPrefijo: "FAC-",
    campos: [
      {
        id: "monto",
        label: "Valor Neto de la Venta (Sin IVA)",
        tipo: "monto",
        placeholder: "0.00",
        valorPorDefecto: 1500,
        ayuda: "Monto base de las mercancías vendidas.",
      },
      {
        id: "aplicaIva",
        label: "Aplica IVA (13% Débito Fiscal)",
        tipo: "boolean",
        valorPorDefecto: true,
      },
      {
        id: "cuentaIngreso",
        label: "Destino de los Fondos",
        tipo: "select",
        valorPorDefecto: "1101",
        opciones: [
          { label: "1101 - Caja General", valor: "1101" },
          { label: "1102 - Bancos", valor: "1102" },
        ],
      },
      {
        id: "cliente",
        label: "Nombre del Cliente",
        tipo: "texto",
        placeholder: "Cliente Final / Empresa",
        valorPorDefecto: "Cliente Mostrador",
      },
    ],
    generarGlosa: (v) =>
      `Venta de mercaderías al contado según factura comercial a ${v.cliente || "cliente"}.`,
  },
  {
    id: "venta_mercaderia_credito",
    nombre: "Venta de Mercadería (Crédito)",
    categoria: "ventas",
    descripcion: "Venta a plazo con generación de derecho de cobro en Cuentas por Cobrar (Clientes).",
    icono: "BadgePercent",
    colorBadge: "bg-teal-500/10 text-teal-500 border-teal-500/20",
    defaultTipo: "OPERACION",
    documentoDefaultPrefijo: "CCF-",
    campos: [
      {
        id: "monto",
        label: "Valor Neto de la Venta (Sin IVA)",
        tipo: "monto",
        placeholder: "0.00",
        valorPorDefecto: 3200,
      },
      {
        id: "aplicaIva",
        label: "Aplica IVA (13% Débito Fiscal)",
        tipo: "boolean",
        valorPorDefecto: true,
      },
      {
        id: "cuentaActivo",
        label: "Cuenta de Cobro",
        tipo: "select",
        valorPorDefecto: "1103",
        opciones: [
          { label: "1103 - Cuentas por cobrar (Clientes)", valor: "1103" },
          { label: "1106 - Deudores diversos", valor: "1106" },
        ],
      },
      {
        id: "cliente",
        label: "Nombre del Cliente / Empresa",
        tipo: "texto",
        placeholder: "Comercial San José S.A.",
        valorPorDefecto: "Corporación San Salvador S.A.",
      },
    ],
    generarGlosa: (v) =>
      `Venta de mercaderías al crédito según CCF a ${v.cliente || "cliente"}.`,
  },

  // 3. DEVOLUCIONES ANALÍTICAS
  {
    id: "devolucion_sobre_compra",
    nombre: "Devolución sobre Compras",
    categoria: "devoluciones",
    descripcion: "Devolución de mercaderías a proveedor (mercadería dañada o defectuosa) con reintegro.",
    icono: "RotateCcw",
    colorBadge: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    defaultTipo: "OPERACION",
    documentoDefaultPrefijo: "NC-",
    campos: [
      {
        id: "monto",
        label: "Valor Neto de la Mercadería Devuelta",
        tipo: "monto",
        placeholder: "0.00",
        valorPorDefecto: 400,
        ayuda: "Monto neto devuelto a precio de compra.",
      },
      {
        id: "aplicaIva",
        label: "Ajuste de IVA Crédito Fiscal (13%)",
        tipo: "boolean",
        valorPorDefecto: true,
      },
      {
        id: "medioReintegro",
        label: "Forma de Compensación",
        tipo: "select",
        valorPorDefecto: "1101",
        opciones: [
          { label: "1101 - Devolución en Efectivo (Caja)", valor: "1101" },
          { label: "1102 - Depósito en Banco", valor: "1102" },
          { label: "2101 - Disminución de Cuentas por Pagar", valor: "2101" },
        ],
      },
      {
        id: "motivo",
        label: "Motivo de la Devolución",
        tipo: "texto",
        placeholder: "Mercancía defectuosa fuera de especificación",
        valorPorDefecto: "Lote con fallas de calidad",
      },
    ],
    generarGlosa: (v) =>
      `Devolución de mercadería sobre compras según Nota de Crédito por motivo de ${v.motivo || "devolución"}.`,
  },
  {
    id: "devolucion_sobre_venta",
    nombre: "Devolución sobre Ventas",
    categoria: "devoluciones",
    descripcion: "Recepción de mercancía devuelta por cliente con reintegro de fondos o ajuste de saldo.",
    icono: "CornerDownLeft",
    colorBadge: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    defaultTipo: "OPERACION",
    documentoDefaultPrefijo: "NC-",
    campos: [
      {
        id: "monto",
        label: "Valor Neto de la Venta Devuelta",
        tipo: "monto",
        placeholder: "0.00",
        valorPorDefecto: 300,
      },
      {
        id: "aplicaIva",
        label: "Ajuste de IVA Débito Fiscal (13%)",
        tipo: "boolean",
        valorPorDefecto: true,
      },
      {
        id: "medioReintegro",
        label: "Forma de Devolución al Cliente",
        tipo: "select",
        valorPorDefecto: "1101",
        opciones: [
          { label: "1101 - Reembolso en Efectivo (Caja)", valor: "1101" },
          { label: "1103 - Rebaja a Cuenta por Cobrar", valor: "1103" },
        ],
      },
      {
        id: "cliente",
        label: "Cliente",
        tipo: "texto",
        placeholder: "Cliente que devolvió",
        valorPorDefecto: "Cliente Frecuente",
      },
    ],
    generarGlosa: (v) =>
      `Devolución de mercadería sobre ventas según Nota de Crédito emitida a ${v.cliente || "cliente"}.`,
  },

  // 4. GASTOS DE OPERACIÓN
  {
    id: "pago_gasto_operativo",
    nombre: "Pago de Gasto Operativo",
    categoria: "gastos",
    descripcion: "Alquileres, energía eléctrica, agua, telecomunicaciones o papelería con IVA crédito.",
    icono: "Building2",
    colorBadge: "bg-violet-500/10 text-violet-500 border-violet-500/20",
    defaultTipo: "OPERACION",
    documentoDefaultPrefijo: "REC-",
    campos: [
      {
        id: "cuentaGasto",
        label: "Tipo de Gasto",
        tipo: "select",
        valorPorDefecto: "4204",
        opciones: [
          { label: "4204 - Gastos de Alquiler", valor: "4204" },
          { label: "4205 - Gastos de Servicios Básicos (Luz/Agua/Internet)", valor: "4205" },
          { label: "4207 - Gastos de Papelería y Útiles", valor: "4207" },
          { label: "4201 - Gastos de Administración General", valor: "4201" },
          { label: "4208 - Gastos de Publicidad", valor: "4208" },
        ],
      },
      {
        id: "monto",
        label: "Monto Neto (Base Imponible)",
        tipo: "monto",
        placeholder: "0.00",
        valorPorDefecto: 600,
      },
      {
        id: "aplicaIva",
        label: "Aplica IVA (13% Crédito Fiscal)",
        tipo: "boolean",
        valorPorDefecto: true,
      },
      {
        id: "medioPago",
        label: "Medio de Pago",
        tipo: "select",
        valorPorDefecto: "1102",
        opciones: [
          { label: "1102 - Bancos (Cheque / Transferencia)", valor: "1102" },
          { label: "1101 - Caja General", valor: "1101" },
        ],
      },
      {
        id: "conceptoDetalle",
        label: "Detalle del Servicio / Periodo",
        tipo: "texto",
        placeholder: "Mes de Marzo 2026",
        valorPorDefecto: "Periodo corriente",
      },
    ],
    generarGlosa: (v) =>
      `Pago de gasto operativo (${v.conceptoDetalle || "gasto del mes"}) según comprobante fiscal.`,
  },

  // 5. TESORERÍA (ABONOS / PAGOS)
  {
    id: "abono_cobro_cliente",
    nombre: "Cobro a Clientes / Abono de Cartera",
    categoria: "tesoreria",
    descripcion: "Cobro de cuentas pendientes de clientes con ingreso a bancos o caja (sin afectar ventas).",
    icono: "ArrowDownLeft",
    colorBadge: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    defaultTipo: "OPERACION",
    documentoDefaultPrefijo: "REC-",
    campos: [
      {
        id: "monto",
        label: "Monto Cobrado ($)",
        tipo: "monto",
        placeholder: "0.00",
        valorPorDefecto: 1200,
      },
      {
        id: "medioCobro",
        label: "Cuenta de Recepción",
        tipo: "select",
        valorPorDefecto: "1102",
        opciones: [
          { label: "1102 - Depósito en Banco", valor: "1102" },
          { label: "1101 - Caja General (Efectivo)", valor: "1101" },
        ],
      },
      {
        id: "cliente",
        label: "Nombre del Cliente",
        tipo: "texto",
        placeholder: "Cliente deudor",
        valorPorDefecto: "Cliente ABC",
      },
    ],
    generarGlosa: (v) =>
      `Cobro de saldo a favor por abono de cliente ${v.cliente || "cartera"} según recibo.`,
  },
  {
    id: "abono_pago_proveedor",
    nombre: "Pago a Proveedores / Liquidación Pasivo",
    categoria: "tesoreria",
    descripcion: "Pago a cuentas por pagar de proveedores con egreso de bancos o caja.",
    icono: "ArrowUpRight",
    colorBadge: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    defaultTipo: "OPERACION",
    documentoDefaultPrefijo: "CHQ-",
    campos: [
      {
        id: "monto",
        label: "Monto Pagado ($)",
        tipo: "monto",
        placeholder: "0.00",
        valorPorDefecto: 1800,
      },
      {
        id: "origenFondos",
        label: "Origen de los Fondos",
        tipo: "select",
        valorPorDefecto: "1102",
        opciones: [
          { label: "1102 - Bancos (Transferencia / Cheque)", valor: "1102" },
          { label: "1101 - Caja General", valor: "1101" },
        ],
      },
      {
        id: "proveedor",
        label: "Proveedor Pagado",
        tipo: "texto",
        placeholder: "Nombre del proveedor",
        valorPorDefecto: "Distribuidora Mayorista S.A.",
      },
    ],
    generarGlosa: (v) =>
      `Pago a cuentas por pagar de proveedor ${v.proveedor || "proveedor"} según comprobante.`,
  },
]
