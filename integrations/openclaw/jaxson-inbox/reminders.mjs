import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { ReceiptStore } from './receipts.mjs'

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function runReminderCycle({ identity, since, offset = 0, store, transport, queue, stopped = () => false }) {
  const send = await transport.ready(identity)
  if (!send || stopped()) return { offset, status: 'waiting-for-context' }
  const batch = await queue({ action: 'claim', senderId: identity.senderId, since, offset })
  if (!Array.isArray(batch.deliveries) || batch.deliveries.length > 5 || batch.deliveries.some(item =>
    item.recipientId !== identity.senderId || !uuid.test(item.itemId) || !uuid.test(item.claimToken) ||
    !Number.isFinite(Date.parse(item.reminderAt)) || typeof item.text !== 'string' || !item.text || item.text.length > 5000)) {
    throw new Error('Invalid reminder batch')
  }
  const counts = { sent: 0, acknowledged: 0, uncertain: 0, failed: 0 }
  for (const item of batch.deliveries) {
    if (stopped()) break
    const key = `reminder:${hash([identity, item.itemId, item.reminderAt])}`
    const fingerprint = hash(item.text)
    const claim = store.claim(key, fingerprint)
    if (claim.status === 'uncertain' || claim.status === 'conflict') { counts.uncertain++; continue }
    if (claim.status === 'claimed') {
      try {
        await send(item.text)
        store.finish(key, fingerprint, { sent: true })
        counts.sent++
      } catch {
        store.uncertain(key, fingerprint)
        counts.uncertain++
        continue
      }
    }
    try {
      const ack = await queue({ action: 'ack', senderId: identity.senderId, itemId: item.itemId, reminderAt: item.reminderAt, claimToken: item.claimToken })
      if (ack.acknowledged !== true) throw new Error('Missing acknowledgement')
      counts.acknowledged++
    } catch { counts.failed++ }
  }
  return { offset: Number.isSafeInteger(batch.nextOffset) && batch.nextOffset >= 0 ? batch.nextOffset : 0, status: batch.bound === false ? 'unbound' : 'ready', ...counts }
}

function weixinTransport(config) {
  let modules
  return { async ready(identity) {
    const root = process.env.WEIXIN_PLUGIN_ROOT || '/home/node/.openclaw/extensions/openclaw-weixin/dist/src'
    modules ??= Promise.all(['auth/accounts.js', 'messaging/inbound.js', 'messaging/send.js'].map(file => import(pathToFileURL(join(root, file)).href)))
    const [accounts, inbound, messaging] = await modules
    const account = accounts.resolveWeixinAccount(config, identity.accountId)
    let contextToken = inbound.getContextToken(identity.accountId, identity.senderId)
    if (!contextToken) {
      inbound.restoreContextTokens(identity.accountId)
      contextToken = inbound.getContextToken(identity.accountId, identity.senderId)
    }
    if (!account.token || !contextToken || account.enabled === false) return null
    return text => messaging.sendMessageWeixin({ to: identity.senderId, text, opts: {
      accountId: identity.accountId, baseUrl: account.baseUrl, token: account.token, contextToken, timeoutMs: 15000,
    } })
  } }
}

export function registerReminderService(api, identities) {
  if (process.env.TODO_REMINDERS_ENABLED !== 'true') return
  if (typeof api.registerService !== 'function') throw new Error('Native reminder service is unavailable')
  let timer, running, store, stopped = true, abort
  api.registerService({
    id: 'jaxson-todo-reminders',
    async start(ctx) {
      const owners = identities().filter(item => item.channelId === 'openclaw-weixin')
      const since = process.env.TODO_REMINDERS_SINCE
      const secret = process.env.TODO_BOT_SECRET?.trim()
      if (owners.length !== 1 || !since || !Number.isFinite(Date.parse(since)) || !secret || !process.env.TODO_RECEIPTS_PATH) throw new Error('Incomplete private reminder configuration')
      const url = new URL('/api/bot/reminder-queue', process.env.TODO_BOT_BASE_URL)
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Reminder queue requires HTTPS')
      store = new ReceiptStore(process.env.TODO_RECEIPTS_PATH)
      stopped = false
      abort = new AbortController()
      let offset = 0, lastStatus
      const transport = weixinTransport(ctx.config)
      const queue = async body => {
        const response = await fetch(url, { method: 'POST', redirect: 'error', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]),
          headers: { 'content-type': 'application/json', 'x-bot-secret': secret }, body: JSON.stringify(body) })
        if (!response.ok) throw new Error('Reminder queue request failed')
        return response.json()
      }
      const tick = () => {
        if (running || stopped) return
        running = runReminderCycle({ identity: owners[0], since, offset, store, transport, queue, stopped: () => stopped })
          .then(result => {
            offset = result.offset
            if (result.status !== lastStatus || result.sent || result.failed || result.uncertain) ctx.logger.info(`[todo-reminders] ${JSON.stringify(result)}`)
            lastStatus = result.status
          }).catch(() => { ctx.logger.warn('[todo-reminders] cycle failed; check queue and channel availability') })
          .finally(() => { running = undefined })
      }
      timer = setInterval(tick, 60_000)
      timer.unref?.()
      ctx.logger.info('[todo-reminders] scheduled every 60 seconds')
    },
    async stop() {
      stopped = true
      clearInterval(timer)
      abort?.abort()
      await running
      store?.close()
      store = undefined
    },
  })
}
