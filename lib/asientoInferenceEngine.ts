/**
 * MOTOR DE INFERENCIA CONTABLE PURO
 * 
 * Deduce de forma determinista la imputación contable (DEBE o HABER)
 * basándose en la Teoría del Cargo y el Abono, la Naturaleza de la Cuenta
 * y el sentido de la operación económica (+ Aumenta / - Disminuye).
 */

import type { Cuenta, Naturaleza, TipoCuenta } from "./types"

export type OperacionContable = "AUMENTA" | "DISMINUYE" | "+" | "-"
export type ImputacionContable = "DEBE" | "HABER"

export interface ResumenCuentaInferencia {
  codigo: string
  nombre: string
  tipo?: TipoCuenta
  naturaleza: Naturaleza | "DEUDORA" | "ACREEDORA"
}

export interface ResultadoImputacion {
  imputacion: ImputacionContable
  debe: number
  haber: number
  monto: number
  operacionNormalizada: "AUMENTA" | "DISMINUYE"
  naturalezaNormalizada: "deudora" | "acreedora"
  explicacion: string
  reglaContable: string
}

/**
 * Normaliza la operación contable a 'AUMENTA' o 'DISMINUYE'.
 */
export function normalizarOperacion(op: OperacionContable): "AUMENTA" | "DISMINUYE" {
  if (op === "+" || op === "AUMENTA") return "AUMENTA"
  return "DISMINUYE"
}

/**
 * Normaliza la naturaleza a minúsculas ('deudora' | 'acreedora').
 */
export function normalizarNaturaleza(nat: string): "deudora" | "acreedora" {
  const n = (nat || "").trim().toLowerCase()
  return n === "acreedora" ? "acreedora" : "deudora"
}

/**
 * Redondeo financiero exacto a 2 decimales evitando errores de coma flotante.
 */
export function redondearCentavos(monto: number): number {
  return Math.round((Math.abs(Number(monto) || 0) + Number.EPSILON) * 100) / 100
}

/**
 * Deduce si un monto debe cargarse al DEBE o abonarse al HABER.
 * 
 * Reglas de la Partida Doble:
 * - Cuenta DEUDORA (Activo, Gastos, Costos):
 *   * Aumenta (+)   => DEBE  (Cargo)
 *   * Disminuye (-) => HABER (Abono)
 * 
 * - Cuenta ACREEDORA (Pasivo, Capital, Ingresos, Complementarias de compras):
 *   * Aumenta (+)   => HABER (Abono)
 *   * Disminuye (-) => DEBE  (Cargo)
 * 
 * @param cuenta Objeto con código, nombre y naturaleza de la cuenta
 * @param monto Importe de la transacción (positivo)
 * @param operacion Sentido de la variación patrimonial ('+' | '-' | 'AUMENTA' | 'DISMINUYE')
 */
export function inferirImputacion(
  cuenta: ResumenCuentaInferencia | Cuenta,
  monto: number,
  operacion: OperacionContable = "AUMENTA",
): ResultadoImputacion {
  const montoNeto = redondearCentavos(monto)
  const opNorm = normalizarOperacion(operacion)
  const natNorm = normalizarNaturaleza(cuenta.naturaleza)

  let imputacion: ImputacionContable
  let reglaContable: string

  if (natNorm === "deudora") {
    if (opNorm === "AUMENTA") {
      imputacion = "DEBE"
      reglaContable = "Cuenta Deudora al AUMENTAR (+) se debita (DEBE)"
    } else {
      imputacion = "HABER"
      reglaContable = "Cuenta Deudora al DISMINUIR (-) se acredita (HABER)"
    }
  } else {
    // Acreedora
    if (opNorm === "AUMENTA") {
      imputacion = "HABER"
      reglaContable = "Cuenta Acreedora al AUMENTAR (+) se acredita (HABER)"
    } else {
      imputacion = "DEBE"
      reglaContable = "Cuenta Acreedora al DISMINUIR (-) se debita (DEBE)"
    }
  }

  const debe = imputacion === "DEBE" ? montoNeto : 0
  const haber = imputacion === "HABER" ? montoNeto : 0

  const nombreCuenta = cuenta.nombre || `Cuenta ${cuenta.codigo}`
  const tipoStr = cuenta.tipo ? ` (${cuenta.tipo.toUpperCase()})` : ""
  const accionVerbo = opNorm === "AUMENTA" ? "aumenta (+)" : "disminuye (-)"
  const imputacionVerbo = imputacion === "DEBE" ? "se CARGA al DEBE" : "se ABONA al HABER"

  const explicacion = `${nombreCuenta}${tipoStr} de naturaleza ${natNorm.toUpperCase()}: al ${accionVerbo} ${imputacionVerbo}.`

  return {
    imputacion,
    debe,
    haber,
    monto: montoNeto,
    operacionNormalizada: opNorm,
    naturalezaNormalizada: natNorm,
    explicacion,
    reglaContable,
  }
}

export interface RecomendacionAutoBalance {
  hayDescuadre: boolean
  totalDebe: number
  totalHaber: number
  diferencia: number
  columnaFaltante: ImputacionContable | null
  montoFaltante: number
  operacionSugeridaParaCuenta?: (cuenta: ResumenCuentaInferencia | Cuenta) => {
    operacion: "AUMENTA" | "DISMINUYE"
    simbolo: "+" | "-"
    explicacion: string
  }
}

/**
 * Calcula el descuadre acumulado y devuelve la operación que debe aplicarse
 * a cualquier cuenta candidata para cerrar la partida doble en cero.
 */
export function calcularAutoBalance(
  lineasCalculadas: Array<{ debe: number; haber: number }>,
): RecomendacionAutoBalance {
  let debeCents = 0
  let haberCents = 0

  for (const l of lineasCalculadas) {
    debeCents += Math.round((Number(l.debe) || 0) * 100)
    haberCents += Math.round((Number(l.haber) || 0) * 100)
  }

  const diffCents = debeCents - haberCents
  const hayDescuadre = diffCents !== 0
  const columnaFaltante: ImputacionContable | null =
    diffCents > 0 ? "HABER" : diffCents < 0 ? "DEBE" : null
  const montoFaltante = Math.abs(diffCents) / 100

  const operacionSugeridaParaCuenta = (cuenta: ResumenCuentaInferencia | Cuenta) => {
    if (!columnaFaltante) {
      return {
        operacion: "AUMENTA" as const,
        simbolo: "+" as const,
        explicacion: "La partida ya se encuentra perfectamente cuadrada.",
      }
    }

    const nat = normalizarNaturaleza(cuenta.naturaleza)
    let op: "AUMENTA" | "DISMINUYE"

    if (columnaFaltante === "DEBE") {
      // Necesitamos saldo al DEBE
      // Deudora + Aumenta = DEBE
      // Acreedora + Disminuye = DEBE
      op = nat === "deudora" ? "AUMENTA" : "DISMINUYE"
    } else {
      // Necesitamos saldo al HABER
      // Deudora + Disminuye = HABER
      // Acreedora + Aumenta = HABER
      op = nat === "deudora" ? "DISMINUYE" : "AUMENTA"
    }

    const simbolo: "+" | "-" = op === "AUMENTA" ? "+" : "-"
    const explicacion = `Para aportar $${montoFaltante.toFixed(2)} al ${columnaFaltante} usando ${cuenta.nombre} (${nat}), debe marcarse como ${op} (${simbolo}).`

    return { operacion: op, simbolo, explicacion }
  }

  return {
    hayDescuadre,
    totalDebe: debeCents / 100,
    totalHaber: haberCents / 100,
    diferencia: Math.abs(diffCents) / 100,
    columnaFaltante,
    montoFaltante,
    operacionSugeridaParaCuenta,
  }
}
