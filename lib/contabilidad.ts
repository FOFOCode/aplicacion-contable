import type {
  Asiento,
  AsientoLinea,
  Cuenta,
  Naturaleza,
  SaldoCuenta,
  TipoCuenta,
} from "./types"

// ============================================================
// UTILIDADES
// ============================================================

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

// ============================================================
// TOTALES DE ASIENTO
// ============================================================

export function totalesAsiento(lineas: AsientoLinea[]) {
  const debe = redondear(
    lineas.reduce(
      (s, l) => s + (Number(l.debe) || 0),
      0
    )
  )

  const haber = redondear(
    lineas.reduce(
      (s, l) => s + (Number(l.haber) || 0),
      0
    )
  )

  return {
    debe,
    haber,
    diferencia: redondear(debe - haber),
  }
}

// ============================================================
// VALIDACIÓN PARTIDA DOBLE
// ============================================================

export interface ResultadoValidacion {
  valido: boolean
  errores: string[]
}

export function validarPartidaDoble(
  fecha: string,
  concepto: string,
  lineas: AsientoLinea[]
): ResultadoValidacion {
  const errores: string[] = []

  if (!fecha) {
    errores.push(
      "La fecha del asiento es obligatoria."
    )
  }

  if (!concepto.trim()) {
    errores.push(
      "El concepto del asiento es obligatorio."
    )
  }

  const lineasConCuenta =
    lineas.filter((l) => l.codigo)

  if (lineasConCuenta.length < 2) {
    errores.push(
      "Un asiento debe tener al menos dos cuentas (un cargo y un abono)."
    )
  }

  for (const l of lineasConCuenta) {
    const debe =
      Number(l.debe) || 0

    const haber =
      Number(l.haber) || 0

    if (debe < 0 || haber < 0) {
      errores.push(
        `La cuenta ${l.codigo} tiene valores negativos.`
      )
    }

    if (
      debe > 0 &&
      haber > 0
    ) {
      errores.push(
        `La cuenta ${l.codigo} no puede tener Debe y Haber a la vez.`
      )
    }

    if (
      debe === 0 &&
      haber === 0
    ) {
      errores.push(
        `La cuenta ${l.codigo} no tiene ningún movimiento.`
      )
    }
  }

  const {
    debe,
    haber,
  } = totalesAsiento(
    lineasConCuenta
  )

  if (
    debe === 0 &&
    haber === 0
  ) {
    errores.push(
      "El asiento no tiene importes registrados."
    )
  } else if (
    debe !== haber
  ) {
    errores.push(
      `No se cumple la Partida Doble: el total del Debe (${formatoMoneda(
        debe
      )}) debe ser igual al total del Haber (${formatoMoneda(
        haber
      )}).`
    )
  }

  return {
    valido:
      errores.length === 0,
    errores,
  }
}

// ============================================================
// LIBRO MAYOR
// ============================================================

export function calcularMayor(
  cuentas: Cuenta[],
  asientos: Asiento[]
): SaldoCuenta[] {
  return cuentas
    .map((cuenta) => {
      let debe = 0
      let haber = 0

      for (
        const asiento
        of asientos
      ) {
        for (
          const linea
          of asiento.lineas
        ) {
          if (
            linea.codigo ===
            cuenta.codigo
          ) {
            debe +=
              Number(
                linea.debe
              ) || 0

            haber +=
              Number(
                linea.haber
              ) || 0
          }
        }
      }

      debe =
        redondear(debe)

      haber =
        redondear(haber)

      const saldo =
        redondear(
          debe - haber
        )

      const naturalezaSaldo:
        Naturaleza | null =
        saldo === 0
          ? null
          : saldo > 0
            ? "deudora"
            : "acreedora"

      return {
        cuenta,
        debe,
        haber,
        saldo,
        naturalezaSaldo,
      }
    })
    .filter(
      (s) =>
        s.debe !== 0 ||
        s.haber !== 0
    )
}

// ============================================================
// SALDO NORMALIZADO
// ============================================================

export function saldoNormalizado(
  s: SaldoCuenta
): number {
  return s.cuenta.naturaleza ===
    "deudora"
    ? redondear(
        s.debe - s.haber
      )
    : redondear(
        s.haber - s.debe
      )
}

// ============================================================
// LÍNEA DE REPORTE
// ============================================================

export interface LineaReporte {
  cuenta: Cuenta
  monto: number
}

function sumar(
  arr: LineaReporte[]
): number {
  return redondear(
    arr.reduce(
      (total, linea) =>
        total + linea.monto,
      0
    )
  )
}

// ============================================================
// ESTADO DE RESULTADOS
// ============================================================

export interface EstadoResultados {
  ingresos: LineaReporte[]
  gastos: LineaReporte[]

  // Ventas
  ventas: LineaReporte[]
  devolucionesVentas: LineaReporte[]
  otrosIngresosOperativos: LineaReporte[]

  // Compras / costo
  compras: LineaReporte[]
  gastosCompras: LineaReporte[]
  devolucionesCompras: LineaReporte[]
  costoVentas: LineaReporte[]

  // Gastos e ingresos financieros
  gastosOperacion: LineaReporte[]
  ingresosFinancieros: LineaReporte[]
  gastosFinancieros: LineaReporte[]

  // Totales de ventas
  totalVentasBrutas: number
  totalDevolucionesVentas: number
  totalVentas: number

  // Totales de compras
  totalCompras: number
  totalGastosCompras: number
  comprasTotales: number
  totalDevolucionesCompras: number
  comprasNetas: number

  // Costo
  totalCostoVentas: number
  usaDetalleCompras: boolean

  // Resultados
  utilidadBruta: number

  totalOtrosIngresosOperativos: number

  totalGastosOperacion: number
  utilidadOperacion: number

  totalIngresosFinancieros: number
  totalGastosFinancieros: number
  resultadoFinanciero: number

  totalIngresos: number
  totalGastos: number

  utilidadAntesImpuestos: number
  utilidad: number
}

export function calcularEstadoResultados(
  mayor: SaldoCuenta[]
): EstadoResultados {
  const ingresos: LineaReporte[] = []
  const gastos: LineaReporte[] = []

  const ventas: LineaReporte[] = []
  const devolucionesVentas: LineaReporte[] = []
  const otrosIngresosOperativos: LineaReporte[] = []

  const compras: LineaReporte[] = []
  const gastosCompras: LineaReporte[] = []
  const devolucionesCompras: LineaReporte[] = []
  const costoVentas: LineaReporte[] = []

  const gastosOperacion: LineaReporte[] = []
  const ingresosFinancieros: LineaReporte[] = []
  const gastosFinancieros: LineaReporte[] = []

  for (const s of mayor) {
    const codigo =
      s.cuenta.codigo

    // ========================================================
    // INGRESOS
    // ========================================================

    if (
      s.cuenta.tipo ===
      "ingreso"
    ) {
      // Devoluciones sobre ventas
      // Se manejan como contra-ingreso.
      if (
        codigo.startsWith(
          "512"
        )
      ) {
        const linea = {
          cuenta: s.cuenta,
          monto: redondear(
            s.debe - s.haber
          ),
        }

        devolucionesVentas.push(
          linea
        )

        continue
      }

      const linea = {
        cuenta: s.cuenta,
        monto: redondear(
          s.haber - s.debe
        ),
      }

      ingresos.push(linea)

      // Ingresos financieros
      if (
        codigo.startsWith(
          "52"
        )
      ) {
        ingresosFinancieros.push(
          linea
        )
      }

      // Ventas principales
      else if (
        codigo === "5101" ||
        codigo.startsWith(
          "511"
        )
      ) {
        ventas.push(linea)
      }

      // Otros ingresos
      else {
        otrosIngresosOperativos.push(
          linea
        )
      }
    }

    // ========================================================
    // COSTOS Y GASTOS
    // ========================================================

    else if (
      s.cuenta.tipo ===
      "gasto"
    ) {
      // Devoluciones sobre compras
      // Normalmente tienen movimiento acreedor.
      if (
        codigo.startsWith(
          "413"
        )
      ) {
        const linea = {
          cuenta: s.cuenta,
          monto: redondear(
            s.haber - s.debe
          ),
        }

        devolucionesCompras.push(
          linea
        )

        continue
      }

      const linea = {
        cuenta: s.cuenta,
        monto: redondear(
          s.debe - s.haber
        ),
      }

      gastos.push(linea)

      // Compras
      if (
        codigo.startsWith(
          "411"
        )
      ) {
        compras.push(linea)
      }

      // Gastos sobre compras
      else if (
        codigo.startsWith(
          "412"
        )
      ) {
        gastosCompras.push(
          linea
        )
      }

      // Gastos financieros
      else if (
        codigo.startsWith(
          "43"
        )
      ) {
        gastosFinancieros.push(
          linea
        )
      }

      // Gastos de operación
      else if (
        codigo.startsWith(
          "42"
        )
      ) {
        gastosOperacion.push(
          linea
        )
      }

      // Costo de venta directo
      else if (
        codigo.startsWith(
          "41"
        )
      ) {
        costoVentas.push(
          linea
        )
      }

      // Si hay otra cuenta de gasto,
      // se considera gasto de operación.
      else {
        gastosOperacion.push(
          linea
        )
      }
    }
  }

  // ==========================================================
  // VENTAS
  // ==========================================================

  const totalVentasBrutas =
    sumar(ventas)

  const totalDevolucionesVentas =
    sumar(
      devolucionesVentas
    )

  const totalVentas =
    redondear(
      totalVentasBrutas -
        totalDevolucionesVentas
    )

  // ==========================================================
  // COMPRAS
  // ==========================================================

  const totalCompras =
    sumar(compras)

  const totalGastosCompras =
    sumar(gastosCompras)

  const comprasTotales =
    redondear(
      totalCompras +
        totalGastosCompras
    )

  const totalDevolucionesCompras =
    sumar(
      devolucionesCompras
    )

  const comprasNetas =
    redondear(
      comprasTotales -
        totalDevolucionesCompras
    )

  // ==========================================================
  // COSTO DE VENTA
  // ==========================================================

  const costoVentaDirecto =
    sumar(costoVentas)

  // Si existen cuentas de compras,
  // usamos el esquema del ejercicio:
  //
  // Compras
  // + Gastos sobre compras
  // - Devoluciones sobre compras
  // = Compras netas
  // = Costo de venta
  //
  // SIN inventario inicial ni inventario final.

  const usaDetalleCompras =
    compras.length > 0 ||
    gastosCompras.length > 0 ||
    devolucionesCompras.length > 0

  const totalCostoVentas =
    usaDetalleCompras
      ? comprasNetas
      : costoVentaDirecto

  // ==========================================================
  // UTILIDAD BRUTA
  // ==========================================================

  const utilidadBruta =
    redondear(
      totalVentas -
        totalCostoVentas
    )

  // ==========================================================
  // OTROS INGRESOS OPERATIVOS
  // ==========================================================

  const totalOtrosIngresosOperativos =
    sumar(
      otrosIngresosOperativos
    )

  // ==========================================================
  // GASTOS DE OPERACIÓN
  // ==========================================================

  const totalGastosOperacion =
    sumar(
      gastosOperacion
    )

  const utilidadOperacion =
    redondear(
      utilidadBruta +
        totalOtrosIngresosOperativos -
        totalGastosOperacion
    )

  // ==========================================================
  // RESULTADO FINANCIERO
  // ==========================================================

  const totalIngresosFinancieros =
    sumar(
      ingresosFinancieros
    )

  const totalGastosFinancieros =
    sumar(
      gastosFinancieros
    )

  const resultadoFinanciero =
    redondear(
      totalIngresosFinancieros -
        totalGastosFinancieros
    )

  // ==========================================================
  // RESULTADO FINAL
  // ==========================================================

  const utilidadAntesImpuestos =
    redondear(
      utilidadOperacion +
        resultadoFinanciero
    )

  const totalIngresos =
    redondear(
      totalVentas +
        totalOtrosIngresosOperativos +
        totalIngresosFinancieros
    )

  const totalGastos =
    redondear(
      totalCostoVentas +
        totalGastosOperacion +
        totalGastosFinancieros
    )

  return {
    ingresos,
    gastos,

    ventas,
    devolucionesVentas,
    otrosIngresosOperativos,

    compras,
    gastosCompras,
    devolucionesCompras,
    costoVentas,

    gastosOperacion,
    ingresosFinancieros,
    gastosFinancieros,

    totalVentasBrutas,
    totalDevolucionesVentas,
    totalVentas,

    totalCompras,
    totalGastosCompras,
    comprasTotales,
    totalDevolucionesCompras,
    comprasNetas,

    totalCostoVentas,
    usaDetalleCompras,

    utilidadBruta,

    totalOtrosIngresosOperativos,

    totalGastosOperacion,
    utilidadOperacion,

    totalIngresosFinancieros,
    totalGastosFinancieros,
    resultadoFinanciero,

    totalIngresos,
    totalGastos,

    utilidadAntesImpuestos,

    // Por ahora no tenemos una cuenta
    // automática de impuesto sobre la renta.
    // Por eso utilidad = utilidad antes de impuestos.
    utilidad:
      utilidadAntesImpuestos,
  }
}

// ============================================================
// BALANCE GENERAL
// ============================================================

export interface BalanceGeneral {
  activos: LineaReporte[]
  pasivos: LineaReporte[]
  capital: LineaReporte[]

  activosCorrientes: LineaReporte[]
  activosNoCorrientes: LineaReporte[]

  pasivosCorrientes: LineaReporte[]
  pasivosNoCorrientes: LineaReporte[]

  totalActivoCorriente: number
  totalActivoNoCorriente: number

  totalPasivoCorriente: number
  totalPasivoNoCorriente: number

  totalActivo: number
  totalPasivo: number

  totalCapitalCuentas: number
  totalCapitalContable: number

  utilidadEjercicio: number

  totalPasivoMasCapital: number

  cuadra: boolean
}

export function calcularBalanceGeneral(
  mayor: SaldoCuenta[],
  utilidadEjercicio: number
): BalanceGeneral {
  const activos: LineaReporte[] = []
  const pasivos: LineaReporte[] = []
  const capital: LineaReporte[] = []

  const activosCorrientes: LineaReporte[] = []
  const activosNoCorrientes: LineaReporte[] = []

  const pasivosCorrientes: LineaReporte[] = []
  const pasivosNoCorrientes: LineaReporte[] = []

  for (const s of mayor) {
    const codigo =
      s.cuenta.codigo

    // ========================================================
    // ACTIVO
    // ========================================================

    if (
      s.cuenta.tipo ===
      "activo"
    ) {
      const linea = {
        cuenta: s.cuenta,
        monto: redondear(
          s.debe - s.haber
        ),
      }

      activos.push(linea)

      // 11 = Activo corriente
      if (
        codigo.startsWith(
          "11"
        )
      ) {
        activosCorrientes.push(
          linea
        )
      }

      // Todo activo distinto de 11
      // se considera no corriente.
      else {
        activosNoCorrientes.push(
          linea
        )
      }
    }

    // ========================================================
    // PASIVO
    // ========================================================

    else if (
      s.cuenta.tipo ===
      "pasivo"
    ) {
      const linea = {
        cuenta: s.cuenta,
        monto: redondear(
          s.haber - s.debe
        ),
      }

      pasivos.push(linea)

      // 21 = Pasivo corriente
      if (
        codigo.startsWith(
          "21"
        )
      ) {
        pasivosCorrientes.push(
          linea
        )
      }

      // Todo pasivo distinto de 21
      // se considera no corriente.
      else {
        pasivosNoCorrientes.push(
          linea
        )
      }
    }

    // ========================================================
    // CAPITAL
    // ========================================================

    else if (
      s.cuenta.tipo ===
      "capital"
    ) {
      capital.push({
        cuenta: s.cuenta,
        monto: redondear(
          s.haber - s.debe
        ),
      })
    }
  }

  // ==========================================================
  // TOTALES ACTIVO
  // ==========================================================

  const totalActivoCorriente =
    sumar(
      activosCorrientes
    )

  const totalActivoNoCorriente =
    sumar(
      activosNoCorrientes
    )

  const totalActivo =
    redondear(
      totalActivoCorriente +
        totalActivoNoCorriente
    )

  // ==========================================================
  // TOTALES PASIVO
  // ==========================================================

  const totalPasivoCorriente =
    sumar(
      pasivosCorrientes
    )

  const totalPasivoNoCorriente =
    sumar(
      pasivosNoCorrientes
    )

  const totalPasivo =
    redondear(
      totalPasivoCorriente +
        totalPasivoNoCorriente
    )

  // ==========================================================
  // CAPITAL
  // ==========================================================

  const totalCapitalCuentas =
    sumar(capital)

  const totalCapitalContable =
    redondear(
      totalCapitalCuentas +
        utilidadEjercicio
    )

  const totalPasivoMasCapital =
    redondear(
      totalPasivo +
        totalCapitalContable
    )

  return {
    activos,
    pasivos,
    capital,

    activosCorrientes,
    activosNoCorrientes,

    pasivosCorrientes,
    pasivosNoCorrientes,

    totalActivoCorriente,
    totalActivoNoCorriente,

    totalPasivoCorriente,
    totalPasivoNoCorriente,

    totalActivo,
    totalPasivo,

    totalCapitalCuentas,
    totalCapitalContable,

    utilidadEjercicio,

    totalPasivoMasCapital,

    cuadra:
      Math.abs(
        totalActivo -
          totalPasivoMasCapital
      ) < 0.01,
  }
}

// ============================================================
// TOTALES GENERALES
// ============================================================

export interface Totales {
  totalPorTipo: Record<
    TipoCuenta,
    number
  >

  totalDebe: number
  totalHaber: number
  numeroAsientos: number
}