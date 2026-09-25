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

export function obtenerFechaLocal(d: Date = new Date()): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
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

export interface TotalesLoteResultado {
  totalDebe: number
  totalHaber: number
  diferencia: number
  cuadrado: boolean
  partidasValidas: number
  partidasConError: number
  totalPartidas: number
}

export function calcularTotalesLote(
  asientos: Asiento[]
): TotalesLoteResultado {
  let debeCents = 0
  let haberCents = 0
  let partidasValidas = 0
  let partidasConError = 0

  for (const a of asientos) {
    if (a.estado === "ANULADO") {
      continue
    }

    let aDebeCents = 0
    let aHaberCents = 0

    for (const l of a.lineas) {
      aDebeCents +=
        Math.round(
          (Number(l.debe) || 0) * 100
        )

      aHaberCents +=
        Math.round(
          (Number(l.haber) || 0) * 100
        )
    }

    debeCents += aDebeCents
    haberCents += aHaberCents

    if (
      aDebeCents === aHaberCents &&
      aDebeCents > 0
    ) {
      partidasValidas++
    } else {
      partidasConError++
    }
  }

  const diffCents =
    debeCents - haberCents

  const totalDebe =
    debeCents / 100

  const totalHaber =
    haberCents / 100

  const diferencia =
    Math.abs(diffCents) / 100

  const cuadrado =
    diffCents === 0 &&
    (
      asientos.length === 0 ||
      (
        debeCents > 0 &&
        partidasConError === 0
      )
    )

  return {
    totalDebe,
    totalHaber,
    diferencia,
    cuadrado,
    partidasValidas,
    partidasConError,
    totalPartidas:
      asientos.length,
  }
}

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
    lineas.filter(
      (l) => l.codigo
    )

  if (
    lineasConCuenta.length < 2
  ) {
    errores.push(
      "Un asiento debe tener al menos dos cuentas (un cargo y un abono)."
    )
  }

  for (const l of lineasConCuenta) {
    const debe =
      Number(l.debe) || 0

    const haber =
      Number(l.haber) || 0

    if (
      debe < 0 ||
      haber < 0
    ) {
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
  asientos: Asiento[],
  ejercicioFiltro?: number,
  incluirCierre:
    boolean = false
): SaldoCuenta[] {
  return cuentas
    .map((cuenta) => {
      let debeCents = 0
      let haberCents = 0

      for (
        const asiento
        of asientos
      ) {
        if (
          asiento.estado ===
          "ANULADO"
        ) {
          continue
        }

        if (
          !incluirCierre &&
          asiento.tipo ===
          "CIERRE"
        ) {
          continue
        }

        if (
          ejercicioFiltro !==
          undefined
        ) {
          const ej =
            asiento.ejercicio ||
            (
              asiento.fecha
                ? new Date(
                    asiento.fecha
                  ).getFullYear()
                : undefined
            )

          if (
            ej !==
              undefined &&
            ej !==
              ejercicioFiltro
          ) {
            continue
          }
        }

        for (
          const linea
          of asiento.lineas
        ) {
          if (
            linea.codigo ===
            cuenta.codigo
          ) {
            debeCents +=
              Math.round(
                (
                  Number(
                    linea.debe
                  ) || 0
                ) * 100
              )

            haberCents +=
              Math.round(
                (
                  Number(
                    linea.haber
                  ) || 0
                ) * 100
              )
          }
        }
      }

      const debe =
        debeCents / 100

      const haber =
        haberCents / 100

      const saldo =
        (
          debeCents -
          haberCents
        ) / 100

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
  return (
    s.cuenta.naturaleza ===
    "deudora"
      ? redondear(
          s.debe -
          s.haber
        )
      : redondear(
          s.haber -
          s.debe
        )
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
      (
        total,
        linea
      ) =>
        total +
        linea.monto,
      0
    )
  )
}

export interface MetodoAnaliticoDetalle {
  ventasTotales: number

  devolucionesSobreVentas:
    number

  rebajasSobreVentas:
    number

  ventasNetas: number

  inventarioInicial: number

  compras: number

  gastosSobreCompras:
    number

  comprasTotales: number

  devolucionesSobreCompras:
    number

  rebajasSobreCompras:
    number

  comprasNetas: number

  totalMercancias: number

  inventarioFinalEstimado:
    number

  valorInventarioFinal:
    number

  fechaInventarioFinal?:
    string | null

  responsableInventarioFinal?:
    string | null

  costoVentas: number

  utilidadBruta: number

  gastosOperacion: number

  utilidadOperacion: number

  totalIngresosFinancieros:
    number

  totalGastosFinancieros:
    number

  otrosIngresos: number

  utilidadNeta: number
}

// ============================================================
// ESTADO DE RESULTADOS
// ============================================================

export interface EstadoResultados {
  ingresos: LineaReporte[]
  gastos: LineaReporte[]

  ventas: LineaReporte[]

  devolucionesVentas:
    LineaReporte[]

  otrosIngresosOperativos:
    LineaReporte[]

  compras: LineaReporte[]

  gastosCompras:
    LineaReporte[]

  devolucionesCompras:
    LineaReporte[]

  costoVentas: LineaReporte[]

  gastosOperacion:
    LineaReporte[]

  ingresosFinancieros:
    LineaReporte[]

  gastosFinancieros:
    LineaReporte[]

  totalVentasBrutas:
    number

  totalDevolucionesVentas:
    number

  totalVentas: number

  totalCompras: number

  totalGastosCompras:
    number

  comprasTotales: number

  totalDevolucionesCompras:
    number

  comprasNetas: number

  totalCostoVentas:
    number

  usaDetalleCompras:
    boolean

  utilidadBruta: number

  totalOtrosIngresosOperativos:
    number

  totalGastosOperacion:
    number

  utilidadOperacion:
    number

  totalIngresosFinancieros:
    number

  totalGastosFinancieros:
    number

  resultadoFinanciero:
    number

  totalIngresos: number

  totalGastos: number

  utilidadAntesImpuestos:
    number

  utilidad: number

  analitico:
    MetodoAnaliticoDetalle

  calculadoPorSql?:
    boolean
}

export function calcularEstadoResultados(
  mayor: SaldoCuenta[],
  inventarioFinal?: number,
  metaInventario?: {
    fecha?:
      string | null

    responsable?:
      string | null
  }
): EstadoResultados {
  const ingresos:
    LineaReporte[] = []

  const gastos:
    LineaReporte[] = []

  const ventas:
    LineaReporte[] = []

  const devolucionesVentas:
    LineaReporte[] = []

  const otrosIngresosOperativos:
    LineaReporte[] = []

  const compras:
    LineaReporte[] = []

  const gastosCompras:
    LineaReporte[] = []

  const devolucionesCompras:
    LineaReporte[] = []

  const costoVentas:
    LineaReporte[] = []

  const gastosOperacion:
    LineaReporte[] = []

  const ingresosFinancieros:
    LineaReporte[] = []

  const gastosFinancieros:
    LineaReporte[] = []

  for (
    const s
    of mayor
  ) {
    const codigo =
      s.cuenta.codigo

    if (
      s.cuenta.tipo ===
      "ingreso"
    ) {
      if (
        codigo.startsWith(
          "512"
        )
      ) {
        const linea = {
          cuenta:
            s.cuenta,

          monto:
            redondear(
              s.debe -
              s.haber
            ),
        }

        devolucionesVentas.push(
          linea
        )

        continue
      }

      const linea = {
        cuenta:
          s.cuenta,

        monto:
          redondear(
            s.haber -
            s.debe
          ),
      }

      ingresos.push(
        linea
      )

      if (
        codigo.startsWith(
          "52"
        )
      ) {
        ingresosFinancieros.push(
          linea
        )
      } else if (
        codigo === "5101" ||
        codigo.startsWith(
          "511"
        )
      ) {
        ventas.push(
          linea
        )
      } else {
        otrosIngresosOperativos.push(
          linea
        )
      }
    } else if (
      s.cuenta.tipo ===
      "gasto"
    ) {
      if (
        codigo.startsWith(
          "413"
        )
      ) {
        const linea = {
          cuenta:
            s.cuenta,

          monto:
            redondear(
              s.haber -
              s.debe
            ),
        }

        devolucionesCompras.push(
          linea
        )

        continue
      }

      const linea = {
        cuenta:
          s.cuenta,

        monto:
          redondear(
            s.debe -
            s.haber
          ),
      }

      gastos.push(
        linea
      )

      if (
        codigo.startsWith(
          "411"
        )
      ) {
        compras.push(
          linea
        )
      } else if (
        codigo.startsWith(
          "412"
        )
      ) {
        gastosCompras.push(
          linea
        )
      } else if (
        codigo.startsWith(
          "43"
        )
      ) {
        gastosFinancieros.push(
          linea
        )
      } else if (
        codigo.startsWith(
          "42"
        )
      ) {
        gastosOperacion.push(
          linea
        )
      } else if (
        codigo.startsWith(
          "41"
        )
      ) {
        costoVentas.push(
          linea
        )
      } else {
        gastosOperacion.push(
          linea
        )
      }
    }
  }

  const totalVentasBrutas =
    sumar(
      ventas
    )

  const totalDevolucionesVentas =
    sumar(
      devolucionesVentas
    )

  const totalVentas =
    redondear(
      totalVentasBrutas -
      totalDevolucionesVentas
    )

  const totalCompras =
    sumar(
      compras
    )

  const totalGastosCompras =
    sumar(
      gastosCompras
    )

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

  const costoVentaDirecto =
    sumar(
      costoVentas
    )

  const usaDetalleCompras =
    compras.length > 0 ||
    gastosCompras.length > 0 ||
    devolucionesCompras.length >
      0

  const totalCostoVentas =
    usaDetalleCompras
      ? comprasNetas
      : costoVentaDirecto

  const utilidadBruta =
    redondear(
      totalVentas -
      totalCostoVentas
    )

  const totalOtrosIngresosOperativos =
    sumar(
      otrosIngresosOperativos
    )

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

  function buscarSaldo(
    codigo: string
  ) {
    const item =
      mayor.find(
        (m) =>
          m.cuenta.codigo ===
          codigo
      )

    if (!item) {
      return 0
    }

    return redondear(
      item.cuenta.naturaleza ===
      "deudora"
        ? item.debe -
          item.haber
        : item.haber -
          item.debe
    )
  }

  const ventasTotales =
    Math.max(
      0,
      buscarSaldo(
        "5101"
      )
    )

  const devolucionesSobreVentas =
    Math.max(
      0,
      buscarSaldo(
        "4103"
      )
    )

  const rebajasSobreVentas =
    Math.max(
      0,
      buscarSaldo(
        "4104"
      )
    )

  const ventasNetas =
    redondear(
      ventasTotales -
      devolucionesSobreVentas -
      rebajasSobreVentas
    )

  const inventarioInicial =
    Math.max(
      0,
      buscarSaldo(
        "1104"
      )
    )

  const comprasAnaliticas =
    Math.max(
      0,
      buscarSaldo(
        "4101"
      )
    )

  const gastosSobreCompras =
    Math.max(
      0,
      buscarSaldo(
        "4102"
      )
    )

  const comprasTotalesAnaliticas =
    redondear(
      comprasAnaliticas +
      gastosSobreCompras
    )

  const devolucionesSobreCompras =
    Math.max(
      0,
      buscarSaldo(
        "5102"
      )
    )

  const rebajasSobreCompras =
    Math.max(
      0,
      buscarSaldo(
        "5103"
      )
    )

  const comprasNetasAnaliticas =
    redondear(
      comprasTotalesAnaliticas -
      devolucionesSobreCompras -
      rebajasSobreCompras
    )

  const totalMercancias =
    redondear(
      inventarioInicial +
      comprasNetasAnaliticas
    )

  const inventarioFinalReal =
    typeof inventarioFinal ===
      "number" &&
    !Number.isNaN(
      inventarioFinal
    )
      ? inventarioFinal
      : inventarioInicial

  const costoVentasAnalitico =
    redondear(
      totalMercancias -
      inventarioFinalReal
    )

  const utilidadBrutaAnalitica =
    redondear(
      ventasNetas -
      costoVentasAnalitico
    )

  const utilidadOperacionAnalitica =
    redondear(
      utilidadBrutaAnalitica -
      totalGastosOperacion
    )

  const otrosIngresos =
    Math.max(
      0,
      buscarSaldo(
        "5104"
      )
    )

  const utilidadNetaAnalitica =
    redondear(
      utilidadOperacionAnalitica +
      resultadoFinanciero +
      otrosIngresos
    )

  const utilidad =
    inventarioFinal !==
    undefined
      ? utilidadNetaAnalitica
      : redondear(
          totalIngresos -
          totalGastos
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

    utilidad,

    analitico: {
      ventasTotales,

      devolucionesSobreVentas,

      rebajasSobreVentas,

      ventasNetas,

      inventarioInicial,

      compras:
        comprasAnaliticas,

      gastosSobreCompras,

      comprasTotales:
        comprasTotalesAnaliticas,

      devolucionesSobreCompras,

      rebajasSobreCompras,

      comprasNetas:
        comprasNetasAnaliticas,

      totalMercancias,

      inventarioFinalEstimado:
        inventarioFinalReal,

      valorInventarioFinal:
        inventarioFinalReal,

      fechaInventarioFinal:
        metaInventario
          ?.fecha ??
        null,

      responsableInventarioFinal:
        metaInventario
          ?.responsable ??
        null,

      costoVentas:
        costoVentasAnalitico,

      utilidadBruta:
        utilidadBrutaAnalitica,

      gastosOperacion:
        totalGastosOperacion,

      utilidadOperacion:
        utilidadOperacionAnalitica,

      totalIngresosFinancieros,

      totalGastosFinancieros,

      otrosIngresos,

      utilidadNeta:
        utilidadNetaAnalitica,
    },
  }
}

// ============================================================
// BALANCE GENERAL
// ============================================================

export interface BalanceGeneral {
  activos: LineaReporte[]
  pasivos: LineaReporte[]
  capital: LineaReporte[]

  activosCorrientes:
    LineaReporte[]

  activosNoCorrientes:
    LineaReporte[]

  pasivosCorrientes:
    LineaReporte[]

  pasivosNoCorrientes:
    LineaReporte[]

  totalActivoCorriente:
    number

  totalActivoNoCorriente:
    number

  totalPasivoCorriente:
    number

  totalPasivoNoCorriente:
    number

  totalActivo: number
  totalPasivo: number

  totalCapitalCuentas:
    number

  totalCapitalContable:
    number

  utilidadEjercicio:
    number

  totalPasivoMasCapital:
    number

  cuadra: boolean
}

export function calcularBalanceGeneral(
  mayor: SaldoCuenta[],
  utilidadEjercicio: number,
  inventarioFinal?: number
): BalanceGeneral {
  const activos:
    LineaReporte[] = []

  const pasivos:
    LineaReporte[] = []

  const capital:
    LineaReporte[] = []

  const activosCorrientes:
    LineaReporte[] = []

  const activosNoCorrientes:
    LineaReporte[] = []

  const pasivosCorrientes:
    LineaReporte[] = []

  const pasivosNoCorrientes:
    LineaReporte[] = []

  let tiene1104 =
    false

  for (
    const s
    of mayor
  ) {
    const codigo =
      s.cuenta.codigo

    if (
      s.cuenta.tipo ===
      "activo"
    ) {
      let monto =
        redondear(
          s.debe -
          s.haber
        )

      if (
        codigo ===
        "1104"
      ) {
        tiene1104 =
          true

        if (
          typeof inventarioFinal ===
            "number" &&
          !Number.isNaN(
            inventarioFinal
          )
        ) {
          monto =
            redondear(
              inventarioFinal
            )
        }
      }

      const linea:
        LineaReporte =
        {
          cuenta:
            s.cuenta,

          monto,
        }

      activos.push(
        linea
      )

      if (
        codigo.startsWith(
          "11"
        )
      ) {
        activosCorrientes.push(
          linea
        )
      } else {
        activosNoCorrientes.push(
          linea
        )
      }
    } else if (
      s.cuenta.tipo ===
      "pasivo"
    ) {
      const linea:
        LineaReporte =
        {
          cuenta:
            s.cuenta,

          monto:
            redondear(
              s.haber -
              s.debe
            ),
        }

      pasivos.push(
        linea
      )

      if (
        codigo.startsWith(
          "21"
        )
      ) {
        pasivosCorrientes.push(
          linea
        )
      } else {
        pasivosNoCorrientes.push(
          linea
        )
      }
    } else if (
      s.cuenta.tipo ===
      "capital"
    ) {
      capital.push({
        cuenta:
          s.cuenta,

        monto:
          redondear(
            s.haber -
            s.debe
          ),
      })
    }
  }

  if (
    !tiene1104 &&
    typeof inventarioFinal ===
      "number" &&
    !Number.isNaN(
      inventarioFinal
    ) &&
    inventarioFinal > 0
  ) {
    const cuentaInventario:
      Cuenta = {
        codigo:
          "1104",

        nombre:
          "Inventario de mercadería",

        tipo:
          "activo",

        naturaleza:
          "deudora",

        activa:
          true,
      }

    const lineaInventario:
      LineaReporte = {
        cuenta:
          cuentaInventario,

        monto:
          redondear(
            inventarioFinal
          ),
      }

    activos.push(
      lineaInventario
    )

    activosCorrientes.push(
      lineaInventario
    )
  }

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

  const totalCapitalCuentas =
    sumar(
      capital
    )

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

export function obtenerCuentaPrincipal(
  codigo: string,
  cuentasMap?:
    | Map<
        string,
        Cuenta
      >
    | Record<
        string,
        Cuenta
      >
): string {
  const cod =
    (
      codigo ||
      ""
    ).trim()

  if (!cod) {
    return ""
  }

  const partes =
    cod.split(
      /[-.]/
    )

  if (
    partes.length > 1 &&
    cuentasMap
  ) {
    const codPadre =
      partes[0]

    const cPadre =
      cuentasMap instanceof Map
        ? cuentasMap.get(
            codPadre
          )
        : cuentasMap[
            codPadre
          ]

    if (cPadre) {
      return cPadre.nombre
    }
  }

  const p4 =
    cod.slice(
      0,
      4
    )

  const p2 =
    cod.slice(
      0,
      2
    )

  const p1 =
    cod.slice(
      0,
      1
    )

  if (
    p4 === "1101" ||
    p4 === "1102" ||
    p4 === "1100"
  ) {
    return "Efectivo y equivalentes"
  }

  if (
    p4 === "1103" ||
    p4 === "1106"
  ) {
    return "Cuentas por cobrar"
  }

  if (
    p4 === "1104"
  ) {
    return "Inventarios"
  }

  if (
    p4 === "1105"
  ) {
    return "Impuestos por recuperar"
  }

  if (
    p4 === "1107" ||
    p4 === "1108"
  ) {
    return "Pagos anticipados"
  }

  if (
    p2 === "11"
  ) {
    return "Activo corriente"
  }

  if (
    p2 === "12"
  ) {
    return "Propiedad, planta y equipo"
  }

  if (
    p4 === "2101" ||
    p4 === "2105"
  ) {
    return "Cuentas por pagar"
  }

  if (
    p4 === "2102" ||
    p2 === "22"
  ) {
    return "Obligaciones financieras"
  }

  if (
    p4 === "2103" ||
    p4 === "2104" ||
    p4 === "2107"
  ) {
    return "Impuestos y retenciones por pagar"
  }

  if (
    p4 === "2106"
  ) {
    return "Sueldos y beneficios por pagar"
  }

  if (
    p2 === "21"
  ) {
    return "Pasivo corriente"
  }

  if (
    p1 === "2"
  ) {
    return "Pasivo"
  }

  if (
    p4 === "3101"
  ) {
    return "Capital social"
  }

  if (
    p4 === "3102" ||
    p4 === "3104"
  ) {
    return "Resultados acumulados"
  }

  if (
    p4 === "3103"
  ) {
    return "Reservas"
  }

  if (
    p1 === "3"
  ) {
    return "Capital contable"
  }

  if (
    p2 === "41"
  ) {
    return "Costo de ventas"
  }

  if (
    p4 === "4201" ||
    p4 === "4207"
  ) {
    return "Gastos de administración"
  }

  if (
    p4 === "4202" ||
    p4 === "4208"
  ) {
    return "Gastos de venta"
  }

  if (
    p4 === "4203" ||
    p4 === "4204" ||
    p4 === "4205" ||
    p4 === "4206"
  ) {
    return "Gastos de operación"
  }

  if (
    p2 === "43"
  ) {
    return "Gastos financieros"
  }

  if (
    p1 === "4"
  ) {
    return "Costos y gastos"
  }

  if (
    p4 === "5101"
  ) {
    return "Ingresos de actividades ordinarias"
  }

  if (
    p4 === "5102" ||
    p4 === "5103"
  ) {
    return "Costo de ventas"
  }

  if (
    p4 === "5104" ||
    p4 === "5105"
  ) {
    return "Otros ingresos operativos"
  }

  if (
    p2 === "52"
  ) {
    return "Ingresos financieros"
  }

  if (
    p1 === "5"
  ) {
    return "Ingresos"
  }

  return "Cuenta General"
}

export function formatearCuentaJerarquica(
  cuenta: {
    codigo: string
    nombre: string
  },

  cuentasMap?:
    | Map<
        string,
        Cuenta
      >
    | Record<
        string,
        Cuenta
      >
): {
  principal: string
  subcuenta: string
  textoCompleto: string
} {
  const principal =
    obtenerCuentaPrincipal(
      cuenta.codigo,
      cuentasMap
    )

  const subcuenta =
    cuenta.nombre ||
    `Cuenta ${cuenta.codigo}`

  const textoCompleto =
    principal &&
    principal.toLowerCase() !==
      subcuenta.toLowerCase()
      ? `${principal} - ${subcuenta}`
      : subcuenta

  return {
    principal,
    subcuenta,
    textoCompleto,
  }
}

export interface InfoCuentaIVA {
  esSujeta: boolean

  tipo:
    | "COMPRA"
    | "VENTA"
    | null

  cuentaIvaCodigo:
    string

  cuentaIvaNombre:
    string

  impuestoNombre:
    string
}

export function esCuentaSujetaAIVA(
  codigo: string
): InfoCuentaIVA {
  const cod =
    (
      codigo ||
      ""
    ).trim()

  const esAdquisicionConIVA =
    cod === "4101" ||
    cod.startsWith(
      "4101"
    ) ||
    cod === "4102" ||
    cod.startsWith(
      "4102"
    ) ||
    cod === "4105" ||
    cod.startsWith(
      "4105"
    ) ||
    cod === "1201" ||
    cod.startsWith(
      "1201"
    ) ||
    cod === "1202" ||
    cod.startsWith(
      "1202"
    ) ||
    cod === "1203" ||
    cod.startsWith(
      "1203"
    ) ||
    cod === "1204" ||
    cod.startsWith(
      "1204"
    ) ||
    cod === "1107" ||
    cod.startsWith(
      "1107"
    ) ||
    cod === "4201" ||
    cod.startsWith(
      "4201"
    ) ||
    cod === "4202" ||
    cod.startsWith(
      "4202"
    ) ||
    cod === "4204" ||
    cod.startsWith(
      "4204"
    ) ||
    cod === "4205" ||
    cod.startsWith(
      "4205"
    ) ||
    cod === "4207" ||
    cod.startsWith(
      "4207"
    ) ||
    cod === "4208" ||
    cod.startsWith(
      "4208"
    ) ||
    cod === "4303" ||
    cod.startsWith(
      "4303"
    ) ||
    cod === "5102" ||
    cod.startsWith(
      "5102"
    ) ||
    cod === "5103" ||
    cod.startsWith(
      "5103"
    )

  if (
    esAdquisicionConIVA
  ) {
    let detalle =
      "Compra / Adquisición"

    if (
      cod.startsWith(
        "1203"
      )
    ) {
      detalle =
        "Equipo de Cómputo"
    } else if (
      cod.startsWith(
        "1202"
      )
    ) {
      detalle =
        "Equipo de Transporte"
    } else if (
      cod.startsWith(
        "1201"
      )
    ) {
      detalle =
        "Mobiliario y Equipo"
    } else if (
      cod.startsWith(
        "1204"
      )
    ) {
      detalle =
        "Edificios e Instalaciones"
    } else if (
      cod.startsWith(
        "4101"
      )
    ) {
      detalle =
        "Compra de Mercadería"
    } else if (
      cod.startsWith(
        "4303"
      )
    ) {
      detalle =
        "Comisiones Bancarias"
    } else if (
      cod.startsWith(
        "5102"
      ) ||
      cod.startsWith(
        "5103"
      )
    ) {
      detalle =
        "Ajuste / Devolución sobre Compras"
    }

    return {
      esSujeta: true,

      tipo:
        "COMPRA",

      cuentaIvaCodigo:
        "1105",

      cuentaIvaNombre:
        "IVA crédito fiscal",

      impuestoNombre:
        `IVA Crédito Fiscal 13% (${detalle})`,
    }
  }

  const esVentaOIngresoConIVA =
    cod === "5101" ||
    cod.startsWith(
      "5101"
    ) ||
    cod === "5104" ||
    cod.startsWith(
      "5104"
    ) ||
    cod === "5105" ||
    cod.startsWith(
      "5105"
    ) ||
    cod === "5203" ||
    cod.startsWith(
      "5203"
    ) ||
    cod === "4103" ||
    cod.startsWith(
      "4103"
    ) ||
    cod === "4104" ||
    cod.startsWith(
      "4104"
    )

  if (
    esVentaOIngresoConIVA
  ) {
    let detalleVenta = "Venta / Ingreso"
    if (
      cod.startsWith("4103") ||
      cod.startsWith("4104")
    ) {
      detalleVenta = "Ajuste / Devolución sobre Ventas"
    }

    return {
      esSujeta: true,

      tipo:
        "VENTA",

      cuentaIvaCodigo:
        "2103",

      cuentaIvaNombre:
        "IVA débito fiscal",

      impuestoNombre:
        `IVA Débito Fiscal 13% (${detalleVenta})`,
    }
  }

  return {
    esSujeta: false,

    tipo: null,

    cuentaIvaCodigo:
      "",

    cuentaIvaNombre:
      "",

    impuestoNombre:
      "",
  }
}

export function calcularDesgloseIVA(
  montoBruto: number
): {
  base: number
  iva: number
  total: number
} {
  const total =
    redondear(
      Math.abs(
        Number(
          montoBruto
        ) || 0
      )
    )

  if (
    total === 0
  ) {
    return {
      base: 0,
      iva: 0,
      total: 0,
    }
  }

  const base =
    redondear(
      total / 1.13
    )

  const ivaCalculado =
    redondear(
      base * 0.13
    )

  const diferenciaCentavos =
    redondear(
      total -
      (
        base +
        ivaCalculado
      )
    )

  const iva =
    redondear(
      ivaCalculado +
      diferenciaCentavos
    )

  return {
    base,
    iva,
    total,
  }
}

export type ModoCalculoIVA = "NO" | "MAS_IVA" | "IVA_INCLUIDO"

/**
 * Calcula el IVA 13% según la modalidad seleccionada:
 * - NO: Sin IVA
 * - MAS_IVA: El importe es la base neta; se suma el 13% de IVA (Total = Base + IVA)
 * - IVA_INCLUIDO: El importe es el total bruto; se desglosa la base (Base = Total / 1.13, IVA = Total - Base)
 */
export function calcularIVAConModo(monto: number, modo: ModoCalculoIVA): {
  base: number
  iva: number
  total: number
} {
  const m = redondear(Math.abs(Number(monto) || 0))
  if (modo === "NO" || m === 0) {
    return { base: m, iva: 0, total: m }
  }

  if (modo === "MAS_IVA") {
    const base = m
    const iva = redondear(base * 0.13)
    const total = redondear(base + iva)
    return { base, iva, total }
  }

  // IVA_INCLUIDO
  const base = redondear(m / 1.13)
  const ivaCalculado = redondear(base * 0.13)
  const diff = redondear(m - (base + ivaCalculado))
  const iva = redondear(ivaCalculado + diff)
  return { base, iva, total: m }
}

