import type { Cuenta, TipoCuenta } from "./types";

/**
 * Catálogo de Cuentas completo (equivale al futuro data.sql).
 * Clasificación por primer dígito:
 *  1 = Activo, 2 = Pasivo, 3 = Capital contable, 4 = Costos y gastos, 5 = Ingresos
 */
export const CATALOGO_CUENTAS: Cuenta[] = [
  // 1 - Activo (naturaleza deudora)
  // 11 - Activo corriente
  {
    codigo: "1101",
    nombre: "Caja general",
    tipo: "activo",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "1102",
    nombre: "Bancos",
    tipo: "activo",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "1103",
    nombre: "Cuentas por cobrar",
    tipo: "activo",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "1104",
    nombre: "Inventario de mercadería",
    tipo: "activo",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "1105",
    nombre: "IVA crédito fiscal",
    tipo: "activo",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "1106",
    nombre: "Deudores diversos",
    tipo: "activo",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "1107",
    nombre: "Papelería y útiles",
    tipo: "activo",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "1108",
    nombre: "Pagos anticipados",
    tipo: "activo",
    naturaleza: "deudora",
    activa: true,
  },
  // 12 - Activo no corriente
  {
    codigo: "1201",
    nombre: "Mobiliario y equipo",
    tipo: "activo",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "1202",
    nombre: "Equipo de transporte",
    tipo: "activo",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "1203",
    nombre: "Equipo de cómputo",
    tipo: "activo",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "1204",
    nombre: "Edificios",
    tipo: "activo",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "1205",
    nombre: "Terrenos",
    tipo: "activo",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "1206",
    nombre: "Depreciación acumulada",
    tipo: "activo",
    naturaleza: "deudora",
    activa: true,
  },

  // 2 - Pasivo (naturaleza acreedora)
  // 21 - Pasivo corriente
  {
    codigo: "2101",
    nombre: "Cuentas por pagar",
    tipo: "pasivo",
    naturaleza: "acreedora",
    activa: true,
  },
  {
    codigo: "2102",
    nombre: "Préstamos bancarios por pagar",
    tipo: "pasivo",
    naturaleza: "acreedora",
    activa: true,
  },
  {
    codigo: "2103",
    nombre: "IVA débito fiscal",
    tipo: "pasivo",
    naturaleza: "acreedora",
    activa: true,
  },
  {
    codigo: "2104",
    nombre: "Impuestos por pagar",
    tipo: "pasivo",
    naturaleza: "acreedora",
    activa: true,
  },
  {
    codigo: "2105",
    nombre: "Acreedores diversos",
    tipo: "pasivo",
    naturaleza: "acreedora",
    activa: true,
  },
  {
    codigo: "2106",
    nombre: "Sueldos y salarios por pagar",
    tipo: "pasivo",
    naturaleza: "acreedora",
    activa: true,
  },
  {
    codigo: "2107",
    nombre: "Retenciones por pagar",
    tipo: "pasivo",
    naturaleza: "acreedora",
    activa: true,
  },
  // 22 - Pasivo no corriente
  {
    codigo: "2201",
    nombre: "Préstamos bancarios a largo plazo",
    tipo: "pasivo",
    naturaleza: "acreedora",
    activa: true,
  },
  {
    codigo: "2202",
    nombre: "Hipotecas por pagar",
    tipo: "pasivo",
    naturaleza: "acreedora",
    activa: true,
  },

  // 3 - Capital contable (naturaleza acreedora)
  {
    codigo: "3101",
    nombre: "Capital social",
    tipo: "capital",
    naturaleza: "acreedora",
    activa: true,
  },
  {
    codigo: "3102",
    nombre: "Utilidades acumuladas",
    tipo: "capital",
    naturaleza: "acreedora",
    activa: true,
  },
  {
    codigo: "3103",
    nombre: "Reserva legal",
    tipo: "capital",
    naturaleza: "acreedora",
    activa: true,
  },
  {
    codigo: "3104",
    nombre: "Pérdidas acumuladas",
    tipo: "capital",
    naturaleza: "acreedora",
    activa: true,
  },
  {
    codigo: "3105",
    nombre: "Donaciones",
    tipo: "capital",
    naturaleza: "acreedora",
    activa: true,
  },

  // 4 - Costos y gastos (naturaleza deudora)
  //   41 = Compras y cuentas analíticas · 42 = gastos de operación · 43 = gastos financieros
  {
    codigo: "4101",
    nombre: "Compras",
    tipo: "gasto",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "4102",
    nombre: "Gastos sobre compras",
    tipo: "gasto",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "4103",
    nombre: "Devoluciones sobre ventas",
    tipo: "gasto",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "4104",
    nombre: "Rebajas y descuentos sobre ventas",
    tipo: "gasto",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "4105",
    nombre: "Costo de servicios",
    tipo: "gasto",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "4201",
    nombre: "Gastos de administración",
    tipo: "gasto",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "4202",
    nombre: "Gastos de venta",
    tipo: "gasto",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "4203",
    nombre: "Gastos de depreciación",
    tipo: "gasto",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "4204",
    nombre: "Gastos de alquiler",
    tipo: "gasto",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "4205",
    nombre: "Gastos de servicios básicos",
    tipo: "gasto",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "4206",
    nombre: "Gastos de sueldos y salarios",
    tipo: "gasto",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "4207",
    nombre: "Gastos de papelería y útiles",
    tipo: "gasto",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "4208",
    nombre: "Gastos de publicidad",
    tipo: "gasto",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "4301",
    nombre: "Gastos financieros",
    tipo: "gasto",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "4302",
    nombre: "Intereses pagados",
    tipo: "gasto",
    naturaleza: "deudora",
    activa: true,
  },
  {
    codigo: "4303",
    nombre: "Comisiones bancarias",
    tipo: "gasto",
    naturaleza: "deudora",
    activa: true,
  },

  // 5 - Ingresos (naturaleza acreedora)
  //   51 = Ventas y cuentas analíticas · 52 = ingresos financieros
  {
    codigo: "5101",
    nombre: "Ventas",
    tipo: "ingreso",
    naturaleza: "acreedora",
    activa: true,
  },
  {
    codigo: "5102",
    nombre: "Devoluciones sobre compras",
    tipo: "ingreso",
    naturaleza: "acreedora",
    activa: true,
  },
  {
    codigo: "5103",
    nombre: "Rebajas y descuentos sobre compras",
    tipo: "ingreso",
    naturaleza: "acreedora",
    activa: true,
  },
  {
    codigo: "5104",
    nombre: "Otros ingresos operativos",
    tipo: "ingreso",
    naturaleza: "acreedora",
    activa: true,
  },
  {
    codigo: "5105",
    nombre: "Ingresos por servicios",
    tipo: "ingreso",
    naturaleza: "acreedora",
    activa: true,
  },
  {
    codigo: "5201",
    nombre: "Productos financieros",
    tipo: "ingreso",
    naturaleza: "acreedora",
    activa: true,
  },
  {
    codigo: "5202",
    nombre: "Intereses cobrados",
    tipo: "ingreso",
    naturaleza: "acreedora",
    activa: true,
  },
  {
    codigo: "5203",
    nombre: "Utilidad en venta de activos",
    tipo: "ingreso",
    naturaleza: "acreedora",
    activa: true,
  },
];

/** Cuentas agrupadoras virtuales. No reciben asientos; consolidan hojas existentes. */
export const CUENTAS_MAYOR: Cuenta[] = [
  {
    codigo: "1100",
    nombre: "Efectivo y equivalentes",
    tipo: "activo",
    naturaleza: "deudora",
    activa: true,
    es_mayor: true,
    permite_movimiento: false,
  },
  {
    codigo: "1200",
    nombre: "Propiedad, planta y equipo",
    tipo: "activo",
    naturaleza: "deudora",
    activa: true,
    es_mayor: true,
    permite_movimiento: false,
  },
  {
    codigo: "2100",
    nombre: "Pasivo corriente",
    tipo: "pasivo",
    naturaleza: "acreedora",
    activa: true,
    es_mayor: true,
    permite_movimiento: false,
  },
  {
    codigo: "2200",
    nombre: "Pasivo no corriente",
    tipo: "pasivo",
    naturaleza: "acreedora",
    activa: true,
    es_mayor: true,
    permite_movimiento: false,
  },
  {
    codigo: "3100",
    nombre: "Capital contable",
    tipo: "capital",
    naturaleza: "acreedora",
    activa: true,
    es_mayor: true,
    permite_movimiento: false,
  },
  {
    codigo: "4100",
    nombre: "Costos y gastos analíticos",
    tipo: "gasto",
    naturaleza: "deudora",
    activa: true,
    es_mayor: true,
    permite_movimiento: false,
  },
  {
    codigo: "4200",
    nombre: "Gastos de operación",
    tipo: "gasto",
    naturaleza: "deudora",
    activa: true,
    es_mayor: true,
    permite_movimiento: false,
  },
  {
    codigo: "4300",
    nombre: "Gastos financieros",
    tipo: "gasto",
    naturaleza: "deudora",
    activa: true,
    es_mayor: true,
    permite_movimiento: false,
  },
  {
    codigo: "5100",
    nombre: "Ingresos de operación",
    tipo: "ingreso",
    naturaleza: "acreedora",
    activa: true,
    es_mayor: true,
    permite_movimiento: false,
  },
  {
    codigo: "5200",
    nombre: "Ingresos financieros",
    tipo: "ingreso",
    naturaleza: "acreedora",
    activa: true,
    es_mayor: true,
    permite_movimiento: false,
  },
];

export function obtenerCodigoCuentaMayor(codigo: string): string {
  const limpio = codigo.trim();
  if (limpio === "1101" || limpio === "1102") return "1100";
  if (limpio.startsWith("12")) return "1200";
  if (limpio.startsWith("21")) return "2100";
  if (limpio.startsWith("22")) return "2200";
  if (limpio.startsWith("31")) return "3100";
  if (limpio.startsWith("41")) return "4100";
  if (limpio.startsWith("42")) return "4200";
  if (limpio.startsWith("43")) return "4300";
  if (limpio.startsWith("51")) return "5100";
  if (limpio.startsWith("52")) return "5200";
  return limpio.slice(0, 1);
}

export function enriquecerJerarquia(cuenta: Cuenta): Cuenta {
  const padre = cuenta.padre_codigo || obtenerCodigoCuentaMayor(cuenta.codigo);
  return {
    ...cuenta,
    padre_codigo: padre,
    rol_resultado:
      cuenta.codigo === "4103" || cuenta.codigo === "4104"
        ? "reductora_ventas"
        : cuenta.codigo === "5102" || cuenta.codigo === "5103"
          ? "reductora_compras"
          : "normal",
  };
}

export interface RubroContable {
  codigo: string;
  nombre: string;
  grupo: TipoCuenta;
  descripcion: string;
}

export const RUBROS_CONTABLES: RubroContable[] = [
  {
    codigo: "11",
    nombre: "Activo Corriente",
    grupo: "activo",
    descripcion:
      "Efectivo, equivalentes, realizables y exigibles a corto plazo",
  },
  {
    codigo: "12",
    nombre: "Activo No Corriente",
    grupo: "activo",
    descripcion: "Propiedad, planta y equipo, intangibles y depreciaciones",
  },
  {
    codigo: "21",
    nombre: "Pasivo Corriente",
    grupo: "pasivo",
    descripcion: "Obligaciones comerciales, fiscales y laborales a corto plazo",
  },
  {
    codigo: "22",
    nombre: "Pasivo No Corriente",
    grupo: "pasivo",
    descripcion: "Obligaciones bancarias e hipotecarias a largo plazo",
  },
  {
    codigo: "31",
    nombre: "Capital Contable",
    grupo: "capital",
    descripcion: "Capital social, reservas y resultados acumulados",
  },
  {
    codigo: "41",
    nombre: "Costo de Ventas (Analítico)",
    grupo: "gasto",
    descripcion: "Compras y cuentas analíticas de adquisición",
  },
  {
    codigo: "42",
    nombre: "Gastos de Operación",
    grupo: "gasto",
    descripcion: "Gastos administrativos y comerciales del período",
  },
  {
    codigo: "43",
    nombre: "Gastos Financieros",
    grupo: "gasto",
    descripcion: "Intereses y comisiones bancarias",
  },
  {
    codigo: "51",
    nombre: "Ingresos de Operación",
    grupo: "ingreso",
    descripcion: "Ventas y complementarias analíticas",
  },
  {
    codigo: "52",
    nombre: "Ingresos Financieros",
    grupo: "ingreso",
    descripcion: "Productos financieros y rendimientos",
  },
];

/**
 * Calcula el siguiente código disponible dentro de un rubro (ej. rubro '11' -> '1109').
 */
export function sugerirSiguienteCodigo(
  rubroPrefijo: string,
  cuentasExistentes: { codigo: string }[],
): string {
  const existentes = cuentasExistentes
    .map((c) => c.codigo.trim())
    .filter(
      (cod) =>
        cod.startsWith(rubroPrefijo) && cod.length === 4 && /^\d+$/.test(cod),
    )
    .map((cod) => parseInt(cod, 10))
    .sort((a, b) => a - b);

  if (existentes.length === 0) {
    return `${rubroPrefijo}01`;
  }

  // Buscar primer hueco libre o el siguiente correlativo
  let candidato = parseInt(`${rubroPrefijo}01`, 10);
  for (const ocupado of existentes) {
    if (ocupado === candidato) {
      candidato++;
    } else if (ocupado > candidato) {
      return String(candidato).padStart(4, "0");
    }
  }
  return String(candidato).padStart(4, "0");
}
