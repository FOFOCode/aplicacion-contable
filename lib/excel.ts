import * as XLSX from "xlsx"

/**
 * Estilo de celda compatible con xlsx-js-style.
 */
export interface EstiloCelda {
  font?: {
    name?: string
    sz?: number
    bold?: boolean
    italic?: boolean
    underline?: boolean
    color?: { rgb: string }
  }
  fill?: {
    patternType?: "solid" | "none"
    fgColor?: { rgb: string }
  }
  border?: {
    top?: { style: string; color?: { rgb: string } }
    bottom?: { style: string; color?: { rgb: string } }
    left?: { style: string; color?: { rgb: string } }
    right?: { style: string; color?: { rgb: string } }
  }
  alignment?: {
    horizontal?: "left" | "center" | "right" | "justify"
    vertical?: "top" | "center" | "bottom"
    wrapText?: boolean
  }
  numFmt?: string
}

export interface HojaExcel {
  nombre: string
  filas: (string | number | null | undefined)[][]
  /** Anchos de columna en caracteres. Opcional. */
  anchos?: number[]
  /** Alturas de fila en puntos. Opcional. */
  alturas?: number[]
  /**
   * Estilos a aplicar, indexados como `[fila, columna]` en base 0 sobre el
   * arreglo `filas`. Opcional: si se omite, la hoja sale sin formato.
   */
  estilos?: Record<string, EstiloCelda>
  /** Combina este rango, p.ej. ["A1:C1"]. Opcional. */
  combinar?: string[]
  /** Autofiltro sobre este rango, p.ej. "A3:C9". Opcional. */
  filtro?: string
  /** Orientación de página para impresión: "landscape" (horizontal) o "portrait" (vertical). */
  orientacion?: "landscape" | "portrait"
  /** Ajustar ancho a N páginas (1 = ajustar al ancho de 1 página para evitar cortes). */
  fitToWidth?: number
  /** Ajustar alto a N páginas (0 = no forzar altura). */
  fitToHeight?: number
}

// =============================================================================
// PALETA DE COLORES EJECUTIVA, VIBRANTE Y MODERNA
// =============================================================================

export const PALETA_EXCEL = {
  // Azules Reales / Corporativos
  azulBanner: "1E3A8A",          // Blue 900 - Azul real profundo para banner
  azulHeaderTabla: "1E40AF",     // Blue 800 - Cabecera general de columnas
  azulHeaderHaber: "1D4ED8",     // Blue 700 - Cabecera columna Haber
  azulFondoSuave: "EFF6FF",       // Blue 50 - Fondo celeste tenue
  azulFondoAcento: "DBEAFE",      // Blue 100 - Fondo de secciones
  azulTexto: "1E40AF",            // Blue 800 - Texto azul destacado
  azulBorde: "93C5FD",            // Blue 300 - Borde azul nítido

  // Verdes Financieros (Debe / Ingresos / Cuadratura)
  verdeHeaderDebe: "047857",      // Emerald 700 - Cabecera columna Debe
  verdeFondoSuave: "ECFDF5",      // Emerald 50 - Fondo verde tenue
  verdeFondoAcento: "D1FAE5",     // Emerald 100 - Fondo verde menta acento
  verdeFondoTotales: "D1FAE5",    // Emerald 100 - Fondo de sumas iguales
  verdeTexto: "065F46",           // Emerald 800 - Texto verde contable
  verdeBorde: "059669",           // Emerald 600 - Borde verde destacado

  // Ámbar / Naranja Cálido (Salidas / Gastos / Pasivo)
  ambarHeaderSalida: "D97706",    // Amber 600 - Cabecera Salidas
  ambarFondoSuave: "FFFBEB",      // Amber 50 - Fondo salidas tenue
  ambarFondoAcento: "FEF3C7",     // Amber 100 - Fondo gastos/pasivo
  ambarTexto: "92400E",           // Amber 800
  ambarBorde: "F59E0B",           // Amber 500

  // Índigo / Púrpura (Saldo / Capital)
  indigoHeaderSaldo: "4338CA",    // Indigo 700 - Cabecera columna Saldo
  indigoFondoSuave: "EEF2FF",     // Indigo 50
  indigoTexto: "3730A3",

  // Neutros elegantes
  grisCebrado: "F8FAFC",          // Slate 50 - Cebrado alternado
  bordeTabla: "CBD5E1",           // Slate 300 - Cuadrícula limpia
  textoOscuro: "0F172A",          // Slate 900 - Texto principal
  textoGris: "64748B",            // Slate 500
  blanco: "FFFFFF",
}

const BORDE_TABLA = {
  top: { style: "thin", color: { rgb: PALETA_EXCEL.bordeTabla } },
  bottom: { style: "thin", color: { rgb: PALETA_EXCEL.bordeTabla } },
  left: { style: "thin", color: { rgb: PALETA_EXCEL.bordeTabla } },
  right: { style: "thin", color: { rgb: PALETA_EXCEL.bordeTabla } },
}

const BORDE_TOTAL_DOBLE = {
  top: { style: "thin", color: { rgb: PALETA_EXCEL.verdeBorde } },
  bottom: { style: "double", color: { rgb: PALETA_EXCEL.verdeTexto } },
  left: { style: "thin", color: { rgb: PALETA_EXCEL.bordeTabla } },
  right: { style: "thin", color: { rgb: PALETA_EXCEL.bordeTabla } },
}

// =============================================================================
// ESTILOS DE CELDA PREDISEÑADOS
// =============================================================================

export const ESTILO_BANNER_EMPRESA: EstiloCelda = {
  font: { name: "Calibri", sz: 13, bold: true, color: { rgb: PALETA_EXCEL.blanco } },
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.azulBanner } },
  alignment: { horizontal: "center", vertical: "center" },
}

export const ESTILO_BANNER_SUBTITULO: EstiloCelda = {
  font: { name: "Calibri", sz: 9.5, bold: true, color: { rgb: PALETA_EXCEL.azulTexto } },
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.azulFondoSuave } },
  alignment: { horizontal: "center", vertical: "center" },
  border: {
    bottom: { style: "thin", color: { rgb: PALETA_EXCEL.azulBorde } },
  },
}

export const ESTILO_TITULO_EMPRESA: EstiloCelda = {
  font: { name: "Calibri", sz: 13, bold: true, color: { rgb: PALETA_EXCEL.azulBanner } },
  alignment: { horizontal: "left", vertical: "center" },
}

export const ESTILO_SUBTITULO: EstiloCelda = {
  font: { name: "Calibri", sz: 9.5, italic: true, color: { rgb: PALETA_EXCEL.textoGris } },
  alignment: { horizontal: "left", vertical: "center" },
}

// Cabeceras funcionales con color distintivo
export const ESTILO_CABECERA_TABLA: EstiloCelda = {
  font: { name: "Calibri", sz: 10, bold: true, color: { rgb: PALETA_EXCEL.blanco } },
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.azulHeaderTabla } },
  border: {
    top: { style: "medium", color: { rgb: PALETA_EXCEL.azulBanner } },
    bottom: { style: "medium", color: { rgb: PALETA_EXCEL.azulBanner } },
    left: { style: "thin", color: { rgb: "3B82F6" } },
    right: { style: "thin", color: { rgb: "3B82F6" } },
  },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
}

export const ESTILO_CABECERA_DEBE: EstiloCelda = {
  font: { name: "Calibri", sz: 10, bold: true, color: { rgb: PALETA_EXCEL.blanco } },
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.verdeHeaderDebe } },
  border: {
    top: { style: "medium", color: { rgb: "065F46" } },
    bottom: { style: "medium", color: { rgb: "065F46" } },
    left: { style: "thin", color: { rgb: "10B981" } },
    right: { style: "thin", color: { rgb: "10B981" } },
  },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
}

export const ESTILO_CABECERA_HABER: EstiloCelda = {
  font: { name: "Calibri", sz: 10, bold: true, color: { rgb: PALETA_EXCEL.blanco } },
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.azulHeaderHaber } },
  border: {
    top: { style: "medium", color: { rgb: "1E40AF" } },
    bottom: { style: "medium", color: { rgb: "1E40AF" } },
    left: { style: "thin", color: { rgb: "60A5FA" } },
    right: { style: "thin", color: { rgb: "60A5FA" } },
  },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
}

export const ESTILO_CABECERA_SALDO: EstiloCelda = {
  font: { name: "Calibri", sz: 10, bold: true, color: { rgb: PALETA_EXCEL.blanco } },
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.indigoHeaderSaldo } },
  border: {
    top: { style: "medium", color: { rgb: "312E81" } },
    bottom: { style: "medium", color: { rgb: "312E81" } },
    left: { style: "thin", color: { rgb: "818CF8" } },
    right: { style: "thin", color: { rgb: "818CF8" } },
  },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
}

export const ESTILO_CABECERA_SALIDAS: EstiloCelda = {
  font: { name: "Calibri", sz: 10, bold: true, color: { rgb: PALETA_EXCEL.blanco } },
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.ambarHeaderSalida } },
  border: {
    top: { style: "medium", color: { rgb: "B45309" } },
    bottom: { style: "medium", color: { rgb: "B45309" } },
    left: { style: "thin", color: { rgb: "FBBF24" } },
    right: { style: "thin", color: { rgb: "FBBF24" } },
  },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
}

// Filas de Sección / Partida con color
export const ESTILO_FILA_SECCION: EstiloCelda = {
  font: { name: "Calibri", sz: 10, bold: true, color: { rgb: PALETA_EXCEL.azulTexto } },
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.azulFondoAcento } },
  border: {
    top: { style: "thin", color: { rgb: PALETA_EXCEL.azulBorde } },
    bottom: { style: "thin", color: { rgb: PALETA_EXCEL.azulBorde } },
    left: { style: "medium", color: { rgb: PALETA_EXCEL.azulTexto } },
    right: { style: "thin", color: { rgb: PALETA_EXCEL.azulBorde } },
  },
  alignment: { horizontal: "left", vertical: "center" },
}

export const ESTILO_FILA_SECCION_VERDE: EstiloCelda = {
  font: { name: "Calibri", sz: 10, bold: true, color: { rgb: PALETA_EXCEL.verdeTexto } },
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.verdeFondoAcento } },
  border: {
    top: { style: "thin", color: { rgb: PALETA_EXCEL.verdeBorde } },
    bottom: { style: "thin", color: { rgb: PALETA_EXCEL.verdeBorde } },
    left: { style: "medium", color: { rgb: PALETA_EXCEL.verdeTexto } },
    right: { style: "thin", color: { rgb: PALETA_EXCEL.verdeBorde } },
  },
  alignment: { horizontal: "left", vertical: "center" },
}

export const ESTILO_FILA_SECCION_AMBAR: EstiloCelda = {
  font: { name: "Calibri", sz: 10, bold: true, color: { rgb: PALETA_EXCEL.ambarTexto } },
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.ambarFondoAcento } },
  border: {
    top: { style: "thin", color: { rgb: PALETA_EXCEL.ambarBorde } },
    bottom: { style: "thin", color: { rgb: PALETA_EXCEL.ambarBorde } },
    left: { style: "medium", color: { rgb: PALETA_EXCEL.ambarTexto } },
    right: { style: "thin", color: { rgb: PALETA_EXCEL.ambarBorde } },
  },
  alignment: { horizontal: "left", vertical: "center" },
}

// Celdas de datos estándar y cebradas
export const ESTILO_CELDA_NORMAL: EstiloCelda = {
  font: { name: "Calibri", sz: 9.5, color: { rgb: PALETA_EXCEL.textoOscuro } },
  border: BORDE_TABLA,
  alignment: { horizontal: "left", vertical: "center" },
}

export const ESTILO_CELDA_CEBRADA: EstiloCelda = {
  ...ESTILO_CELDA_NORMAL,
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.grisCebrado } },
}

export const ESTILO_CELDA_CENTRO: EstiloCelda = {
  ...ESTILO_CELDA_NORMAL,
  alignment: { horizontal: "center", vertical: "center" },
}

export const ESTILO_CELDA_CENTRO_CEBRADA: EstiloCelda = {
  ...ESTILO_CELDA_CEBRADA,
  alignment: { horizontal: "center", vertical: "center" },
}

export const ESTILO_CELDA_CODIGO: EstiloCelda = {
  font: { name: "Consolas", sz: 9.5, bold: true, color: { rgb: PALETA_EXCEL.azulTexto } },
  border: BORDE_TABLA,
  alignment: { horizontal: "center", vertical: "center" },
}

export const ESTILO_CELDA_CODIGO_CEBRADA: EstiloCelda = {
  ...ESTILO_CELDA_CODIGO,
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.grisCebrado } },
}

// Celdas de moneda con color temático
export const ESTILO_CELDA_MONEDA: EstiloCelda = {
  font: { name: "Consolas", sz: 9.5, color: { rgb: PALETA_EXCEL.textoOscuro } },
  border: BORDE_TABLA,
  alignment: { horizontal: "right", vertical: "center" },
  numFmt: "$#,##0.00;($#,##0.00);\"-\"",
}

export const ESTILO_CELDA_MONEDA_CEBRADA: EstiloCelda = {
  ...ESTILO_CELDA_MONEDA,
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.grisCebrado } },
}

export const ESTILO_CELDA_DEBE: EstiloCelda = {
  font: { name: "Consolas", sz: 9.5, bold: true, color: { rgb: PALETA_EXCEL.verdeTexto } },
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.verdeFondoSuave } },
  border: BORDE_TABLA,
  alignment: { horizontal: "right", vertical: "center" },
  numFmt: "$#,##0.00;($#,##0.00);\"-\"",
}

export const ESTILO_CELDA_HABER: EstiloCelda = {
  font: { name: "Consolas", sz: 9.5, bold: true, color: { rgb: PALETA_EXCEL.azulTexto } },
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.azulFondoSuave } },
  border: BORDE_TABLA,
  alignment: { horizontal: "right", vertical: "center" },
  numFmt: "$#,##0.00;($#,##0.00);\"-\"",
}

export const ESTILO_CELDA_SALDO: EstiloCelda = {
  font: { name: "Consolas", sz: 9.5, bold: true, color: { rgb: PALETA_EXCEL.indigoTexto } },
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.indigoFondoSuave } },
  border: BORDE_TABLA,
  alignment: { horizontal: "right", vertical: "center" },
  numFmt: "$#,##0.00;($#,##0.00);\"-\"",
}

export const ESTILO_CELDA_NUMERO: EstiloCelda = {
  font: { name: "Consolas", sz: 9.5, color: { rgb: PALETA_EXCEL.textoOscuro } },
  border: BORDE_TABLA,
  alignment: { horizontal: "right", vertical: "center" },
  numFmt: "#,##0.00;(#,##0.00);\"-\"",
}

export const ESTILO_CELDA_NUMERO_CEBRADA: EstiloCelda = {
  ...ESTILO_CELDA_NUMERO,
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.grisCebrado } },
}

// Totales formales con fondo Verde Menta de Cuadratura Exitosa
export const ESTILO_TOTAL_DOBLE_TEXTO: EstiloCelda = {
  font: { name: "Calibri", sz: 10, bold: true, color: { rgb: PALETA_EXCEL.verdeTexto } },
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.verdeFondoTotales } },
  border: BORDE_TOTAL_DOBLE,
  alignment: { horizontal: "left", vertical: "center" },
}

export const ESTILO_TOTAL_DOBLE_MONEDA: EstiloCelda = {
  font: { name: "Consolas", sz: 10, bold: true, color: { rgb: PALETA_EXCEL.verdeTexto } },
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.verdeFondoTotales } },
  border: BORDE_TOTAL_DOBLE,
  alignment: { horizontal: "right", vertical: "center" },
  numFmt: "$#,##0.00;($#,##0.00);\"-\"",
}

export const ESTILO_TOTAL_DOBLE_NUMERO: EstiloCelda = {
  font: { name: "Consolas", sz: 10, bold: true, color: { rgb: PALETA_EXCEL.verdeTexto } },
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.verdeFondoTotales } },
  border: BORDE_TOTAL_DOBLE,
  alignment: { horizontal: "right", vertical: "center" },
  numFmt: "#,##0.00;(#,##0.00);\"-\"",
}

// =============================================================================
// CONVERSORES DE RANGO Y AUTO-MAQUETADOR
// =============================================================================

function rangoAMerge(ref: string) {
  const [inicio, fin] = ref.split(":")
  const dec = (celda: string) => {
    const m = /^([A-Z]+)(\d+)$/.exec(celda)
    if (!m) return null
    let columna = 0
    for (const letra of m[1]) columna = columna * 26 + (letra.charCodeAt(0) - 64)
    return { c: columna - 1, r: Number(m[2]) - 1 }
  }
  const a = dec(inicio.trim())
  const b = (fin ? dec(fin.trim()) : a) ?? a
  if (!a || !b) return null
  return { s: a, e: b }
}

export function columnaAExcel(n: number): string {
  let s = ""
  let x = n + 1
  while (x > 0) {
    const resto = (x - 1) % 26
    s = String.fromCharCode(65 + resto) + s
    x = Math.floor((x - 1) / 26)
  }
  return s
}

export interface OpcionesMaquetadoContable {
  filas: (string | number | null | undefined)[][]
  filaEncabezado: number
  columnasMoneda?: number[]
  columnasDebe?: number[]
  columnasHaber?: number[]
  columnasSaldo?: number[]
  columnasSalidas?: number[]
  columnasNumero?: number[]
  columnasCodigo?: number[]
  columnasCentro?: number[]
  anchos?: number[]
  filasTotales?: number[]
  filasSeccion?: number[]
  filtro?: boolean | string
  orientacion?: "landscape" | "portrait"
}

/**
 * Aplica estilos contables ejecutivos completos a una matriz de filas con colores vivos,
 * diferenciación funcional (Debe en verde, Haber en azul, Saldo en índigo),
 * cabecera estilizada, zebra-striping, formatos de moneda y totales con doble raya contable.
 */
export function maquetarReporteContable(opts: OpcionesMaquetadoContable) {
  const {
    filas,
    filaEncabezado,
    columnasMoneda = [],
    columnasDebe = [],
    columnasHaber = [],
    columnasSaldo = [],
    columnasSalidas = [],
    columnasNumero = [],
    columnasCodigo = [],
    columnasCentro = [],
    anchos = [],
    filasTotales = [],
    filasSeccion = [],
    filtro = true,
    orientacion = "landscape",
  } = opts

  const numCols = anchos.length || (filas[filaEncabezado]?.length ?? 1)
  const letraFinal = columnaAExcel(numCols - 1)

  const estilos: Record<string, EstiloCelda> = {}

  // Banner superior con color
  for (let c = 0; c < numCols; c++) {
    estilos[`0:${c}`] = ESTILO_BANNER_EMPRESA
  }

  // Subtítulo estilizado con fondo celeste suave
  for (let r = 1; r < filaEncabezado; r++) {
    const fila = filas[r]
    if (!fila || fila.every((v) => v === null || v === undefined || v === "")) continue
    for (let c = 0; c < numCols; c++) {
      estilos[`${r}:${c}`] = ESTILO_BANNER_SUBTITULO
    }
  }

  // Cabecera de la tabla con colores funcionales
  for (let c = 0; c < numCols; c++) {
    if (columnasDebe.includes(c)) {
      estilos[`${filaEncabezado}:${c}`] = ESTILO_CABECERA_DEBE
    } else if (columnasHaber.includes(c)) {
      estilos[`${filaEncabezado}:${c}`] = ESTILO_CABECERA_HABER
    } else if (columnasSaldo.includes(c)) {
      estilos[`${filaEncabezado}:${c}`] = ESTILO_CABECERA_SALDO
    } else if (columnasSalidas.includes(c)) {
      estilos[`${filaEncabezado}:${c}`] = ESTILO_CABECERA_SALIDAS
    } else {
      estilos[`${filaEncabezado}:${c}`] = ESTILO_CABECERA_TABLA
    }
  }

  const ultimaFila = filas.length - 1
  const setTotales = new Set(filasTotales.length ? filasTotales : [ultimaFila])
  const setSecciones = new Set(filasSeccion)

  // Cuerpo de la tabla
  let contadorCuerpo = 0
  for (let f = filaEncabezado + 1; f <= ultimaFila; f++) {
    const fila = filas[f]
    if (!fila || fila.every((v) => v === null || v === undefined || v === "")) {
      continue
    }

    if (setTotales.has(f)) {
      // Fila de Totales Cuadrados (Fondo Verde Menta y Doble raya verde contable)
      for (let c = 0; c < numCols; c++) {
        if (columnasMoneda.includes(c) || columnasDebe.includes(c) || columnasHaber.includes(c) || columnasSaldo.includes(c)) {
          estilos[`${f}:${c}`] = ESTILO_TOTAL_DOBLE_MONEDA
        } else if (columnasNumero.includes(c) || columnasSalidas.includes(c)) {
          estilos[`${f}:${c}`] = ESTILO_TOTAL_DOBLE_NUMERO
        } else {
          estilos[`${f}:${c}`] = ESTILO_TOTAL_DOBLE_TEXTO
        }
      }
      continue
    }

    if (setSecciones.has(f)) {
      // Fila de Sección/Partida con acento celeste
      for (let c = 0; c < numCols; c++) {
        estilos[`${f}:${c}`] = ESTILO_FILA_SECCION
      }
      continue
    }

    // Fila de datos con Zebra Striping suave
    const esPar = contadorCuerpo % 2 === 0
    contadorCuerpo++

    for (let c = 0; c < numCols; c++) {
      if (columnasDebe.includes(c)) {
        estilos[`${f}:${c}`] = ESTILO_CELDA_DEBE
      } else if (columnasHaber.includes(c)) {
        estilos[`${f}:${c}`] = ESTILO_CELDA_HABER
      } else if (columnasSaldo.includes(c)) {
        estilos[`${f}:${c}`] = ESTILO_CELDA_SALDO
      } else if (columnasMoneda.includes(c)) {
        estilos[`${f}:${c}`] = esPar ? ESTILO_CELDA_MONEDA : ESTILO_CELDA_MONEDA_CEBRADA
      } else if (columnasNumero.includes(c) || columnasSalidas.includes(c)) {
        estilos[`${f}:${c}`] = esPar ? ESTILO_CELDA_NUMERO : ESTILO_CELDA_NUMERO_CEBRADA
      } else if (columnasCodigo.includes(c)) {
        estilos[`${f}:${c}`] = esPar ? ESTILO_CELDA_CODIGO : ESTILO_CELDA_CODIGO_CEBRADA
      } else if (columnasCentro.includes(c)) {
        estilos[`${f}:${c}`] = esPar ? ESTILO_CELDA_CENTRO : ESTILO_CELDA_CENTRO_CEBRADA
      } else {
        estilos[`${f}:${c}`] = esPar ? ESTILO_CELDA_NORMAL : ESTILO_CELDA_CEBRADA
      }
    }
  }

  // Alturas de fila proporcionales
  const alturas = filas.map((_, i) => {
    if (i === 0) return 26 // Banner institucional
    if (i < filaEncabezado) return 18 // Subtítulos
    if (i === filaEncabezado) return 26 // Encabezado de columnas
    if (setTotales.has(i)) return 24 // Totales
    if (setSecciones.has(i)) return 20 // Secciones
    return 18 // Filas de datos estándar
  })

  // Autofiltro
  let filtroStr: string | undefined
  if (typeof filtro === "string") {
    filtroStr = filtro
  } else if (filtro && ultimaFila > filaEncabezado) {
    const finDatos = Array.from(setTotales).sort((a, b) => a - b)[0] ?? ultimaFila
    filtroStr = `A${filaEncabezado + 1}:${letraFinal}${finDatos}`
  }

  const combinar: string[] = []
  // Combinar banners superiores
  for (let r = 0; r < filaEncabezado; r++) {
    const fila = filas[r]
    if (fila && fila.some((v) => v !== null && v !== undefined && v !== "")) {
      combinar.push(`A${r + 1}:${letraFinal}${r + 1}`)
    }
  }

  return {
    anchos,
    alturas,
    combinar,
    filtro: filtroStr,
    estilos,
    orientacion,
    fitToWidth: 1,
    fitToHeight: 0,
  }
}

// =============================================================================
// EXPORTADOR PRINCIPAL CON CONFIGURACIÓN DE PÁGINA (PAGE SETUP / PRINT)
// =============================================================================

export function exportarLibroExcel(nombreArchivo: string, hojas: HojaExcel[]) {
  const wb = XLSX.utils.book_new()

  for (const hoja of hojas) {
    const ws = XLSX.utils.aoa_to_sheet(hoja.filas) as XLSX.WorkSheet & {
      "!cols"?: unknown[]
      "!merges"?: unknown[]
      "!rows"?: unknown[]
      "!autofilter"?: { ref: string }
      "!pageSetup"?: Record<string, unknown>
      "!margins"?: Record<string, unknown>
    }

    if (hoja.anchos?.length) {
      ws["!cols"] = hoja.anchos.map((wch) => ({ wch }))
    }

    if (hoja.alturas?.length) {
      ws["!rows"] = hoja.alturas.map((hpt) => ({ hpt }))
    }

    if (hoja.combinar?.length) {
      const merges = hoja.combinar.map(rangoAMerge).filter((m) => m !== null)
      if (merges.length) ws["!merges"] = merges
    }

    if (hoja.filtro) {
      ws["!autofilter"] = { ref: hoja.filtro }
    }

    // Configuración formal para impresión (Ctrl + P / Page Setup)
    ws["!pageSetup"] = {
      orientation: hoja.orientacion || "landscape",
      paperSize: 9, // Carta (Letter 8.5 x 11 in)
      fitToWidth: hoja.fitToWidth ?? 1,
      fitToHeight: hoja.fitToHeight ?? 0,
      scale: 100,
    }

    // Márgenes estrechos para maximizar área de lectura y presentación
    ws["!margins"] = {
      left: 0.45,
      right: 0.45,
      top: 0.6,
      bottom: 0.6,
      header: 0.3,
      footer: 0.3,
    }

    if (hoja.estilos) {
      for (const [pos, estilo] of Object.entries(hoja.estilos)) {
        const [fila, columna] = pos.split(":").map(Number)
        if (Number.isNaN(fila) || Number.isNaN(columna)) continue
        const direccion = XLSX.utils.encode_cell({ r: fila, c: columna })
        if (!ws[direccion]) {
          ws[direccion] = { t: "s", v: "" } as XLSX.CellObject
        }
        ws[direccion].s = estilo as never
      }
    }

    const nombreLimpio = hoja.nombre.replace(/[:\\/?*\[\]]/g, "").slice(0, 31) || "Hoja"
    XLSX.utils.book_append_sheet(wb, ws, nombreLimpio)
  }

  const nombreFinal = nombreArchivo.endsWith(".xlsx") ? nombreArchivo : `${nombreArchivo}.xlsx`
  XLSX.writeFile(wb, nombreFinal)
}
