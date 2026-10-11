import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { ReceiptStore } from './receipts.mjs'

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'todo-receipts-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return join(dir, 'private', 'receipts.sqlite')
}

test('completed receipt survives another process without claiming again', t => {
  const path = fixture(t)
  const store = new ReceiptStore(path)
  assert.equal(store.claim('message', 'content').status, 'claimed')
  store.finish('message', 'content', { handled: true, text: 'saved' })
  store.close()
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { ReceiptStore } from ${JSON.stringify(new URL('./receipts.mjs', import.meta.url).href)};
    const store = new ReceiptStore(process.argv[1]);
    console.log(JSON.stringify(store.claim('message', 'content'))); store.close();
  `, path], { encoding: 'utf8' })
  assert.equal(child.status, 0, child.stderr)
  assert.deepEqual(JSON.parse(child.stdout), { status: 'completed', result: { handled: true, text: 'saved' } })
})

test('two connections cannot claim the same message; pending never becomes retryable', t => {
  let one, two
  t.after(() => { one?.close(); two?.close() })
  const path = fixture(t)
  one = new ReceiptStore(path)
  two = new ReceiptStore(path)
  assert.equal(one.claim('message', 'content').status, 'claimed')
  assert.equal(two.claim('message', 'content').status, 'uncertain')
  assert.equal(two.claim('message', 'different').status, 'conflict')
  one.uncertain('message', 'content')
  assert.equal(two.claim('message', 'content').status, 'uncertain')
})

test('receipt cannot be replaced with another fingerprint', t => {
  let store
  t.after(() => store?.close())
  store = new ReceiptStore(fixture(t))
  store.claim('message', 'content')
  assert.throws(() => store.finish('message', 'wrong', { text: 'bad' }))
  store.finish('message', 'content', { text: 'ok' })
  assert.equal(store.claim('message', 'wrong').status, 'conflict')
})

test('unavailable receipt storage fails closed', () => {
  assert.throws(() => new ReceiptStore(''))
  assert.throws(() => new ReceiptStore(join(import.meta.filename, 'impossible.sqlite')))
})
test('actual Todo hook returns persisted reply after process restart without another HTTP request', t => {
  const path = fixture(t)
  const script = `
    import inbox from ${JSON.stringify(new URL('./index.mjs', import.meta.url).href)};
    process.env.TODO_RECEIPTS_PATH=process.argv[1];
    process.env.TODO_BOT_SECRET='test'; process.env.TODO_BOT_BASE_URL='https://todo.example';
    process.env.TODO_BOT_RESPONSE_MODE='reply-v1'; delete process.env.TODO_REMINDERS_ENABLED;
    process.env.STUDIO_INBOX_ALLOWED_IDENTITIES=JSON.stringify([{channelId:'wechat',accountId:'account',senderId:'owner'}]);
    let calls=0, receive; globalThis.fetch=async()=>{ calls++; return new Response(JSON.stringify({reply:'已创建测试'})); };
    inbox.register({on(name,fn){receive=fn}});
    const result=await receive({content:'td 测试'}, {channelId:'wechat',accountId:'account',senderId:'owner',conversationId:'owner',messageId:'stable-id'});
    console.log(JSON.stringify({calls,result}));
  `
  const run = () => {
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', script, path], { encoding: 'utf8' })
    assert.equal(child.status, 0, child.stderr)
    return JSON.parse(child.stdout)
  }
  const first = run(), second = run()
  assert.equal(first.calls, 1); assert.equal(second.calls, 0)
  assert.deepEqual(first.result, second.result)
})
