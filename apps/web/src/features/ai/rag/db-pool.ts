import pg from 'pg'

declare global {
  var __jaxson_pg_pools: Map<string, pg.Pool> | undefined
}

const pools = globalThis.__jaxson_pg_pools ?? new Map<string, pg.Pool>()
if (!globalThis.__jaxson_pg_pools) {
  globalThis.__jaxson_pg_pools = pools
}

export interface PgPoolOptions {
  max?: number
  idleTimeoutMillis?: number
  connectionTimeoutMillis?: number
}

/**
 * Get or create a persistent, singleton pg.Pool for the given connection string.
 * This prevents creating and tearing down connection pools on every request.
 */
export function getPgPool(connectionString: string, options?: PgPoolOptions): pg.Pool {
  let pool = pools.get(connectionString)

  if (!pool) {
    const max = options?.max ?? (process.env.PG_POOL_MAX ? parseInt(process.env.PG_POOL_MAX, 10) : 10)
    const idleTimeoutMillis = options?.idleTimeoutMillis ?? 30000
    const connectionTimeoutMillis = options?.connectionTimeoutMillis ?? 3000

    pool = new pg.Pool({
      connectionString,
      max,
      idleTimeoutMillis,
      connectionTimeoutMillis,
    })

    // Prevent uncaught idle client errors from crashing the Node.js process
    pool.on('error', (err) => {
      console.error('[db-pool] Unexpected error on idle PostgreSQL client:', err)
    })

    pools.set(connectionString, pool)
  }

  return pool
}

/**
 * Cleanly close all managed pools (used in tests or server shutdown)
 */
export async function closeAllPgPools(): Promise<void> {
  const closePromises: Promise<void>[] = []
  for (const [key, pool] of pools.entries()) {
    closePromises.push(
      pool.end().catch((err) => {
        console.warn(`[db-pool] Error ending pool for ${key}:`, err)
      })
    )
  }
  pools.clear()
  await Promise.all(closePromises)
}
