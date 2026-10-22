type Db = { query: (sql: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> }

export const MAX_ATTEMPTS: number

export function markTaskFailed(
  db: Db,
  task: { id: string; entity_id: string; attempts: number },
  error: unknown,
  log?: (line: string) => void,
): Promise<void>

export interface IndexHealth {
  ok: boolean
  pending: number
  processing: number
  failed: number
  oldestPendingSeconds: number
  lastError: string | null
  problems: string[]
}

export function readIndexHealth(db: Db): Promise<IndexHealth>
