import { Pool } from "pg"

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined
}

export function getDbPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    return null
  }

  if (!global.__pgPool) {
    const isCloud =
      connectionString.includes("neon.tech") ||
      connectionString.includes("supabase.co") ||
      connectionString.includes("supabase.com") ||
      connectionString.includes("sslmode=require")
    const cleanConnectionString = connectionString.replace(/[\?&]sslmode=[^&]+/, "")
    global.__pgPool = new Pool({
      connectionString: cleanConnectionString,
      ssl: isCloud ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  }

  return global.__pgPool
}

export async function isDbConnected(): Promise<boolean> {
  const pool = getDbPool()
  if (!pool) return false
  try {
    const res = await pool.query("SELECT 1 AS ok")
    return res.rows.length > 0
  } catch {
    return false
  }
}
