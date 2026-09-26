import * as XLSX from "xlsx"

export interface HojaExcel {
  nombre: string
  filas: (string | number | null | undefined)[][]
}

export function exportarLibroExcel(nombreArchivo: string, hojas: HojaExcel[]) {
  const wb = XLSX.utils.book_new()

  for (const hoja of hojas) {
    const ws = XLSX.utils.aoa_to_sheet(hoja.filas)
    
    // Mejorar la presentación usando solo la librería nativa (sin cosas locas)
    // 1. Ampliar el ancho de las columnas para que se lea todo bien
    const esKardex = hoja.nombre.toLowerCase().includes("kardex") || hoja.filas[0]?.[0]?.toString().includes("KARDEX")
    
    if (esKardex) {
      ws['!cols'] = [
        { wch: 12 },  // Fecha
        { wch: 15 },  // Comprobante
        { wch: 45 },  // Concepto (muy ancho para leer la descripción)
        { wch: 15 },  // Entradas
        { wch: 15 },  // Salidas
        { wch: 15 },  // Existencias
        { wch: 15 },  // Costo
        { wch: 18 },  // Debe
        { wch: 18 },  // Haber
        { wch: 20 },  // Saldo
      ]
      
      // 2. Darle formato de moneda y número a las celdas numéricas
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1')
      for (let R = 0; R <= range.e.r; ++R) {
        for (let C = 0; C <= range.e.c; ++C) {
          const cellRef = XLSX.utils.encode_cell({ c: C, r: R })
          const cell = ws[cellRef]
          
          if (!cell || cell.t !== 'n') continue // Solo tocar números
          
          if (C >= 3 && C <= 5) {
            // Unidades: Formato de número con separador de miles
            cell.z = '#,##0.00'
          } else if (C >= 6 && C <= 9) {
            // Valores: Formato de contabilidad
            cell.z = '"$"#,##0.00'
          }
        }
      }
    } else {
      // Ancho por defecto genérico si no es kardex
      ws['!cols'] = Array(15).fill({ wch: 20 })
    }

    const nombreLimpio = hoja.nombre.replace(/[:\\/?*\[\]]/g, "").slice(0, 31) || "Hoja"
    XLSX.utils.book_append_sheet(wb, ws, nombreLimpio)
  }

  const nombreFinal = nombreArchivo.endsWith(".xlsx") ? nombreArchivo : `${nombreArchivo}.xlsx`
  XLSX.writeFile(wb, nombreFinal)
}
