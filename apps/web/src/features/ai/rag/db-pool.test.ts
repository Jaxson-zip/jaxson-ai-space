import { describe, expect, it, afterEach } from 'vitest'
import { getPgPool, closeAllPgPools } from './db-pool'

describe('Database Connection Pool Singleton Manager', () => {
  afterEach(async () => {
    await closeAllPgPools()
  })

  it('reuses the same pool instance for identical connection strings', () => {
    const connStr = 'postgresql://user:pass@localhost:5432/test_db_1'
    const poolA = getPgPool(connStr)
    const poolB = getPgPool(connStr)

    expect(poolA).toBe(poolB)
  })

  it('creates distinct pools for different connection strings', () => {
    const connStr1 = 'postgresql://user:pass@localhost:5432/test_db_1'
    const connStr2 = 'postgresql://user:pass@localhost:5432/test_db_2'

    const poolA = getPgPool(connStr1)
    const poolB = getPgPool(connStr2)

    expect(poolA).not.toBe(poolB)
  })

  it('correctly closes all pools and clears the registry', async () => {
    const connStr = 'postgresql://user:pass@localhost:5432/test_db_clear'
    const pool = getPgPool(connStr)
    expect(pool).toBeDefined()

    await closeAllPgPools()

    // After closing, requesting the pool again should create a fresh instance
    const newPool = getPgPool(connStr)
    expect(newPool).not.toBe(pool)
  })
})
