/**
 * MOTOR DE REGLAS DE NEGOCIO PARA PLANTILLAS CONTABLES (asientoTemplateEngine.ts)
 * 
 * Transforma eventos de negocio de alto nivel (montos netos, IVA, forma de pago)
 * en asientos contables perfectamente balanceados con Partida Doble bajo el Sistema Analítico.
 */

import { PLANTILLAS_CONTABLES, type PlantillaAsiento } from "./templates.config"
import type { Cuenta } from "./types"

export interface LineaGenerada {
  codigo: string
  nombreCuenta: string
  debe: number
  haber: number
  justificacion: string
}

export interface AsientoPlantillaResultado {
  valido: boolean
  plantillaId: string
  plantillaNombre: string
  tipo: "OPERACION" | "AJUSTE"
  glosa: string
  documentoSoporte: string
  baseImponible: number
  iva: number
  total: number
  totalDebe: number
  totalHaber: number
  diferencia: number
  cuadra: boolean
  lineas: LineaGenerada[]
  errores: string[]
}

const TASA_IVA_ESTANDAR = 0.13 // 13% en El Salvador (es-SV)

function roundMoney(amount: number): number {
  return Math.round((Math.abs(Number(amount) || 0) + Number.EPSILON) * 100) / 100
}

function buscarNombreCuenta(codigo: string, catalogo?: Cuenta[]): string {
  if (catalogo && catalogo.length > 0) {
    const c = catalogo.find((item) => item.codigo === codigo)
    if (c) return c.nombre
  }
  const nombresFijos: Record<string, string> = {
    "1101": "Caja general",
    "1102": "Bancos",
    "1103": "Cuentas por cobrar",
    "1104": "Inventario de mercadería (Inicial)",
    "1105": "IVA crédito fiscal",
    "1106": "Deudores diversos",
    "2101": "Cuentas por pagar",
    "2103": "IVA débito fiscal",
    "2105": "Acreedores diversos",
    "4101": "Compras",
    "4102": "Gastos sobre compras",
    "4103": "Devoluciones sobre ventas",
    "4104": "Rebajas y descuentos sobre ventas",
    "4201": "Gastos de administración",
    "4204": "Gastos de alquiler",
    "4205": "Gastos de servicios básicos",
    "4207": "Gastos de papelería y útiles",
    "4208": "Gastos de publicidad",
    "5101": "Ventas",
    "5102": "Devoluciones sobre compras",
    "5103": "Rebajas y descuentos sobre compras",
  }
  return nombresFijos[codigo] || `Cuenta ${codigo}`
}

/**
 * Ejecuta una plantilla contable parametrizada y genera el asiento contable balanceado.
 * 
 * @param plantillaId Identificador único de la plantilla comercial
 * @param valores Objeto con valores ingresados por el usuario
 * @param catalogo Opcional: Catálogo de cuentas para validar nombres y permisos
 */
export function generarAsientoDesdePlantilla(
  plantillaId: string,
  valores: Record<string, any>,
  catalogo?: Cuenta[],
): AsientoPlantillaResultado {
  const plantilla = PLANTILLAS_CONTABLES.find((p) => p.id === plantillaId)
  if (!plantilla) {
    return {
      valido: false,
      plantillaId,
      plantillaNombre: "Desconocida",
      tipo: "OPERACION",
      glosa: "",
      documentoSoporte: "",
      baseImponible: 0,
      iva: 0,
      total: 0,
      totalDebe: 0,
      totalHaber: 0,
      diferencia: 0,
      cuadra: false,
      lineas: [],
      errores: [`No se encontró la plantilla contable con id '${plantillaId}'.`],
    }
  }

  const errores: string[] = []
  const montoInput = roundMoney(valores.monto || 0)
  if (montoInput <= 0) {
    errores.push("El monto de la transacción debe ser mayor a $0.00.")
  }

  const aplicaIva = Boolean(valores.aplicaIva !== undefined ? valores.aplicaIva : true)
  const ivaCalculado = aplicaIva ? roundMoney(montoInput * TASA_IVA_ESTANDAR) : 0
  const montoTotal = roundMoney(montoInput + ivaCalculado)

  const lineas: LineaGenerada[] = []
  const docSoporte = valores.documentoSoporte || `${plantilla.documentoDefaultPrefijo}${Math.floor(1000 + Math.random() * 9000)}`

  switch (plantilla.id) {
    // -------------------------------------------------------------------------
    // 1. COMPRAS DE MERCANCÍA (SISTEMA ANALÍTICO)
    // -------------------------------------------------------------------------
    case "compra_mercaderia_contado": {
      const medioPago = valores.medioPago || "1101"
      // Línea 1: Compras (Costo - Deudora) al Debe
      lineas.push({
        codigo: "4101",
        nombreCuenta: buscarNombreCuenta("4101", catalogo),
        debe: montoInput,
        haber: 0,
        justificacion: "Sistema Analítico: Adquisición de mercaderías se carga directamente a Compras.",
      })
      // Línea 2: IVA Crédito Fiscal al Debe
      if (ivaCalculado > 0) {
        lineas.push({
          codigo: "1105",
          nombreCuenta: buscarNombreCuenta("1105", catalogo),
          debe: ivaCalculado,
          haber: 0,
          justificacion: "13% IVA Crédito Fiscal deducible en compras de mercadería.",
        })
      }
      // Línea 3: Caja o Banco al Haber
      lineas.push({
        codigo: medioPago,
        nombreCuenta: buscarNombreCuenta(medioPago, catalogo),
        debe: 0,
        haber: montoTotal,
        justificacion: "Salida de efectivo o fondos bancarios por pago al contado.",
      })
      break
    }

    case "compra_mercaderia_credito": {
      const cuentaPasivo = valores.cuentaPasivo || "2101"
      // Línea 1: Compras
      lineas.push({
        codigo: "4101",
        nombreCuenta: buscarNombreCuenta("4101", catalogo),
        debe: montoInput,
        haber: 0,
        justificacion: "Sistema Analítico: Registro directo del costo de compra.",
      })
      // Línea 2: IVA Crédito
      if (ivaCalculado > 0) {
        lineas.push({
          codigo: "1105",
          nombreCuenta: buscarNombreCuenta("1105", catalogo),
          debe: ivaCalculado,
          haber: 0,
          justificacion: "13% IVA Crédito Fiscal exigible por factura/CCF.",
        })
      }
      // Línea 3: Cuentas por Pagar (Proveedores)
      lineas.push({
        codigo: cuentaPasivo,
        nombreCuenta: buscarNombreCuenta(cuentaPasivo, catalogo),
        debe: 0,
        haber: montoTotal,
        justificacion: "Obligación de pago a plazo contraída con el proveedor.",
      })
      break
    }

    case "gastos_sobre_compras": {
      const medioPago = valores.medioPago || "1101"
      lineas.push({
        codigo: "4102",
        nombreCuenta: buscarNombreCuenta("4102", catalogo),
        debe: montoInput,
        haber: 0,
        justificacion: "Sistema Analítico: Fletes y transporte se registran en Gastos sobre Compras.",
      })
      if (ivaCalculado > 0) {
        lineas.push({
          codigo: "1105",
          nombreCuenta: buscarNombreCuenta("1105", catalogo),
          debe: ivaCalculado,
          haber: 0,
          justificacion: "IVA Crédito Fiscal correspondiente al servicio de flete.",
        })
      }
      lineas.push({
        codigo: medioPago,
        nombreCuenta: buscarNombreCuenta(medioPago, catalogo),
        debe: 0,
        haber: montoTotal,
        justificacion: "Liquidación del flete mediante salida de caja o banco.",
      })
      break
    }

    // -------------------------------------------------------------------------
    // 2. VENTAS DE MERCANCÍA (SISTEMA ANALÍTICO)
    // -------------------------------------------------------------------------
    case "venta_mercaderia_contado": {
      const cuentaIngreso = valores.cuentaIngreso || "1101"
      // Línea 1: Ingreso a Caja / Banco
      lineas.push({
        codigo: cuentaIngreso,
        nombreCuenta: buscarNombreCuenta(cuentaIngreso, catalogo),
        debe: montoTotal,
        haber: 0,
        justificacion: "Recepción de efectivo o cheque por venta al contado.",
      })
      // Línea 2: Ventas al Haber
      lineas.push({
        codigo: "5101",
        nombreCuenta: buscarNombreCuenta("5101", catalogo),
        debe: 0,
        haber: montoInput,
        justificacion: "Ingreso ordinario por ventas de mercancías.",
      })
      // Línea 3: IVA Débito Fiscal al Haber
      if (ivaCalculado > 0) {
        lineas.push({
          codigo: "2103",
          nombreCuenta: buscarNombreCuenta("2103", catalogo),
          debe: 0,
          haber: ivaCalculado,
          justificacion: "13% IVA Débito Fiscal cobrado al cliente por enterar al fisco.",
        })
      }
      break
    }

    case "venta_mercaderia_credito": {
      const cuentaActivo = valores.cuentaActivo || "1103"
      lineas.push({
        codigo: cuentaActivo,
        nombreCuenta: buscarNombreCuenta(cuentaActivo, catalogo),
        debe: montoTotal,
        haber: 0,
        justificacion: "Generación de derecho de cobro a clientes a plazo.",
      })
      lineas.push({
        codigo: "5101",
        nombreCuenta: buscarNombreCuenta("5101", catalogo),
        debe: 0,
        haber: montoInput,
        justificacion: "Ventas de mercancías devengadas en el ejercicio.",
      })
      if (ivaCalculado > 0) {
        lineas.push({
          codigo: "2103",
          nombreCuenta: buscarNombreCuenta("2103", catalogo),
          debe: 0,
          haber: ivaCalculado,
          justificacion: "IVA Débito Fiscal facturado en venta a crédito.",
        })
      }
      break
    }

    // -------------------------------------------------------------------------
    // 3. DEVOLUCIONES ANALÍTICAS
    // -------------------------------------------------------------------------
    case "devolucion_sobre_compra": {
      const medioReintegro = valores.medioReintegro || "1101"
      // Reintegro o disminución de pasivo
      lineas.push({
        codigo: medioReintegro,
        nombreCuenta: buscarNombreCuenta(medioReintegro, catalogo),
        debe: montoTotal,
        haber: 0,
        justificacion: "Reintegro de dinero o disminución del saldo adeudado al proveedor.",
      })
      // Cuenta analítica acreedora complementaria de compras
      lineas.push({
        codigo: "5102",
        nombreCuenta: buscarNombreCuenta("5102", catalogo),
        debe: 0,
        haber: montoInput,
        justificacion: "Sistema Analítico: Devoluciones sobre compras (naturaleza acreedora).",
      })
      // Ajuste/reversión de IVA crédito
      if (ivaCalculado > 0) {
        lineas.push({
          codigo: "1105",
          nombreCuenta: buscarNombreCuenta("1105", catalogo),
          debe: 0,
          haber: ivaCalculado,
          justificacion: "Reversión del IVA Crédito Fiscal por anulación/devolución de compra.",
        })
      }
      break
    }

    case "devolucion_sobre_venta": {
      const medioReintegro = valores.medioReintegro || "1101"
      // Cuenta analítica deudora complementaria de ventas
      lineas.push({
        codigo: "4103",
        nombreCuenta: buscarNombreCuenta("4103", catalogo),
        debe: montoInput,
        haber: 0,
        justificacion: "Sistema Analítico: Devolución sobre ventas disminuye las ventas netas.",
      })
      // Reversión del IVA débito
      if (ivaCalculado > 0) {
        lineas.push({
          codigo: "2103",
          nombreCuenta: buscarNombreCuenta("2103", catalogo),
          debe: ivaCalculado,
          haber: 0,
          justificacion: "Reversión del IVA Débito Fiscal devuelto al cliente vía Nota de Crédito.",
        })
      }
      // Reembolso o rebaja de saldo
      lineas.push({
        codigo: medioReintegro,
        nombreCuenta: buscarNombreCuenta(medioReintegro, catalogo),
        debe: 0,
        haber: montoTotal,
        justificacion: "Salida de efectivo o rebaja en cuenta por cobrar de cliente.",
      })
      break
    }

    // -------------------------------------------------------------------------
    // 4. GASTOS DE OPERACIÓN
    // -------------------------------------------------------------------------
    case "pago_gasto_operativo": {
      const cuentaGasto = valores.cuentaGasto || "4204"
      const medioPago = valores.medioPago || "1102"
      lineas.push({
        codigo: cuentaGasto,
        nombreCuenta: buscarNombreCuenta(cuentaGasto, catalogo),
        debe: montoInput,
        haber: 0,
        justificacion: "Gasto operativo del período (cuenta deudora).",
      })
      if (ivaCalculado > 0) {
        lineas.push({
          codigo: "1105",
          nombreCuenta: buscarNombreCuenta("1105", catalogo),
          debe: ivaCalculado,
          haber: 0,
          justificacion: "IVA Crédito Fiscal amparado en factura de servicios.",
        })
      }
      lineas.push({
        codigo: medioPago,
        nombreCuenta: buscarNombreCuenta(medioPago, catalogo),
        debe: 0,
        haber: montoTotal,
        justificacion: "Pago efectuado mediante cheque, transferencia o caja.",
      })
      break
    }

    // -------------------------------------------------------------------------
    // 5. TESORERÍA (ABONOS / LIQUIDACIONES)
    // -------------------------------------------------------------------------
    case "abono_cobro_cliente": {
      const medioCobro = valores.medioCobro || "1102"
      lineas.push({
        codigo: medioCobro,
        nombreCuenta: buscarNombreCuenta(medioCobro, catalogo),
        debe: montoInput,
        haber: 0,
        justificacion: "Entrada de fondos por recuperación de cuentas por cobrar.",
      })
      lineas.push({
        codigo: "1103",
        nombreCuenta: buscarNombreCuenta("1103", catalogo),
        debe: 0,
        haber: montoInput,
        justificacion: "Disminución del derecho exigible a clientes.",
      })
      break
    }

    case "abono_pago_proveedor": {
      const origenFondos = valores.origenFondos || "1102"
      lineas.push({
        codigo: "2101",
        nombreCuenta: buscarNombreCuenta("2101", catalogo),
        debe: montoInput,
        haber: 0,
        justificacion: "Disminución de la deuda comercial exigible con proveedores.",
      })
      lineas.push({
        codigo: origenFondos,
        nombreCuenta: buscarNombreCuenta(origenFondos, catalogo),
        debe: 0,
        haber: montoInput,
        justificacion: "Salida de fondos de banco o caja general.",
      })
      break
    }

    default:
      errores.push(`Lógica de negocio no implementada para la plantilla '${plantilla.id}'.`)
  }

  // Verificación estricta de Partida Doble en centavos
  let dCents = 0
  let hCents = 0
  for (const l of lineas) {
    dCents += Math.round((Number(l.debe) || 0) * 100)
    hCents += Math.round((Number(l.haber) || 0) * 100)
  }

  const diffCents = dCents - hCents
  const totalDebe = dCents / 100
  const totalHaber = hCents / 100
  const diferencia = Math.abs(diffCents) / 100
  const cuadra = diffCents === 0 && dCents > 0

  if (!cuadra && errores.length === 0) {
    errores.push(
      `Descuadre contable detectado en plantilla: Debe ($${totalDebe.toFixed(2)}) !== Haber ($${totalHaber.toFixed(2)}).`,
    )
  }

  const glosa = plantilla.generarGlosa({
    ...valores,
    monto: montoInput,
    total: montoTotal,
    iva: ivaCalculado,
  })

  return {
    valido: errores.length === 0 && cuadra,
    plantillaId: plantilla.id,
    plantillaNombre: plantilla.nombre,
    tipo: plantilla.defaultTipo,
    glosa,
    documentoSoporte: docSoporte,
    baseImponible: montoInput,
    iva: ivaCalculado,
    total: montoTotal,
    totalDebe,
    totalHaber,
    diferencia,
    cuadra,
    lineas,
    errores,
  }
}
