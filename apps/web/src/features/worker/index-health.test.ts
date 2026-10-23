import { describe, expect, it, vi } from 'vitest'
import { MAX_ATTEMPTS, markTaskFailed, readIndexHealth } from '../../../scripts/lib/index-health.mjs'

describe('index worker failures are visible', () => {
  const task = { id: '41', entity_id: 'proj-todo-memo', attempts: 2 }

  it('reschedules a failed attempt and logs which task failed and why', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] })
    const log = vi.fn()
    await markTaskFailed({ query }, task, new Error('embedding timeout'), log)
    expect(query).toHaveBeenCalledWith(expect.stringContaining("WHEN attempts >= $3 THEN 'failed'"), ['41', 'embedding timeout', MAX_ATTEMPTS])
    expect(log).toHaveBeenCalledWith(expect.stringContaining('task 41 (proj-todo-memo) failed, attempt 2/5: embedding timeout'))
  })

  it('says loudly when a task gives up', async () => {
    const log = vi.fn()
    await markTaskFailed({ query: vi.fn().mockResolvedValue({ rows: [] }) }, { ...task, attempts: MAX_ATTEMPTS }, 'bad vector', log)
    expect(log.mock.calls.map(([line]) => line).join('\n')).toMatch(/gave up on task 41 .*--health/)
  })
})

describe('index health report', () => {
  const db = (rows: Record<string, unknown>) => ({ query: vi.fn().mockResolvedValue({ rows: [rows] }) })

  it('is healthy with nothing failed and nothing waiting long', async () => {
    const report = await readIndexHealth(db({ pending: 1, processing: 0, failed: 0, oldest_pending_seconds: 3, last_error: null }))
    expect(report).toEqual({ ok: true, pending: 1, processing: 0, failed: 0, oldestPendingSeconds: 3, lastError: null, problems: [] })
  })

  it('reports failed tasks and a stuck queue', async () => {
    const report = await readIndexHealth(db({ pending: '4', processing: '0', failed: '2', oldest_pending_seconds: '900', last_error: 'embedding timeout' }))
    expect(report.ok).toBe(false)
    expect(report.problems).toEqual(['2 个索引任务已放弃（重试 5 次仍失败）', '最早的待处理任务已等待 900 秒'])
    expect(report.lastError).toBe('embedding timeout')
  })
})
