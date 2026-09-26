import * as XLSX from "xlsx"

/**
 * Estilo de celda. El subconjunto es el que entiende xlsx-js-style (fork de
 * SheetJS con escritura de estilos; la build oficial los descarta).
 */
export interface EstiloCelda {
  font?: { name?: string; sz?: number; bold?: boolean; italic?: boolean; color?: { rgb: string } }
  fill?: { patternType?: "solid"; fgColor?: { rgb: string } }
  border?: {
    top?: { style: string; color?: { rgb: string } }
    bottom?: { style: string; color?: { rgb: string } }
    left?: { style: string; color?: { rgb: string } }
    right?: { style: string; color?: { rgb: string } }
  }
  alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean }
  numFmt?: string
}

export interface HojaExcel {
  nombre: string
  filas: (string | number | null | undefined)[][]
  /** Anchos de columna en caracteres. Opcional. */
  anchos?: number[]
  /**
   * Estilos a aplicar, indexados como `[fila, columna]` en base 0 sobre el
   * arreglo `filas`. Opcional: si se omite, la hoja sale sin formato.
   */
  estilos?: Record<string, EstiloCelda>
  /** Alturas de fila en puntos. Opcional. */
  alturas?: number[]
  /** Combina este rango, p.ej. "A1:C1". Opcional. */
  combinar?: string[]
  /** Autofiltro sobre este rango, p.ej. "A3:C9". Opcional. */
  filtro?: string
}

const clave = (fila: number, columna: number) => `${fila}:${columna}`

/** Convierte "A1:C1" en los rangos que espera SheetJS. */
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

/**
 * Genera y descarga un libro de trabajo de Microsoft Excel (.xlsx)
 * directamente en el navegador del usuario.
 *
 * Todos los campos de maquetado son opcionales a proposito: los demas
 * llamantes de este helper siguen obteniendo una hoja sin formato.
 */
export function exportarLibroExcel(nombreArchivo: string, hojas: HojaExcel[]) {
  const wb = XLSX.utils.book_new()

  for (const hoja of hojas) {
    const ws = XLSX.utils.aoa_to_sheet(hoja.filas) as XLSX.WorkSheet & {
      "!cols"?: unknown[]
      "!merges"?: unknown[]
      "!rows"?: unknown[]
      "!autofilter"?: { ref: string }
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

    if (hoja.estilos) {
      for (const [pos, estilo] of Object.entries(hoja.estilos)) {
        const [fila, columna] = pos.split(":").map(Number)
        if (Number.isNaN(fila) || Number.isNaN(columna)) continue
        const direccion = XLSX.utils.encode_cell({ r: fila, c: columna })
        // aoa_to_sheet no crea celdas vacias, asi que hay que materializar
        // las que solo llevan estilo (celdas de encabezado o de relleno).
        if (!ws[direccion]) {
          ws[direccion] = { t: "s", v: "" } as XLSX.CellObject
        }
        ws[direccion].s = estilo as never
      }
    }

    // Limitar nombre de la hoja a 31 caracteres y sanitizar caracteres prohibidos
    const nombreLimpio = hoja.nombre.replace(/[:\\/?*\[\]]/g, "").slice(0, 31) || "Hoja"
    XLSX.utils.book_append_sheet(wb, ws, nombreLimpio)
  }

  const nombreFinal = nombreArchivo.endsWith(".xlsx") ? nombreArchivo : `${nombreArchivo}.xlsx`
  XLSX.writeFile(wb, nombreFinal)
}
