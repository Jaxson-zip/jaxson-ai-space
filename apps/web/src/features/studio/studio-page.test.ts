import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import StudioPage from '@/app/(frontend)/studio/page'
import { extractCandidateMemories } from './memory-extractor'

interface StudioWrite {
  action: string
  content?: string
  reflection?: { date: string }
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers() })

function setup(content: string) {
  const writes: StudioWrite[] = []
  vi.stubGlobal('fetch', vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'POST') {
      writes.push(JSON.parse(String(init.body)))
      return Response.json({ success: true })
    }
    return Response.json({ success: true, reflections: [], approvedMemories: [], candidateMemories: [{
      id: 'test-memory', title: '技术复盘', content, category: 'pitfall_solution',
      status: 'candidate', evidenceTag: '测试复盘', confidence: 0.96, tags: [],
    }] })
  }))
  render(React.createElement(StudioPage))
  return writes
}

async function edit() {
  fireEvent.click(screen.getByRole('button', { name: /^候选记忆待确认/ }))
  fireEvent.click(await screen.findByRole('button', { name: '编辑' }))
}

async function save(writes: StudioWrite[]) {
  fireEvent.click(screen.getByRole('button', { name: /保存并确认私人记忆/ }))
  await waitFor(() => expect(writes).toHaveLength(1))
  return writes[0].content
}

it('preserves an extracted technical memory exactly when confirming it without edits', async () => {
  const candidate = extractCandidateMemories({
    id: 'test-reflection', title: '并发去重', type: 'technical', date: '2026-10-25',
    content: '排查并发提交产生重复数据的问题。', challenges: '并发提交重复写入。',
    solution: '使用唯一约束和事务解决重复写入，验证失败时完整回滚。',
  })[0]
  const writes = setup(candidate.content)
  await edit()
  expect(await save(writes)).toBe(candidate.content)
})

it('keeps edits when switching between structured and plain-text modes', async () => {
  const writes = setup('【难点与场景】并发提交。\n【解决手段与架构】原来的方案。')
  await edit()
  fireEvent.change(screen.getByPlaceholderText('描述采用的架构、算法、库或工程化解决方案...'), {
    target: { value: '使用幂等键避免重复提交。' },
  })
  fireEvent.click(screen.getByRole('button', { name: /自由纯文本模式/ }))
  const raw = screen.getByDisplayValue(/使用幂等键避免重复提交/) as HTMLTextAreaElement
  fireEvent.change(raw, { target: { value: '【难点与场景】修改后的场景。\n【解决手段与架构】纯文本中补充的方案。' } })
  fireEvent.click(screen.getByRole('button', { name: /结构化分段编辑/ }))
  expect((screen.getByPlaceholderText('描述业务场景背景、遇到的痛点或技术挑战...') as HTMLTextAreaElement).value).toBe('修改后的场景。')
  expect(await save(writes)).toContain('纯文本中补充的方案。')
})

it.each([
  '普通正文，包含完整的工作背景和解决方案。',
  '说明文字\n【难点与场景】背景。\n【解决手段与架构】方案。',
  '【难点与场景】背景。\n【解决手段与架构】方案。\n【验证结果】全部测试通过。',
  '【难点与场景】第一个背景。\n【难点与场景】第二个背景。',
])('uses lossless plain-text editing for content with extra structure: %s', async (content) => {
  const writes = setup(content)
  await edit()
  expect((screen.getByLabelText('事实内容（纯文本编辑）') as HTMLTextAreaElement).value).toBe(content)
  expect((screen.getByRole('button', { name: /结构化分段编辑/ }) as HTMLButtonElement).disabled).toBe(true)
  expect(await save(writes)).toBe(content)
})

it('preserves the existing solution when only its scenario is changed', async () => {
  const writes = setup('【难点与场景】原来的场景。\n【解决手段与架构】保留这段完整方案。')
  await edit()
  fireEvent.change(screen.getByPlaceholderText('描述业务场景背景、遇到的痛点或技术挑战...'), {
    target: { value: '修订的场景。' },
  })
  const saved = await save(writes)
  expect(saved).toContain('修订的场景。')
  expect(saved).toContain('保留这段完整方案。')
})

function fillReflection() {
  fireEvent.change(screen.getByPlaceholderText('例如：优化 Vue3 监控组件防抖与并发状态'), { target: { value: '测试复盘' } })
  fireEvent.change(screen.getByPlaceholderText('记录今天做了什么、交付了什么模块...'), { target: { value: '只记录测试数据，不向生产提交。' } })
}

it.each([
  ['America/Los_Angeles', '2026-10-25T00:30:00Z', '2026-10-24'],
  ['Asia/Shanghai', '2026-10-24T23:30:00Z', '2026-10-25'],
])('submits the local calendar day in %s rather than the UTC day', async (timezone, instant, expected) => {
  vi.stubEnv('TZ', timezone)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(instant))
  const writes = setup('测试')
  fillReflection()
  fireEvent.click(screen.getByRole('button', { name: /提交复盘并提炼候选记忆/ }))
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(writes[0].reflection?.date).toBe(expected)
})

it('lets the owner choose an earlier date and keeps it across a local midnight', async () => {
  vi.stubEnv('TZ', 'America/Los_Angeles')
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-25T06:59:00Z'))
  const writes = setup('测试')
  fireEvent.change(screen.getByLabelText('复盘日期'), { target: { value: '2026-10-20' } })
  vi.setSystemTime(new Date('2026-10-25T07:01:00Z'))
  fireEvent.focus(window)
  expect((screen.getByLabelText('复盘日期') as HTMLInputElement).value).toBe('2026-10-20')
  fillReflection()
  fireEvent.click(screen.getByRole('button', { name: /提交复盘并提炼候选记忆/ }))
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(writes[0].reflection?.date).toBe('2026-10-20')
})

it('advances the default date at local midnight without requiring a reload', async () => {
  vi.stubEnv('TZ', 'America/Los_Angeles')
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-25T06:59:00Z'))
  const writes = setup('测试')
  expect((screen.getByLabelText('复盘日期') as HTMLInputElement).value).toBe('2026-10-24')
  await act(async () => { await vi.advanceTimersByTimeAsync(2 * 60 * 1000) })
  expect((screen.getByLabelText('复盘日期') as HTMLInputElement).value).toBe('2026-10-25')
  fillReflection()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /提交复盘并提炼候选记忆/ })) })
  expect(writes[0].reflection?.date).toBe('2026-10-25')
})
