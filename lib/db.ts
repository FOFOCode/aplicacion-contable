import { Pool } from "pg"

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined
}

export function getDbPool(): Pool | null {
  const rawConnectionString =
    process.env.DATABASE_URL

  if (!rawConnectionString) {
    return null
  }

  if (!global.__pgPool) {
    let connectionString =
      rawConnectionString

    const isCloud =
      connectionString.includes(
        "supabase.co"
      ) ||
      connectionString.includes(
        "supabase.com"
      ) ||
      connectionString.includes(
        "sslmode=require"
      )

    if (isCloud) {
      try {
        const url =
          new URL(
            connectionString
          )

        url.searchParams.delete(
          "sslmode"
        )

        connectionString =
          url.toString()
      } catch {
        connectionString =
          connectionString.replace(
            /([?&])sslmode=[^&]+(&?)/,
            (_match, prefix, suffix) =>
              suffix
                ? prefix
                : ""
          )
      }
    }

    global.__pgPool =
      new Pool({
        connectionString,

        ssl: isCloud
          ? {
              rejectUnauthorized:
                false,
            }
          : false,

        max: 10,

        idleTimeoutMillis:
          30000,

        connectionTimeoutMillis:
          10000,
      })
  }

  return global.__pgPool
}

export async function isDbConnected(): Promise<boolean> {
  const pool =
    getDbPool()

  if (!pool) {
    return false
  }

  try {
    const res =
      await pool.query(
        "SELECT 1 AS ok"
      )

    return (
      res.rows.length > 0
    )
  } catch (error) {
    console.error(
      "Error de conexión PostgreSQL:",
      error
    )

    return false
  }
}