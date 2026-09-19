import type { Cuenta } from "./types"

/**
 * Catálogo de Cuentas base (equivale al futuro data.sql).
 * Clasificación por primer dígito:
 *  1 = Activo, 2 = Pasivo, 3 = Capital contable, 4 = Costos y gastos, 5 = Ingresos
 */
export const CATALOGO_CUENTAS: Cuenta[] = [
  // 1 - Activo (naturaleza deudora)
  { codigo: "1101", nombre: "Caja general", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1102", nombre: "Bancos", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1103", nombre: "Cuentas por cobrar", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1104", nombre: "Inventario de mercadería", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1105", nombre: "IVA crédito fiscal", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1201", nombre: "Mobiliario y equipo", tipo: "activo", naturaleza: "deudora", activa: true },
  { codigo: "1202", nombre: "Equipo de transporte", tipo: "activo", naturaleza: "deudora", activa: true },

  // 2 - Pasivo (naturaleza acreedora)
  { codigo: "2101", nombre: "Cuentas por pagar", tipo: "pasivo", naturaleza: "acreedora", activa: true },
  { codigo: "2102", nombre: "Préstamos bancarios por pagar", tipo: "pasivo", naturaleza: "acreedora", activa: true },
  { codigo: "2103", nombre: "IVA débito fiscal", tipo: "pasivo", naturaleza: "acreedora", activa: true },
  { codigo: "2104", nombre: "Impuestos por pagar", tipo: "pasivo", naturaleza: "acreedora", activa: true },

  // 3 - Capital contable (naturaleza acreedora)
  { codigo: "3101", nombre: "Capital social", tipo: "capital", naturaleza: "acreedora", activa: true },
  { codigo: "3102", nombre: "Utilidades acumuladas", tipo: "capital", naturaleza: "acreedora", activa: true },
  { codigo: "3103", nombre: "Reserva legal", tipo: "capital", naturaleza: "acreedora", activa: true },

  // 4 - Costos y gastos (naturaleza deudora)
  //   41 = costo de ventas · 42 = gastos de operación · 43 = gastos financieros
  { codigo: "4101", nombre: "Costo de venta", tipo: "gasto", naturaleza: "deudora", activa: true },
  { codigo: "4201", nombre: "Gastos de administración", tipo: "gasto", naturaleza: "deudora", activa: true },
  { codigo: "4202", nombre: "Gastos de venta", tipo: "gasto", naturaleza: "deudora", activa: true },
  { codigo: "4301", nombre: "Gastos financieros", tipo: "gasto", naturaleza: "deudora", activa: true },

  // 5 - Ingresos (naturaleza acreedora)
  //   51 = ventas / operativos · 52 = ingresos financieros
  { codigo: "5101", nombre: "Ventas", tipo: "ingreso", naturaleza: "acreedora", activa: true },
  { codigo: "5102", nombre: "Otros ingresos operativos", tipo: "ingreso", naturaleza: "acreedora", activa: true },
  { codigo: "5201", nombre: "Productos financieros", tipo: "ingreso", naturaleza: "acreedora", activa: true },
]
