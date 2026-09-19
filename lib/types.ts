export type Naturaleza = "deudora" | "acreedora"

export type TipoCuenta = "activo" | "pasivo" | "capital" | "gasto" | "ingreso"

export interface Cuenta {
  codigo: string
  nombre: string
  tipo: TipoCuenta
  naturaleza: Naturaleza
  /** Cuenta activa. Una cuenta usada en asientos no se borra: se marca como eliminada (activa=false). */
  activa: boolean
}

/**
 * Subclasificación del Estado de Resultados por los dos primeros dígitos del código.
 * Permite armar el reporte en cascada (ventas, costo de ventas, gastos de operación, financieros).
 */
export type SubgrupoResultados =
  | "ventas"
  | "costoVentas"
  | "gastosOperacion"
  | "ingresosFinancieros"
  | "gastosFinancieros"

export function subgrupoResultados(codigo: string, tipo: TipoCuenta): SubgrupoResultados | null {
  const p = codigo.trim().slice(0, 2)
  if (tipo === "ingreso") {
    return p === "52" ? "ingresosFinancieros" : "ventas"
  }
  if (tipo === "gasto") {
    if (p === "41") return "costoVentas"
    if (p === "43") return "gastosFinancieros"
    return "gastosOperacion"
  }
  return null
}

export interface AsientoLinea {
  codigo: string
  debe: number
  haber: number
}

export interface Asiento {
  id: string
  numero: number
  fecha: string
  concepto: string
  lineas: AsientoLinea[]
}

export interface SaldoCuenta {
  cuenta: Cuenta
  debe: number
  haber: number
  saldo: number
  naturalezaSaldo: Naturaleza | null
}

/** Devuelve el grupo contable a partir del primer dígito del código de cuenta. */
export function grupoPorDigito(codigo: string): TipoCuenta | null {
  switch (codigo.trim().charAt(0)) {
    case "1":
      return "activo"
    case "2":
      return "pasivo"
    case "3":
      return "capital"
    case "4":
      return "gasto"
    case "5":
      return "ingreso"
    default:
      return null
  }
}

export const ETIQUETA_TIPO: Record<TipoCuenta, string> = {
  activo: "Activo",
  pasivo: "Pasivo",
  capital: "Capital contable",
  gasto: "Costos y gastos",
  ingreso: "Ingresos",
}
