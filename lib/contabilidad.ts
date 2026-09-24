import type {
  Asiento,
  AsientoLinea,
  Cuenta,
  Naturaleza,
  SaldoCuenta,
  TipoCuenta,
} from "./types";
import { subgrupoResultados } from "./types";

export function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatoMoneda(n: number): string {
  return new Intl.NumberFormat("es-SV", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n || 0);
}

export function totalesAsiento(lineas: AsientoLinea[]) {
  const debe = redondear(lineas.reduce((s, l) => s + (Number(l.debe) || 0), 0));
  const haber = redondear(
    lineas.reduce((s, l) => s + (Number(l.haber) || 0), 0),
  );
  return { debe, haber, diferencia: redondear(debe - haber) };
}

export interface TotalesLoteResultado {
  totalDebe: number;
  totalHaber: number;
  diferencia: number;
  cuadrado: boolean;
  partidasValidas: number;
  partidasConError: number;
  totalPartidas: number;
}

/**
 * Suma y valida débitos y créditos de todas las partidas del lote en centavos enteros
 * (Math.round * 100) para garantizar cuadratura estricta y sin errores de coma flotante.
 */
export function calcularTotalesLote(asientos: Asiento[]): TotalesLoteResultado {
  let debeCents = 0;
  let haberCents = 0;
  let partidasValidas = 0;
  let partidasConError = 0;

  for (const a of asientos) {
    if (a.estado === "ANULADO") continue;

    let aDebeCents = 0;
    let aHaberCents = 0;
    for (const l of a.lineas) {
      aDebeCents += Math.round((Number(l.debe) || 0) * 100);
      aHaberCents += Math.round((Number(l.haber) || 0) * 100);
    }
    debeCents += aDebeCents;
    haberCents += aHaberCents;

    if (aDebeCents === aHaberCents && aDebeCents > 0) {
      partidasValidas++;
    } else {
      partidasConError++;
    }
  }

  const diffCents = debeCents - haberCents;
  const totalDebe = debeCents / 100;
  const totalHaber = haberCents / 100;
  const diferencia = Math.abs(diffCents) / 100;
  const cuadrado =
    diffCents === 0 &&
    (asientos.length === 0 || (debeCents > 0 && partidasConError === 0));

  return {
    totalDebe,
    totalHaber,
    diferencia,
    cuadrado,
    partidasValidas,
    partidasConError,
    totalPartidas: asientos.length,
  };
}

export interface ResultadoValidacion {
  valido: boolean;
  errores: string[];
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
  const errores: string[] = [];

  if (!fecha) errores.push("La fecha del asiento es obligatoria.");
  if (!concepto.trim()) errores.push("El concepto del asiento es obligatorio.");

  const lineasConCuenta = lineas.filter((l) => l.codigo);
  if (lineasConCuenta.length < 2) {
    errores.push(
      "Un asiento debe tener al menos dos cuentas (un cargo y un abono).",
    );
  }

  for (const l of lineasConCuenta) {
    const debe = Number(l.debe) || 0;
    const haber = Number(l.haber) || 0;
    if (debe < 0 || haber < 0) {
      errores.push(`La cuenta ${l.codigo} tiene valores negativos.`);
    }
    if (debe > 0 && haber > 0) {
      errores.push(
        `La cuenta ${l.codigo} no puede tener Debe y Haber a la vez.`,
      );
    }
    if (debe === 0 && haber === 0) {
      errores.push(`La cuenta ${l.codigo} no tiene ningún movimiento.`);
    }
  }

  const { debe, haber } = totalesAsiento(lineasConCuenta);
  if (debe === 0 && haber === 0) {
    errores.push("El asiento no tiene importes registrados.");
  } else if (debe !== haber) {
    errores.push(
      `No se cumple la Partida Doble: el total del Debe (${formatoMoneda(debe)}) debe ser igual al total del Haber (${formatoMoneda(haber)}).`,
    );
  }

  return { valido: errores.length === 0, errores };
}

/**
 * Mayorización automática: consolida débitos y créditos de cada cuenta
 * del catálogo y determina el saldo (Deudor / Acreedor).
 */
export function calcularMayor(
  cuentas: Cuenta[],
  asientos: Asiento[],
  ejercicioFiltro?: number,
  incluirCierre: boolean = false,
): SaldoCuenta[] {
  return cuentas
    .map((cuenta) => {
      let debeCents = 0;
      let haberCents = 0;
      for (const asiento of asientos) {
        if (asiento.estado === "ANULADO") continue;
        if (!incluirCierre && asiento.tipo === "CIERRE") continue;
        if (ejercicioFiltro !== undefined) {
          const ej =
            asiento.ejercicio ||
            (asiento.fecha ? new Date(asiento.fecha).getFullYear() : undefined);
          if (ej !== undefined && ej !== ejercicioFiltro) continue;
        }
        for (const linea of asiento.lineas) {
          if (linea.codigo === cuenta.codigo) {
            debeCents += Math.round((Number(linea.debe) || 0) * 100);
            haberCents += Math.round((Number(linea.haber) || 0) * 100);
          }
        }
      }
      const debe = debeCents / 100;
      const haber = haberCents / 100;
      const saldo = (debeCents - haberCents) / 100;
      const naturalezaSaldo: Naturaleza | null =
        saldo === 0 ? null : saldo > 0 ? "deudora" : "acreedora";
      return {
        cuenta: { ...cuenta, padre_codigo: cuenta.padre_codigo ?? undefined },
        debe,
        haber,
        saldo,
        naturalezaSaldo,
      };
    })
    .filter((s) => s.debe !== 0 || s.haber !== 0);
}

export function consolidarMayor(
  mayor: SaldoCuenta[],
  cuentasMayor: Cuenta[],
): SaldoCuenta[] {
  const grupos = new Map<string, SaldoCuenta>();
  for (const saldo of mayor) {
    const codigoPadre = saldo.cuenta.padre_codigo;
    if (!codigoPadre) continue;
    const cuentaMayor = cuentasMayor.find(
      (cuenta) => cuenta.codigo === codigoPadre,
    );
    if (!cuentaMayor) continue;
    const existente = grupos.get(codigoPadre);
    if (existente) {
      existente.debe = redondear(existente.debe + saldo.debe);
      existente.haber = redondear(existente.haber + saldo.haber);
      existente.saldo = redondear(existente.debe - existente.haber);
      existente.naturalezaSaldo =
        existente.saldo === 0
          ? null
          : existente.saldo > 0
            ? "deudora"
            : "acreedora";
      existente.cuentasHijas?.push(saldo.cuenta.codigo);
    } else {
      grupos.set(codigoPadre, {
        cuenta: cuentaMayor,
        debe: saldo.debe,
        haber: saldo.haber,
        saldo: saldo.saldo,
        naturalezaSaldo: saldo.naturalezaSaldo,
        cuentasHijas: [saldo.cuenta.codigo],
      });
    }
  }
  return [...grupos.values()].filter(
    (saldo) => saldo.debe !== 0 || saldo.haber !== 0,
  );
}

/** Saldo mostrado según la naturaleza de la cuenta (siempre positivo cuando es normal). */
export function saldoNormalizado(s: SaldoCuenta): number {
  return s.cuenta.naturaleza === "deudora"
    ? redondear(s.debe - s.haber)
    : redondear(s.haber - s.debe);
}

export interface LineaReporte {
  cuenta: Cuenta;
  monto: number;
}

export interface MetodoAnaliticoDetalle {
  // Ventas Netas
  ventasTotales: number;
  devolucionesSobreVentas: number;
  rebajasSobreVentas: number;
  ventasNetas: number;

  // Compras y Mercancías
  inventarioInicial: number;
  compras: number;
  gastosSobreCompras: number;
  comprasTotales: number;
  devolucionesSobreCompras: number;
  rebajasSobreCompras: number;
  comprasNetas: number;
  totalMercancias: number;
  inventarioFinalEstimado: number;
  valorInventarioFinal: number;
  fechaInventarioFinal?: string | null;
  responsableInventarioFinal?: string | null;
  costoVentas: number;

  // Resultados
  utilidadBruta: number;
  gastosOperacion: number;
  utilidadOperacion: number;
  totalIngresosFinancieros: number;
  totalGastosFinancieros: number;
  otrosIngresos: number;
  utilidadNeta: number;
}

export interface EstadoResultados {
  ingresos: LineaReporte[];
  gastos: LineaReporte[];
  // Desglose en cascada
  ventas: LineaReporte[];
  costoVentas: LineaReporte[];
  gastosOperacion: LineaReporte[];
  ingresosFinancieros: LineaReporte[];
  gastosFinancieros: LineaReporte[];
  totalVentas: number;
  totalCostoVentas: number;
  utilidadBruta: number;
  totalGastosOperacion: number;
  utilidadOperacion: number;
  totalIngresosFinancieros: number;
  totalGastosFinancieros: number;
  resultadoFinanciero: number;
  totalIngresos: number;
  totalGastos: number;
  utilidad: number;
  // Detalle del Método Analítico o Pormenorizado
  analitico: MetodoAnaliticoDetalle;
  /** Indica si los valores fueron extraídos directamente de la vista SQL vista_estado_resultados_analitico */
  calculadoPorSql?: boolean;
}

/**
 * Estado de Resultados: código 5 (ingresos) - código 4 (costos y gastos) = utilidad.
 * Además arma el reporte en cascada y calcula las fórmulas oficiales del Método Analítico o Pormenorizado.
 */
export function calcularEstadoResultados(
  mayor: SaldoCuenta[],
  inventarioFinal?: number,
  metaInventario?: { fecha?: string | null; responsable?: string | null },
): EstadoResultados {
  const ingresos: LineaReporte[] = [];
  const gastos: LineaReporte[] = [];
  const ventas: LineaReporte[] = [];
  const costoVentas: LineaReporte[] = [];
  const gastosOperacion: LineaReporte[] = [];
  const ingresosFinancieros: LineaReporte[] = [];
  const gastosFinancieros: LineaReporte[] = [];

  for (const s of mayor) {
    if (
      s.cuenta.rol_resultado === "reductora_ventas" ||
      s.cuenta.rol_resultado === "reductora_compras"
    ) {
      continue;
    }
    if (s.cuenta.tipo === "ingreso") {
      const linea = { cuenta: s.cuenta, monto: redondear(s.haber - s.debe) };
      ingresos.push(linea);
      if (
        subgrupoResultados(s.cuenta.codigo, "ingreso") === "ingresosFinancieros"
      ) {
        ingresosFinancieros.push(linea);
      } else {
        ventas.push(linea);
      }
    } else if (s.cuenta.tipo === "gasto") {
      const linea = { cuenta: s.cuenta, monto: redondear(s.debe - s.haber) };
      gastos.push(linea);
      const sub = subgrupoResultados(s.cuenta.codigo, "gasto");
      if (sub === "costoVentas") costoVentas.push(linea);
      else if (sub === "gastosFinancieros") gastosFinancieros.push(linea);
      else gastosOperacion.push(linea);
    }
  }

  const suma = (arr: LineaReporte[]) =>
    redondear(arr.reduce((a, b) => a + b.monto, 0));
  const totalVentas = suma(ventas);
  const totalCostoVentas = suma(costoVentas);
  const utilidadBruta = redondear(totalVentas - totalCostoVentas);
  const totalGastosOperacion = suma(gastosOperacion);
  const utilidadOperacion = redondear(utilidadBruta - totalGastosOperacion);
  const totalIngresosFinancieros = suma(ingresosFinancieros);
  const totalGastosFinancieros = suma(gastosFinancieros);
  const resultadoFinanciero = redondear(
    totalIngresosFinancieros - totalGastosFinancieros,
  );
  const totalIngresos = suma(ingresos);
  const totalGastos = suma(gastos);

  // Fórmulas oficiales del Método Analítico o Pormenorizado
  const buscarSaldo = (codigo: string) => {
    const item = mayor.find((m) => m.cuenta.codigo === codigo);
    if (!item) return 0;
    return redondear(
      item.cuenta.naturaleza === "deudora"
        ? item.debe - item.haber
        : item.haber - item.debe,
    );
  };

  const ventasTotales = Math.max(0, buscarSaldo("5101"));
  const devolucionesSobreVentas = Math.max(0, buscarSaldo("4103"));
  const rebajasSobreVentas = Math.max(0, buscarSaldo("4104"));
  const ventasNetas = redondear(
    ventasTotales - devolucionesSobreVentas - rebajasSobreVentas,
  );

  const inventarioInicial = Math.max(0, buscarSaldo("1104"));
  const compras = Math.max(0, buscarSaldo("4101"));
  const gastosSobreCompras = Math.max(0, buscarSaldo("4102"));
  const comprasTotales = redondear(compras + gastosSobreCompras);
  const devolucionesSobreCompras = Math.max(0, buscarSaldo("5102"));
  const rebajasSobreCompras = Math.max(0, buscarSaldo("5103"));
  const comprasNetas = redondear(
    comprasTotales - devolucionesSobreCompras - rebajasSobreCompras,
  );
  const totalMercancias = redondear(inventarioInicial + comprasNetas);
  // Desacoplamiento resuelto: Usar el valor real de la Toma Física de Inventarios cuando esté disponible
  const inventarioFinalReal =
    typeof inventarioFinal === "number" && !isNaN(inventarioFinal)
      ? inventarioFinal
      : inventarioInicial;
  const costoVentasAnalitico = redondear(totalMercancias - inventarioFinalReal);
  const utilidadBrutaAnalitica = redondear(ventasNetas - costoVentasAnalitico);
  const utilidadOperacionAnalitica = redondear(
    utilidadBrutaAnalitica - totalGastosOperacion,
  );
  const otrosIngresos = Math.max(0, buscarSaldo("5104"));
  const utilidadNetaAnalitica = redondear(
    utilidadOperacionAnalitica + resultadoFinanciero + otrosIngresos,
  );

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
    utilidad:
      inventarioFinal !== undefined
        ? utilidadNetaAnalitica
        : redondear(totalIngresos - totalGastos),
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
      utilidadOperacion: utilidadOperacionAnalitica,
      totalIngresosFinancieros,
      totalGastosFinancieros,
      otrosIngresos,
      utilidadNeta: utilidadNetaAnalitica,
    },
  };
}

export interface BalanceGeneral {
  activos: LineaReporte[];
  pasivos: LineaReporte[];
  capital: LineaReporte[];
  totalActivo: number;
  totalPasivo: number;
  totalCapitalContable: number;
  utilidadEjercicio: number;
  totalPasivoMasCapital: number;
  cuadra: boolean;
}

/** Balance General: código 1 (activo) = código 2 (pasivo) + código 3 (capital contable) */
export function calcularBalanceGeneral(
  mayor: SaldoCuenta[],
  utilidadEjercicio: number,
  inventarioFinal?: number,
): BalanceGeneral {
  const activos: LineaReporte[] = [];
  const pasivos: LineaReporte[] = [];
  const capital: LineaReporte[] = [];

  let tiene1104 = false;
  for (const s of mayor) {
    if (s.cuenta.tipo === "activo") {
      let monto = redondear(s.debe - s.haber);
      if (s.cuenta.codigo === "1104") {
        tiene1104 = true;
        if (typeof inventarioFinal === "number" && !isNaN(inventarioFinal)) {
          monto = redondear(inventarioFinal);
        }
      }
      activos.push({ cuenta: s.cuenta, monto });
    } else if (s.cuenta.tipo === "pasivo") {
      pasivos.push({ cuenta: s.cuenta, monto: redondear(s.haber - s.debe) });
    } else if (s.cuenta.tipo === "capital") {
      capital.push({ cuenta: s.cuenta, monto: redondear(s.haber - s.debe) });
    }
  }

  // Si la cuenta 1104 no tuvo movimientos en el mayor pero hay inventario final definido
  if (
    !tiene1104 &&
    typeof inventarioFinal === "number" &&
    inventarioFinal > 0
  ) {
    activos.push({
      cuenta: {
        codigo: "1104",
        nombre: "Inventario de mercadería",
        tipo: "activo",
        naturaleza: "deudora",
        activa: true,
      },
      monto: redondear(inventarioFinal),
    });
  }

  const totalActivo = redondear(activos.reduce((a, b) => a + b.monto, 0));
  const totalPasivo = redondear(pasivos.reduce((a, b) => a + b.monto, 0));
  const totalCapitalCuentas = redondear(
    capital.reduce((a, b) => a + b.monto, 0),
  );
  const totalCapitalContable = redondear(
    totalCapitalCuentas + utilidadEjercicio,
  );
  const totalPasivoMasCapital = redondear(totalPasivo + totalCapitalContable);

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
  };
}

export interface Totales {
  totalPorTipo: Record<TipoCuenta, number>;
  totalDebe: number;
  totalHaber: number;
  numeroAsientos: number;
}

/**
 * Deduce automáticamente el nombre de la Cuenta Principal (padre / rubro de mayor)
 * a partir del código contable o jerarquía, para mostrar formato profesional:
 * "Efectivo y equivalentes - Bancos"
 */
export function obtenerCuentaPrincipal(
  codigo: string,
  cuentasMap?: Map<string, Cuenta> | Record<string, Cuenta>,
): string {
  const cod = (codigo || "").trim();
  if (!cod) return "";

  // Si tiene guión o punto ej: "1102-01" o "1102.01"
  const partes = cod.split(/[-.]/);
  if (partes.length > 1 && cuentasMap) {
    const codPadre = partes[0];
    const cPadre =
      cuentasMap instanceof Map
        ? cuentasMap.get(codPadre)
        : cuentasMap[codPadre];
    if (cPadre) return cPadre.nombre;
  }

  const p4 = cod.slice(0, 4);
  const p2 = cod.slice(0, 2);
  const p1 = cod.slice(0, 1);

  // 1. Activo
  if (p4 === "1101" || p4 === "1102" || p4 === "1100")
    return "Efectivo y equivalentes";
  if (p4 === "1103" || p4 === "1106") return "Cuentas por cobrar";
  if (p4 === "1104") return "Inventarios";
  if (p4 === "1105") return "Impuestos por recuperar";
  if (p4 === "1107" || p4 === "1108") return "Pagos anticipados";
  if (p2 === "11") return "Activo corriente";
  if (p2 === "12") return "Propiedad, planta y equipo";

  // 2. Pasivo
  if (p4 === "2101" || p4 === "2105") return "Cuentas por pagar";
  if (p4 === "2102" || p2 === "22") return "Obligaciones financieras";
  if (p4 === "2103" || p4 === "2104" || p4 === "2107")
    return "Impuestos y retenciones por pagar";
  if (p4 === "2106") return "Sueldos y beneficios por pagar";
  if (p2 === "21") return "Pasivo corriente";
  if (p1 === "2") return "Pasivo";

  // 3. Patrimonio / Capital
  if (p4 === "3101") return "Capital social";
  if (p4 === "3102" || p4 === "3104") return "Resultados acumulados";
  if (p4 === "3103") return "Reservas";
  if (p1 === "3") return "Capital contable";

  // 4. Costos y Gastos
  if (p2 === "41") return "Costo de ventas";
  if (p4 === "4201" || p4 === "4207") return "Gastos de administración";
  if (p4 === "4202" || p4 === "4208") return "Gastos de venta";
  if (p4 === "4203" || p4 === "4204" || p4 === "4205" || p4 === "4206")
    return "Gastos de operación";
  if (p2 === "43") return "Gastos financieros";
  if (p1 === "4") return "Costos y gastos";

  // 5. Ingresos y Complementarias
  if (p4 === "5101") return "Ingresos de actividades ordinarias";
  if (p4 === "5102" || p4 === "5103") return "Costo de ventas";
  if (p4 === "5104" || p4 === "5105") return "Otros ingresos operativos";
  if (p2 === "52") return "Ingresos financieros";
  if (p1 === "5") return "Ingresos";

  return "Cuenta General";
}

/**
 * Formatea el nombre contable jerárquico:
 * "Efectivo y equivalentes - Bancos"
 */
export function formatearCuentaJerarquica(
  cuenta: { codigo: string; nombre: string },
  cuentasMap?: Map<string, Cuenta> | Record<string, Cuenta>,
): { principal: string; subcuenta: string; textoCompleto: string } {
  const principal = obtenerCuentaPrincipal(cuenta.codigo, cuentasMap);
  const subcuenta = cuenta.nombre || `Cuenta ${cuenta.codigo}`;
  const textoCompleto =
    principal && principal.toLowerCase() !== subcuenta.toLowerCase()
      ? `${principal} - ${subcuenta}`
      : subcuenta;
  return { principal, subcuenta, textoCompleto };
}

export interface InfoCuentaIVA {
  esSujeta: boolean;
  tipo: "COMPRA" | "VENTA" | null;
  cuentaIvaCodigo: string;
  cuentaIvaNombre: string;
  impuestoNombre: string;
}

/**
 * Determina si una cuenta contable corresponde a adquisiciones (compras, activo fijo, gastos)
 * o ventas/ingresos sujetos a IVA (13%).
 *
 * En la técnica contable y legislación salvadoreña (Art. 65 Ley del IVA):
 * - Las adquisiciones de mercaderías (4101), activo fijo (1201 mobiliario, 1202 transporte/vehículos,
 *   1203 equipo de cómputo, 1204 edificios), suministros (1107) y gastos operativos gravados
 *   generan IVA Crédito Fiscal (1105).
 * - Las ventas (5101) e ingresos por servicios (5105) generan IVA Débito Fiscal (2103).
 */
export function esCuentaSujetaAIVA(codigo: string): InfoCuentaIVA {
  const cod = (codigo || "").trim();

  // 1. Adquisiciones sujetas a IVA Crédito Fiscal (1105):
  // - Activo Fijo / Propiedad Planta y Equipo: 1201 Mobiliario, 1202 Transporte, 1203 Cómputo, 1204 Edificios
  // - Suministros e insumos: 1107 Papelería y útiles
  // - Costos de compras y servicios: 4101 Compras, 4102 Gastos sobre compras, 4105 Costo de servicios
  // - Gastos operativos gravados: 4201 Administración, 4202 Venta, 4204 Alquileres, 4205 Servicios básicos, 4207 Papelería, 4208 Publicidad
  const esAdquisicionConIVA =
    cod === "4101" ||
    cod.startsWith("4101") ||
    cod === "4102" ||
    cod.startsWith("4102") ||
    cod === "4105" ||
    cod.startsWith("4105") ||
    cod === "1201" ||
    cod.startsWith("1201") || // Mobiliario y equipo
    cod === "1202" ||
    cod.startsWith("1202") || // Equipo de transporte (carros, camiones)
    cod === "1203" ||
    cod.startsWith("1203") || // Equipo de cómputo (computadoras, servidores)
    cod === "1204" ||
    cod.startsWith("1204") || // Edificios (instalaciones/mejoras gravadas)
    cod === "1107" ||
    cod.startsWith("1107") || // Papelería y útiles de oficina
    cod === "4201" ||
    cod.startsWith("4201") || // Gastos de administración
    cod === "4202" ||
    cod.startsWith("4202") || // Gastos de venta
    cod === "4204" ||
    cod.startsWith("4204") || // Gastos de alquiler
    cod === "4205" ||
    cod.startsWith("4205") || // Gastos de servicios básicos
    cod === "4207" ||
    cod.startsWith("4207") || // Gastos de papelería
    cod === "4208" ||
    cod.startsWith("4208"); // Gastos de publicidad

  if (esAdquisicionConIVA) {
    let detalle = "Compra / Adquisición";
    if (cod.startsWith("1203")) detalle = "Equipo de Cómputo";
    else if (cod.startsWith("1202")) detalle = "Equipo de Transporte";
    else if (cod.startsWith("1201")) detalle = "Mobiliario y Equipo";
    else if (cod.startsWith("1204")) detalle = "Edificios e Instalaciones";
    else if (cod.startsWith("4101")) detalle = "Compra de Mercadería";

    return {
      esSujeta: true,
      tipo: "COMPRA",
      cuentaIvaCodigo: "1105",
      cuentaIvaNombre: "IVA crédito fiscal",
      impuestoNombre: `IVA Crédito Fiscal 13% (${detalle})`,
    };
  }

  // 2. Ventas e ingresos sujetos a IVA Débito Fiscal (2103):
  // - 5101 Ventas, 5104 Otros ingresos, 5105 Ingresos por servicios, 5203 Venta de activos
  const esVentaOIngresoConIVA =
    cod === "5101" ||
    cod.startsWith("5101") ||
    cod === "5104" ||
    cod.startsWith("5104") ||
    cod === "5105" ||
    cod.startsWith("5105") ||
    cod === "5203" ||
    cod.startsWith("5203");

  if (esVentaOIngresoConIVA) {
    return {
      esSujeta: true,
      tipo: "VENTA",
      cuentaIvaCodigo: "2103",
      cuentaIvaNombre: "IVA débito fiscal",
      impuestoNombre: "IVA Débito Fiscal (13%)",
    };
  }

  return {
    esSujeta: false,
    tipo: null,
    cuentaIvaCodigo: "",
    cuentaIvaNombre: "",
    impuestoNombre: "",
  };
}

/**
 * Realiza el cálculo y desglose automático de IVA 13% según la fórmula contable:
 * Base Imponible = Monto Bruto / 1.13
 * IVA = Base Imponible * 0.13
 * Garantiza cuadre matemático exacto: Base + IVA === Monto Bruto
 */
export function calcularDesgloseIVA(montoBruto: number): {
  base: number;
  iva: number;
  total: number;
} {
  const total = redondear(Math.abs(Number(montoBruto) || 0));
  if (total === 0) return { base: 0, iva: 0, total: 0 };

  // 1. $X / 1.13
  const base = redondear(total / 1.13);
  // 2. Base * 0.13
  const ivaCalculado = redondear(base * 0.13);

  // 3. Ajuste de centavo para consistencia estricta de partida doble
  const diferenciaCentavos = redondear(total - (base + ivaCalculado));
  const iva = redondear(ivaCalculado + diferenciaCentavos);

  return {
    base,
    iva,
    total,
  };
}
