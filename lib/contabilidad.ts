import type { Asiento, AsientoLinea, Cuenta, Naturaleza, SaldoCuenta, TipoCuenta } from "./types"
import { subgrupoResultados } from "./types"

export function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function formatoMoneda(n: number): string {
  return new Intl.NumberFormat("es-SV", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n || 0)
}

export function totalesAsiento(lineas: AsientoLinea[]) {
  const debe = redondear(lineas.reduce((s, l) => s + (Number(l.debe) || 0), 0))
  const haber = redondear(lineas.reduce((s, l) => s + (Number(l.haber) || 0), 0))
  return { debe, haber, diferencia: redondear(debe - haber) }
}

export interface ResultadoValidacion {
  valido: boolean
  errores: string[]
}

/**
 * Valida la Partida Doble y la integridad del asiento.
 * El sistema debe bloquear el guardado si no se cumple.
 */
export function validarPartidaDoble(
  fecha: string,
  concepto: string,
  lineas: AsientoLinea[],
): ResultadoValidacion {
  const errores: string[] = []

  if (!fecha) errores.push("La fecha del asiento es obligatoria.")
  if (!concepto.trim()) errores.push("El concepto del asiento es obligatorio.")

  const lineasConCuenta = lineas.filter((l) => l.codigo)
  if (lineasConCuenta.length < 2) {
    errores.push("Un asiento debe tener al menos dos cuentas (un cargo y un abono).")
  }

  for (const l of lineasConCuenta) {
    const debe = Number(l.debe) || 0
    const haber = Number(l.haber) || 0
    if (debe < 0 || haber < 0) {
      errores.push(`La cuenta ${l.codigo} tiene valores negativos.`)
    }
    if (debe > 0 && haber > 0) {
      errores.push(`La cuenta ${l.codigo} no puede tener Debe y Haber a la vez.`)
    }
    if (debe === 0 && haber === 0) {
      errores.push(`La cuenta ${l.codigo} no tiene ningún movimiento.`)
    }
  }

  const { debe, haber } = totalesAsiento(lineasConCuenta)
  if (debe === 0 && haber === 0) {
    errores.push("El asiento no tiene importes registrados.")
  } else if (debe !== haber) {
    errores.push(
      `No se cumple la Partida Doble: el total del Debe (${formatoMoneda(debe)}) debe ser igual al total del Haber (${formatoMoneda(haber)}).`,
    )
  }

  return { valido: errores.length === 0, errores }
}

/**
 * Mayorización automática: consolida débitos y créditos de cada cuenta
 * del catálogo y determina el saldo (Deudor / Acreedor).
 */
export function calcularMayor(
  cuentas: Cuenta[],
  asientos: Asiento[],
  ejercicioFiltro?: number,
  incluirCierre: boolean = false
): SaldoCuenta[] {
  return cuentas
    .map((cuenta) => {
      let debe = 0
      let haber = 0
      for (const asiento of asientos) {
        if (asiento.estado === "ANULADO") continue
        if (!incluirCierre && asiento.tipo === "CIERRE") continue
        if (ejercicioFiltro !== undefined) {
          const ej = asiento.ejercicio || (asiento.fecha ? new Date(asiento.fecha).getFullYear() : undefined)
          if (ej !== undefined && ej !== ejercicioFiltro) continue
        }
        for (const linea of asiento.lineas) {
          if (linea.codigo === cuenta.codigo) {
            debe += Number(linea.debe) || 0
            haber += Number(linea.haber) || 0
          }
        }
      }
      debe = redondear(debe)
      haber = redondear(haber)
      const saldo = redondear(debe - haber)
      const naturalezaSaldo: Naturaleza | null = saldo === 0 ? null : saldo > 0 ? "deudora" : "acreedora"
      return { cuenta, debe, haber, saldo, naturalezaSaldo }
    })
    .filter((s) => s.debe !== 0 || s.haber !== 0)
}

/** Saldo mostrado según la naturaleza de la cuenta (siempre positivo cuando es normal). */
export function saldoNormalizado(s: SaldoCuenta): number {
  return s.cuenta.naturaleza === "deudora" ? redondear(s.debe - s.haber) : redondear(s.haber - s.debe)
}

export interface LineaReporte {
  cuenta: Cuenta
  monto: number
}

export interface MetodoAnaliticoDetalle {
  // Ventas Netas
  ventasTotales: number
  devolucionesSobreVentas: number
  rebajasSobreVentas: number
  ventasNetas: number

  // Compras y Mercancías
  inventarioInicial: number
  compras: number
  gastosSobreCompras: number
  comprasTotales: number
  devolucionesSobreCompras: number
  rebajasSobreCompras: number
  comprasNetas: number
  totalMercancias: number
  inventarioFinalEstimado: number
  valorInventarioFinal: number
  fechaInventarioFinal?: string | null
  responsableInventarioFinal?: string | null
  costoVentas: number

  // Resultados
  utilidadBruta: number
  gastosOperacion: number
  utilidadOperacion: number
  totalIngresosFinancieros: number
  totalGastosFinancieros: number
  otrosIngresos: number
  utilidadNeta: number
}

export interface EstadoResultados {
  ingresos: LineaReporte[]
  gastos: LineaReporte[]
  // Desglose en cascada
  ventas: LineaReporte[]
  costoVentas: LineaReporte[]
  gastosOperacion: LineaReporte[]
  ingresosFinancieros: LineaReporte[]
  gastosFinancieros: LineaReporte[]
  totalVentas: number
  totalCostoVentas: number
  utilidadBruta: number
  totalGastosOperacion: number
  utilidadOperacion: number
  totalIngresosFinancieros: number
  totalGastosFinancieros: number
  resultadoFinanciero: number
  totalIngresos: number
  totalGastos: number
  utilidad: number
  // Detalle del Método Analítico o Pormenorizado
  analitico: MetodoAnaliticoDetalle
  /** Indica si los valores fueron extraídos directamente de la vista SQL vista_estado_resultados_analitico */
  calculadoPorSql?: boolean
}

/**
 * Estado de Resultados: código 5 (ingresos) - código 4 (costos y gastos) = utilidad.
 * Además arma el reporte en cascada y calcula las fórmulas oficiales del Método Analítico o Pormenorizado.
 */
export function calcularEstadoResultados(
  mayor: SaldoCuenta[],
  inventarioFinal?: number,
  metaInventario?: { fecha?: string | null; responsable?: string | null }
): EstadoResultados {
  const ingresos: LineaReporte[] = []
  const gastos: LineaReporte[] = []
  const ventas: LineaReporte[] = []
  const costoVentas: LineaReporte[] = []
  const gastosOperacion: LineaReporte[] = []
  const ingresosFinancieros: LineaReporte[] = []
  const gastosFinancieros: LineaReporte[] = []

  for (const s of mayor) {
    if (s.cuenta.tipo === "ingreso") {
      const linea = { cuenta: s.cuenta, monto: redondear(s.haber - s.debe) }
      ingresos.push(linea)
      if (subgrupoResultados(s.cuenta.codigo, "ingreso") === "ingresosFinancieros") {
        ingresosFinancieros.push(linea)
      } else {
        ventas.push(linea)
      }
    } else if (s.cuenta.tipo === "gasto") {
      const linea = { cuenta: s.cuenta, monto: redondear(s.debe - s.haber) }
      gastos.push(linea)
      const sub = subgrupoResultados(s.cuenta.codigo, "gasto")
      if (sub === "costoVentas") costoVentas.push(linea)
      else if (sub === "gastosFinancieros") gastosFinancieros.push(linea)
      else gastosOperacion.push(linea)
    }
  }

  const suma = (arr: LineaReporte[]) => redondear(arr.reduce((a, b) => a + b.monto, 0))
  const totalVentas = suma(ventas)
  const totalCostoVentas = suma(costoVentas)
  const utilidadBruta = redondear(totalVentas - totalCostoVentas)
  const totalGastosOperacion = suma(gastosOperacion)
  const utilidadOperacion = redondear(utilidadBruta - totalGastosOperacion)
  const totalIngresosFinancieros = suma(ingresosFinancieros)
  const totalGastosFinancieros = suma(gastosFinancieros)
  const resultadoFinanciero = redondear(totalIngresosFinancieros - totalGastosFinancieros)
  const totalIngresos = suma(ingresos)
  const totalGastos = suma(gastos)

  // Fórmulas oficiales del Método Analítico o Pormenorizado
  const buscarSaldo = (codigo: string) => {
    const item = mayor.find((m) => m.cuenta.codigo === codigo)
    if (!item) return 0
    return redondear(item.cuenta.naturaleza === "deudora" ? item.debe - item.haber : item.haber - item.debe)
  }

  const ventasTotales = Math.max(0, buscarSaldo("5101"))
  const devolucionesSobreVentas = Math.max(0, buscarSaldo("4103"))
  const rebajasSobreVentas = Math.max(0, buscarSaldo("4104"))
  const ventasNetas = redondear(ventasTotales - devolucionesSobreVentas - rebajasSobreVentas)

  const inventarioInicial = Math.max(0, buscarSaldo("1104"))
  const compras = Math.max(0, buscarSaldo("4101"))
  const gastosSobreCompras = Math.max(0, buscarSaldo("4102"))
  const comprasTotales = redondear(compras + gastosSobreCompras)
  const devolucionesSobreCompras = Math.max(0, buscarSaldo("5102"))
  const rebajasSobreCompras = Math.max(0, buscarSaldo("5103"))
  const comprasNetas = redondear(comprasTotales - devolucionesSobreCompras - rebajasSobreCompras)
  const totalMercancias = redondear(inventarioInicial + comprasNetas)

  // Desacoplamiento resuelto: Usar el valor real de la Toma Física de Inventarios cuando esté disponible
  const inventarioFinalReal =
    typeof inventarioFinal === "number" && !isNaN(inventarioFinal)
      ? inventarioFinal
      : inventarioInicial
  const costoVentasAnalitico = redondear(totalMercancias - inventarioFinalReal)
  const utilidadBrutaAnalitica = redondear(ventasNetas - costoVentasAnalitico)
  const otrosIngresos = Math.max(0, buscarSaldo("5104"))

  return {
    ingresos,
    gastos,
    ventas,
    costoVentas,
    gastosOperacion,
    ingresosFinancieros,
    gastosFinancieros,
    totalVentas,
    totalCostoVentas,
    utilidadBruta,
    totalGastosOperacion,
    utilidadOperacion,
    totalIngresosFinancieros,
    totalGastosFinancieros,
    resultadoFinanciero,
    totalIngresos,
    totalGastos,
    utilidad: redondear(totalIngresos - totalGastos),
    analitico: {
      ventasTotales,
      devolucionesSobreVentas,
      rebajasSobreVentas,
      ventasNetas,
      inventarioInicial,
      compras,
      gastosSobreCompras,
      comprasTotales,
      devolucionesSobreCompras,
      rebajasSobreCompras,
      comprasNetas,
      totalMercancias,
      inventarioFinalEstimado: inventarioFinalReal,
      valorInventarioFinal: inventarioFinalReal,
      fechaInventarioFinal: metaInventario?.fecha || null,
      responsableInventarioFinal: metaInventario?.responsable || null,
      costoVentas: costoVentasAnalitico,
      utilidadBruta: utilidadBrutaAnalitica,
      gastosOperacion: totalGastosOperacion,
      utilidadOperacion,
      totalIngresosFinancieros,
      totalGastosFinancieros,
      otrosIngresos,
      utilidadNeta: redondear(totalIngresos - totalGastos),
    },
  }
}

export interface BalanceGeneral {
  activos: LineaReporte[]
  pasivos: LineaReporte[]
  capital: LineaReporte[]
  totalActivo: number
  totalPasivo: number
  totalCapitalContable: number
  utilidadEjercicio: number
  totalPasivoMasCapital: number
  cuadra: boolean
}

/** Balance General: código 1 (activo) = código 2 (pasivo) + código 3 (capital contable) */
export function calcularBalanceGeneral(
  mayor: SaldoCuenta[],
  utilidadEjercicio: number,
  inventarioFinal?: number
): BalanceGeneral {
  const activos: LineaReporte[] = []
  const pasivos: LineaReporte[] = []
  const capital: LineaReporte[] = []

  let tiene1104 = false
  for (const s of mayor) {
    if (s.cuenta.tipo === "activo") {
      let monto = redondear(s.debe - s.haber)
      if (s.cuenta.codigo === "1104") {
        tiene1104 = true
        if (typeof inventarioFinal === "number" && !isNaN(inventarioFinal)) {
          monto = redondear(inventarioFinal)
        }
      }
      activos.push({ cuenta: s.cuenta, monto })
    } else if (s.cuenta.tipo === "pasivo") {
      pasivos.push({ cuenta: s.cuenta, monto: redondear(s.haber - s.debe) })
    } else if (s.cuenta.tipo === "capital") {
      capital.push({ cuenta: s.cuenta, monto: redondear(s.haber - s.debe) })
    }
  }

  // Si la cuenta 1104 no tuvo movimientos en el mayor pero hay inventario final definido
  if (!tiene1104 && typeof inventarioFinal === "number" && inventarioFinal > 0) {
    activos.push({
      cuenta: {
        codigo: "1104",
        nombre: "Inventario de mercadería",
        tipo: "activo",
        naturaleza: "deudora",
        activa: true,
      },
      monto: redondear(inventarioFinal),
    })
  }

  const totalActivo = redondear(activos.reduce((a, b) => a + b.monto, 0))
  const totalPasivo = redondear(pasivos.reduce((a, b) => a + b.monto, 0))
  const totalCapitalCuentas = redondear(capital.reduce((a, b) => a + b.monto, 0))
  const totalCapitalContable = redondear(totalCapitalCuentas + utilidadEjercicio)
  const totalPasivoMasCapital = redondear(totalPasivo + totalCapitalContable)

  return {
    activos,
    pasivos,
    capital,
    totalActivo,
    totalPasivo,
    totalCapitalContable,
    utilidadEjercicio,
    totalPasivoMasCapital,
    cuadra: Math.abs(totalActivo - totalPasivoMasCapital) < 0.01,
  }
}

export interface Totales {
  totalPorTipo: Record<TipoCuenta, number>
  totalDebe: number
  totalHaber: number
  numeroAsientos: number
}
