import type { Asiento, Cuenta } from "./types"

/**
 * Escenario de prueba (mock up) para corroborar los Estados Financieros.
 * Todo en memoria: catálogo, las 13 partidas (P1–P13) y los valores esperados
 * obtenidos de la mayorización manual.
 */
export const CATALOGO_PRUEBA: Cuenta[] = [
  // 1 - Activo (naturaleza deudora)
  { codigo: "1101", nombre: "CAJA", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1102", nombre: "BANCOS", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1103", nombre: "CUENTAS POR COBRAR", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1104", nombre: "INVENTARIOS", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1105", nombre: "IVA CRÉDITO FISCAL", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1201", nombre: "PROPIEDAD, PLANTA Y EQUIPO", tipo: "activo", naturaleza: "deudora", activa: true },

  // 2 - Pasivo (naturaleza acreedora)
  { codigo: "2101", nombre: "CUENTAS POR PAGAR", tipo: "pasivo", naturaleza: "acreedora", activa: true },
  { codigo: "2102", nombre: "PRÉSTAMOS A LARGO PLAZO", tipo: "pasivo", naturaleza: "acreedora", activa: true },
  { codigo: "2103", nombre: "IVA DÉBITO FISCAL", tipo: "pasivo", naturaleza: "acreedora", activa: true },

  // 3 - Capital contable (naturaleza acreedora)
  { codigo: "3101", nombre: "CAPITAL SOCIAL", tipo: "capital", naturaleza: "acreedora", activa: true },

  // 4 - Costos y gastos (naturaleza deudora salvo contra-cuentas)
  { codigo: "4101", nombre: "COMPRAS", tipo: "gasto", naturaleza: "deudora", activa: true },
  { codigo: "4102", nombre: "DEVOLUCIONES SOBRE COMPRAS", tipo: "gasto", naturaleza: "acreedora", activa: true },
  { codigo: "4301", nombre: "GASTOS FINANCIEROS", tipo: "gasto", naturaleza: "deudora", activa: true },

  // 5 - Ingresos (naturaleza acreedora salvo contra-cuentas)
  { codigo: "5101", nombre: "VENTAS", tipo: "ingreso", naturaleza: "acreedora", activa: true },
  { codigo: "5102", nombre: "DEVOLUCIONES SOBRE VENTAS", tipo: "ingreso", naturaleza: "deudora", activa: true },
]

export const ASIENTOS_PRUEBA: Asiento[] = [
  {
    id: "p1",
    numero: 1,
    fecha: "2026-01-01",
    concepto: "P1: Aportación inicial de los socios en efectivo e inventarios.",
    lineas: [
      { codigo: "1101", debe: 30000, haber: 0 },
      { codigo: "1104", debe: 6000, haber: 0 },
      { codigo: "3101", debe: 0, haber: 36000 },
    ],
  },
  {
    id: "p2",
    numero: 2,
    fecha: "2026-01-02",
    concepto: "P2: Depósito del efectivo en el banco.",
    lineas: [
      { codigo: "1102", debe: 20000, haber: 0 },
      { codigo: "1101", debe: 0, haber: 20000 },
    ],
  },
  {
    id: "p3",
    numero: 3,
    fecha: "2026-01-03",
    concepto: "P3: Compra de mercadería al crédito (queso), IVA incluido aparte.",
    lineas: [
      { codigo: "4101", debe: 8849.56, haber: 0 },
      { codigo: "1105", debe: 1150.44, haber: 0 },
      { codigo: "2101", debe: 0, haber: 10000 },
    ],
  },
  {
    id: "p4",
    numero: 4,
    fecha: "2026-01-08",
    concepto: "P4: Devolución de mercadería del 08/01 al proveedor.",
    lineas: [
      { codigo: "2101", debe: 1000, haber: 0 },
      { codigo: "1105", debe: 0, haber: 115.04 },
      { codigo: "4102", debe: 0, haber: 884.96 },
    ],
  },
  {
    id: "p5",
    numero: 5,
    fecha: "2026-01-12",
    concepto: "P5: Venta de mercadería al crédito con IVA débito fiscal.",
    lineas: [
      { codigo: "1103", debe: 12000, haber: 0 },
      { codigo: "5101", debe: 0, haber: 10619.47 },
      { codigo: "2103", debe: 0, haber: 1380.53 },
    ],
  },
  {
    id: "p6",
    numero: 6,
    fecha: "2026-01-12",
    concepto: "P6: Devolución de mercadería del 12/01 por parte del cliente.",
    lineas: [
      { codigo: "5102", debe: 88.5, haber: 0 },
      { codigo: "2103", debe: 11.5, haber: 0 },
      { codigo: "1103", debe: 0, haber: 100 },
    ],
  },
  {
    id: "p7",
    numero: 7,
    fecha: "2026-01-13",
    concepto: "P7: Pago total al proveedor con cheque.",
    lineas: [
      { codigo: "2101", debe: 9000, haber: 0 },
      { codigo: "1102", debe: 0, haber: 9000 },
    ],
  },
  {
    id: "p8",
    numero: 8,
    fecha: "2026-01-14",
    concepto: "P8: Compra de escritorios al contado, pagados en efectivo.",
    lineas: [
      { codigo: "1201", debe: 265.49, haber: 0 },
      { codigo: "1105", debe: 34.51, haber: 0 },
      { codigo: "1101", debe: 0, haber: 300 },
    ],
  },
  {
    id: "p9",
    numero: 9,
    fecha: "2026-01-15",
    concepto: "P9: Cobro de la primera cuota del cliente en banco.",
    lineas: [
      { codigo: "1102", debe: 5950, haber: 0 },
      { codigo: "1103", debe: 0, haber: 5950 },
    ],
  },
  {
    id: "p10",
    numero: 10,
    fecha: "2026-01-16",
    concepto: "P10: Compra de laptop al contado, pagada con banco.",
    lineas: [
      { codigo: "1201", debe: 513.27, haber: 0 },
      { codigo: "1105", debe: 66.73, haber: 0 },
      { codigo: "1102", debe: 0, haber: 580 },
    ],
  },
  {
    id: "p11",
    numero: 11,
    fecha: "2026-01-17",
    concepto: "P11: Venta de contado con IVA débito fiscal, cobrada en efectivo.",
    lineas: [
      { codigo: "1101", debe: 5000, haber: 0 },
      { codigo: "5101", debe: 0, haber: 4424.78 },
      { codigo: "2103", debe: 0, haber: 575.22 },
    ],
  },
  {
    id: "p12",
    numero: 12,
    fecha: "2026-01-18",
    concepto: "P12: Compra de vehículo: prima pagada con banco y saldo financiado.",
    lineas: [
      { codigo: "1201", debe: 13274.34, haber: 0 },
      { codigo: "1105", debe: 1725.66, haber: 0 },
      { codigo: "1102", debe: 0, haber: 1500 },
      { codigo: "2101", debe: 0, haber: 13500 },
    ],
  },
  {
    id: "p13",
    numero: 13,
    fecha: "2026-01-20",
    concepto: "P13: Préstamo Banco Davivienda: abono neto, comisión e IVA.",
    lineas: [
      { codigo: "1102", debe: 18870, haber: 0 },
      { codigo: "1105", debe: 130, haber: 0 },
      { codigo: "4301", debe: 1000, haber: 0 },
      { codigo: "2102", debe: 0, haber: 20000 },
    ],
  },
]

/**
 * Valores esperados de la mayorización manual para corroborar el cálculo del sistema.
 * Los valores dependientes del inventario final (costo de ventas, utilidad, activo,
 * capital y pasivo + capital) se derivan en la vista a partir de estas constantes
 * y del inventario final indicado (conteo físico).
 */
export const VALORES_ESPERADOS = {
  inventarioInicial: 6000,
  mercaderiaDisponible: 13964.6,
  totalGastos: 1000,
  totalActivo: 77435.4,
  totalPasivo: 35444.25,
  capitalSocial: 36000,
  utilidadEjercicio: 5991.15,
  totalCapitalContable: 41991.15,
  totalPasivoMasCapital: 77435.4,
  totalVentas: 14955.75,
  totalCostoVentas: 7964.6,
  utilidadBruta: 6991.15,
} as const