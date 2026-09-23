export type Naturaleza = "deudora" | "acreedora"

export type TipoCuenta = "activo" | "pasivo" | "capital" | "gasto" | "ingreso"

export interface Cuenta {
  codigo: string
  nombre: string
  tipo: TipoCuenta
  naturaleza: Naturaleza
  /** Indica si la cuenta permite asientos directos o es de título/acumulación. */
  permite_movimiento?: boolean
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
  parcial?: number
}

export interface Asiento {
  id: string
  correlativo_global?: number
  ejercicio?: number
  numero: number
  fecha: string
  concepto: string
  tipo?: "APERTURA" | "OPERACION" | "AJUSTE" | "CIERRE" | "REVERSION"
  estado?: "BORRADOR" | "APLICADO" | "ANULADO"
  asiento_reversion_id?: string | null
  documento_soporte?: string | null
  anulado_en?: string | null
  motivo_anulacion?: string | null
  lote_id?: string | null
  lote_numero?: number | null
  folio_diario_id?: string | null
  numero_folio?: number | null
  lineas: AsientoLinea[]
}

export interface FolioDiario {
  id: string
  ejercicio: number
  numero_folio: number
  fecha: string
  estado: "ABIERTO" | "CERRADO"
  total_debe: number
  total_haber: number
  cerrado_en?: string | null
  cerrado_por?: string | null
  creado_en?: string
  cantidad_partidas?: number
}

export interface LoteContable {
  id: string
  numero: number
  ejercicio: number
  mes: string
  estado: "EN_PROCESO" | "CERRADO" | "FOLIADO"
  fecha_apertura: string
  fecha_cierre?: string | null
  usuario?: string
  observaciones?: string
  total_debe: number
  total_haber: number
  cantidad_partidas: number
  partidas_ids?: string[]
}

export interface AsientoHistorial {
  id: string
  asiento_id: string
  accion: "CREACION" | "MODIFICACION" | "ANULACION" | "CIERRE"
  ejercicio: number
  numero: number
  concepto?: string
  total_debe: number
  total_haber: number
  motivo?: string
  creado_en?: string
}

export interface CierreContable {
  id: string
  ejercicio: number
  fecha_cierre: string
  concepto: string
  total_ingresos: number
  total_gastos: number
  utilidad: number
  cuenta_capital_codigo: string
  cuenta_capital_nombre?: string
  asiento_cierre_id: string
  asiento_numero?: number
  creado_en?: string
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
