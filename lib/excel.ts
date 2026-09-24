import * as XLSX from "xlsx"

export interface HojaExcel {
  nombre: string
  filas: (string | number | null | undefined)[][]
}

/**
 * Genera y descarga un libro de trabajo de Microsoft Excel (.xlsx)
 * directamente en el navegador del usuario.
 */
export function exportarLibroExcel(nombreArchivo: string, hojas: HojaExcel[]) {
  const wb = XLSX.utils.book_new()

  for (const hoja of hojas) {
    const ws = XLSX.utils.aoa_to_sheet(hoja.filas)
    // Limitar nombre de la hoja a 31 caracteres y sanitizar caracteres prohibidos
    const nombreLimpio = hoja.nombre.replace(/[:\\/?*\[\]]/g, "").slice(0, 31) || "Hoja"
    XLSX.utils.book_append_sheet(wb, ws, nombreLimpio)
  }

  const nombreFinal = nombreArchivo.endsWith(".xlsx") ? nombreArchivo : `${nombreArchivo}.xlsx`
  XLSX.writeFile(wb, nombreFinal)
}
