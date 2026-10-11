import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { gateWeixinSource } from './weixin-admission.mjs'

// Execute the real vendor entry before any command/media processing.
const source = readFileSync(new URL('./weixin-entry.fixture.js', import.meta.url), 'utf8')
function entry(patched, allow, scanner) {
  const start = patched.indexOf('export async function processOneMessage(full, deps) {')
  const stop = patched.indexOf('const receivedAt = Date.now();', start)
  const body = patched.slice(start, stop).replace('export ', '') + 'return "PROCESS"; } return processOneMessage;'
  return new Function('readFrameworkAllowFromList', 'loadWeixinAccount', 'logger', body)(() => allow, () => ({ userId: scanner }), { error() {} })
}
test('reject non-owner before slash commands, media or dispatch; reject missing owner', async () => {
  const patched = gateWeixinSource(source)
  const deps = { channelRuntime: {}, accountId: 'account' }
  assert.equal(await entry(patched, [], 'owner')({ from_user_id: 'stranger' }, deps), undefined)
  assert.equal(await entry(patched, [], undefined)({ from_user_id: 'stranger' }, deps), undefined)
  assert.equal(await entry(patched, ['owner'], 'scanner')({ from_user_id: 'scanner' }, deps), undefined)
  assert.equal(await entry(patched, ['owner'], undefined)({ from_user_id: 'owner' }, deps), 'PROCESS')
  assert.equal(await entry(patched, [], 'owner')({ from_user_id: 'owner' }, deps), 'PROCESS')
})
test('refuse unexpected vendor code and preserve an already applied guard', () => {
  assert.throws(() => gateWeixinSource('unrecognized source'), /Unsupported/)
  const patched = gateWeixinSource(source)
  assert.equal(gateWeixinSource(patched), patched)
})
