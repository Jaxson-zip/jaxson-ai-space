import test from 'node:test'
import assert from 'node:assert/strict'
import { handleWeixinInbox } from './jaxson-inbox/weixin-inbox.mjs'

process.env.JAXSON_INBOX_ONLY = 'true'
process.env.STUDIO_INBOX_ALLOWED_IDENTITIES = JSON.stringify([{ channelId: 'openclaw-weixin', accountId: 'account', senderId: 'owner' }])
process.env.SPACE_BOT_SECRET = 'test-only'
process.env.SPACE_BOT_BASE_URL = 'https://api.example.test'
const base = { from_user_id: 'owner', context_token: 'context', message_type: 1 }
const deps = { accountId: 'account', baseUrl: 'https://wechat.example.test', token: 'test-token', log() {}, errLog() {} }
const calls = []
const tools = { messageId: 'provider-id', content: '你好', send: async input => { calls.push(input) } }
test('ordinary owner text replies directly without a model or storage call', async () => {
  const fetchBefore = globalThis.fetch
  globalThis.fetch = () => { throw new Error('must not call storage') }
  try {
    calls.length = 0
    assert.equal(await handleWeixinInbox(base, deps, tools), true)
    assert.equal(calls.length, 1)
    assert.match(calls[0].text, /私人收件已就绪/)
    assert.equal(calls[0].opts.contextToken, 'context')
  } finally { globalThis.fetch = fetchBefore }
})
test('fp preserves provider identity and returns only a valid persistence receipt', async () => {
  const fetchBefore = globalThis.fetch
  let payload
  globalThis.fetch = async (_url, options) => {
    payload = JSON.parse(options.body)
    return { ok: true, json: async () => ({ success: true, reflectionId: '1', reply: '复盘已保存', extractedCount: 1 }) }
  }
  try {
    calls.length = 0
    assert.equal(await handleWeixinInbox(base, deps, { ...tools, messageId: 'fp-real-provider-id', content: 'fp 测试内容' }), true)
    assert.deepEqual(payload, { message: '测试内容', senderId: 'owner', channelId: 'openclaw-weixin', accountId: 'account', conversationId: 'owner', messageId: 'fp-real-provider-id' })
    assert.equal(calls[0].text, '复盘已保存')
  } finally { globalThis.fetch = fetchBefore }
})
test('missing stable ID refuses saving; missing context cannot write or fall through', async () => {
  calls.length = 0
  assert.equal(await handleWeixinInbox(base, deps, { ...tools, messageId: undefined, content: 'fp 内容' }), true)
  assert.match(calls[0].text, /缺少稳定身份/)
  calls.length = 0
  assert.equal(await handleWeixinInbox({ ...base, context_token: undefined }, deps, { ...tools, content: 'fp 内容' }), true)
  assert.equal(calls.length, 0)
})
test('non-owner and groups are silent and never call storage or send', async () => {
  calls.length = 0
  assert.equal(await handleWeixinInbox({ ...base, from_user_id: 'stranger' }, deps, tools), true)
  assert.equal(await handleWeixinInbox({ ...base, group_id: 'group' }, deps, tools), true)
  assert.equal(calls.length, 0)
})
test('delivery failure is handled without falling through into AI', async () => {
  assert.equal(await handleWeixinInbox(base, deps, { ...tools, send: async () => { throw new Error('network') } }), true)
})
test('disabled inbox mode preserves vendor pipeline', async () => {
  process.env.JAXSON_INBOX_ONLY = 'false'
  try { assert.equal(await handleWeixinInbox(base, deps, tools), false) }
  finally { process.env.JAXSON_INBOX_ONLY = 'true' }
})
