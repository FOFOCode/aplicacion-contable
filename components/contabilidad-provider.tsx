"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { CATALOGO_CUENTAS } from "@/lib/catalogo"

import {
  calcularBalanceGeneral,
  calcularEstadoResultados,
  calcularMayor,
} from "@/lib/contabilidad"

import {
  grupoPorDigito,
  type Asiento,
  type CierreContable,
  type Cuenta,
  type EjercicioFiscal,
  type InventarioTomaFisica,
} from "@/lib/types"

// ============================================================
// STORAGE
// ============================================================

const STORAGE_ASIENTOS =
  "modulo-contable:asientos"

const STORAGE_CUENTAS =
  "modulo-contable:cuentas"

const STORAGE_CIERRES =
  "modulo-contable:cierres"

const STORAGE_EJERCICIO =
  "modulo-contable:ejercicio_seleccionado"

const STORAGE_TOMA =
  "modulo-contable:toma_fisica"

// ============================================================
// DATOS LOCALES DE RESPALDO
// ============================================================

const EJERCICIOS_DEFECTO: EjercicioFiscal[] = [
  {
    ejercicio: 2026,
    fecha_inicio: "2026-01-01",
    fecha_fin: "2026-12-31",
    ultimo_numero: 7,
    estado: "ABIERTO",
  },
]

const TOMA_FISICA_DEFECTO: InventarioTomaFisica = {
  ejercicio: 2026,
  fecha_toma: "2026-12-31",
  valor_inventario_final: 6500,
  responsable:
    "Comité de Auditoría y Control de Inventarios",
  observaciones:
    "Toma física de existencias y conteo al cierre del ejercicio 2026 (Método Analítico)",
}

const ASIENTOS_EJEMPLO: Asiento[] = [
  {
    id: "a1",
    ejercicio: 2026,
    numero: 1,
    fecha: "2026-01-02",
    concepto:
      "Aportación inicial de los socios en efectivo, banco e inventario inicial de mercaderías.",
    tipo: "APERTURA",
    estado: "APLICADO",
    lineas: [
      {
        codigo: "1101",
        debe: 10000,
        haber: 0,
      },
      {
        codigo: "1102",
        debe: 5000,
        haber: 0,
      },
      {
        codigo: "1104",
        debe: 5000,
        haber: 0,
      },
      {
        codigo: "3101",
        debe: 0,
        haber: 20000,
      },
    ],
  },

  {
    id: "a2",
    ejercicio: 2026,
    numero: 2,
    fecha: "2026-01-05",
    concepto:
      "Compra de mercadería al contado según factura (Método Analítico).",
    tipo: "OPERACION",
    estado: "APLICADO",
    lineas: [
      {
        codigo: "4101",
        debe: 4000,
        haber: 0,
      },
      {
        codigo: "1105",
        debe: 520,
        haber: 0,
      },
      {
        codigo: "1102",
        debe: 0,
        haber: 4520,
      },
    ],
  },

  {
    id: "a3",
    ejercicio: 2026,
    numero: 3,
    fecha: "2026-01-07",
    concepto:
      "Pago de fletes y transporte de mercadería comprada (Método Analítico).",
    tipo: "OPERACION",
    estado: "APLICADO",
    lineas: [
      {
        codigo: "4102",
        debe: 300,
        haber: 0,
      },
      {
        codigo: "1105",
        debe: 39,
        haber: 0,
      },
      {
        codigo: "1101",
        debe: 0,
        haber: 339,
      },
    ],
  },

  {
    id: "a4",
    ejercicio: 2026,
    numero: 4,
    fecha: "2026-01-09",
    concepto:
      "Devolución de mercadería dañada al proveedor según nota de crédito (Método Analítico).",
    tipo: "OPERACION",
    estado: "APLICADO",
    lineas: [
      {
        codigo: "1102",
        debe: 452,
        haber: 0,
      },
      {
        codigo: "5102",
        debe: 0,
        haber: 400,
      },
      {
        codigo: "1105",
        debe: 0,
        haber: 52,
      },
    ],
  },

  {
    id: "a5",
    ejercicio: 2026,
    numero: 5,
    fecha: "2026-01-12",
    concepto:
      "Venta de mercaderías al contado con IVA débito fiscal (Método Analítico).",
    tipo: "OPERACION",
    estado: "APLICADO",
    lineas: [
      {
        codigo: "1102",
        debe: 9040,
        haber: 0,
      },
      {
        codigo: "5101",
        debe: 0,
        haber: 8000,
      },
      {
        codigo: "2103",
        debe: 0,
        haber: 1040,
      },
    ],
  },

  {
    id: "a6",
    ejercicio: 2026,
    numero: 6,
    fecha: "2026-01-15",
    concepto:
      "Cliente devuelve mercadería por no cumplir especificaciones técnicas (Método Analítico).",
    tipo: "OPERACION",
    estado: "APLICADO",
    lineas: [
      {
        codigo: "4103",
        debe: 500,
        haber: 0,
      },
      {
        codigo: "2103",
        debe: 65,
        haber: 0,
      },
      {
        codigo: "1102",
        debe: 0,
        haber: 565,
      },
    ],
  },

  {
    id: "a7",
    ejercicio: 2026,
    numero: 7,
    fecha: "2026-01-20",
    concepto:
      "Pago de servicios contables y gastos administrativos con cheque.",
    tipo: "OPERACION",
    estado: "APLICADO",
    lineas: [
      {
        codigo: "4201",
        debe: 800,
        haber: 0,
      },
      {
        codigo: "1102",
        debe: 0,
        haber: 800,
      },
    ],
  },
]

// ============================================================
// TIPOS
// ============================================================

type ResultadoOperacion = {
  success: boolean
  error?: string
}

type ResultadoCierre = {
  success: boolean
  error?: string
  siguienteEjercicio?: number
  [key: string]: unknown
}

interface ContabilidadContextValue {
  cuentas: Cuenta[]
  asientos: Asiento[]
  cierres: CierreContable[]

  ejercicios: EjercicioFiscal[]

  ejercicioSeleccionado: number

  setEjercicioSeleccionado: (
    ejercicio: number
  ) => void

  ejercicioActual:
    | EjercicioFiscal
    | undefined

  esEjercicioCerrado: boolean

  tomaFisica:
    | InventarioTomaFisica
    | null

  guardarTomaFisica: (
    toma: Partial<InventarioTomaFisica>
  ) => Promise<boolean>

  cambiarEstadoEjercicio: (
    ejercicio: number,
    nuevoEstado:
      | "ABIERTO"
      | "CERRADO"
      | "BLOQUEADO"
  ) => Promise<boolean>

  crearEjercicio: (
    ejercicio: number
  ) => Promise<boolean>

  generarPartidaApertura: (
    origen: number,
    destino: number
  ) => Promise<ResultadoOperacion>

  dbConnected: boolean
  cargando: boolean

  agregarAsiento: (
    asiento: Omit<
      Asiento,
      "id" | "numero"
    >
  ) => Promise<ResultadoOperacion>

  eliminarAsiento: (
    id: string,
    motivo?: string
  ) => Promise<void>

  anularAsiento: (
    id: string,
    motivo?: string
  ) => Promise<ResultadoOperacion>

  agregarCuenta: (
    cuenta: Cuenta
  ) => Promise<void>

  renombrarCuenta: (
    codigoActual: string,
    codigoNuevo: string,
    nombre: string
  ) => Promise<ResultadoOperacion>

  eliminarCuenta: (
    codigo: string
  ) => Promise<ResultadoOperacion>

  reactivarCuenta: (
    codigo: string
  ) => Promise<void>

  cuentaEnUso: (
    codigo: string
  ) => boolean

  reiniciarEjemplo: () => void

  limpiarTodo: () => void

  cerrarCicloContable: (
    opciones?: {
      aperturarSiguiente?: boolean
    }
  ) => Promise<
    ResultadoCierre | void
  >

  recargarCierres: () => Promise<void>

  recargarAsientos: () => Promise<void>

  recargarTodo: () => Promise<void>

  mayor: ReturnType<
    typeof calcularMayor
  >

  estadoResultados: ReturnType<
    typeof calcularEstadoResultados
  >

  balanceGeneral: ReturnType<
    typeof calcularBalanceGeneral
  >
}

// ============================================================
// CONTEXTO
// ============================================================

const ContabilidadContext =
  createContext<
    ContabilidadContextValue | null
  >(null)

// ============================================================
// PROVIDER
// ============================================================

export function ContabilidadProvider({
  children,
}: {
  children: ReactNode
}) {
  // ============================================================
  // ESTADOS
  // ============================================================

  const [
    cuentas,
    setCuentas,
  ] = useState<Cuenta[]>(
    CATALOGO_CUENTAS
  )

  const [
    asientos,
    setAsientos,
  ] = useState<Asiento[]>(
    ASIENTOS_EJEMPLO
  )

  const [
    cierres,
    setCierres,
  ] = useState<CierreContable[]>(
    []
  )

  const [
    ejercicios,
    setEjercicios,
  ] = useState<
    EjercicioFiscal[]
  >(EJERCICIOS_DEFECTO)

  const [
    ejercicioSeleccionado,
    setEjercicioSeleccionadoState,
  ] = useState<number>(2026)

  const [
    tomaFisica,
    setTomaFisica,
  ] =
    useState<InventarioTomaFisica | null>(
      TOMA_FISICA_DEFECTO
    )

  const [
    reporteAnaliticoSql,
    setReporteAnaliticoSql,
  ] =
    useState<Record<
      string,
      unknown
    > | null>(null)

  const [
    hidratado,
    setHidratado,
  ] = useState(false)

  const [
    dbConnected,
    setDbConnected,
  ] = useState(false)

  const [
    cargando,
    setCargando,
  ] = useState(true)

  // ============================================================
  // EJERCICIO ACTUAL
  // ============================================================

  const ejercicioActual =
    useMemo(() => {
      const encontrado =
        ejercicios.find(
          (e) =>
            e.ejercicio ===
            ejercicioSeleccionado
        )

      if (encontrado) {
        return encontrado
      }

      return {
        ejercicio:
          ejercicioSeleccionado,

        fecha_inicio:
          `${ejercicioSeleccionado}-01-01`,

        fecha_fin:
          `${ejercicioSeleccionado}-12-31`,

        ultimo_numero: 0,

        estado:
          "ABIERTO" as const,
      }
    }, [
      ejercicios,
      ejercicioSeleccionado,
    ])

  const esEjercicioCerrado =
    useMemo(() => {
      return (
        ejercicioActual.estado !==
        "ABIERTO"
      )
    }, [ejercicioActual])

  // ============================================================
  // CAMBIAR EJERCICIO
  // ============================================================

  const setEjercicioSeleccionado =
    useCallback(
      (ejercicio: number) => {
        setEjercicioSeleccionadoState(
          ejercicio
        )

        if (
          typeof window !==
          "undefined"
        ) {
          localStorage.setItem(
            STORAGE_EJERCICIO,
            ejercicio.toString()
          )
        }
      },
      []
    )

  // ============================================================
  // RECARGAR CIERRES
  // ============================================================

  const recargarCierres =
    useCallback(async () => {
      if (!dbConnected) {
        return
      }

      try {
        const respuesta =
          await fetch(
            "/api/cierres",
            {
              cache: "no-store",
            }
          )

        if (!respuesta.ok) {
          return
        }

        const data =
          await respuesta.json()

        if (
          Array.isArray(data)
        ) {
          setCierres(data)
        }
      } catch (error) {
        console.error(
          "Error al cargar cierres:",
          error
        )
      }
    }, [dbConnected])

  // ============================================================
  // RECARGAR ASIENTOS
  // ============================================================

  const recargarAsientos =
    useCallback(async () => {
      if (!dbConnected) {
        return
      }

      try {
        const respuesta =
          await fetch(
            `/api/asientos?ejercicio=${ejercicioSeleccionado}`,
            {
              cache: "no-store",
            }
          )

        if (!respuesta.ok) {
          return
        }

        const data =
          await respuesta.json()

        if (
          Array.isArray(data)
        ) {
          setAsientos(data)
        }
      } catch (error) {
        console.error(
          "Error al recargar asientos:",
          error
        )
      }
    }, [
      dbConnected,
      ejercicioSeleccionado,
    ])

  // ============================================================
  // RECARGAR TOMA FÍSICA
  // ============================================================

  const recargarTomaFisica =
    useCallback(
      async (
        ejercicio: number
      ) => {
        if (!dbConnected) {
          return
        }

        try {
          const respuesta =
            await fetch(
              `/api/inventario?ejercicio=${ejercicio}`,
              {
                cache: "no-store",
              }
            )

          if (!respuesta.ok) {
            return
          }

          const data =
            await respuesta.json()

          if (
            data &&
            data.existe
          ) {
            setTomaFisica(
              data
            )
          } else {
            setTomaFisica({
              ejercicio,

              fecha_toma:
                `${ejercicio}-12-31`,

              valor_inventario_final:
                0,

              responsable: "",

              observaciones: "",
            })
          }
        } catch (error) {
          console.error(
            "Error al cargar toma física:",
            error
          )
        }
      },
      [dbConnected]
    )

  // ============================================================
  // RECARGAR REPORTE ANALÍTICO
  // ============================================================

  const recargarReporteAnaliticoSql =
    useCallback(
      async (
        ejercicio: number
      ) => {
        if (!dbConnected) {
          return
        }

        try {
          const respuesta =
            await fetch(
              `/api/reportes/analitico?ejercicio=${ejercicio}`,
              {
                cache: "no-store",
              }
            )

          if (
            respuesta.ok
          ) {
            setReporteAnaliticoSql(
              await respuesta.json()
            )
          } else {
            setReporteAnaliticoSql(
              null
            )
          }
        } catch {
          setReporteAnaliticoSql(
            null
          )
        }
      },
      [dbConnected]
    )

  // ============================================================
  // RECARGAR TODO
  // ============================================================

  const recargarTodo =
    useCallback(async () => {
      await Promise.all([
        recargarAsientos(),
        recargarCierres(),
        recargarTomaFisica(
          ejercicioSeleccionado
        ),
        recargarReporteAnaliticoSql(
          ejercicioSeleccionado
        ),
      ])
    }, [
      recargarAsientos,
      recargarCierres,
      recargarTomaFisica,
      recargarReporteAnaliticoSql,
      ejercicioSeleccionado,
    ])

  // ============================================================
  // CARGA INICIAL
  // ============================================================

  useEffect(() => {
    async function inicializar() {
      try {
        const statusRes =
          await fetch(
            "/api/status",
            {
              cache:
                "no-store",
            }
          ).catch(
            () => null
          )

        const statusData =
          statusRes &&
          statusRes.ok
            ? await statusRes.json()
            : null

        if (
          statusData?.connected
        ) {
          setDbConnected(
            true
          )

          const [
            cuentasRes,
            ejerciciosRes,
            cierresRes,
          ] =
            await Promise.all([
              fetch(
                "/api/cuentas",
                {
                  cache:
                    "no-store",
                }
              ),

              fetch(
                "/api/ejercicios",
                {
                  cache:
                    "no-store",
                }
              ).catch(
                () => null
              ),

              fetch(
                "/api/cierres",
                {
                  cache:
                    "no-store",
                }
              ).catch(
                () => null
              ),
            ])

          // CUENTAS

          if (
            cuentasRes.ok
          ) {
            const dbCuentas =
              await cuentasRes.json()

            if (
              Array.isArray(
                dbCuentas
              )
            ) {
              setCuentas(
                dbCuentas
              )
            }
          }

          // EJERCICIOS

          let ejercicioActivo =
            2026

          if (
            ejerciciosRes &&
            ejerciciosRes.ok
          ) {
            const dbEjercicios =
              await ejerciciosRes.json()

            if (
              Array.isArray(
                dbEjercicios
              ) &&
              dbEjercicios.length >
                0
            ) {
              setEjercicios(
                dbEjercicios
              )

              const guardado =
                localStorage.getItem(
                  STORAGE_EJERCICIO
                )

              const guardadoNumero =
                guardado
                  ? Number(
                      guardado
                    )
                  : null

              const existeGuardado =
                dbEjercicios.find(
                  (
                    ejercicio: EjercicioFiscal
                  ) =>
                    ejercicio.ejercicio ===
                    guardadoNumero
                )

              if (
                existeGuardado
              ) {
                ejercicioActivo =
                  existeGuardado.ejercicio
              } else {
                const abierto =
                  dbEjercicios.find(
                    (
                      ejercicio: EjercicioFiscal
                    ) =>
                      ejercicio.estado ===
                      "ABIERTO"
                  )

                ejercicioActivo =
                  abierto
                    ?.ejercicio ??
                  dbEjercicios[0]
                    .ejercicio
              }

              setEjercicioSeleccionadoState(
                ejercicioActivo
              )
            }
          }

          // ASIENTOS, INVENTARIO Y REPORTE

          const [
            asientosRes,
            inventarioRes,
            reporteRes,
          ] =
            await Promise.all([
              fetch(
                `/api/asientos?ejercicio=${ejercicioActivo}`,
                {
                  cache:
                    "no-store",
                }
              ),

              fetch(
                `/api/inventario?ejercicio=${ejercicioActivo}`,
                {
                  cache:
                    "no-store",
                }
              ).catch(
                () => null
              ),

              fetch(
                `/api/reportes/analitico?ejercicio=${ejercicioActivo}`,
                {
                  cache:
                    "no-store",
                }
              ).catch(
                () => null
              ),
            ])

          if (
            asientosRes.ok
          ) {
            const dbAsientos =
              await asientosRes.json()

            if (
              Array.isArray(
                dbAsientos
              )
            ) {
              setAsientos(
                dbAsientos
              )
            }
          }

          if (
            inventarioRes &&
            inventarioRes.ok
          ) {
            const inventario =
              await inventarioRes.json()

            if (
              inventario &&
              inventario.existe
            ) {
              setTomaFisica(
                inventario
              )
            }
          }

          if (
            reporteRes &&
            reporteRes.ok
          ) {
            setReporteAnaliticoSql(
              await reporteRes.json()
            )
          }

          if (
            cierresRes &&
            cierresRes.ok
          ) {
            const dbCierres =
              await cierresRes.json()

            if (
              Array.isArray(
                dbCierres
              )
            ) {
              setCierres(
                dbCierres
              )
            }
          }
        } else {
          // ================================================
          // MODO LOCAL
          // ================================================

          setDbConnected(
            false
          )

          const rawAsientos =
            localStorage.getItem(
              STORAGE_ASIENTOS
            )

          const rawCuentas =
            localStorage.getItem(
              STORAGE_CUENTAS
            )

          const rawCierres =
            localStorage.getItem(
              STORAGE_CIERRES
            )

          const rawToma =
            localStorage.getItem(
              STORAGE_TOMA
            )

          if (rawAsientos) {
            setAsientos(
              JSON.parse(
                rawAsientos
              )
            )
          }

          if (rawCuentas) {
            setCuentas(
              JSON.parse(
                rawCuentas
              )
            )
          }

          if (rawCierres) {
            setCierres(
              JSON.parse(
                rawCierres
              )
            )
          }

          if (rawToma) {
            setTomaFisica(
              JSON.parse(
                rawToma
              )
            )
          }
        }
      } catch (error) {
        console.error(
          "Error al inicializar el sistema:",
          error
        )

        setDbConnected(
          false
        )
      } finally {
        setHidratado(
          true
        )

        setCargando(
          false
        )
      }
    }

    inicializar()
  }, [])

  // ============================================================
  // AL CAMBIAR EJERCICIO
  // ============================================================

  useEffect(() => {
    if (!hidratado) {
      return
    }

    if (!dbConnected) {
      return
    }

    void recargarAsientos()

    void recargarTomaFisica(
      ejercicioSeleccionado
    )

    void recargarReporteAnaliticoSql(
      ejercicioSeleccionado
    )
  }, [
    ejercicioSeleccionado,
    dbConnected,
    hidratado,
    recargarAsientos,
    recargarTomaFisica,
    recargarReporteAnaliticoSql,
  ])

  // ============================================================
  // PERSISTENCIA LOCAL
  // ============================================================

  useEffect(() => {
    if (
      !hidratado ||
      dbConnected
    ) {
      return
    }

    localStorage.setItem(
      STORAGE_ASIENTOS,
      JSON.stringify(
        asientos
      )
    )

    localStorage.setItem(
      STORAGE_CUENTAS,
      JSON.stringify(
        cuentas
      )
    )

    localStorage.setItem(
      STORAGE_CIERRES,
      JSON.stringify(
        cierres
      )
    )

    if (tomaFisica) {
      localStorage.setItem(
        STORAGE_TOMA,
        JSON.stringify(
          tomaFisica
        )
      )
    }
  }, [
    asientos,
    cuentas,
    cierres,
    tomaFisica,
    hidratado,
    dbConnected,
  ])

  // ============================================================
  // GUARDAR TOMA FÍSICA
  // ============================================================

  async function guardarTomaFisica(
    toma: Partial<InventarioTomaFisica>
  ): Promise<boolean> {
    const nuevaToma: InventarioTomaFisica =
      {
        ejercicio:
          toma.ejercicio ??
          ejercicioSeleccionado,

        fecha_toma:
          toma.fecha_toma ??
          new Date()
            .toISOString()
            .slice(0, 10),

        valor_inventario_final:
          Number(
            toma.valor_inventario_final
          ) || 0,

        responsable:
          toma.responsable ??
          "Auditoría Interna",

        observaciones:
          toma.observaciones ??
          "Toma física de existencias",
      }

    if (dbConnected) {
      try {
        const respuesta =
          await fetch(
            "/api/inventario",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify(
                nuevaToma
              ),
            }
          )

        if (
          !respuesta.ok
        ) {
          return false
        }

        const guardada =
          await respuesta.json()

        setTomaFisica(
          guardada
        )

        await recargarReporteAnaliticoSql(
          nuevaToma.ejercicio
        )

        return true
      } catch (error) {
        console.error(
          "Error al guardar inventario:",
          error
        )

        return false
      }
    }

    setTomaFisica(
      nuevaToma
    )

    return true
  }

  // ============================================================
  // CAMBIAR ESTADO DEL EJERCICIO
  // ============================================================

  async function cambiarEstadoEjercicio(
    ejercicio: number,
    nuevoEstado:
      | "ABIERTO"
      | "CERRADO"
      | "BLOQUEADO"
  ): Promise<boolean> {
    if (dbConnected) {
      try {
        const respuesta =
          await fetch(
            "/api/ejercicios",
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                ejercicio,
                estado:
                  nuevoEstado,
              }),
            }
          )

        if (
          !respuesta.ok
        ) {
          return false
        }

        const actualizado =
          await respuesta.json()

        setEjercicios(
          (prev) =>
            prev.map(
              (item) =>
                item.ejercicio ===
                ejercicio
                  ? {
                      ...item,
                      ...actualizado,
                    }
                  : item
            )
        )

        return true
      } catch (error) {
        console.error(
          "Error al actualizar ejercicio:",
          error
        )

        return false
      }
    }

    setEjercicios(
      (prev) =>
        prev.map(
          (item) =>
            item.ejercicio ===
            ejercicio
              ? {
                  ...item,
                  estado:
                    nuevoEstado,
                }
              : item
        )
    )

    return true
  }

  // ============================================================
  // CREAR EJERCICIO
  // ============================================================

  async function crearEjercicio(
    ejercicio: number
  ): Promise<boolean> {
    if (dbConnected) {
      try {
        const respuesta =
          await fetch(
            "/api/ejercicios",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                ejercicio,
              }),
            }
          )

        if (
          !respuesta.ok
        ) {
          return false
        }

        const nuevo =
          await respuesta.json()

        setEjercicios(
          (prev) => [
            nuevo,
            ...prev.filter(
              (item) =>
                item.ejercicio !==
                ejercicio
            ),
          ]
        )

        setEjercicioSeleccionado(
          ejercicio
        )

        return true
      } catch (error) {
        console.error(
          "Error al crear ejercicio:",
          error
        )

        return false
      }
    }

    const nuevo: EjercicioFiscal =
      {
        ejercicio,

        fecha_inicio:
          `${ejercicio}-01-01`,

        fecha_fin:
          `${ejercicio}-12-31`,

        ultimo_numero: 0,

        estado: "ABIERTO",
      }

    setEjercicios(
      (prev) => [
        nuevo,
        ...prev.filter(
          (item) =>
            item.ejercicio !==
            ejercicio
        ),
      ]
    )

    setEjercicioSeleccionado(
      ejercicio
    )

    return true
  }

  // ============================================================
  // GENERAR APERTURA
  // ============================================================

  async function generarPartidaApertura(
    origen: number,
    destino: number
  ): Promise<ResultadoOperacion> {
    if (!dbConnected) {
      return {
        success: false,

        error:
          "La generación de apertura requiere conexión activa a la base de datos.",
      }
    }

    try {
      const respuesta =
        await fetch(
          "/api/ejercicios/apertura",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              ejercicio_origen:
                origen,

              ejercicio_destino:
                destino,
            }),
          }
        )

      if (
        respuesta.ok
      ) {
        const ejerciciosRes =
          await fetch(
            "/api/ejercicios",
            {
              cache:
                "no-store",
            }
          )

        if (
          ejerciciosRes.ok
        ) {
          setEjercicios(
            await ejerciciosRes.json()
          )
        }

        setEjercicioSeleccionado(
          destino
        )

        return {
          success: true,
        }
      }

      const error =
        await respuesta
          .json()
          .catch(
            () => ({})
          )

      return {
        success: false,

        error:
          error.error ??
          "Error al generar la partida de apertura.",
      }
    } catch (error) {
      return {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Error inesperado de red.",
      }
    }
  }

  // ============================================================
  // AGREGAR ASIENTO
  // ============================================================

  async function agregarAsiento(
    asiento: Omit<
      Asiento,
      "id" | "numero"
    >
  ): Promise<ResultadoOperacion> {
    if (
      esEjercicioCerrado
    ) {
      return {
        success: false,

        error:
          `El ejercicio fiscal ${ejercicioSeleccionado} está cerrado o bloqueado.`,
      }
    }

    if (dbConnected) {
      try {
        const respuesta =
          await fetch(
            "/api/asientos",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify(
                asiento
              ),
            }
          )

        const data =
          await respuesta
            .json()
            .catch(
              () => ({})
            )

        if (
          !respuesta.ok
        ) {
          return {
            success: false,

            error:
              data.error ??
              "No se pudo registrar el asiento.",
          }
        }

        await recargarAsientos()

        await recargarReporteAnaliticoSql(
          ejercicioSeleccionado
        )

        return {
          success: true,
        }
      } catch (error) {
        return {
          success: false,

          error:
            error instanceof Error
              ? error.message
              : "Error al guardar el asiento.",
        }
      }
    }

    setAsientos(
      (prev) => {
        const ejercicio =
          asiento.ejercicio ??
          ejercicioSeleccionado

        const delEjercicio =
          prev.filter(
            (item) =>
              item.ejercicio ===
              ejercicio
          )

        const numero =
          delEjercicio.reduce(
            (
              max,
              item
            ) =>
              Math.max(
                max,
                item.numero
              ),
            0
          ) + 1

        const correlativoGlobal =
          prev.reduce(
            (
              max,
              item
            ) =>
              Math.max(
                max,
                item.correlativo_global ??
                  0
              ),
            0
          ) + 1

        const nuevo: Asiento =
          {
            ...asiento,

            id:
              crypto.randomUUID(),

            numero,

            ejercicio,

            correlativo_global:
              correlativoGlobal,

            estado:
              asiento.estado ??
              "APLICADO",
          }

        return [
          nuevo,
          ...prev,
        ]
      }
    )

    return {
      success: true,
    }
  }

  // ============================================================
  // ANULAR ASIENTO
  // ============================================================

  async function anularAsiento(
    id: string,
    motivo =
      "Anulación contable por corrección/auditoría"
  ): Promise<ResultadoOperacion> {
    if (
      esEjercicioCerrado
    ) {
      return {
        success: false,

        error:
          `No es posible anular partidas del ejercicio ${ejercicioSeleccionado} porque está cerrado o bloqueado.`,
      }
    }

    if (dbConnected) {
      try {
        const respuesta =
          await fetch(
            `/api/asientos/${id}`,
            {
              method: "DELETE",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                motivo,
              }),
            }
          )

        const data =
          await respuesta
            .json()
            .catch(
              () => ({})
            )

        if (
          !respuesta.ok
        ) {
          return {
            success: false,

            error:
              data.error ??
              "No se pudo anular la partida.",
          }
        }

        await recargarAsientos()

        await recargarReporteAnaliticoSql(
          ejercicioSeleccionado
        )

        return {
          success: true,
        }
      } catch (error) {
        return {
          success: false,

          error:
            error instanceof Error
              ? error.message
              : "Error al anular la partida.",
        }
      }
    }

    setAsientos(
      (prev) =>
        prev.map(
          (asiento) =>
            asiento.id === id
              ? {
                  ...asiento,

                  estado:
                    "ANULADO",

                  anulado_en:
                    new Date().toISOString(),

                  motivo_anulacion:
                    motivo,
                }
              : asiento
        )
    )

    return {
      success: true,
    }
  }

  async function eliminarAsiento(
    id: string,
    motivo?: string
  ) {
    await anularAsiento(
      id,
      motivo
    )
  }

  // ============================================================
  // AGREGAR CUENTA
  // ============================================================

  async function agregarCuenta(
    cuenta: Cuenta
  ) {
    if (dbConnected) {
      try {
        const respuesta =
          await fetch(
            "/api/cuentas",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify(
                cuenta
              ),
            }
          )

        const data =
          await respuesta
            .json()
            .catch(
              () => ({})
            )

        if (
          !respuesta.ok
        ) {
          console.warn(
            data.error ??
              "No se pudo guardar la cuenta."
          )

          return
        }

        const nuevaCuenta =
          data.cuenta ??
          cuenta

        setCuentas(
          (prev) =>
            prev.some(
              (item) =>
                item.codigo ===
                nuevaCuenta.codigo
            )
              ? prev
              : [
                  ...prev,
                  nuevaCuenta,
                ].sort(
                  (
                    a,
                    b
                  ) =>
                    a.codigo.localeCompare(
                      b.codigo
                    )
                )
        )

        return
      } catch (error) {
        console.error(
          "Error al guardar cuenta:",
          error
        )

        return
      }
    }

    setCuentas(
      (prev) =>
        prev.some(
          (item) =>
            item.codigo ===
            cuenta.codigo
        )
          ? prev
          : [
              ...prev,
              {
                ...cuenta,
                activa: true,
              },
            ].sort(
              (
                a,
                b
              ) =>
                a.codigo.localeCompare(
                  b.codigo
                )
            )
    )
  }

  // ============================================================
  // CUENTA EN USO
  // ============================================================

  function cuentaEnUso(
    codigo: string
  ) {
    return asientos.some(
      (asiento) =>
        asiento.estado !==
          "ANULADO" &&
        asiento.lineas.some(
          (linea) =>
            linea.codigo ===
            codigo
        )
    )
  }

  // ============================================================
  // MODIFICAR CUENTA
  // ============================================================

  async function renombrarCuenta(
    codigoActual: string,
    codigoNuevo: string,
    nombre: string
  ): Promise<ResultadoOperacion> {
    const codigoLimpio =
      codigoNuevo.trim()

    const nombreLimpio =
      nombre.trim()

    if (
      cuentaEnUso(
        codigoActual
      )
    ) {
      return {
        success: false,

        error:
          "No se puede modificar esta cuenta porque posee movimientos contables registrados.",
      }
    }

    if (
      !/^\d{3,}$/.test(
        codigoLimpio
      )
    ) {
      return {
        success: false,

        error:
          "El código debe tener al menos 3 dígitos numéricos.",
      }
    }

    const tipo =
      grupoPorDigito(
        codigoLimpio
      )

    if (!tipo) {
      return {
        success: false,

        error:
          "El primer dígito debe ser 1, 2, 3, 4 o 5.",
      }
    }

    if (!nombreLimpio) {
      return {
        success: false,

        error:
          "El nombre de la cuenta es obligatorio.",
      }
    }

    const codigoDuplicado =
      cuentas.some(
        (cuenta) =>
          cuenta.codigo ===
            codigoLimpio &&
          cuenta.codigo !==
            codigoActual
      )

    if (
      codigoDuplicado
    ) {
      return {
        success: false,

        error:
          "Ya existe otra cuenta con ese código.",
      }
    }

    const nombreDuplicado =
      cuentas.some(
        (cuenta) =>
          cuenta.codigo !==
            codigoActual &&
          cuenta.nombre
            .trim()
            .toLowerCase() ===
            nombreLimpio.toLowerCase()
      )

    if (
      nombreDuplicado
    ) {
      return {
        success: false,

        error:
          "Ya existe otra cuenta con ese nombre.",
      }
    }

    if (dbConnected) {
      try {
        const respuesta =
          await fetch(
            `/api/cuentas/${encodeURIComponent(
              codigoActual
            )}`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                codigo:
                  codigoLimpio,

                nombre:
                  nombreLimpio,
              }),
            }
          )

        const data =
          await respuesta
            .json()
            .catch(
              () => ({})
            )

        if (
          !respuesta.ok
        ) {
          return {
            success: false,

            error:
              data.error ??
              "No se pudo modificar la cuenta.",
          }
        }

        const actualizada: Cuenta =
          data.cuenta ?? {
            ...cuentas.find(
              (cuenta) =>
                cuenta.codigo ===
                codigoActual
            )!,

            codigo:
              codigoLimpio,

            nombre:
              nombreLimpio,

            tipo,

            naturaleza:
              tipo ===
                "activo" ||
              tipo ===
                "gasto"
                ? "deudora"
                : "acreedora",
          }

        setCuentas(
          (prev) =>
            prev
              .map(
                (cuenta) =>
                  cuenta.codigo ===
                  codigoActual
                    ? actualizada
                    : cuenta
              )
              .sort(
                (
                  a,
                  b
                ) =>
                  a.codigo.localeCompare(
                    b.codigo
                  )
              )
        )

        return {
          success: true,
        }
      } catch (error) {
        console.error(
          error
        )

        return {
          success: false,

          error:
            "No se pudo conectar con la base de datos.",
        }
      }
    }

    const naturaleza: Cuenta["naturaleza"] =
      tipo === "activo" ||
      tipo === "gasto"
        ? "deudora"
        : "acreedora"

    setCuentas(
      (prev) =>
        prev
          .map(
            (cuenta): Cuenta =>
              cuenta.codigo ===
              codigoActual
                ? {
                    ...cuenta,

                    codigo:
                      codigoLimpio,

                    nombre:
                      nombreLimpio,

                    tipo,

                    naturaleza,
                  }
                : cuenta
          )
          .sort(
            (
              a,
              b
            ) =>
              a.codigo.localeCompare(
                b.codigo
              )
          )
    )

    return {
      success: true,
    }
  }

  // ============================================================
  // ELIMINAR CUENTA
  // ============================================================

  async function eliminarCuenta(
    codigo: string
  ): Promise<ResultadoOperacion> {
    if (
      cuentaEnUso(codigo)
    ) {
      return {
        success: false,

        error:
          "No se puede eliminar esta cuenta porque posee movimientos contables registrados.",
      }
    }

    if (dbConnected) {
      try {
        const respuesta =
          await fetch(
            `/api/cuentas/${encodeURIComponent(
              codigo
            )}`,
            {
              method: "DELETE",
            }
          )

        const data =
          await respuesta
            .json()
            .catch(
              () => ({})
            )

        if (
          !respuesta.ok
        ) {
          return {
            success: false,

            error:
              data.error ??
              "No se pudo eliminar la cuenta.",
          }
        }
      } catch (error) {
        console.error(
          error
        )

        return {
          success: false,

          error:
            "No se pudo conectar con la base de datos.",
        }
      }
    }

    setCuentas(
      (prev) =>
        prev.filter(
          (cuenta) =>
            cuenta.codigo !==
            codigo
        )
    )

    return {
      success: true,
    }
  }

  // ============================================================
  // REACTIVAR CUENTA
  // ============================================================

  async function reactivarCuenta(
    codigo: string
  ) {
    if (dbConnected) {
      try {
        const respuesta =
          await fetch(
            `/api/cuentas/${encodeURIComponent(
              codigo
            )}`,
            {
              method: "PATCH",
            }
          )

        if (
          !respuesta.ok
        ) {
          return
        }
      } catch (error) {
        console.error(
          "Error al reactivar cuenta:",
          error
        )

        return
      }
    }

    setCuentas(
      (prev) =>
        prev.map(
          (cuenta) =>
            cuenta.codigo ===
            codigo
              ? {
                  ...cuenta,
                  activa: true,
                }
              : cuenta
        )
    )
  }

  // ============================================================
  // DATOS DE PRUEBA
  // ============================================================

  function reiniciarEjemplo() {
    setCuentas(
      CATALOGO_CUENTAS
    )

    setAsientos(
      ASIENTOS_EJEMPLO
    )

    setTomaFisica(
      TOMA_FISICA_DEFECTO
    )
  }

  function limpiarTodo() {
    setAsientos([])
  }

  // ============================================================
  // CERRAR CICLO
  // ============================================================

  async function cerrarCicloContable(
    opciones?: {
      aperturarSiguiente?: boolean
    }
  ): Promise<
    ResultadoCierre | void
  > {
    if (dbConnected) {
      try {
        const respuesta =
          await fetch(
            "/api/cierre",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                ejercicio:
                  ejercicioSeleccionado,

                aperturar_siguiente:
                  Boolean(
                    opciones?.aperturarSiguiente
                  ),
              }),
            }
          )

        const data =
          await respuesta
            .json()
            .catch(
              () => ({})
            )

        if (
          !respuesta.ok
        ) {
          return {
            success: false,

            error:
              data.error ??
              "Error al cerrar el ejercicio.",
          }
        }

        const ejerciciosRes =
          await fetch(
            "/api/ejercicios",
            {
              cache:
                "no-store",
            }
          )

        if (
          ejerciciosRes.ok
        ) {
          setEjercicios(
            await ejerciciosRes.json()
          )
        }

        if (
          opciones?.aperturarSiguiente &&
          data.siguienteEjercicio
        ) {
          setEjercicioSeleccionado(
            data.siguienteEjercicio
          )
        } else {
          await recargarTodo()
        }

        return {
          success: true,
          ...data,
        }
      } catch (error) {
        console.error(
          "Error al cerrar ejercicio:",
          error
        )

        return {
          success: false,

          error:
            "Error de red o conexión.",
        }
      }
    }

    // MODO LOCAL

    setEjercicios(
      (prev) =>
        prev.map(
          (ejercicio) =>
            ejercicio.ejercicio ===
            ejercicioSeleccionado
              ? {
                  ...ejercicio,

                  estado:
                    "CERRADO",
                }
              : ejercicio
        )
    )

    return {
      success: true,
    }
  }

  // ============================================================
  // CÁLCULOS
  // ============================================================

  const mayor =
    useMemo(
      () =>
        calcularMayor(
          cuentas,
          asientos,
          ejercicioSeleccionado,
          false
        ),
      [
        cuentas,
        asientos,
        ejercicioSeleccionado,
      ]
    )

  const estadoResultados =
    useMemo(() => {
      const resultado =
        calcularEstadoResultados(
          mayor,
          tomaFisica
            ?.valor_inventario_final,
          tomaFisica
            ? {
                fecha:
                  tomaFisica.fecha_toma,

                responsable:
                  tomaFisica.responsable,
              }
            : undefined
        )

      if (
        !dbConnected ||
        !reporteAnaliticoSql ||
        Number(
          reporteAnaliticoSql.ejercicio
        ) !==
          ejercicioSeleccionado
      ) {
        return resultado
      }

      const sql =
        reporteAnaliticoSql as {
          ventasTotales?: number
          devolucionesSobreVentas?: number
          rebajasSobreVentas?: number
          ventasNetas?: number
          inventarioInicial?: number
          compras?: number
          gastosSobreCompras?: number
          comprasTotales?: number
          devolucionesSobreCompras?: number
          rebajasSobreCompras?: number
          comprasNetas?: number
          totalMercancias?: number
          inventarioFinal?: number
          fechaInventarioFinal?:
            | string
            | null
          costoVentas?: number
          utilidadBruta?: number
          gastosOperacion?: number
          utilidadOperacion?: number
          productosFinancieros?: number
          gastosFinancieros?: number
          otrosIngresos?: number
          utilidadNeta?: number
        }

      return {
        ...resultado,

        calculadoPorSql: true,

        totalVentas:
          sql.ventasNetas ??
          resultado.totalVentas,

        totalCostoVentas:
          sql.costoVentas ??
          resultado.totalCostoVentas,

        utilidadBruta:
          sql.utilidadBruta ??
          resultado.utilidadBruta,

        totalGastosOperacion:
          sql.gastosOperacion ??
          resultado.totalGastosOperacion,

        utilidadOperacion:
          sql.utilidadOperacion ??
          resultado.utilidadOperacion,

        totalIngresosFinancieros:
          sql.productosFinancieros ??
          resultado.totalIngresosFinancieros,

        totalGastosFinancieros:
          sql.gastosFinancieros ??
          resultado.totalGastosFinancieros,

        utilidad:
          sql.utilidadNeta ??
          resultado.utilidad,
      }
    }, [
      mayor,
      tomaFisica,
      dbConnected,
      reporteAnaliticoSql,
      ejercicioSeleccionado,
    ])

  const balanceGeneral =
    useMemo(
      () =>
        calcularBalanceGeneral(
          mayor,

          estadoResultados.utilidad,

          estadoResultados
            .analitico
            ?.valorInventarioFinal ??
            tomaFisica
              ?.valor_inventario_final ??
            0
        ),
      [
        mayor,
        estadoResultados,
        tomaFisica,
      ]
    )

  // ============================================================
  // VALUE
  // ============================================================

  const value: ContabilidadContextValue =
    {
      cuentas,
      asientos,
      cierres,

      ejercicios,

      ejercicioSeleccionado,

      setEjercicioSeleccionado,

      ejercicioActual,

      esEjercicioCerrado,

      tomaFisica,

      guardarTomaFisica,

      cambiarEstadoEjercicio,

      crearEjercicio,

      generarPartidaApertura,

      dbConnected,

      cargando,

      agregarAsiento,

      eliminarAsiento,

      anularAsiento,

      agregarCuenta,

      renombrarCuenta,

      eliminarCuenta,

      reactivarCuenta,

      cuentaEnUso,

      reiniciarEjemplo,

      limpiarTodo,

      cerrarCicloContable,

      recargarCierres,

      recargarAsientos,

      recargarTodo,

      mayor,

      estadoResultados,

      balanceGeneral,
    }

  return (
    <ContabilidadContext.Provider
      value={value}
    >
      {children}
    </ContabilidadContext.Provider>
  )
}

// ============================================================
// HOOK
// ============================================================

export function useContabilidad() {
  const contexto =
    useContext(
      ContabilidadContext
    )

  if (!contexto) {
    throw new Error(
      "useContabilidad debe usarse dentro de ContabilidadProvider"
    )
  }

  return contexto
}