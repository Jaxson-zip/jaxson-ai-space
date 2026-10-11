import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gateWeixinSource } from './weixin-admission.mjs'
import { routeWeixinInbox } from './weixin-inbox-path.mjs'

const vendor = readFileSync(new URL('./weixin-entry.fixture.js', import.meta.url), 'utf8')
test('private handler runs after sender guard and before vendor commands/media/session', async () => {
  const patched = routeWeixinInbox(gateWeixinSource(vendor))
  assert.equal(routeWeixinInbox(patched), patched)
  let calls = 0
  const begin = patched.indexOf('export async function processOneMessage')
  const end = patched.indexOf('    const receivedAt = Date.now();', begin)
  const entry = new Function('readFrameworkAllowFromList', 'loadWeixinAccount', 'handleWeixinInbox', 'sendMessageWeixin', 'getWeixinMessageId', 'extractTextBody', 'logger', patched.slice(begin, end).replace('export ', '') + 'return "VENDOR"; } return processOneMessage;')(
    () => ['owner'], () => ({ userId: 'owner' }), async () => { calls++; return true }, () => {}, () => 'provider', () => 'fp 内容', { error() {} },
  )
  assert.equal(await entry({ from_user_id: 'stranger' }, { channelRuntime: {}, accountId: 'account' }), undefined)
  assert.equal(calls, 0)
  assert.equal(await entry({ from_user_id: 'owner' }, { channelRuntime: {}, accountId: 'account' }), undefined)
  assert.equal(calls, 1)
})
test('unexpected or unguarded vendor entry cannot acquire fast path', () => {
  assert.throws(() => routeWeixinInbox(vendor), /guard/)
  assert.throws(() => routeWeixinInbox('unexpected'), /Unsupported/)
})
