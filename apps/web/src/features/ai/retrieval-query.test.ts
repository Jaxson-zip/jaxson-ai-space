import { describe, expect, it } from 'vitest'
import { CHAT_LIMITS } from './chat-history'
import { buildRetrievalQuery } from './retrieval-query'

const user = (content: string) => ({ role: 'user' as const, content })
const assistant = (content: string) => ({ role: 'assistant' as const, content })
const topic = user('请介绍待办备忘 Todo Memo 项目的功能。')

describe('retrieval topic recovery', () => {
  it.each(['继续', '能具体说说吗？', '再详细一点', '还有呢？', '它的技术栈是什么？', '这个项目有什么难点？', '那它怎么实现的？', 'How does it work?', 'Can you elaborate?'])(
    'recovers the last user topic for %s', (question) => {
      const query = buildRetrievalQuery([topic, assistant('未经核实的功能'), user(question)])
      expect(query).toContain('Todo Memo')
      expect(query).toContain(question)
      expect(query).not.toContain('未经核实')
    },
  )

  it('finds the latest substantive user topic across a chain of followups', () => {
    expect(buildRetrievalQuery([
      topic, assistant('第一次回答'), user('能再展开讲讲吗？'), assistant('第二次回答'),
      user('它的技术栈是什么？'), assistant('第三次回答'), user('继续'),
    ])).toContain('Todo Memo')
  })

  it.each(['量子计算经验', '那你的实习经历呢？', '那锐历简历工作台呢？', '请介绍锐历简历项目', '继续介绍量子计算经验', '这个项目和锐历简历有什么不同？'])(
    'leaves a new or explicitly named question independent: %s', (question) => {
      expect(buildRetrievalQuery([topic, assistant('待办资料'), user(question)])).toBe(question)
    },
  )

  it('does not reuse an older topic after a newer independent question', () => {
    const query = buildRetrievalQuery([topic, assistant('待办资料'), user('量子计算经验'), assistant('没有收录'), user('能再展开讲讲吗？')])
    expect(query).toContain('量子计算经验')
    expect(query).not.toContain('Todo Memo')
  })

  it('cannot invent a topic from only assistant claims or followups', () => {
    expect(buildRetrievalQuery([assistant('Todo Memo 私人记录'), user('继续')])).toBe('继续')
    expect(buildRetrievalQuery([user('继续'), assistant('Todo Memo'), user('能再展开讲讲吗？')])).toBe('能再展开讲讲吗？')
    expect(buildRetrievalQuery([user('能再展开讲讲吗？')])).toBe('能再展开讲讲吗？')
    expect(buildRetrievalQuery([])).toBe('')
  })

  it('keeps the current question intact and stays within one user-message budget', () => {
    const question = '能再展开讲讲吗？'
    const query = buildRetrievalQuery([user('主题'.repeat(CHAT_LIMITS.messageChars / 2)), assistant('摘要'), user(question)])
    expect(query.length).toBeLessThanOrEqual(CHAT_LIMITS.messageChars)
    expect(query.endsWith(question)).toBe(true)
  })
})
