import { Pool } from "pg"

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined
}

export function getDbPool(): Pool | null {
  const rawConnectionString = process.env.DATABASE_URL

  if (!rawConnectionString) {
    return null
  }

  if (!global.__pgPool) {
    let connectionString = rawConnectionString

    const isSupabase =
      connectionString.includes("supabase.co") ||
      connectionString.includes("supabase.com")

    if (isSupabase) {
      const url = new URL(connectionString)

      // Quitamos sslmode de la URL porque configuraremos SSL aquí.
      url.searchParams.delete("sslmode")

      connectionString = url.toString()
    }

    global.__pgPool = new Pool({
      connectionString,

      ssl: isSupabase
        ? {
            rejectUnauthorized: false,
          }
        : false,

      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })
  }

  return global.__pgPool
}

export async function isDbConnected(): Promise<boolean> {
  const pool = getDbPool()

  if (!pool) {
    return false
  }

  try {
    const res = await pool.query("SELECT 1 AS ok")
    return res.rows.length > 0
  } catch (error) {
    console.error("Error de conexión PostgreSQL:", error)
    return false
  }
}
