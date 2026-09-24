"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileDown,
  FileSpreadsheet,
  Filter,
  ListTree,
  Search,
  TableProperties,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { useContabilidad } from "@/components/contabilidad-provider";
import { consolidarMayor, formatoMoneda, redondear } from "@/lib/contabilidad";
import { CUENTAS_MAYOR } from "@/lib/catalogo";
import { exportarLibroExcel } from "@/lib/excel";
import { ETIQUETA_TIPO, type TipoCuenta } from "@/lib/types";

const CATEGORIAS: { valor: string; label: string }[] = [
  { valor: "todas", label: "Todas las cuentas" },
  { valor: "activo", label: "1. Activos" },
  { valor: "pasivo", label: "2. Pasivos" },
  { valor: "capital", label: "3. Capital Contable" },
  { valor: "gasto", label: "4. Costos y Gastos" },
  { valor: "ingreso", label: "5. Ingresos" },
];

export default function LibroMayorPage() {
  const { mayor, asientos, ejercicioSeleccionado } = useContabilidad();
  const [vista, setVista] = useState<"cuentasT" | "comprobacion">("cuentasT");
  const [modoMayor, setModoMayor] = useState<"detallado" | "consolidado">(
    "detallado",
  );
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("todas");

  // Asientos del ejercicio actual ordenados cronológicamente
  const asientosEjercicio = useMemo(() => {
    return asientos
      .filter((a) => {
        if (a.estado === "ANULADO") return false;
        if (a.tipo === "CIERRE") return false;
        const ej =
          a.ejercicio ||
          (a.fecha ? new Date(a.fecha).getFullYear() : undefined);
        return ej === undefined || ej === ejercicioSeleccionado;
      })
      .sort(
        (a, b) =>
          (a.fecha || "").localeCompare(b.fecha || "") || a.numero - b.numero,
      );
  }, [asientos, ejercicioSeleccionado]);

  // Desglose de partidas por cuenta para las Cuentas T reales
  const movimientosPorCuenta = useMemo(() => {
    const mapa = new Map<
      string,
      {
        debe: {
          fecha: string;
          numero: number;
          concepto: string;
          monto: number;
        }[];
        haber: {
          fecha: string;
          numero: number;
          concepto: string;
          monto: number;
        }[];
      }
    >();

    for (const a of asientosEjercicio) {
      for (const l of a.lineas) {
        if (!mapa.has(l.codigo)) {
          mapa.set(l.codigo, { debe: [], haber: [] });
        }
        const obj = mapa.get(l.codigo)!;
        const concepto = a.concepto?.trim() || "Concepto no informado";
        if (Number(l.debe) > 0) {
          obj.debe.push({
            fecha: a.fecha,
            numero: a.numero,
            concepto,
            monto: Number(l.debe),
          });
        }
        if (Number(l.haber) > 0) {
          obj.haber.push({
            fecha: a.fecha,
            numero: a.numero,
            concepto,
            monto: Number(l.haber),
          });
        }
      }
    }
    return mapa;
  }, [asientosEjercicio]);

  const mayorConsolidado = useMemo(
    () => consolidarMayor(mayor, CUENTAS_MAYOR),
    [mayor],
  );
  const mayorVisible = modoMayor === "consolidado" ? mayorConsolidado : mayor;
  const mayorParaVista = vista === "comprobacion" ? mayor : mayorVisible;

  const cuentasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return mayorParaVista.filter((m) => {
      if (categoria !== "todas" && m.cuenta.tipo !== categoria) return false;
      if (!q) return true;
      return (
        m.cuenta.codigo.toLowerCase().includes(q) ||
        m.cuenta.nombre.toLowerCase().includes(q) ||
        (m.cuentasHijas || []).some((codigo) =>
          codigo.toLowerCase().includes(q),
        )
      );
    });
  }, [mayorParaVista, busqueda, categoria]);

  const totalDebe = redondear(mayorParaVista.reduce((s, m) => s + m.debe, 0));
  const totalHaber = redondear(mayorParaVista.reduce((s, m) => s + m.haber, 0));
  const totalDeudor = redondear(
    mayorParaVista
      .filter((m) => m.naturalezaSaldo === "deudora")
      .reduce((s, m) => s + Math.abs(m.saldo), 0),
  );
  const totalAcreedor = redondear(
    mayorParaVista
      .filter((m) => m.naturalezaSaldo === "acreedora")
      .reduce((s, m) => s + Math.abs(m.saldo), 0),
  );

  function movimientosDeCuenta(codigo: string, hijos?: string[]) {
    const codigos = hijos && hijos.length > 0 ? hijos : [codigo];
    return codigos.reduce(
      (acumulado, hijo) => {
        const movimientos = movimientosPorCuenta.get(hijo);
        if (!movimientos) return acumulado;
        acumulado.debe.push(...movimientos.debe);
        acumulado.haber.push(...movimientos.haber);
        return acumulado;
      },
      {
        debe: [] as {
          fecha: string;
          numero: number;
          concepto: string;
          monto: number;
        }[],
        haber: [] as {
          fecha: string;
          numero: number;
          concepto: string;
          monto: number;
        }[],
      },
    );
  }

  function exportarExcel() {
    const filasMayor: (string | number | null | undefined)[][] = [
      ["SISTEMA CONTABLE AUTOMATIZADO - LIBRO MAYOR"],
      [`Ejercicio fiscal: ${ejercicioSeleccionado}`],
      [`Fecha de emisión: ${new Date().toLocaleDateString("es-SV")}`],
      [],
      [
        "Código",
        "Nombre de la Cuenta",
        "Tipo",
        "Naturaleza",
        "Total Debe",
        "Total Haber",
        "Saldo Neto",
        "Condición",
      ],
    ];

    for (const m of mayorVisible) {
      filasMayor.push([
        m.cuenta.codigo,
        m.cuenta.nombre,
        m.cuenta.tipo,
        m.cuenta.naturaleza,
        m.debe,
        m.haber,
        Math.abs(m.saldo),
        m.naturalezaSaldo || "Saldada",
      ]);
    }
    filasMayor.push([]);
    filasMayor.push(["TOTALES", "", "", "", totalDebe, totalHaber, "", ""]);

    const filasDetalle: (string | number | null | undefined)[][] = [
      ["DETALLE DE CUENTAS T"],
      [`Ejercicio fiscal: ${ejercicioSeleccionado}`],
      [`Fecha de emisión: ${new Date().toLocaleDateString("es-SV")}`],
      [],
      [
        "Código",
        "Cuenta",
        "Folio",
        "Fecha",
        "Concepto",
        "Debe",
        "Haber",
        "Saldo final",
        "Condición",
      ],
    ];

    for (const m of mayorVisible) {
      const movimientos = movimientosDeCuenta(m.cuenta.codigo, m.cuentasHijas);
      for (const movimiento of movimientos?.debe || []) {
        filasDetalle.push([
          m.cuenta.codigo,
          m.cuenta.nombre,
          movimiento.numero,
          movimiento.fecha,
          movimiento.concepto,
          movimiento.monto,
          0,
          "",
          "",
        ]);
      }
      for (const movimiento of movimientos?.haber || []) {
        filasDetalle.push([
          m.cuenta.codigo,
          m.cuenta.nombre,
          movimiento.numero,
          movimiento.fecha,
          movimiento.concepto,
          0,
          movimiento.monto,
          "",
          "",
        ]);
      }
      filasDetalle.push([
        m.cuenta.codigo,
        m.cuenta.nombre,
        "",
        "",
        "Saldo final",
        "",
        "",
        m.saldo,
        m.naturalezaSaldo || "Saldada",
      ]);
    }

    const filasComprobacion: (string | number | null | undefined)[][] = [
      ["BALANCE DE COMPROBACIÓN"],
      [`Ejercicio fiscal: ${ejercicioSeleccionado}`],
      [`Fecha de emisión: ${new Date().toLocaleDateString("es-SV")}`],
      [],
      [
        "Código",
        "Nombre de la Cuenta",
        "Movimiento Debe",
        "Movimiento Haber",
        "Saldo Deudor",
        "Saldo Acreedor",
      ],
    ];

    for (const m of mayor) {
      const deudor = m.naturalezaSaldo === "deudora" ? Math.abs(m.saldo) : 0;
      const acreedor =
        m.naturalezaSaldo === "acreedora" ? Math.abs(m.saldo) : 0;
      filasComprobacion.push([
        m.cuenta.codigo,
        m.cuenta.nombre,
        m.debe,
        m.haber,
        deudor,
        acreedor,
      ]);
    }
    filasComprobacion.push([]);
    filasComprobacion.push([
      "SUMAS IGUALES",
      "",
      totalDebe,
      totalHaber,
      totalDeudor,
      totalAcreedor,
    ]);

    exportarLibroExcel(`Libro_Mayor_Ejercicio_${ejercicioSeleccionado}`, [
      { nombre: "Libro Mayor", filas: filasMayor },
      { nombre: "Detalle Cuentas T", filas: filasDetalle },
      { nombre: "Balance de Comprobación", filas: filasComprobacion },
    ]);
  }

  function exportarPdf() {
    const previousTitle = document.title;
    document.title = `Libro_Mayor_${vista === "comprobacion" ? "Balance_Comprobacion" : "CuentasT"}_${ejercicioSeleccionado}`;
    window.print();
    window.setTimeout(() => {
      document.title = previousTitle;
    }, 500);
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Mayorización Central
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <Badge variant="default" className="text-xs font-mono">
                Ciclo Fiscal {ejercicioSeleccionado}
              </Badge>
              <Badge variant="success" className="text-[10px]">
                Mayorización automática
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl mt-0.5">
              Libro Mayor y Balanza
            </h1>
            <p className="max-w-2xl text-xs sm:text-sm text-muted-foreground">
              Consolidación automática en tiempo real de débitos y créditos en
              Cuentas T y Balance de Comprobación.
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportarPdf}
              className="h-8 gap-1.5 text-xs shadow-xs"
            >
              <FileDown className="size-3.5" />
              Imprimir
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportarExcel}
              className="h-8 gap-1.5 text-xs border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/20 shadow-xs"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-600" />
              Exportar Excel
            </Button>
          </div>
        </div>
      </header>

      {/* BARRA DE HERRAMIENTAS: BÚSQUEDA, FILTRO Y ALTERNADOR DE VISTAS */}
      <Card className="print:hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Alternador de Vistas */}
            <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40">
              <button
                type="button"
                onClick={() => setModoMayor("detallado")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  modoMayor === "detallado"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Detallado
              </button>
              <button
                type="button"
                onClick={() => setModoMayor("consolidado")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  modoMayor === "consolidado"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Consolidado
              </button>
            </div>
            <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40">
              <button
                type="button"
                onClick={() => setVista("cuentasT")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  vista === "cuentasT"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BookOpen className="size-3.5" />
                Cuentas T (Detallado)
              </button>
              <button
                type="button"
                onClick={() => setVista("comprobacion")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  vista === "comprobacion"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <TableProperties className="size-3.5" />
                Balance de Comprobación
              </button>
            </div>

            {/* Contador de cuentas filtradas */}
            <Badge variant="muted" className="text-xs">
              {cuentasFiltradas.length} de {mayorVisible.length} cuentas con
              saldo
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar cuenta por código o nombre..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9 h-10 text-sm"
              />
            </div>

            <div className="relative">
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {CATEGORIAS.map((cat) => (
                  <option key={cat.valor} value={cat.valor}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {mayor.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            <ListTree className="mx-auto size-10 text-muted-foreground/40 mb-3" />
            <p className="font-semibold text-foreground">
              No hay movimientos en este ejercicio
            </p>
            <p className="text-xs mt-1">
              Registra asientos en el Libro Diario para generar la mayorización
              automática.
            </p>
          </CardContent>
        </Card>
      ) : vista === "cuentasT" ? (
        /* VISTA: CUENTAS T REALES Y DETALLADAS */
        <section className="grid gap-4 sm:grid-cols-2">
          {cuentasFiltradas.map((m) => {
            const movs = movimientosDeCuenta(m.cuenta.codigo, m.cuentasHijas);
            // Detección de anomalías contables
            const esActivo = m.cuenta.tipo === "activo";
            const sobregirada = esActivo && m.naturalezaSaldo === "acreedora";
            const saldoCero = m.naturalezaSaldo === null;

            return (
              <Card
                key={m.cuenta.codigo}
                className={
                  sobregirada ? "border-red-500/40 bg-red-500/[0.02]" : ""
                }
              >
                <CardHeader className="pb-3 border-b border-border/60">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="font-mono text-primary font-bold">
                          {m.cuenta.codigo}
                        </span>
                        <span>{m.cuenta.nombre}</span>
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {ETIQUETA_TIPO[m.cuenta.tipo]} · Naturaleza{" "}
                        {m.cuenta.naturaleza}
                      </CardDescription>
                      {m.cuentasHijas && m.cuentasHijas.length > 0 && (
                        <CardDescription className="mt-1 text-[11px]">
                          Cuenta mayor consolidada · Subcuentas:{" "}
                          {m.cuentasHijas.join(" | ")}
                        </CardDescription>
                      )}
                    </div>

                    <Link
                      href={`/kardex?codigo=${m.cuenta.codigo}`}
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded"
                      title="Abrir extracto auxiliar de esta cuenta"
                    >
                      Auxiliar <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-3">
                  {/* Estructura formal de Cuenta T */}
                  <div className="grid grid-cols-2 rounded-lg border border-border overflow-hidden text-xs">
                    {/* Columna DEBE */}
                    <div className="border-r border-border flex flex-col justify-between">
                      <div>
                        <div className="bg-muted/60 p-2 text-center font-bold text-muted-foreground uppercase border-b border-border text-[11px]">
                          Debe (Cargos)
                        </div>
                        <div className="p-2 space-y-1 max-h-36 overflow-y-auto divide-y divide-border/40">
                          {movs.debe.length === 0 ? (
                            <p className="text-center text-muted-foreground/40 py-2">
                              -
                            </p>
                          ) : (
                            movs.debe.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-start justify-between gap-2 pt-1"
                              >
                                <div className="min-w-0">
                                  <span className="block font-mono text-[10px] text-muted-foreground">
                                    #{item.numero} ({item.fecha.slice(5)})
                                  </span>
                                  <span
                                    className="mt-0.5 block truncate text-[10px] text-foreground"
                                    title={item.concepto}
                                  >
                                    {item.concepto}
                                  </span>
                                </div>
                                <span className="shrink-0 font-mono font-medium text-foreground">
                                  {formatoMoneda(item.monto)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="bg-muted/30 p-2 border-t border-border flex justify-between font-mono font-bold">
                        <span className="text-muted-foreground text-[10px]">
                          Suma:
                        </span>
                        <span>{formatoMoneda(m.debe)}</span>
                      </div>
                    </div>

                    {/* Columna HABER */}
                    <div className="flex flex-col justify-between">
                      <div>
                        <div className="bg-muted/60 p-2 text-center font-bold text-muted-foreground uppercase border-b border-border text-[11px]">
                          Haber (Abonos)
                        </div>
                        <div className="p-2 space-y-1 max-h-36 overflow-y-auto divide-y divide-border/40">
                          {movs.haber.length === 0 ? (
                            <p className="text-center text-muted-foreground/40 py-2">
                              -
                            </p>
                          ) : (
                            movs.haber.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-start justify-between gap-2 pt-1"
                              >
                                <div className="min-w-0">
                                  <span className="block font-mono text-[10px] text-muted-foreground">
                                    #{item.numero} ({item.fecha.slice(5)})
                                  </span>
                                  <span
                                    className="mt-0.5 block truncate text-[10px] text-foreground"
                                    title={item.concepto}
                                  >
                                    {item.concepto}
                                  </span>
                                </div>
                                <span className="shrink-0 font-mono font-medium text-foreground">
                                  {formatoMoneda(item.monto)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="bg-muted/30 p-2 border-t border-border flex justify-between font-mono font-bold">
                        <span className="text-muted-foreground text-[10px]">
                          Suma:
                        </span>
                        <span>{formatoMoneda(m.haber)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Saldo Final y Estado */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-muted-foreground font-medium">
                      Saldo Neto:
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-foreground">
                        {formatoMoneda(Math.abs(m.saldo))}
                      </span>

                      {sobregirada ? (
                        <Badge
                          variant="warning"
                          className="text-[10px] flex items-center gap-1 font-bold"
                        >
                          <AlertTriangle className="size-3" />
                          ¡Sobregiro! (Acreedor)
                        </Badge>
                      ) : saldoCero ? (
                        <Badge
                          variant="muted"
                          className="text-[10px] flex items-center gap-1"
                        >
                          <CheckCircle2 className="size-3 text-emerald-600" />
                          Saldada
                        </Badge>
                      ) : m.naturalezaSaldo === "deudora" ? (
                        <Badge variant="deudora" className="text-[10px]">
                          Saldo Deudor
                        </Badge>
                      ) : (
                        <Badge
                          variant="default"
                          className="text-[10px] bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                        >
                          Saldo Acreedor
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      ) : (
        /* VISTA: BALANCE DE COMPROBACIÓN FORMAL */
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Balance de Comprobación de Sumas y Saldos
            </CardTitle>
            <CardDescription>
              Comprobación estricta de igualdad matemática entre movimientos y
              saldos deudores y acreedores.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b border-border">
                    <th rowSpan={2} className="py-2.5 px-3 text-left">
                      Código
                    </th>
                    <th rowSpan={2} className="py-2.5 px-3 text-left">
                      Nombre de la Cuenta
                    </th>
                    <th
                      colSpan={2}
                      className="py-1 px-3 text-center border-b border-border"
                    >
                      Movimientos
                    </th>
                    <th
                      colSpan={2}
                      className="py-1 px-3 text-center border-b border-border"
                    >
                      Saldos
                    </th>
                  </tr>
                  <tr className="border-b border-border text-[11px]">
                    <th className="py-1.5 px-3 text-right">Debe</th>
                    <th className="py-1.5 px-3 text-right">Haber</th>
                    <th className="py-1.5 px-3 text-right">Deudor</th>
                    <th className="py-1.5 px-3 text-right">Acreedor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {cuentasFiltradas.map((m) => {
                    const deudor =
                      m.naturalezaSaldo === "deudora" ? Math.abs(m.saldo) : 0;
                    const acreedor =
                      m.naturalezaSaldo === "acreedora" ? Math.abs(m.saldo) : 0;
                    return (
                      <tr
                        key={m.cuenta.codigo}
                        className="hover:bg-muted/30 transition-colors group"
                      >
                        <td className="py-2.5 px-3 font-mono font-medium text-xs">
                          <Link
                            href={`/kardex?codigo=${m.cuenta.codigo}`}
                            className="text-primary hover:underline font-bold inline-flex items-center gap-1"
                            title="Abrir extracto en Libro Auxiliar"
                          >
                            <span>{m.cuenta.codigo}</span>
                            <ArrowRight className="size-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                        </td>
                        <td className="py-2.5 px-3 text-foreground">
                          <Link
                            href={`/kardex?codigo=${m.cuenta.codigo}`}
                            className="hover:underline"
                            title="Abrir extracto en Libro Auxiliar"
                          >
                            {m.cuenta.nombre}
                          </Link>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {m.debe > 0 ? formatoMoneda(m.debe) : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {m.haber > 0 ? formatoMoneda(m.haber) : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-foreground">
                          {deudor > 0 ? formatoMoneda(deudor) : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-foreground">
                          {acreedor > 0 ? formatoMoneda(acreedor) : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/40 font-bold border-b-4 border-double border-foreground/30">
                  <tr>
                    <td
                      colSpan={2}
                      className="py-3 px-3 uppercase text-xs tracking-wider text-muted-foreground"
                    >
                      Sumas Iguales
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {formatoMoneda(totalDebe)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {formatoMoneda(totalHaber)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-foreground">
                      {formatoMoneda(totalDeudor)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-foreground">
                      {formatoMoneda(totalAcreedor)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* BANDA DE VERIFICACIÓN DE CUADRE DE BALANZA */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/20 border-t border-border text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span>
                    <strong>Verificación de Partida Doble:</strong> Débitos (
                    {formatoMoneda(totalDebe)}) = Créditos (
                    {formatoMoneda(totalHaber)}) · Saldos Deudores (
                    {formatoMoneda(totalDeudor)}) = Saldos Acreedores (
                    {formatoMoneda(totalAcreedor)})
                  </span>
                </div>
                <Badge
                  variant={
                    totalDebe === totalHaber && totalDeudor === totalAcreedor
                      ? "success"
                      : "warning"
                  }
                  className="font-mono text-[10px]"
                >
                  {totalDebe === totalHaber && totalDeudor === totalAcreedor
                    ? "Balanza Cuadrada al Centavo ✓"
                    : "Diferencia detectada"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PIE DE FIRMAS DE AUDITORÍA (IMPRESIÓN OFICIAL) */}
      <footer className="hidden border-t border-border pt-8 text-center text-xs text-muted-foreground print:block">
        <p className="font-semibold text-foreground">
          Libro Mayor y Balance de Comprobación emitido oficialmente por el
          Sistema Contable.
        </p>
        <p className="mt-1">
          Certificación de sumas y saldos mayorizados correspondientes al Ciclo
          Fiscal {ejercicioSeleccionado}.
        </p>
        <div className="mt-14 grid grid-cols-3 gap-10">
          <div className="border-t border-foreground/50 pt-2 font-medium">
            Elaboró (Auxiliar Contable)
          </div>
          <div className="border-t border-foreground/50 pt-2 font-medium">
            Revisó (Contador General - JVPCPA)
          </div>
          <div className="border-t border-foreground/50 pt-2 font-medium">
            Autorizó (Representante Legal / Auditor)
          </div>
        </div>
      </footer>
    </div>
  );
}
