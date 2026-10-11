import { describe, expect, it, vi } from 'vitest'
import { isLatestIndexTask } from '../../../scripts/lib/index-task-state.mjs'

describe('production index retry ordering', () => {
  it('rejects an older publication after a newer withdrawal event exists', async () => {
    const client = { query: vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 'withdrawal' }] }) }
    expect(await isLatestIndexTask(client, { id: 'old-publication', entity_id: 'knowledge-123' })).toBe(false)
    expect(client.query.mock.calls[1][1]).toEqual(['knowledge-123'])
  })

  it('accepts the latest event after acquiring the entity transaction lock', async () => {
    const client = { query: vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 'latest-event' }] }) }
    expect(await isLatestIndexTask(client, { id: 'latest-event', entity_id: 'proj-test' })).toBe(true)
    expect(client.query.mock.calls[0][0]).toContain('pg_advisory_xact_lock')
  })
})
