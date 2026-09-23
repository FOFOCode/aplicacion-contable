import type { Cuenta } from "./types"

/**
 * Catálogo de Cuentas completo (equivale al futuro data.sql).
 * Clasificación por primer dígito:
 *  1 = Activo, 2 = Pasivo, 3 = Capital contable, 4 = Costos y gastos, 5 = Ingresos
 */
export const CATALOGO_CUENTAS: Cuenta[] = [
  // 1 - Activo (naturaleza deudora)
  // 11 - Activo corriente
  { codigo: "1101", nombre: "Caja general", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1102", nombre: "Bancos", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1103", nombre: "Cuentas por cobrar", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1104", nombre: "Inventario de mercadería", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1105", nombre: "IVA crédito fiscal", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1106", nombre: "Deudores diversos", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1107", nombre: "Papelería y útiles", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1108", nombre: "Pagos anticipados", tipo: "activo", naturaleza: "deudora", activa: true },
  // 12 - Activo no corriente
  { codigo: "1201", nombre: "Mobiliario y equipo", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1202", nombre: "Equipo de transporte", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1203", nombre: "Equipo de cómputo", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1204", nombre: "Edificios", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1205", nombre: "Terrenos", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1206", nombre: "Depreciación acumulada", tipo: "activo", naturaleza: "deudora", activa: true },

  // 2 - Pasivo (naturaleza acreedora)
  // 21 - Pasivo corriente
  { codigo: "2101", nombre: "Cuentas por pagar", tipo: "pasivo", naturaleza: "acreedora", activa: true },
  { codigo: "2102", nombre: "Préstamos bancarios por pagar", tipo: "pasivo", naturaleza: "acreedora", activa: true },
  { codigo: "2103", nombre: "IVA débito fiscal", tipo: "pasivo", naturaleza: "acreedora", activa: true },
  { codigo: "2104", nombre: "Impuestos por pagar", tipo: "pasivo", naturaleza: "acreedora", activa: true },
  { codigo: "2105", nombre: "Acreedores diversos", tipo: "pasivo", naturaleza: "acreedora", activa: true },
  { codigo: "2106", nombre: "Sueldos y salarios por pagar", tipo: "pasivo", naturaleza: "acreedora", activa: true },
  { codigo: "2107", nombre: "Retenciones por pagar", tipo: "pasivo", naturaleza: "acreedora", activa: true },
  // 22 - Pasivo no corriente
  { codigo: "2201", nombre: "Préstamos bancarios a largo plazo", tipo: "pasivo", naturaleza: "acreedora", activa: true },
  { codigo: "2202", nombre: "Hipotecas por pagar", tipo: "pasivo", naturaleza: "acreedora", activa: true },

  // 3 - Capital contable (naturaleza acreedora)
  { codigo: "3101", nombre: "Capital social", tipo: "capital", naturaleza: "acreedora", activa: true },
  { codigo: "3102", nombre: "Utilidades acumuladas", tipo: "capital", naturaleza: "acreedora", activa: true },
  { codigo: "3103", nombre: "Reserva legal", tipo: "capital", naturaleza: "acreedora", activa: true },
  { codigo: "3104", nombre: "Pérdidas acumuladas", tipo: "capital", naturaleza: "acreedora", activa: true },
  { codigo: "3105", nombre: "Donaciones", tipo: "capital", naturaleza: "acreedora", activa: true },

  // 4 - Costos y gastos (naturaleza deudora)
  //   41 = Compras y cuentas analíticas · 42 = gastos de operación · 43 = gastos financieros
  { codigo: "4101", nombre: "Compras", tipo: "gasto", naturaleza: "deudora", activa: true },
  { codigo: "4102", nombre: "Gastos sobre compras", tipo: "gasto", naturaleza: "deudora", activa: true },
  { codigo: "4103", nombre: "Devoluciones sobre ventas", tipo: "gasto", naturaleza: "deudora", activa: true },
  { codigo: "4104", nombre: "Rebajas y descuentos sobre ventas", tipo: "gasto", naturaleza: "deudora", activa: true },
  { codigo: "4105", nombre: "Costo de servicios", tipo: "gasto", naturaleza: "deudora", activa: true },
  { codigo: "4201", nombre: "Gastos de administración", tipo: "gasto", naturaleza: "deudora", activa: true },
  { codigo: "4202", nombre: "Gastos de venta", tipo: "gasto", naturaleza: "deudora", activa: true },
  { codigo: "4203", nombre: "Gastos de depreciación", tipo: "gasto", naturaleza: "deudora", activa: true },
  { codigo: "4204", nombre: "Gastos de alquiler", tipo: "gasto", naturaleza: "deudora", activa: true },
  { codigo: "4205", nombre: "Gastos de servicios básicos", tipo: "gasto", naturaleza: "deudora", activa: true },
  { codigo: "4206", nombre: "Gastos de sueldos y salarios", tipo: "gasto", naturaleza: "deudora", activa: true },
  { codigo: "4207", nombre: "Gastos de papelería y útiles", tipo: "gasto", naturaleza: "deudora", activa: true },
  { codigo: "4208", nombre: "Gastos de publicidad", tipo: "gasto", naturaleza: "deudora", activa: true },
  { codigo: "4301", nombre: "Gastos financieros", tipo: "gasto", naturaleza: "deudora", activa: true },
  { codigo: "4302", nombre: "Intereses pagados", tipo: "gasto", naturaleza: "deudora", activa: true },
  { codigo: "4303", nombre: "Comisiones bancarias", tipo: "gasto", naturaleza: "deudora", activa: true },

  // 5 - Ingresos (naturaleza acreedora)
  //   51 = Ventas y cuentas analíticas · 52 = ingresos financieros
  { codigo: "5101", nombre: "Ventas", tipo: "ingreso", naturaleza: "acreedora", activa: true },
  { codigo: "5102", nombre: "Devoluciones sobre compras", tipo: "ingreso", naturaleza: "acreedora", activa: true },
  { codigo: "5103", nombre: "Rebajas y descuentos sobre compras", tipo: "ingreso", naturaleza: "acreedora", activa: true },
  { codigo: "5104", nombre: "Otros ingresos operativos", tipo: "ingreso", naturaleza: "acreedora", activa: true },
  { codigo: "5105", nombre: "Ingresos por servicios", tipo: "ingreso", naturaleza: "acreedora", activa: true },
  { codigo: "5201", nombre: "Productos financieros", tipo: "ingreso", naturaleza: "acreedora", activa: true },
  { codigo: "5202", nombre: "Intereses cobrados", tipo: "ingreso", naturaleza: "acreedora", activa: true },
  { codigo: "5203", nombre: "Utilidad en venta de activos", tipo: "ingreso", naturaleza: "acreedora", activa: true },
]
