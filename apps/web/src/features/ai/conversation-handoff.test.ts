import { expect, it } from 'vitest'
import { readConversationSnapshot } from './conversation-handoff'
const snapshot = () => ({ draft: '继续追问', messages: [
  { id: '1', role: 'user', content: '问题' },
  { id: '2', role: 'assistant', content: '部分回答', status: 'stopped', sources: [{ tag: '项目', project: 'todo-memo' }] },
] })

it('keeps sources and stopped answers, rekeys messages and reconstructs reply relationships', () => {
  expect(readConversationSnapshot(snapshot())).toMatchObject({ draft: '继续追问', messages: [
    { id: 'handoff-0', role: 'user', content: '问题' },
    { id: 'handoff-1', replyTo: 'handoff-0', status: 'stopped', sources: [{ tag: '项目', project: 'todo-memo' }] },
  ] })
})
it('rejects unbounded, malformed, unpaired and still-streaming data', () => {
  expect(readConversationSnapshot(null)).toBeNull()
  expect(readConversationSnapshot({ ...snapshot(), draft: '长'.repeat(2501) })).toBeNull()
  expect(readConversationSnapshot({ ...snapshot(), messages: [snapshot().messages[0]] })).toBeNull()
  expect(readConversationSnapshot({ ...snapshot(), messages: Array(102).fill(snapshot().messages[0]) })).toBeNull()
  for (const patch of [{ status: 'streaming' }, { content: '长'.repeat(24001) }, { sources: [{ tag: 2 }] }, { evidence: ['长'.repeat(501)] }]) {
    const state = snapshot()
    Object.assign(state.messages[1], patch)
    expect(readConversationSnapshot(state)).toBeNull()
  }
})
