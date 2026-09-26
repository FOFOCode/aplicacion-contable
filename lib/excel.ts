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
// PALETA Y ESTILOS EJECUTIVOS PARA CONTABILIDAD
// =============================================================================

export const PALETA_EXCEL = {
  azulCabecera: "1E293B",     // Slate 800 - Ejecutivo sobrio
  azulTitulo: "0F172A",       // Slate 900 - Titular
  azulSubseccion: "334155",   // Slate 700 - Sub-encabezados
  fondoSeccion: "F1F5F9",     // Slate 100 - Filas de grupo / secciones
  fondoCebrado: "F8FAFC",     // Slate 50 - Zebra striping
  fondoTotales: "E2E8F0",     // Slate 200 - Resalte sumas iguales
  bordeSuave: "CBD5E1",       // Slate 300 - Cuadrícula nítida
  bordeFuerte: "0F172A",      // Slate 900 - Línea total
  textoOscuro: "0F172A",
  textoGris: "475569",
  blanco: "FFFFFF",
}

const BORDE_TABLA = {
  top: { style: "thin", color: { rgb: PALETA_EXCEL.bordeSuave } },
  bottom: { style: "thin", color: { rgb: PALETA_EXCEL.bordeSuave } },
  left: { style: "thin", color: { rgb: PALETA_EXCEL.bordeSuave } },
  right: { style: "thin", color: { rgb: PALETA_EXCEL.bordeSuave } },
}

const BORDE_TOTAL_DOBLE = {
  top: { style: "thin", color: { rgb: PALETA_EXCEL.bordeFuerte } },
  bottom: { style: "double", color: { rgb: PALETA_EXCEL.bordeFuerte } },
  left: { style: "thin", color: { rgb: PALETA_EXCEL.bordeSuave } },
  right: { style: "thin", color: { rgb: PALETA_EXCEL.bordeSuave } },
}

export const ESTILO_TITULO_EMPRESA: EstiloCelda = {
  font: { name: "Calibri", sz: 14, bold: true, color: { rgb: PALETA_EXCEL.azulTitulo } },
  alignment: { horizontal: "left", vertical: "center" },
}

export const ESTILO_SUBTITULO: EstiloCelda = {
  font: { name: "Calibri", sz: 10, italic: true, color: { rgb: PALETA_EXCEL.textoGris } },
  alignment: { horizontal: "left", vertical: "center" },
}

export const ESTILO_CABECERA_TABLA: EstiloCelda = {
  font: { name: "Calibri", sz: 10, bold: true, color: { rgb: PALETA_EXCEL.blanco } },
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.azulCabecera } },
  border: {
    top: { style: "medium", color: { rgb: PALETA_EXCEL.azulCabecera } },
    bottom: { style: "medium", color: { rgb: PALETA_EXCEL.azulCabecera } },
    left: { style: "thin", color: { rgb: "334155" } },
    right: { style: "thin", color: { rgb: "334155" } },
  },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
}

export const ESTILO_FILA_SECCION: EstiloCelda = {
  font: { name: "Calibri", sz: 10, bold: true, color: { rgb: PALETA_EXCEL.azulTitulo } },
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.fondoSeccion } },
  border: {
    top: { style: "thin", color: { rgb: "94A3B8" } },
    bottom: { style: "thin", color: { rgb: "94A3B8" } },
    left: { style: "thin", color: { rgb: PALETA_EXCEL.bordeSuave } },
    right: { style: "thin", color: { rgb: PALETA_EXCEL.bordeSuave } },
  },
  alignment: { horizontal: "left", vertical: "center" },
}

export const ESTILO_CELDA_NORMAL: EstiloCelda = {
  font: { name: "Calibri", sz: 9.5, color: { rgb: PALETA_EXCEL.textoOscuro } },
  border: BORDE_TABLA,
  alignment: { horizontal: "left", vertical: "center" },
}

export const ESTILO_CELDA_CEBRADA: EstiloCelda = {
  ...ESTILO_CELDA_NORMAL,
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.fondoCebrado } },
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
  font: { name: "Consolas", sz: 9.5, bold: true, color: { rgb: PALETA_EXCEL.textoOscuro } },
  border: BORDE_TABLA,
  alignment: { horizontal: "center", vertical: "center" },
}

export const ESTILO_CELDA_CODIGO_CEBRADA: EstiloCelda = {
  ...ESTILO_CELDA_CODIGO,
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.fondoCebrado } },
}

export const ESTILO_CELDA_MONEDA: EstiloCelda = {
  font: { name: "Consolas", sz: 9.5, color: { rgb: PALETA_EXCEL.textoOscuro } },
  border: BORDE_TABLA,
  alignment: { horizontal: "right", vertical: "center" },
  numFmt: "$#,##0.00;($#,##0.00);\"-\"",
}

export const ESTILO_CELDA_MONEDA_CEBRADA: EstiloCelda = {
  ...ESTILO_CELDA_MONEDA,
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.fondoCebrado } },
}

export const ESTILO_CELDA_NUMERO: EstiloCelda = {
  font: { name: "Consolas", sz: 9.5, color: { rgb: PALETA_EXCEL.textoOscuro } },
  border: BORDE_TABLA,
  alignment: { horizontal: "right", vertical: "center" },
  numFmt: "#,##0.00;(#,##0.00);\"-\"",
}

export const ESTILO_CELDA_NUMERO_CEBRADA: EstiloCelda = {
  ...ESTILO_CELDA_NUMERO,
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.fondoCebrado } },
}

export const ESTILO_TOTAL_DOBLE_TEXTO: EstiloCelda = {
  font: { name: "Calibri", sz: 10, bold: true, color: { rgb: PALETA_EXCEL.azulTitulo } },
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.fondoTotales } },
  border: BORDE_TOTAL_DOBLE,
  alignment: { horizontal: "left", vertical: "center" },
}

export const ESTILO_TOTAL_DOBLE_MONEDA: EstiloCelda = {
  font: { name: "Consolas", sz: 10, bold: true, color: { rgb: PALETA_EXCEL.azulTitulo } },
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.fondoTotales } },
  border: BORDE_TOTAL_DOBLE,
  alignment: { horizontal: "right", vertical: "center" },
  numFmt: "$#,##0.00;($#,##0.00);\"-\"",
}

export const ESTILO_TOTAL_DOBLE_NUMERO: EstiloCelda = {
  font: { name: "Consolas", sz: 10, bold: true, color: { rgb: PALETA_EXCEL.azulTitulo } },
  fill: { patternType: "solid", fgColor: { rgb: PALETA_EXCEL.fondoTotales } },
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
 * Aplica estilos contables ejecutivos completos a una matriz de filas.
 * Incluye cabecera estilizada, zebra-striping, formatos de moneda,
 * fila de totales con doble subrayado formal y configuración de página.
 */
export function maquetarReporteContable(opts: OpcionesMaquetadoContable) {
  const {
    filas,
    filaEncabezado,
    columnasMoneda = [],
    columnasNumero = [],
    columnasCodigo = [],
    columnasCentro = [],
    anchos = [],
    filasTotales = [],
    filasSeccion = [],
    filtro = true,
    orientacion = "landscape",
  } = opts

  const estilos: Record<string, EstiloCelda> = {
    "0:0": ESTILO_TITULO_EMPRESA,
  }

  // Título y subtítulos iniciales
  for (let r = 1; r < filaEncabezado; r++) {
    estilos[`${r}:0`] = ESTILO_SUBTITULO
  }

  const numCols = anchos.length || (filas[filaEncabezado]?.length ?? 1)
  const letraFinal = columnaAExcel(numCols - 1)

  // Cabecera de la tabla
  for (let c = 0; c < numCols; c++) {
    estilos[`${filaEncabezado}:${c}`] = ESTILO_CABECERA_TABLA
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
      // Fila de Totales (Doble raya contable)
      for (let c = 0; c < numCols; c++) {
        if (columnasMoneda.includes(c)) {
          estilos[`${f}:${c}`] = ESTILO_TOTAL_DOBLE_MONEDA
        } else if (columnasNumero.includes(c)) {
          estilos[`${f}:${c}`] = ESTILO_TOTAL_DOBLE_NUMERO
        } else {
          estilos[`${f}:${c}`] = ESTILO_TOTAL_DOBLE_TEXTO
        }
      }
      continue
    }

    if (setSecciones.has(f)) {
      // Fila de Sección/Grupo
      for (let c = 0; c < numCols; c++) {
        estilos[`${f}:${c}`] = ESTILO_FILA_SECCION
      }
      continue
    }

    // Fila de datos con Zebra Striping suave
    const esPar = contadorCuerpo % 2 === 0
    contadorCuerpo++

    for (let c = 0; c < numCols; c++) {
      if (columnasMoneda.includes(c)) {
        estilos[`${f}:${c}`] = esPar ? ESTILO_CELDA_MONEDA : ESTILO_CELDA_MONEDA_CEBRADA
      } else if (columnasNumero.includes(c)) {
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
    if (i === 0) return 24 // Título empresa
    if (i < filaEncabezado) return 15 // Subtítulos
    if (i === filaEncabezado) return 26 // Encabezado de columnas
    if (setTotales.has(i)) return 22 // Totales
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

  return {
    anchos,
    alturas,
    combinar: [`A1:${letraFinal}1`],
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
