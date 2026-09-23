"use client"

import {
  createContext,
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
  type Cuenta,
} from "@/lib/types"

const STORAGE_ASIENTOS = "modulo-contable:asientos"
const STORAGE_CUENTAS = "modulo-contable:cuentas"

const ASIENTOS_EJEMPLO: Asiento[] = [
  {
    id: "a1",
    numero: 1,
    fecha: "2026-01-02",
    concepto: "Aportación inicial de los socios en efectivo y banco.",
    lineas: [
      { codigo: "1101", debe: 10000, haber: 0 },
      { codigo: "1102", debe: 5000, haber: 0 },
      { codigo: "3101", debe: 0, haber: 15000 },
    ],
  },
  {
    id: "a2",
    numero: 2,
    fecha: "2026-01-05",
    concepto: "Compra de mercadería al crédito fiscal, pagada con banco.",
    lineas: [
      { codigo: "1104", debe: 4000, haber: 0 },
      { codigo: "1105", debe: 520, haber: 0 },
      { codigo: "1102", debe: 0, haber: 4520 },
    ],
  },
  {
    id: "a3",
    numero: 3,
    fecha: "2026-01-12",
    concepto: "Venta de mercadería con IVA débito fiscal, cobrada en banco.",
    lineas: [
      { codigo: "1102", debe: 6780, haber: 0 },
      { codigo: "5101", debe: 0, haber: 6000 },
      { codigo: "2103", debe: 0, haber: 780 },
    ],
  },
  {
    id: "a4",
    numero: 4,
    fecha: "2026-01-12",
    concepto: "Registro del costo de la mercadería vendida.",
    lineas: [
      { codigo: "4101", debe: 3000, haber: 0 },
      { codigo: "1104", debe: 0, haber: 3000 },
    ],
  },
  {
    id: "a5",
    numero: 5,
    fecha: "2026-01-20",
    concepto: "Pago de gastos de administración con banco.",
    lineas: [
      { codigo: "4201", debe: 800, haber: 0 },
      { codigo: "1102", debe: 0, haber: 800 },
    ],
  },
]

type ResultadoOperacion = {
  success: boolean
  error?: string
}

interface ContabilidadContextValue {
  cuentas: Cuenta[]
  asientos: Asiento[]
  dbConnected: boolean
  cargando: boolean

  agregarAsiento: (
    a: Omit<Asiento, "id" | "numero">
  ) => void

  eliminarAsiento: (
    id: string
  ) => void

  agregarCuenta: (
    c: Cuenta
  ) => void

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
  ) => void

  cuentaEnUso: (
    codigo: string
  ) => boolean

  reiniciarEjemplo: () => void

  limpiarTodo: () => void

  cerrarCicloContable: () => void

  mayor: ReturnType<typeof calcularMayor>

  estadoResultados: ReturnType<
    typeof calcularEstadoResultados
  >

  balanceGeneral: ReturnType<
    typeof calcularBalanceGeneral
  >
}

const ContabilidadContext =
  createContext<ContabilidadContextValue | null>(null)

export function ContabilidadProvider({
  children,
}: {
  children: ReactNode
}) {
  const [cuentas, setCuentas] =
    useState<Cuenta[]>(CATALOGO_CUENTAS)

  const [asientos, setAsientos] =
    useState<Asiento[]>(ASIENTOS_EJEMPLO)

  const [hidratado, setHidratado] =
    useState(false)

  const [dbConnected, setDbConnected] =
    useState(false)

  const [cargando, setCargando] =
    useState(true)

  // ============================================================
  // INICIALIZACIÓN
  // ============================================================

  useEffect(() => {
    async function inicializar() {
      try {
        const resStatus = await fetch("/api/status").catch(
          () => null
        )

        const statusData =
          resStatus && resStatus.ok
            ? await resStatus.json()
            : null

        if (statusData?.connected) {
          setDbConnected(true)

          const [cRes, aRes] =
            await Promise.all([
              fetch("/api/cuentas"),
              fetch("/api/asientos"),
            ])

          if (cRes.ok && aRes.ok) {
            const dbCuentas =
              await cRes.json()

            const dbAsientos =
              await aRes.json()

            if (
              Array.isArray(dbCuentas) &&
              dbCuentas.length > 0
            ) {
              setCuentas(dbCuentas)
            }

            if (Array.isArray(dbAsientos)) {
              setAsientos(dbAsientos)
            }
          }
        } else {
          // Si no existe conexión con PostgreSQL,
          // utilizar almacenamiento local.
          setDbConnected(false)

          const rawA =
            localStorage.getItem(
              STORAGE_ASIENTOS
            )

          const rawC =
            localStorage.getItem(
              STORAGE_CUENTAS
            )

          if (rawA) {
            setAsientos(
              JSON.parse(rawA)
            )
          }

          if (rawC) {
            setCuentas(
              JSON.parse(rawC)
            )
          }
        }
      } catch (error) {
        console.error(
          "Error al inicializar el sistema:",
          error
        )

        setDbConnected(false)

        const rawA =
          localStorage.getItem(
            STORAGE_ASIENTOS
          )

        const rawC =
          localStorage.getItem(
            STORAGE_CUENTAS
          )

        if (rawA) {
          setAsientos(
            JSON.parse(rawA)
          )
        }

        if (rawC) {
          setCuentas(
            JSON.parse(rawC)
          )
        }
      } finally {
        setHidratado(true)
        setCargando(false)
      }
    }

    inicializar()
  }, [])

  // ============================================================
  // GUARDAR LOCALMENTE CUANDO NO HAY BD
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
      JSON.stringify(asientos)
    )

    localStorage.setItem(
      STORAGE_CUENTAS,
      JSON.stringify(cuentas)
    )
  }, [
    asientos,
    cuentas,
    hidratado,
    dbConnected,
  ])

  // ============================================================
  // AGREGAR ASIENTO
  // ============================================================

  const agregarAsiento:
    ContabilidadContextValue["agregarAsiento"] =
    async (a) => {
      if (dbConnected) {
        try {
          const res =
            await fetch(
              "/api/asientos",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify(a),
              }
            )

          if (res.ok) {
            const {
              id,
              numero,
            } = await res.json()

            setAsientos(
              (prev) => [
                ...prev,
                {
                  ...a,
                  id,
                  numero,
                },
              ]
            )

            return
          }
        } catch (error) {
          console.error(
            "Error al guardar asiento en base de datos:",
            error
          )
        }
      }

      setAsientos((prev) => {
        const numero =
          prev.reduce(
            (max, x) =>
              Math.max(
                max,
                x.numero
              ),
            0
          ) + 1

        return [
          ...prev,
          {
            ...a,
            id: crypto.randomUUID(),
            numero,
          },
        ]
      })
    }

  // ============================================================
  // ELIMINAR ASIENTO
  // ============================================================

  const eliminarAsiento =
    async (id: string) => {
      if (dbConnected) {
        try {
          const res =
            await fetch(
              `/api/asientos/${id}`,
              {
                method: "DELETE",
              }
            )

          if (!res.ok) {
            console.error(
              "No se pudo eliminar el asiento."
            )

            return
          }
        } catch (error) {
          console.error(
            "Error al eliminar asiento:",
            error
          )

          return
        }
      }

      setAsientos((prev) =>
        prev.filter(
          (a) => a.id !== id
        )
      )
    }

  // ============================================================
  // AGREGAR CUENTA
  // ============================================================

  const agregarCuenta =
    async (c: Cuenta) => {
      if (dbConnected) {
        try {
          const res =
            await fetch(
              "/api/cuentas",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify(c),
              }
            )

          if (!res.ok) {
            const data =
              await res.json()

            console.warn(
  data.error ??
    "No se pudo guardar la cuenta."
)

            return
          }

          const data =
            await res.json()

          const nuevaCuenta =
            data.cuenta ?? c

          setCuentas(
            (prev) =>
              prev.some(
                (x) =>
                  x.codigo ===
                  nuevaCuenta.codigo
              )
                ? prev
                : [
                    ...prev,
                    nuevaCuenta,
                  ].sort(
                    (a, b) =>
                      a.codigo.localeCompare(
                        b.codigo
                      )
                  )
          )

          return
        } catch (error) {
          console.error(
            "Error al guardar cuenta en base de datos:",
            error
          )

          return
        }
      }

      setCuentas((prev) =>
        prev.some(
          (x) =>
            x.codigo === c.codigo
        )
          ? prev
          : [
              ...prev,
              {
                ...c,
                activa: true,
              },
            ].sort(
              (a, b) =>
                a.codigo.localeCompare(
                  b.codigo
                )
            )
      )
    }

  // ============================================================
  // COMPROBAR SI UNA CUENTA TIENE MOVIMIENTOS
  // ============================================================

  const cuentaEnUso = (
    codigo: string
  ) => {
    return asientos.some(
      (a) =>
        a.lineas.some(
          (l) =>
            l.codigo === codigo
        )
    )
  }

  // ============================================================
  // MODIFICAR CUENTA
  // CÓDIGO + NOMBRE
  // ============================================================

  const renombrarCuenta =
    async (
      codigoActual: string,
      codigoNuevo: string,
      nombre: string
    ): Promise<ResultadoOperacion> => {
      const codigoLimpio =
        codigoNuevo.trim()

      const nombreLimpio =
        nombre.trim()

      // --------------------------------------------------------
      // No permitir modificar una cuenta utilizada
      // --------------------------------------------------------

      if (
        cuentaEnUso(
          codigoActual
        )
      ) {
        return {
          success: false,
          error:
            "No se puede modificar esta cuenta porque ya posee movimientos contables registrados.",
        }
      }

      // --------------------------------------------------------
      // Validar código
      // --------------------------------------------------------

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

      // --------------------------------------------------------
      // Comprobar código duplicado
      // --------------------------------------------------------

      const codigoDuplicado =
        cuentas.some(
          (c) =>
            c.codigo ===
              codigoLimpio &&
            c.codigo !==
              codigoActual
        )

      if (codigoDuplicado) {
        return {
          success: false,
          error:
            "Ya existe otra cuenta con ese código.",
        }
      }

      // --------------------------------------------------------
      // Validar nombre
      // --------------------------------------------------------

      if (!nombreLimpio) {
        return {
          success: false,
          error:
            "El nombre de la cuenta es obligatorio.",
        }
      }

      // --------------------------------------------------------
      // BASE DE DATOS
      // --------------------------------------------------------

      if (dbConnected) {
        try {
          const res =
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
                body: JSON.stringify(
                  {
                    codigo:
                      codigoLimpio,
                    nombre:
                      nombreLimpio,
                  }
                ),
              }
            )

          const data =
            await res.json()

          if (!res.ok) {
            return {
              success: false,
              error:
                data.error ??
                "No se pudo modificar la cuenta.",
            }
          }

          const cuentaActualizada =
            data.cuenta as Cuenta

          setCuentas(
            (prev) =>
              prev
                .map((c) =>
                  c.codigo ===
                  codigoActual
                    ? cuentaActualizada
                    : c
                )
                .sort(
                  (a, b) =>
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
            "Error al modificar cuenta:",
            error
          )

          return {
            success: false,
            error:
              "No se pudo conectar con la base de datos.",
          }
        }
      }

      // --------------------------------------------------------
      // MODO LOCAL
      // --------------------------------------------------------

     const naturaleza: Cuenta["naturaleza"] =
  tipo === "activo" || tipo === "gasto"
    ? "deudora"
    : "acreedora"

    setCuentas((prev) =>
  prev
    .map((c): Cuenta =>
      c.codigo === codigoActual
        ? {
            ...c,
            codigo: codigoLimpio,
            nombre: nombreLimpio,
            tipo,
            naturaleza,
          }
        : c
    )
    .sort((a, b) => a.codigo.localeCompare(b.codigo))
)

return {
  success: true,
}
    }

      
  // ============================================================
  // ELIMINAR CUENTA
  // ============================================================

  const eliminarCuenta =
    async (
      codigo: string
    ): Promise<ResultadoOperacion> => {
      // --------------------------------------------------------
      // Si tiene movimientos, NO se elimina.
      // --------------------------------------------------------

      if (
        cuentaEnUso(codigo)
      ) {
        return {
          success: false,
          error:
            "No se puede eliminar esta cuenta porque posee movimientos contables registrados.",
        }
      }

      // --------------------------------------------------------
      // BASE DE DATOS
      // --------------------------------------------------------

      if (dbConnected) {
        try {
          const res =
            await fetch(
              `/api/cuentas/${encodeURIComponent(
                codigo
              )}`,
              {
                method: "DELETE",
              }
            )

          const data =
            await res.json()

          if (!res.ok) {
            return {
              success: false,
              error:
                data.error ??
                "No se pudo eliminar la cuenta.",
            }
          }
        } catch (error) {
          console.error(
            "Error al eliminar cuenta:",
            error
          )

          return {
            success: false,
            error:
              "No se pudo conectar con la base de datos.",
          }
        }
      }

      // --------------------------------------------------------
      // QUITAR DE LA INTERFAZ
      // --------------------------------------------------------

      setCuentas(
        (prev) =>
          prev.filter(
            (c) =>
              c.codigo !==
              codigo
          )
      )

      return {
        success: true,
      }
    }

  // ============================================================
  // REACTIVAR CUENTA
  // Se conserva temporalmente para compatibilidad con la interfaz
  // actual. Después quitaremos el concepto de soft-delete.
  // ============================================================

  const reactivarCuenta =
    async (codigo: string) => {
      if (dbConnected) {
        try {
          const res =
            await fetch(
              `/api/cuentas/${encodeURIComponent(
                codigo
              )}`,
              {
                method: "PATCH",
              }
            )

          if (!res.ok) {
            console.error(
              "No se pudo reactivar la cuenta."
            )

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
          prev.map((c) =>
            c.codigo === codigo
              ? {
                  ...c,
                  activa: true,
                }
              : c
          )
      )
    }

  // ============================================================
  // REINICIAR EJEMPLO
  // ============================================================

  const reiniciarEjemplo = () => {
    setCuentas(
      CATALOGO_CUENTAS
    )

    setAsientos(
      ASIENTOS_EJEMPLO
    )
  }

  // ============================================================
  // LIMPIAR ASIENTOS
  // ============================================================

  const limpiarTodo = () => {
    setAsientos([])
  }

  // ============================================================
  // CERRAR CICLO CONTABLE
  // ============================================================

  const cerrarCicloContable =
    async () => {
      if (dbConnected) {
        try {
          const res =
            await fetch(
              "/api/cierre",
              {
                method: "POST",
              }
            )

          if (res.ok) {
            const fresh =
              await fetch(
                "/api/asientos"
              )

            if (fresh.ok) {
              setAsientos(
                await fresh.json()
              )

              return
            }
          }
        } catch (error) {
          console.error(
            "Error al invocar cierre contable en base de datos:",
            error
          )
        }
      }

      const saldos =
        calcularMayor(
          cuentas,
          asientos
        ).filter(
          (s) =>
            s.cuenta.tipo !==
              "ingreso" &&
            s.cuenta.tipo !==
              "gasto"
        )

      const utilidad =
        calcularEstadoResultados(
          calcularMayor(
            cuentas,
            asientos
          )
        ).utilidad

      const cuentaCapital =
        cuentas.find(
          (cuenta) =>
            cuenta.tipo ===
              "capital" &&
            cuenta.activa
        )

      const lineas =
        saldos
          .map((saldo) => {
            const importe =
              Math.abs(
                saldo.saldo
              )

            if (!importe) {
              return null
            }

            const esDeudora =
              saldo.cuenta
                .naturaleza ===
              "deudora"

            return {
              codigo:
                saldo.cuenta
                  .codigo,

              debe:
                esDeudora
                  ? importe
                  : 0,

              haber:
                esDeudora
                  ? 0
                  : importe,
            }
          })
          .filter(
            (
              linea
            ): linea is {
              codigo: string
              debe: number
              haber: number
            } =>
              Boolean(linea)
          )

      if (
        utilidad !== 0 &&
        cuentaCapital
      ) {
        lineas.push({
          codigo:
            cuentaCapital.codigo,

          debe:
            utilidad < 0
              ? Math.abs(
                  utilidad
                )
              : 0,

          haber:
            utilidad > 0
              ? utilidad
              : 0,
        })
      }

      const debe =
        lineas.reduce(
          (
            total,
            linea
          ) =>
            total +
            linea.debe,
          0
        )

      const haber =
        lineas.reduce(
          (
            total,
            linea
          ) =>
            total +
            linea.haber,
          0
        )

      if (
        !lineas.length ||
        Math.abs(
          debe - haber
        ) >= 0.01
      ) {
        return
      }

      setAsientos([
        {
          id:
            crypto.randomUUID(),

          numero: 1,

          fecha:
            new Date()
              .toISOString()
              .slice(
                0,
                10
              ),

          concepto:
            "Asiento de apertura del nuevo ejercicio contable",

          lineas,
        },
      ])
    }

  // ============================================================
  // CÁLCULOS CONTABLES
  // ============================================================

  const mayor =
    useMemo(
      () =>
        calcularMayor(
          cuentas,
          asientos
        ),
      [
        cuentas,
        asientos,
      ]
    )

  const estadoResultados =
    useMemo(
      () =>
        calcularEstadoResultados(
          mayor
        ),
      [mayor]
    )

  const balanceGeneral =
    useMemo(
      () =>
        calcularBalanceGeneral(
          mayor,
          estadoResultados.utilidad
        ),
      [
        mayor,
        estadoResultados.utilidad,
      ]
    )

  // ============================================================
  // CONTEXTO
  // ============================================================

  const value:
    ContabilidadContextValue =
    {
      cuentas,
      asientos,
      dbConnected,
      cargando,

      agregarAsiento,
      eliminarAsiento,

      agregarCuenta,
      renombrarCuenta,
      eliminarCuenta,
      reactivarCuenta,
      cuentaEnUso,

      reiniciarEjemplo,
      limpiarTodo,
      cerrarCicloContable,

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
  const ctx =
    useContext(
      ContabilidadContext
    )

  if (!ctx) {
    throw new Error(
      "useContabilidad debe usarse dentro de ContabilidadProvider"
    )
  }

  return ctx
}