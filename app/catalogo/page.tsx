"use client"

import { useMemo, useState } from "react"
import {
  AlertCircle,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  EyeOff,
  Filter,
  Info,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input, Label, Select } from "@/components/ui/field"
import { useContabilidad } from "@/components/contabilidad-provider"
import { RUBROS_CONTABLES, sugerirSiguienteCodigo } from "@/lib/catalogo"
import { ETIQUETA_TIPO, grupoPorDigito, type Cuenta, type Naturaleza, type TipoCuenta } from "@/lib/types"

const NATURALEZA_DEFAULT: Record<TipoCuenta, Naturaleza> = {
  activo: "deudora",
  pasivo: "acreedora",
  capital: "acreedora",
  gasto: "deudora",
  ingreso: "acreedora",
}

const ORDEN_GRUPOS: TipoCuenta[] = ["activo", "pasivo", "capital", "gasto", "ingreso"]

/**
 * Normaliza cadenas para búsqueda insensible a mayúsculas, minúsculas y tildes/acentos.
 */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

export default function CatalogoPage() {
  const {
    cuentas,
    asientos,
    agregarCuenta,
    renombrarCuenta,
    eliminarCuenta,
    reactivarCuenta,
    reiniciarEjemplo,
  } = useContabilidad()

  // Estados de Filtros y Búsqueda
  const [busqueda, setBusqueda] = useState("")
  const [grupoFiltro, setGrupoFiltro] = useState<"todos" | TipoCuenta>("todos")
  const [filtroEstado, setFiltroEstado] = useState<"todas" | "activas" | "inactivas">("todas")
  const [bannerAbierto, setBannerAbierto] = useState(false)

  // Modales
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false)
  const [cuentaEditando, setCuentaEditando] = useState<Cuenta | null>(null)
  const [cuentaDesactivando, setCuentaDesactivando] = useState<Cuenta | null>(null)

  // Formulario Nueva Cuenta
  const [nuevoRubro, setNuevoRubro] = useState("11")
  const [nuevoCodigo, setNuevoCodigo] = useState("")
  const [nuevoNombre, setNuevoNombre] = useState("")
  const [nuevaNaturaleza, setNuevaNaturaleza] = useState<Naturaleza>("deudora")
  const [nuevoPermiteMovimiento, setNuevoPermiteMovimiento] = useState(true)
  const [formError, setFormError] = useState("")

  // Formulario Edición
  const [editNombre, setEditNombre] = useState("")
  const [editNaturaleza, setEditNaturaleza] = useState<Naturaleza>("deudora")
  const [editError, setEditError] = useState("")

  // Notificación rápida tipo toast
  const [toastMensaje, setToastMensaje] = useState<string | null>(null)

  const mostrarToast = (msg: string) => {
    setToastMensaje(msg)
    setTimeout(() => setToastMensaje(null), 3500)
  }

  // Mapa de uso: cuántas líneas de asientos tienen cada cuenta
  const conteoMovimientos = useMemo(() => {
    const mapa: Record<string, number> = {}
    for (const a of asientos) {
      if (a.estado === "ANULADO") continue
      for (const l of a.lineas) {
        mapa[l.codigo] = (mapa[l.codigo] || 0) + 1
      }
    }
    return mapa
  }, [asientos])

  // Estadísticas del Catálogo
  const estadisticas = useMemo(() => {
    const total = cuentas.length
    const activas = cuentas.filter((c) => c.activa).length
    const inactivas = total - activas
    const enUso = cuentas.filter((c) => (conteoMovimientos[c.codigo] || 0) > 0).length

    const porGrupo: Record<TipoCuenta, { total: number; activas: number; enUso: number }> = {
      activo: { total: 0, activas: 0, enUso: 0 },
      pasivo: { total: 0, activas: 0, enUso: 0 },
      capital: { total: 0, activas: 0, enUso: 0 },
      gasto: { total: 0, activas: 0, enUso: 0 },
      ingreso: { total: 0, activas: 0, enUso: 0 },
    }

    for (const c of cuentas) {
      if (porGrupo[c.tipo]) {
        porGrupo[c.tipo].total++
        if (c.activa) porGrupo[c.tipo].activas++
        if ((conteoMovimientos[c.codigo] || 0) > 0) porGrupo[c.tipo].enUso++
      }
    }

    return { total, activas, inactivas, enUso, porGrupo }
  }, [cuentas, conteoMovimientos])

  // Filtrado reactivo de cuentas (con búsqueda por palabras y sin distinción de tildes)
  const cuentasFiltradas = useMemo(() => {
    const q = normalizar(busqueda)
    const terminos = q.split(/\s+/).filter(Boolean)

    return cuentas.filter((c) => {
      // Filtro de búsqueda (código y nombre)
      if (terminos.length > 0) {
        const codNorm = normalizar(c.codigo)
        const nomNorm = normalizar(c.nombre)
        const coincide = terminos.every((term) => codNorm.includes(term) || nomNorm.includes(term))
        if (!coincide) return false
      }
      // Filtro de grupo contable
      if (grupoFiltro !== "todos" && c.tipo !== grupoFiltro) {
        return false
      }
      // Filtro de estado
      if (filtroEstado === "activas" && !c.activa) return false
      if (filtroEstado === "inactivas" && c.activa) return false

      return true
    })
  }, [cuentas, busqueda, grupoFiltro, filtroEstado])

  // Agrupación jerárquica: Grupos -> Rubros
  const estructuraJerarquica = useMemo(() => {
    return ORDEN_GRUPOS.map((tipo) => {
      const cuentasDelTipo = cuentasFiltradas.filter((c) => c.tipo === tipo)
      const rubrosDelTipo = RUBROS_CONTABLES.filter((r) => r.grupo === tipo)

      const rubrosConCuentas = rubrosDelTipo.map((rubro) => {
        const cuentasDelRubro = cuentasDelTipo
          .filter((c) => c.codigo.startsWith(rubro.codigo))
          .sort((a, b) => a.codigo.localeCompare(b.codigo))
        return {
          ...rubro,
          cuentas: cuentasDelRubro,
        }
      })

      // Cuentas huérfanas que no coincidan exactamente con un rubro predeterminado
      const codigosRubros = rubrosDelTipo.map((r) => r.codigo)
      const cuentasOtras = cuentasDelTipo
        .filter((c) => !codigosRubros.some((r) => c.codigo.startsWith(r)))
        .sort((a, b) => a.codigo.localeCompare(b.codigo))

      return {
        tipo,
        nombreGrupo: ETIQUETA_TIPO[tipo],
        digito: tipo === "activo" ? "1" : tipo === "pasivo" ? "2" : tipo === "capital" ? "3" : tipo === "gasto" ? "4" : "5",
        totalCuentas: cuentasDelTipo.length,
        rubros: rubrosConCuentas.filter((r) => r.cuentas.length > 0 || (grupoFiltro === tipo && !busqueda)),
        cuentasOtras,
      }
    }).filter((g) => g.totalCuentas > 0 || (grupoFiltro === g.tipo && !busqueda))
  }, [cuentasFiltradas, grupoFiltro, busqueda])

  // Apertura de modal de nueva cuenta con auto-cálculo de código
  const abrirModalNuevaCuenta = (rubroInicial = "11") => {
    setNuevoRubro(rubroInicial)
    const sug = sugerirSiguienteCodigo(rubroInicial, cuentas)
    setNuevoCodigo(sug)
    setNuevoNombre("")
    const g = RUBROS_CONTABLES.find((r) => r.codigo === rubroInicial)?.grupo || "activo"
    setNuevaNaturaleza(NATURALEZA_DEFAULT[g])
    setNuevoPermiteMovimiento(true)
    setFormError("")
    setModalNuevoAbierto(true)
  }

  // Cambio de rubro dentro del modal de nueva cuenta
  const manejarCambioRubro = (rubroCod: string) => {
    setNuevoRubro(rubroCod)
    const sug = sugerirSiguienteCodigo(rubroCod, cuentas)
    setNuevoCodigo(sug)
    const g = RUBROS_CONTABLES.find((r) => r.codigo === rubroCod)?.grupo || "activo"
    setNuevaNaturaleza(NATURALEZA_DEFAULT[g])
  }

  // Guardar nueva cuenta
  const guardarNuevaCuenta = async () => {
    setFormError("")
    const cod = nuevoCodigo.trim()
    const nom = nuevoNombre.trim()

    if (!/^\d{3,}$/.test(cod)) {
      setFormError("El código debe contener al menos 3 dígitos numéricos.")
      return
    }
    const t = grupoPorDigito(cod)
    if (!t) {
      setFormError("El primer dígito debe ser 1 (Activo), 2 (Pasivo), 3 (Capital), 4 (Gastos) o 5 (Ingresos).")
      return
    }
    if (!nom) {
      setFormError("El nombre oficial de la cuenta es obligatorio.")
      return
    }
    if (cuentas.some((c) => c.codigo === cod)) {
      setFormError(`El código ${cod} ya está registrado en el catálogo.`)
      return
    }

    await agregarCuenta({
      codigo: cod,
      nombre: nom,
      tipo: t,
      naturaleza: nuevaNaturaleza,
      permite_movimiento: nuevoPermiteMovimiento,
      activa: true,
    })

    setModalNuevoAbierto(false)
    mostrarToast(`Cuenta ${cod} — ${nom} agregada exitosamente.`)
  }

  // Guardar edición
  const guardarEdicion = async () => {
    if (!cuentaEditando) return
    const nom = editNombre.trim()
    if (!nom) {
      setEditError("El nombre de la cuenta no puede estar vacío.")
      return
    }
    await renombrarCuenta(cuentaEditando.codigo, nom)
    setCuentaEditando(null)
    mostrarToast(`Cuenta ${cuentaEditando.codigo} actualizada correctamente.`)
  }

  // Ejecutar Desactivación o Eliminación
  const confirmarDesactivacion = async () => {
    if (!cuentaDesactivando) return
    const cod = cuentaDesactivando.codigo
    const movs = conteoMovimientos[cod] || 0

    eliminarCuenta(cod)
    setCuentaDesactivando(null)
    if (movs > 0) {
      mostrarToast(`Cuenta ${cod} desactivada. Se conserva en libros históricos.`)
    } else {
      mostrarToast(`Cuenta ${cod} eliminada del catálogo.`)
    }
  }

  const renderFilaCuenta = (c: Cuenta) => {
    const movs = conteoMovimientos[c.codigo] || 0
    const esSubcuenta = c.codigo.length > 4

    return (
      <div
        key={c.codigo}
        className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2 transition-colors hover:bg-muted/25 ${
          !c.activa ? "bg-muted/15 opacity-75" : ""
        }`}
      >
        {/* Código, Nombre y Badges Especiales */}
        <div className="flex items-start sm:items-center gap-3">
          <span
            className={`font-mono font-semibold text-sm ${
              esSubcuenta ? "pl-5 text-muted-foreground" : "text-primary"
            }`}
          >
            {c.codigo}
          </span>

          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`text-sm ${c.activa ? "font-medium text-foreground" : "line-through text-muted-foreground"}`}>
                {c.nombre}
              </span>

              {/* Indicadores contables analíticos y correctores */}
              {c.codigo === "1104" && (
                <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/30">
                  Inventario Inicial
                </span>
              )}
              {(c.codigo === "5102" || c.codigo === "5103") && (
                <span className="inline-flex items-center text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/30">
                  Correctora Compras (Acreedora)
                </span>
              )}
              {(c.codigo === "4103" || c.codigo === "4104") && (
                <span className="inline-flex items-center text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/30">
                  Correctora Ventas (Deudora)
                </span>
              )}
              {c.codigo === "1206" && (
                <span className="inline-flex items-center text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/30">
                  Contra-Activo (Acreedora)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground sm:hidden">
              <span>Naturaleza {c.naturaleza}</span>
              <span>·</span>
              <span>{movs} movimientos</span>
            </div>
          </div>
        </div>

        {/* Badges de Auditoría y Acciones */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-1 sm:pt-0 border-t border-border/40 sm:border-0">
          <div className="flex items-center gap-1.5">
            {/* Naturaleza */}
            <Badge
              variant={c.naturaleza === "deudora" ? "deudora" : "acreedora"}
              className="text-[11px] font-mono capitalize px-2 py-0"
            >
              {c.naturaleza}
            </Badge>

            {/* Partidas en uso */}
            <span
              title={`${movs} asientos contables registrados con esta cuenta`}
              className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded ${
                movs > 0 ? "bg-muted text-foreground font-medium" : "text-muted-foreground bg-muted/40"
              }`}
            >
              {movs > 0 ? `${movs} part.` : "Sin uso"}
            </span>

            {/* Estado */}
            {!c.activa && (
              <Badge variant="muted" className="text-[10px] bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                Inactiva
              </Badge>
            )}
          </div>

          {/* Botonera */}
          <div className="flex items-center gap-1">
            {/* Modificar nombre */}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Editar ${c.nombre}`}
              title="Modificar nombre de la cuenta"
              onClick={() => {
                setCuentaEditando(c)
                setEditNombre(c.nombre)
                setEditNaturaleza(c.naturaleza)
                setEditError("")
              }}
            >
              <Pencil className="size-3.5" />
            </Button>

            {/* Desactivar o Reactivar */}
            {c.activa ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Desactivar o eliminar ${c.nombre}`}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title={movs > 0 ? "Desactivar cuenta (conservando historial en libros)" : "Eliminar cuenta del catálogo"}
                onClick={() => setCuentaDesactivando(c)}
              >
                {movs > 0 ? <EyeOff className="size-3.5" /> : <Trash2 className="size-3.5" />}
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Reactivar ${c.nombre}`}
                className="text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                title="Reactivar cuenta en el catálogo"
                onClick={() => {
                  reactivarCuenta(c.codigo)
                  mostrarToast(`Cuenta ${c.codigo} reactivada para nuevos asientos.`)
                }}
              >
                <RotateCcw className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Toast no intrusivo */}
      {toastMensaje && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg border border-primary/20 bg-background/95 px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="size-4 text-primary" />
          <span>{toastMensaje}</span>
        </div>
      )}

      {/* CABECERA Y CONTEXTO OPERATIVO */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Contabilidad General</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">Plan de Cuentas Institucional</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl text-foreground mt-0.5">Catálogo de Cuentas</h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl mt-1">
            Codificación decimal normalizada: <strong>1 Activo</strong>, <strong>2 Pasivo</strong>, <strong>3 Capital</strong>, <strong>4 Costos y Gastos</strong> y <strong>5 Ingresos</strong>. Estructura el Libro Diario, Mayor y los Estados Financieros.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-9 px-3.5 gap-1.5 shadow-sm"
            onClick={() => abrirModalNuevaCuenta(grupoFiltro !== "todos" ? (grupoFiltro === "activo" ? "11" : grupoFiltro === "pasivo" ? "21" : grupoFiltro === "capital" ? "31" : grupoFiltro === "gasto" ? "41" : "51") : "11")}
          >
            <Plus className="size-4" />
            Nueva Cuenta
          </Button>
        </div>
      </header>

      {/* DASHBOARD DE MÉTRICAS Y RESUMEN CONTABLE (KPIS INTERACTIVOS) */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {/* KPI 0: Total Catálogo */}
        <button
          type="button"
          onClick={() => setGrupoFiltro("todos")}
          className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all ${
            grupoFiltro === "todos"
              ? "border-primary bg-primary/[0.04] ring-1 ring-primary shadow-xs"
              : "border-border bg-card hover:bg-muted/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Cuentas</span>
            <Layers className="size-3.5 text-muted-foreground" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-foreground">{estadisticas.total}</div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">{estadisticas.activas} act.</span>
              <span>·</span>
              <span>{estadisticas.enUso} en uso</span>
            </div>
          </div>
        </button>

        {/* KPIs 1 a 5: Grupos Contables */}
        {ORDEN_GRUPOS.map((g) => {
          const stats = estadisticas.porGrupo[g]
          const activo = grupoFiltro === g
          const digito = g === "activo" ? "1" : g === "pasivo" ? "2" : g === "capital" ? "3" : g === "gasto" ? "4" : "5"

          return (
            <button
              key={g}
              type="button"
              onClick={() => setGrupoFiltro(activo ? "todos" : g)}
              className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all ${
                activo
                  ? "border-primary bg-primary/[0.05] ring-1 ring-primary shadow-xs"
                  : "border-border bg-card hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground truncate">{ETIQUETA_TIPO[g]}</span>
                <span className="font-mono text-[11px] font-bold px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                  {digito}
                </span>
              </div>
              <div className="mt-2">
                <div className="text-xl font-bold text-foreground">{stats.total}</div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">{stats.activas} activas</span>
                  <span>·</span>
                  <span>{stats.enUso} partidas</span>
                </div>
              </div>
            </button>
          )
        })}
      </section>

      {/* BANNER DIDÁCTICO DEL MÉTODO ANALÍTICO (COLAPSABLE) */}
      <Card className="border-primary/20 bg-primary/[0.015] overflow-hidden">
        <button
          type="button"
          onClick={() => setBannerAbierto(!bannerAbierto)}
          className="flex w-full items-center justify-between p-3.5 sm:px-5 text-left text-xs sm:text-sm font-medium hover:bg-primary/[0.03] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Info className="size-4 text-primary shrink-0" />
            <span className="font-semibold text-foreground">
              Guía Técnica · Cuentas Especializadas del Método Analítico o Pormenorizado
            </span>
            <Badge variant="outline" className="hidden sm:inline-flex text-[10px] border-primary/30 text-primary">
              Norma de Costeo Comercial
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <span>{bannerAbierto ? "Ocultar fundamentos" : "Ver cuentas correctoras e inventario"}</span>
            {bannerAbierto ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </div>
        </button>

        {bannerAbierto && (
          <CardContent className="px-5 pb-5 pt-1 text-xs border-t border-primary/10 space-y-3">
            <p className="text-muted-foreground leading-relaxed">
              En este sistema las operaciones de mercancías no se registran en una sola cuenta genérica, sino que se segregan analíticamente para calcular el <strong>Costo de Ventas</strong> en cascada:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 font-mono text-[11px]">
              <div className="rounded-lg border border-border/80 bg-background/80 p-2.5">
                <span className="font-bold text-primary block">1104 Inventario inicial</span>
                <span className="text-muted-foreground text-[10px]">Permanece fijo durante el ejercicio contable. Se regulariza en la toma física final.</span>
              </div>
              <div className="rounded-lg border border-border/80 bg-background/80 p-2.5">
                <span className="font-bold text-primary block">4101 Compras brutas</span>
                <span className="text-muted-foreground text-[10px]">Naturaleza deudora. Adquisiciones al costo de factura.</span>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.04] p-2.5">
                <span className="font-bold text-amber-700 dark:text-amber-400 block">5102 Devoluciones s/ compras</span>
                <span className="text-muted-foreground text-[10px]">Cuenta correctora acreedora. Disminuye directamente las compras brutas.</span>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.04] p-2.5">
                <span className="font-bold text-amber-700 dark:text-amber-400 block">5103 Rebajas s/ compras</span>
                <span className="text-muted-foreground text-[10px]">Cuenta correctora acreedora. Bonificaciones recibidas de proveedores.</span>
              </div>
              <div className="rounded-lg border border-border/80 bg-background/80 p-2.5">
                <span className="font-bold text-primary block">5101 Ventas brutas</span>
                <span className="text-muted-foreground text-[10px]">Naturaleza acreedora. Facturación total a clientes.</span>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.04] p-2.5">
                <span className="font-bold text-amber-700 dark:text-amber-400 block">4103 Devoluciones s/ ventas</span>
                <span className="text-muted-foreground text-[10px]">Cuenta correctora deudora. Reduce los ingresos brutos por ventas.</span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* BARRA DE HERRAMIENTAS Y FILTRADO INTEGRADO */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        {/* Búsqueda Reactiva con Limpiador */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código numérico o nombre de cuenta..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9 pr-8 h-9 text-sm"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Filtros de Estado y Conteo de Coincidencias */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de Estado */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFiltroEstado("todas")}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filtroEstado === "todas" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstado("activas")}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filtroEstado === "activas" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Activas ({estadisticas.activas})
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstado("inactivas")}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filtroEstado === "inactivas" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Inactivas ({estadisticas.inactivas})
            </button>
          </div>

          <Badge variant="muted" className="h-8 px-2.5 text-xs font-mono">
            {cuentasFiltradas.length} / {cuentas.length} cuentas
          </Badge>
        </div>
      </div>

      {/* Indicador de filtro por grupo activo */}
      {grupoFiltro !== "todos" && (
        <div className="flex items-center gap-2 px-1 text-xs">
          <span className="text-muted-foreground">Filtrando por clase:</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 font-medium">
            {ETIQUETA_TIPO[grupoFiltro]}
            <button
              type="button"
              onClick={() => setGrupoFiltro("todos")}
              className="hover:text-destructive transition-colors ml-0.5"
              title="Quitar filtro de clase y ver todo el catálogo"
            >
              <X className="size-3" />
            </button>
          </span>
          <button
            type="button"
            onClick={() => setGrupoFiltro("todos")}
            className="text-primary hover:underline font-medium"
          >
            Ver todas las clases
          </button>
        </div>
      )}

      {/* LISTADO JERÁRQUICO POR GRUPOS Y RUBROS CONTABLES */}
      <div className="space-y-6">
        {estructuraJerarquica.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Search className="size-6" />
            </div>
            <h3 className="mt-3 text-base font-semibold text-foreground">No se encontraron cuentas</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
              {grupoFiltro !== "todos"
                ? `No existen cuentas que coincidan con "${busqueda}" dentro de ${ETIQUETA_TIPO[grupoFiltro]}.`
                : `No existen cuentas contables que coincidan con "${busqueda}".`}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              {grupoFiltro !== "todos" && (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setGrupoFiltro("todos")}
                >
                  Buscar en todo el catálogo
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setBusqueda("")
                  setGrupoFiltro("todos")
                  setFiltroEstado("todas")
                }}
              >
                Limpiar filtros
              </Button>
            </div>
          </Card>
        ) : (
          estructuraJerarquica.map((grupo) => (
            <div key={grupo.tipo} className="space-y-3">
              {/* Cabecera del Grupo Principal */}
              <div className="flex items-center justify-between border-b-2 border-primary/20 pb-1.5 px-1">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground font-mono font-bold text-xs">
                    {grupo.digito}
                  </span>
                  <h2 className="text-base font-bold text-foreground uppercase tracking-wide">{grupo.nombreGrupo}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {grupo.totalCuentas} {grupo.totalCuentas === 1 ? "cuenta" : "cuentas"}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="h-7 text-xs text-primary hover:text-primary gap-1"
                    onClick={() => abrirModalNuevaCuenta(grupo.rubros[0]?.codigo || `${grupo.digito}1`)}
                  >
                    <Plus className="size-3.5" />
                    Añadir en {grupo.nombreGrupo.split(" ")[0]}
                  </Button>
                </div>
              </div>

              {/* Rubros de 2 Dígitos */}
              <div className="space-y-3">
                {grupo.rubros.map((rubro) => (
                  <Card key={rubro.codigo} className="overflow-hidden border-border/80 shadow-xs">
                    {/* Encabezado del Rubro */}
                    <div className="flex items-center justify-between bg-muted/40 px-4 py-2 border-b border-border/60">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-primary bg-background px-1.5 py-0.5 rounded border border-border">
                          {rubro.codigo}
                        </span>
                        <span className="text-xs font-semibold text-foreground">{rubro.nombre}</span>
                        <span className="text-[11px] text-muted-foreground hidden md:inline">· {rubro.descripcion}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {rubro.cuentas.length} {rubro.cuentas.length === 1 ? "cuenta" : "cuentas"}
                      </span>
                    </div>

                    {/* Tabla de Cuentas del Rubro */}
                    <div className="divide-y divide-border/60">
                      {rubro.cuentas.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground italic">
                          No hay cuentas registradas en este rubro.
                        </div>
                      ) : (
                        rubro.cuentas.map(renderFilaCuenta)
                      )}
                    </div>
                  </Card>
                ))}

                {/* Cuentas adicionales del grupo que no pertenezcan a rubro estándar */}
                {grupo.cuentasOtras && grupo.cuentasOtras.length > 0 && (
                  <Card className="overflow-hidden border-border/80 shadow-xs">
                    <div className="flex items-center justify-between bg-muted/40 px-4 py-2 border-b border-border/60">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-primary bg-background px-1.5 py-0.5 rounded border border-border">
                          {grupo.digito}
                        </span>
                        <span className="text-xs font-semibold text-foreground">Otras cuentas de {grupo.nombreGrupo}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {grupo.cuentasOtras.length} {grupo.cuentasOtras.length === 1 ? "cuenta" : "cuentas"}
                      </span>
                    </div>
                    <div className="divide-y divide-border/60">
                      {grupo.cuentasOtras.map(renderFilaCuenta)}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* MANTENIMIENTO Y DEMOSTRACIÓN DIDÁCTICA */}
      <Card className="border-dashed border-border/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Database className="size-4 text-primary" />
            Mantenimiento y Entorno Didáctico
          </CardTitle>
          <CardDescription className="text-xs">
            Restablece el catálogo completo original y las partidas del caso comercial de muestra para fines de evaluación o capacitación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => {
              if (window.confirm("¿Deseas restablecer el catálogo oficial y los 7 asientos del caso didáctico de ejemplo? Esta acción recargará las operaciones iniciales.")) {
                reiniciarEjemplo()
                mostrarToast("Catálogo y partidas didácticas restablecidas.")
              }
            }}
          >
            <RefreshCw className="size-3.5" />
            Restablecer datos didácticos del catálogo
          </Button>
        </CardContent>
      </Card>

      {/* ======================================================== */}
      {/* MODAL 1: AGREGAR NUEVA CUENTA CON ASISTENTE DE CÓDIGO */}
      {/* ======================================================== */}
      {modalNuevoAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Plus className="size-5 text-primary" />
                <h3 className="font-bold text-base text-foreground">Agregar Nueva Cuenta Contable</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalNuevoAbierto(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs sm:text-sm">
              {/* Selector de Rubro Guía */}
              <div className="space-y-1.5">
                <Label htmlFor="nuevo-rubro">Rubro Contable (Grupo y Subgrupo)</Label>
                <Select
                  id="nuevo-rubro"
                  value={nuevoRubro}
                  onChange={(e) => manejarCambioRubro(e.target.value)}
                  className="h-9 font-medium"
                >
                  {RUBROS_CONTABLES.map((r) => (
                    <option key={r.codigo} value={r.codigo}>
                      {r.codigo} — {r.nombre} ({ETIQUETA_TIPO[r.grupo]})
                    </option>
                  ))}
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Al cambiar de rubro, el sistema calcula automáticamente el código correlativo disponible.
                </p>
              </div>

              {/* Código y Nombre */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="nuevo-codigo">Código Numérico</Label>
                  <Input
                    id="nuevo-codigo"
                    inputMode="numeric"
                    value={nuevoCodigo}
                    onChange={(e) => setNuevoCodigo(e.target.value)}
                    className="font-mono font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nuevo-nombre">Nombre Oficial de la Cuenta</Label>
                  <Input
                    id="nuevo-nombre"
                    placeholder="Ej. Deudores comerciales locales"
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                  />
                </div>
              </div>

              {/* Naturaleza Contable */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="nueva-naturaleza">Naturaleza Contable</Label>
                  <Select
                    id="nueva-naturaleza"
                    value={nuevaNaturaleza}
                    onChange={(e) => setNuevaNaturaleza(e.target.value as Naturaleza)}
                  >
                    <option value="deudora">Deudora (Saldo en Debe)</option>
                    <option value="acreedora">Acreedora (Saldo en Haber)</option>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="nuevo-tipo-afectacion">Nivel Operativo</Label>
                  <Select
                    id="nuevo-tipo-afectacion"
                    value={nuevoPermiteMovimiento ? "detalle" : "titulo"}
                    onChange={(e) => setNuevoPermiteMovimiento(e.target.value === "detalle")}
                  >
                    <option value="detalle">Afectable (Permite Asientos)</option>
                    <option value="titulo">De Título / Acumulación</option>
                  </Select>
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive font-medium">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalNuevoAbierto(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={guardarNuevaCuenta}
                className="gap-1.5"
              >
                <Check className="size-4" />
                Registrar Cuenta
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: EDITAR NOMBRE DE CUENTA SIN PÉRDIDA DE SCROLL */}
      {/* ======================================================== */}
      {cuentaEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="size-5 text-primary" />
                <h3 className="font-bold text-base text-foreground">Modificar Cuenta Contable</h3>
              </div>
              <button
                type="button"
                onClick={() => setCuentaEditando(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs sm:text-sm">
              <div className="rounded-lg border border-border/80 bg-muted/40 p-3 space-y-1 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Código Inmutable:</span>
                  <span className="font-bold text-primary">{cuentaEditando.codigo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Clasificación:</span>
                  <span className="font-semibold text-foreground uppercase">{ETIQUETA_TIPO[cuentaEditando.tipo]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Naturaleza Actual:</span>
                  <span className="font-semibold capitalize text-foreground">{cuentaEditando.naturaleza}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-nombre">Nombre Oficial de la Cuenta</Label>
                <Input
                  id="edit-nombre"
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  className="font-medium"
                />
              </div>

              {editError && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive font-medium">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCuentaEditando(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={guardarEdicion}
                className="gap-1.5"
              >
                <Check className="size-4" />
                Guardar Modificación
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: DESACTIVACIÓN SEGURA O ELIMINACIÓN CON AUDITORÍA */}
      {/* ======================================================== */}
      {cuentaDesactivando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-5 text-amber-600" />
                <h3 className="font-bold text-base text-foreground">
                  {(conteoMovimientos[cuentaDesactivando.codigo] || 0) > 0 ? "Desactivar Cuenta Contable" : "Eliminar Cuenta Contable"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCuentaDesactivando(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
                <div className="font-mono text-primary font-bold text-sm">
                  {cuentaDesactivando.codigo} — {cuentaDesactivando.nombre}
                </div>
                <div className="text-xs text-muted-foreground">
                  Partidas vinculadas en el ejercicio:{" "}
                  <strong className="text-foreground">{conteoMovimientos[cuentaDesactivando.codigo] || 0} movimientos</strong>
                </div>
              </div>

              {(conteoMovimientos[cuentaDesactivando.codigo] || 0) > 0 ? (
                <div className="space-y-2 rounded-lg bg-amber-500/10 border border-amber-500/25 p-3 text-amber-900 dark:text-amber-200">
                  <p className="font-semibold text-xs flex items-center gap-1.5">
                    <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    Protección de Trazabilidad e Integridad Histórica
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Esta cuenta tiene registros en los Libros Contables. Para proteger los balances y cumplir con las normas de auditoría, <strong>la cuenta no será borrada físicamente</strong>: se marcará como <span className="font-semibold text-foreground">INACTIVA</span> para que no vuelva a aparecer en el formulario de nuevas partidas.
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Esta cuenta no posee ningún asiento registrado. Será purgada de forma segura del catálogo institucional.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCuentaDesactivando(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={confirmarDesactivacion}
                className="gap-1.5"
              >
                {(conteoMovimientos[cuentaDesactivando.codigo] || 0) > 0 ? (
                  <>
                    <EyeOff className="size-4" />
                    Desactivar Cuenta
                  </>
                ) : (
                  <>
                    <Trash2 className="size-4" />
                    Eliminar Definitivamente
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
