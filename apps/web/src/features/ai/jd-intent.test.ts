import { expect, it } from 'vitest'
import { isJobMatchRequest } from './jd-intent'

it.each(['你的实习岗位是什么？', '实习中对你有什么要求？', '你期望什么岗位？', '你是怎么找到招聘信息的？'])(
  'keeps factual questions in ordinary Q&A: %s', question => expect(isJobMatchRequest(question)).toBe(false),
)
it.each(['帮我做前端岗位匹配', '请分析这个 JD', '岗位要求：React、TypeScript', '任职要求\n熟悉前端开发', 'JD: React engineer'])(
  'recognizes a comparison or pasted description: %s', question => expect(isJobMatchRequest(question)).toBe(true),
)
