import test from 'node:test'
import assert from 'node:assert/strict'
import { runReminderCycle } from './reminders.mjs'
import inbox from './index.mjs'

const identity = { channelId: 'openclaw-weixin', accountId: 'account', senderId: 'owner' }
const delivery = { itemId: '11111111-1111-4111-8111-111111111111', claimToken: '22222222-2222-4222-8222-222222222222', reminderAt: '2026-10-10T01:00:00.000Z', recipientId: 'owner', text: '待办提醒：测试' }
function fixture() {
  const rows = new Map(), calls = []
  return { calls, rows, options: { identity, since: '2026-10-10T00:00:00.000Z', offset: 0,
    store: { claim(key, fingerprint) { const row = rows.get(key); if (row) return row.fingerprint !== fingerprint ? { status: 'conflict' } : row; rows.set(key, { fingerprint, status: 'uncertain' }); return { status: 'claimed' } },
      finish(key, fingerprint, result) { rows.set(key, { fingerprint, status: 'completed', result }) }, uncertain() {} },
    transport: { async ready() { return async () => { calls.push('send') } } },
    async queue(body) { calls.push(body.action); return body.action === 'claim' ? { bound: true, deliveries: [delivery], nextOffset: 0 } : { acknowledged: true } },
  } }
}
test('missing login or reply context does not claim reminders', async () => {
  const { options, calls } = fixture(); options.transport.ready = async () => null
  await runReminderCycle(options); assert.deepEqual(calls, [])
})
test('sends once and acknowledges, a later lease only repeats acknowledgement', async () => {
  const { options, calls } = fixture()
  await runReminderCycle(options); await runReminderCycle(options)
  assert.deepEqual(calls, ['claim', 'send', 'ack', 'claim', 'ack'])
})
test('failed acknowledgement preserves sent receipt and never resends', async () => {
  const { options, calls } = fixture(); const queue = options.queue
  options.queue = async body => { if (body.action === 'ack') { calls.push('ack-failed'); throw new Error('timeout') }; return queue(body) }
  await runReminderCycle(options)
  options.queue = queue
  await runReminderCycle(options)
  assert.deepEqual(calls, ['claim', 'send', 'ack-failed', 'claim', 'ack'])
})
test('uncertain send is not retried or acknowledged', async () => {
  const { options, calls } = fixture()
  options.transport.ready = async () => async () => { calls.push('send-failed'); throw new Error('timeout') }
  await runReminderCycle(options); await runReminderCycle(options)
  assert.deepEqual(calls, ['claim', 'send-failed', 'claim'])
})
test('foreign recipient and malformed batches cannot send', async () => {
  const { options, calls } = fixture()
  options.queue = async () => ({ deliveries: [{ ...delivery, recipientId: 'someone-else' }] })
  await assert.rejects(runReminderCycle(options)); assert.deepEqual(calls, [])
})
test('direct receive adapter does not start a second native reminder service', () => {
  const previous = process.env.TODO_REMINDERS_ENABLED
  process.env.TODO_REMINDERS_ENABLED = 'true'
  let services = 0, hooks = 0
  try {
    inbox.register({ on() { hooks++ } })
    inbox.register({ on() { hooks++ }, registerService() { services++ } })
    assert.equal(services, 1); assert.equal(hooks, 2)
  } finally {
    if (previous === undefined) delete process.env.TODO_REMINDERS_ENABLED
    else process.env.TODO_REMINDERS_ENABLED = previous
  }
})
