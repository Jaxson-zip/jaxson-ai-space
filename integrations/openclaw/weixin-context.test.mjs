import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { repairWeixinContext } from './weixin-context.mjs'

const source = readFileSync(new URL('./weixin-context.fixture.js', import.meta.url), 'utf8')
function context(input) {
  return new Function('bodyFromItemList', 'generateMessageSid', 'getWeixinMessageId', repairWeixinContext(source).replace('export ', '') + ';return weixinMessageToMsgContext;')(
    () => 'fp private note', () => 'generated-id', (msg) => msg.message_id,
  )(input, 'bound-account')
}
test('provider sender reaches the core SenderId field without changing account or durable message identity', () => {
  const ctx = context({ from_user_id: 'scanner', message_id: 'provider-id' })
  assert.equal(ctx.SenderId, 'scanner')
  assert.equal(ctx.From, 'scanner')
  assert.equal(ctx.AccountId, 'bound-account')
  assert.equal(ctx.MessageSidFull, 'provider-id')
  assert.equal(context({}).SenderId, '')
})
test('refuse unknown context source; patch is idempotent', () => {
  assert.throws(() => repairWeixinContext('unknown'), /Unsupported/)
  const patched = repairWeixinContext(source)
  assert.equal(repairWeixinContext(patched), patched)
})
