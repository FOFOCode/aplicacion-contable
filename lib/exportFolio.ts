import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { formatoMoneda } from "./contabilidad"
import {
  exportarLibroExcel,
  ESTILO_TITULO_EMPRESA,
  ESTILO_SUBTITULO,
  ESTILO_CABECERA_TABLA,
  ESTILO_FILA_SECCION,
  ESTILO_CELDA_NORMAL,
  ESTILO_CELDA_CODIGO,
  ESTILO_CELDA_MONEDA,
  ESTILO_TOTAL_DOBLE_TEXTO,
  ESTILO_TOTAL_DOBLE_MONEDA,
} from "./excel"

export interface FolioExportData {
  numero_folio: number
  fecha: string
  ejercicio: number
  estado: string
  total_debe: number
  total_haber: number
  partidas: Array<{
    numero: number
    fecha: string
    concepto: string
    documento_soporte?: string
    lineas: Array<{
      codigo: string
      debe: number
      haber: number
    }>
  }>
}

export function exportarFolioPDF(folio: FolioExportData, getNombreCuenta: (codigo: string) => string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" })

  // 1. Membrete Institucional
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text("EMPRESA COMERCIAL S.A. DE C.V.", 105, 14, { align: "center" })

  doc.setFontSize(11)
  doc.text("LIBRO DIARIO GENERAL — SISTEMA ANALÍTICO", 105, 20, { align: "center" })

  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.text(`EJERCICIO FISCAL: ${folio.ejercicio}   |   ESTADO: ${folio.estado}`, 105, 25, { align: "center" })

  // Recuadro de Folio y Fecha
  doc.setDrawColor(200, 200, 200)
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(14, 28, 187, 10, 2, 2, "FD")

  doc.setFont("helvetica", "bold")
  doc.text(`FOLIO DIARIO N°: ${String(folio.numero_folio).padStart(4, "0")}`, 18, 34)
  doc.text(`FECHA DE JORNADA: ${folio.fecha}`, 105, 34, { align: "center" })
  doc.text(`SUMAS IGUALES: ${formatoMoneda(folio.total_debe)}`, 195, 34, { align: "right" })

  // 2. Construcción de filas para jsPDF-AutoTable
  const tableRows: any[] = []

  folio.partidas.forEach((p) => {
    // Encabezado de la partida
    tableRows.push([
      {
        content: `PARTIDA #${p.numero}  —  ${p.concepto} ${p.documento_soporte ? `(Doc: ${p.documento_soporte})` : ""}`,
        colSpan: 4,
        styles: { fontStyle: "bold", fillColor: [241, 245, 249], textColor: [15, 23, 42] },
      },
    ])

    // Líneas contables
    p.lineas.forEach((l) => {
      tableRows.push([
        l.codigo,
        getNombreCuenta(l.codigo),
        l.debe > 0 ? formatoMoneda(l.debe) : "",
        l.haber > 0 ? formatoMoneda(l.haber) : "",
      ])
    })
  })

  // Fila de totales generales
  tableRows.push([
    { content: "TOTALES DEL FOLIO DIARIO:", colSpan: 2, styles: { fontStyle: "bold", halign: "right" } },
    { content: formatoMoneda(folio.total_debe), styles: { fontStyle: "bold", halign: "right" } },
    { content: formatoMoneda(folio.total_haber), styles: { fontStyle: "bold", halign: "right" } },
  ])

  autoTable(doc, {
    startY: 42,
    head: [["CÓDIGO", "CUENTA / DESCRIPCIÓN", "DEBE (USD)", "HABER (USD)"]],
    body: tableRows,
    theme: "grid",
    showHead: "everyPage",
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 25, font: "courier", fontStyle: "bold" },
      1: { cellWidth: 95 },
      2: { cellWidth: 33, halign: "right", font: "courier" },
      3: { cellWidth: 33, halign: "right", font: "courier" },
    },
    styles: { overflow: "linebreak", cellPadding: 1.5 },
    margin: { top: 20, bottom: 25, left: 14, right: 14 },
  })

  // 3. Bloque de Firmas al pie
  const lastY = (doc as any).lastAutoTable?.finalY || 42
  const pageHeight = doc.internal.pageSize.getHeight()

  let firmasY = lastY + 25
  if (firmasY + 20 > pageHeight) {
    doc.addPage()
    firmasY = 40
  }

  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.line(20, firmasY, 70, firmasY)
  doc.text("CONTADOR GENERAL", 45, firmasY + 4, { align: "center" })

  doc.line(80, firmasY, 130, firmasY)
  doc.text("AUDITOR INTERNO", 105, firmasY + 4, { align: "center" })

  doc.line(140, firmasY, 190, firmasY)
  doc.text("REPRESENTANTE LEGAL", 165, firmasY + 4, { align: "center" })

  doc.save(`Folio-Diario-${String(folio.numero_folio).padStart(3, "0")}-${folio.fecha}.pdf`)
}

export function exportarFolioCSV(folio: FolioExportData, getNombreCuenta: (codigo: string) => string) {
  const headers = ["Folio", "Fecha", "Partida", "Concepto", "Doc Soporte", "Codigo Cuenta", "Nombre Cuenta", "Debe", "Haber"]
  const rows: string[][] = []

  folio.partidas.forEach((p) => {
    p.lineas.forEach((l) => {
      rows.push([
        String(folio.numero_folio),
        folio.fecha,
        String(p.numero),
        `"${p.concepto.replace(/"/g, '""')}"`,
        `"${p.documento_soporte || ""}"`,
        l.codigo,
        `"${getNombreCuenta(l.codigo).replace(/"/g, '""')}"`,
        (l.debe || 0).toFixed(2),
        (l.haber || 0).toFixed(2),
      ])
    })
  })

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n")
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", `Folio-Diario-${folio.numero_folio}-${folio.fecha}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function exportarFolioExcel(folio: FolioExportData, getNombreCuenta: (codigo: string) => string) {
  const filas: (string | number | null | undefined)[][] = [
    ["EMPRESA COMERCIAL S.A. DE C.V. — LIBRO DIARIO GENERAL"],
    [`Folio Diario N°: ${String(folio.numero_folio).padStart(4, "0")}  |  Fecha de Jornada: ${folio.fecha}  |  Ejercicio: ${folio.ejercicio}`],
    [`Estado del Folio: ${folio.estado}  |  Expresado en Dólares Estadounidenses (USD)`],
    [],
    ["Partida #", "Fecha", "Código", "Cuenta / Descripción", "Documento", "Debe (USD)", "Haber (USD)"],
  ]

  const anchos = [12, 12, 12, 42, 16, 16, 16]
  const filaEncabezado = 4
  const estilos: Record<string, any> = {
    "0:0": ESTILO_TITULO_EMPRESA,
    "1:0": ESTILO_SUBTITULO,
    "2:0": ESTILO_SUBTITULO,
  }

  for (let c = 0; c < anchos.length; c++) {
    estilos[`${filaEncabezado}:${c}`] = ESTILO_CABECERA_TABLA
  }

  const combinar: string[] = ["A1:G1", "A2:G2", "A3:G3"]

  folio.partidas.forEach((p) => {
    const fIdx = filas.length
    filas.push([
      `PARTIDA #${p.numero}`,
      p.fecha,
      "",
      p.concepto,
      p.documento_soporte || "",
      "",
      "",
    ])

    // Estilo de cabecera de partida
    for (let c = 0; c < anchos.length; c++) {
      estilos[`${fIdx}:${c}`] = ESTILO_FILA_SECCION
    }

    p.lineas.forEach((l) => {
      const rowIdx = filas.length
      filas.push([
        "",
        "",
        l.codigo,
        getNombreCuenta(l.codigo),
        "",
        l.debe > 0 ? l.debe : "",
        l.haber > 0 ? l.haber : "",
      ])

      estilos[`${rowIdx}:0`] = ESTILO_CELDA_NORMAL
      estilos[`${rowIdx}:1`] = ESTILO_CELDA_NORMAL
      estilos[`${rowIdx}:2`] = ESTILO_CELDA_CODIGO
      estilos[`${rowIdx}:3`] = ESTILO_CELDA_NORMAL
      estilos[`${rowIdx}:4`] = ESTILO_CELDA_NORMAL
      estilos[`${rowIdx}:5`] = ESTILO_CELDA_MONEDA
      estilos[`${rowIdx}:6`] = ESTILO_CELDA_MONEDA
    })
  })

  // Fila de Totales
  const fTotal = filas.length
  filas.push([
    "TOTALES DEL FOLIO DIARIO",
    "",
    "",
    "",
    "",
    folio.total_debe,
    folio.total_haber,
  ])

  for (let c = 0; c < anchos.length; c++) {
    if (c === 5 || c === 6) {
      estilos[`${fTotal}:${c}`] = ESTILO_TOTAL_DOBLE_MONEDA
    } else {
      estilos[`${fTotal}:${c}`] = ESTILO_TOTAL_DOBLE_TEXTO
    }
  }

  const alturas = filas.map((_, i) => {
    if (i === 0) return 24
    if (i < filaEncabezado) return 15
    if (i === filaEncabezado) return 26
    if (i === fTotal) return 22
    return 18
  })

  exportarLibroExcel(`Folio_Diario_${String(folio.numero_folio).padStart(3, "0")}_${folio.fecha}`, [
    {
      nombre: `Folio ${folio.numero_folio}`,
      filas,
      anchos,
      alturas,
      combinar,
      estilos,
      orientacion: "landscape",
      fitToWidth: 1,
      fitToHeight: 0,
    },
  ])
}

