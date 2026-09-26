"use client"

import { useContabilidad } from "@/components/contabilidad-provider"
import { formatoMoneda } from "@/lib/contabilidad"

export function ReporteImpresion() {
  const {
    estadoResultados: er,
    balanceGeneral: bg,
    ejercicioSeleccionado,
  } = useContabilidad()

  // Funciones de ayuda para formateo
  const FilaEspacio = () => (
    <tr>
      <td className="py-2" colSpan={2}></td>
    </tr>
  )

  const FilaSubtitulo = ({ titulo }: { titulo: string }) => (
    <tr>
      <td colSpan={2} className="py-2 font-bold uppercase underline">
        {titulo}
      </td>
    </tr>
  )

  const FilaDetalle = ({
    concepto,
    monto,
    indent = false,
  }: {
    concepto: string
    monto: number
    indent?: boolean
  }) => (
    <tr>
      <td className={`py-1 ${indent ? "pl-6" : ""}`}>{concepto}</td>
      <td className="py-1 text-right tabular-nums">{formatoMoneda(monto)}</td>
    </tr>
  )

  const FilaTotal = ({
    concepto,
    monto,
    dobleRaya = false,
  }: {
    concepto: string
    monto: number
    dobleRaya?: boolean
  }) => (
    <tr>
      <td className="py-2 font-bold uppercase">{concepto}</td>
      <td className="py-2 text-right">
        <div
          className={`inline-block border-t border-black pt-1 tabular-nums font-bold ${
            dobleRaya ? "border-b-[3px] border-black border-double pb-1" : ""
          }`}
        >
          {formatoMoneda(monto)}
        </div>
      </td>
    </tr>
  )

  const Firmas = () => (
    <div className="mt-24 grid grid-cols-3 gap-12 text-center text-sm">
      <div>
        <div className="mx-auto mb-2 w-full border-t border-black"></div>
        <p className="font-bold">Representante Legal</p>
      </div>
      <div>
        <div className="mx-auto mb-2 w-full border-t border-black"></div>
        <p className="font-bold">Contador General</p>
      </div>
      <div>
        <div className="mx-auto mb-2 w-full border-t border-black"></div>
        <p className="font-bold">Auditor Externo</p>
      </div>
    </div>
  )

  return (
    <div className="hidden print:block w-full bg-white text-black font-serif text-sm px-8 py-8">
      {/* --------------------------- ESTADO DE RESULTADOS --------------------------- */}
      <div className="break-after-page mb-8">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold uppercase tracking-widest">Finexa</h1>
          <h2 className="text-lg font-bold uppercase">Estado de Resultados</h2>
          <p className="text-sm">
            Del 1 de Enero al 31 de Diciembre del {ejercicioSeleccionado}
          </p>
          <p className="text-sm italic">
            (Expresado en Dólares de los Estados Unidos de América)
          </p>
        </div>

        <table className="w-full max-w-4xl mx-auto border-collapse">
          <tbody>
            <FilaSubtitulo titulo="1. Ingresos Operativos" />
            <FilaDetalle concepto="Ventas Totales" monto={er.analitico.ventasTotales} />
            <FilaDetalle concepto="(-) Devoluciones sobre ventas" monto={er.analitico.devolucionesSobreVentas} indent />
            <FilaDetalle concepto="(-) Rebajas y descuentos sobre ventas" monto={er.analitico.rebajasSobreVentas} indent />
            <FilaTotal concepto="Ventas Netas" monto={er.analitico.ventasNetas} />

            <FilaEspacio />
            <FilaSubtitulo titulo="2. Costo de Ventas" />
            <FilaDetalle concepto="Inventario Inicial" monto={er.analitico.inventarioInicial} />
            <FilaDetalle concepto="(+) Compras" monto={er.analitico.compras} />
            <FilaDetalle concepto="(+) Gastos sobre compras" monto={er.analitico.gastosSobreCompras} />
            <FilaDetalle concepto="(-) Devoluciones sobre compras" monto={er.analitico.devolucionesSobreCompras} indent />
            <FilaDetalle concepto="(-) Rebajas y descuentos sobre compras" monto={er.analitico.rebajasSobreCompras} indent />
            <FilaDetalle concepto="(-) Inventario Final" monto={er.analitico.valorInventarioFinal} indent />
            <FilaTotal concepto="Costo de Ventas" monto={er.analitico.costoVentas} />

            <FilaEspacio />
            <FilaTotal concepto="Utilidad Bruta" monto={er.analitico.utilidadBruta} />

            <FilaEspacio />
            <FilaSubtitulo titulo="3. Gastos de Operación" />
            {er.gastosOperacion.map((gasto) => (
              <FilaDetalle
                key={gasto.cuenta.codigo}
                concepto={`${gasto.cuenta.codigo} - ${gasto.cuenta.nombre}`}
                monto={gasto.monto}
                indent
              />
            ))}
            <FilaTotal concepto="Total Gastos de Operación" monto={er.totalGastosOperacion} />

            <FilaEspacio />
            <FilaTotal concepto="Utilidad de Operación" monto={er.analitico.utilidadOperacion} />

            {(er.totalIngresosFinancieros > 0 || er.totalGastosFinancieros > 0 || er.analitico.otrosIngresos > 0) && (
              <>
                <FilaEspacio />
                <FilaSubtitulo titulo="4. Productos y Gastos Financieros / Otros" />
                {er.analitico.otrosIngresos > 0 && <FilaDetalle concepto="(+) Otros ingresos operativos" monto={er.analitico.otrosIngresos} />}
                {er.totalIngresosFinancieros > 0 && <FilaDetalle concepto="(+) Productos financieros" monto={er.totalIngresosFinancieros} />}
                {er.totalGastosFinancieros > 0 && <FilaDetalle concepto="(-) Gastos financieros" monto={er.totalGastosFinancieros} />}
              </>
            )}

            <FilaEspacio />
            <FilaEspacio />
            <FilaTotal
              concepto={er.utilidad >= 0 ? "Utilidad Neta del Ejercicio" : "Pérdida Neta del Ejercicio"}
              monto={er.utilidad}
              dobleRaya
            />
          </tbody>
        </table>

        <div className="mt-8 text-center text-xs italic">
          <p>Las notas adjuntas son parte integrante de los estados financieros.</p>
        </div>
        <Firmas />
      </div>

      {/* --------------------------- BALANCE GENERAL --------------------------- */}
      <div className="break-before-page">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold uppercase tracking-widest">Finexa</h1>
          <h2 className="text-lg font-bold uppercase">Balance General</h2>
          <p className="text-sm">Al 31 de Diciembre del {ejercicioSeleccionado}</p>
          <p className="text-sm italic">
            (Expresado en Dólares de los Estados Unidos de América)
          </p>
        </div>

        <table className="w-full max-w-4xl mx-auto border-collapse">
          <tbody>
            <FilaSubtitulo titulo="ACTIVO" />
            {bg.activos.map((activo) => (
              <FilaDetalle
                key={activo.cuenta.codigo}
                concepto={`${activo.cuenta.codigo} - ${activo.cuenta.nombre}`}
                monto={activo.monto}
              />
            ))}
            <FilaTotal concepto="Total Activo" monto={bg.totalActivo} dobleRaya />

            <FilaEspacio />
            <FilaSubtitulo titulo="PASIVO" />
            {bg.pasivos.map((pasivo) => (
              <FilaDetalle
                key={pasivo.cuenta.codigo}
                concepto={`${pasivo.cuenta.codigo} - ${pasivo.cuenta.nombre}`}
                monto={pasivo.monto}
              />
            ))}
            <FilaTotal concepto="Total Pasivo" monto={bg.totalPasivo} />

            <FilaEspacio />
            <FilaSubtitulo titulo="CAPITAL CONTABLE" />
            {bg.capital.map((cap) => (
              <FilaDetalle
                key={cap.cuenta.codigo}
                concepto={`${cap.cuenta.codigo} - ${cap.cuenta.nombre}`}
                monto={cap.monto}
              />
            ))}
            <FilaDetalle concepto="Resultado del Ejercicio" monto={bg.utilidadEjercicio} />
            <FilaTotal concepto="Total Capital Contable" monto={bg.totalCapitalContable} />

            <FilaEspacio />
            <FilaTotal concepto="Total Pasivo y Capital" monto={bg.totalPasivoMasCapital} dobleRaya />
          </tbody>
        </table>

        <div className="mt-8 text-center text-xs italic">
          <p>Las notas adjuntas son parte integrante de los estados financieros.</p>
        </div>
        <Firmas />
      </div>
    </div>
  )
}
