import { describe, expect, it } from 'vitest'
import { generate1536Vector, chunkText, processOutboxTask } from './sync-worker'

describe('Async Outbox Worker & 1536-d Vector Indexer', () => {
  it('generates exact 1536-dimensional normalized vector', () => {
    const vector = generate1536Vector('Vue3 资源监控与高并发状态同步')
    expect(vector.length).toBe(1536)

    // Verify unit vector normalization: sum(x^2) ≈ 1
    const normSquared = vector.reduce((sum, v) => sum + v * v, 0)
    expect(normSquared).toBeGreaterThan(0.99)
    expect(normSquared).toBeLessThan(1.01)
  })

  it('chunks long articles properly into multiple segments', () => {
    const longText = '段落一：关于分布式微服务。\n\n'.repeat(20)
    const chunks = chunkText(longText, 100)
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('processes outbox task and generates indexed embedding rows', () => {
    const task = {
      id: 'task-001',
      eventType: 'PROJECT_PUBLISHED' as const,
      entityId: 'proj-todo-memo',
      title: '待办备忘 (Todo Memo PWA)',
      category: 'project',
      content: '基于 React + TypeScript + Supabase + PWA 构建，覆盖登录鉴权、云端任务持久化与离线运行能力。',
      evidenceTag: 'Todo Memo GitHub 源码与线上 Demo',
      status: 'pending' as const,
      createdAt: '2026-08-30T12:00:00Z',
    }

    const rows = processOutboxTask(task)
    expect(rows.length).toBe(1)
    expect(rows[0].chunk_id).toBe('proj-todo-memo_chunk_0')
    expect(rows[0].embedding.length).toBe(1536)
    expect(rows[0].evidence_tag).toBe('Todo Memo GitHub 源码与线上 Demo')
    expect(rows[0].metadata.eventType).toBe('PROJECT_PUBLISHED')
  })
})
