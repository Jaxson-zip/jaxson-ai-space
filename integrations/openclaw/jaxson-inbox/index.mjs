import { createHash } from 'node:crypto'
import { ReceiptStore } from './receipts.mjs'
import { registerReminderService } from './reminders.mjs'

const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const reply = (text) => ({ handled: true, text })
const TTL = 30 * 60 * 1000
const CAPACITY = 1000
const prefix = /^(fp|复盘|总结|心得|踩坑|经验|学习|td|待办|提醒|todo|备忘)[\s:：,，]+(.+)$/is

function allowedIdentities() {
  try {
    const entries = JSON.parse(process.env.STUDIO_INBOX_ALLOWED_IDENTITIES || '[]')
    return Array.isArray(entries) ? entries.filter((item) => ['channelId', 'accountId', 'senderId'].every((key) => typeof item?.[key] === 'string' && item[key].trim())) : []
  } catch { return [] }
}

function targetURL(raw, path) {
  const url = new URL(path, `${raw.replace(/\/+$/, '')}/`)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && local))) throw new Error('Invalid transport URL')
  return url
}

async function forward(input, destination) {
  const studio = destination === 'studio'
  const todoMode = process.env.TODO_BOT_RESPONSE_MODE?.trim() || 'receipt-v1'
  if (!studio && !['receipt-v1', 'reply-v1'].includes(todoMode)) throw new Error('Invalid Todo response mode')
  const secret = (studio ? process.env.SPACE_BOT_SECRET : process.env.TODO_BOT_SECRET)?.trim()
  if (!secret) throw new Error('Missing destination secret')
  const url = targetURL(studio ? (process.env.SPACE_BOT_BASE_URL || 'http://127.0.0.1:3001') : (process.env.TODO_BOT_BASE_URL || 'http://127.0.0.1:8787'), studio ? '/api/studio/inbox' : '/api/bot/message')
  const payload = studio ? input : { senderId: input.senderId, text: input.message, messageId: input.messageId }
  // Todo binding + task lookup + mutation needs several sequential database round trips.
  const timeout = studio
    ? Math.min(5000, Math.max(500, Number(process.env.JAXSON_FORWARD_TIMEOUT_MS) || 4000))
    : Math.min(15000, Math.max(1000, Number(process.env.TODO_BOT_TIMEOUT_MS) || 10000))
  // Only Studio has durable message receipts. Todo's unknown API must not be retried automatically.
  for (let attempt = 0; attempt < (studio ? 2 : 1); attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const res = await fetch(url, {
        method: 'POST', signal: controller.signal, redirect: 'error',
        headers: { 'content-type': 'application/json', [studio ? 'x-studio-token' : 'x-bot-secret']: secret },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        if (studio && attempt === 0 && [429, 502, 503, 504].includes(res.status)) continue
        return { ok: false }
      }
      const data = await res.json()
      // The existing Todo Memo API returns replies for bindings, queries and mutations alike.
      // A reply is not a durable save receipt and must never become a correction source.
      if (!studio && todoMode === 'reply-v1') {
        if (!data || data.success === false || Object.hasOwn(data, 'error') || typeof data.reply !== 'string') return { ok: false }
        return { ok: true, remember: false, text: data.reply.trim() || '微信尚未绑定待办账号。请登录 Todo 网站，在同步面板生成绑定码，再发送「td 绑定 TD-绑定码」。' }
      }
      if (data.success !== true || typeof data.reply !== 'string' || !data.reply.trim() || (studio && !data.reflectionId)) return { ok: false }
      return { ok: true, remember: true, text: data.reply.trim() }
    } catch (error) {
      if (!studio || attempt > 0) throw error
    } finally { clearTimeout(timer) }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return { ok: false }
}

export default {
  id: 'jaxson-inbox',
  name: 'Jaxson private inbox',
  register(api) {
    // The direct WeChat adapter registers only the receive hook. The native
    // plugin lifecycle is the sole owner of the reminder timer.
    if (typeof api.registerService === 'function') registerReminderService(api, allowedIdentities)
    let receipts
    const receiptStore = () => {
      const path = process.env.TODO_RECEIPTS_PATH?.trim()
      if (!path) return undefined
      return receipts ??= new ReceiptStore(path)
    }
    const recent = new Map()
    const completed = new Map()
    const pending = new Map()
    function prune(map) {
      for (const [key, value] of map) if (Date.now() - value.time > TTL) map.delete(key)
      while (map.size >= CAPACITY) map.delete(map.keys().next().value)
    }
    api.on('before_dispatch', async (event, ctx) => {
      const text = typeof event.content === 'string' ? event.content.trim() : ''
      const match = text.match(prefix)
      const correction = /^(转(?:为)?复盘|转(?:为)?待办)$/.test(text)
      const channelId = ctx.channelId || event.channel
      const inboxOnly = process.env.JAXSON_INBOX_ONLY === 'true'
      if (!['openclaw-weixin', 'wechat', 'weixin', 'wecom'].includes(channelId)) return undefined
      if (event.isGroup === true) return inboxOnly ? { handled: true } : undefined
      const senderId = ctx.senderId || event.senderId
      const accountId = ctx.accountId
      const conversationId = ctx.conversationId
      const messageId = ctx.messageId || event.messageId
      if (!match && !correction) {
        if (!inboxOnly) return undefined
        const owner = allowedIdentities().some((item) => item.channelId === channelId && item.accountId === accountId && item.senderId === senderId)
        const todoHelp = process.env.TODO_BOT_SECRET?.trim() && process.env.TODO_BOT_BASE_URL?.trim()
          ? '\n待办指令：「td 任务列表」「td 明天准备面试」。首次使用请先生成网站绑定码，发送「td 绑定 TD-绑定码」。'
          : ''
        return owner ? reply(`私人收件已就绪。发送「fp 内容」保存复盘；普通聊天不会调用 AI 或写入知识库。${todoHelp}`) : { handled: true }
      }
      if (!allowedIdentities().some((item) => item.channelId === channelId && item.accountId === accountId && item.senderId === senderId)) {
        return reply('此发送者未获私人收件授权。')
      }
      if (![senderId, accountId, conversationId, messageId].every((value) => typeof value === 'string' && value.trim())) {
        return reply('消息缺少稳定身份或消息 ID，未转发。请检查频道插件配置。')
      }
      if (text.length > 5000) return reply('消息超过 5000 字，请分段发送。')
      prune(recent); prune(completed)
      const scope = digest([channelId, accountId, conversationId, senderId])
      const key = digest([scope, messageId])
      const fingerprint = digest(text)
      const cached = completed.get(key) || pending.get(key)
      if (cached) return cached.fingerprint === fingerprint ? cached.result : reply('此消息 ID 已处理其他内容，未转发。')
      if (pending.size >= CAPACITY) return reply('收件忙碌，请稍后重试。')
      // Serialize messages in the same conversation so correction sees only successful earlier writes.
      const previous = [...pending.values()].filter((item) => item.scope === scope).map((item) => item.result)
      const result = (async () => {
        await Promise.all(previous)
        let destination = match && /^(fp|复盘|总结|心得|踩坑|经验|学习)$/i.test(match[1]) ? 'studio' : 'todo'
        let input = { message: match?.[2]?.trim(), senderId, channelId, accountId, conversationId, messageId }
        if (correction) {
          const last = recent.get(scope)
          if (!last) return reply('本会话没有最近成功保存的消息，请使用「fp 内容」或「td 内容」。')
          destination = text.includes('复盘') ? 'studio' : 'todo'
          if (last.destination === destination) return reply(`该消息已保存到此处，原记录保留。\n${last.text}`)
          input = { ...last.input, messageId: `copy-${digest([last.input.messageId, destination])}` }
        }
        let ledger
        let receiptKey
        try {
          if (destination === 'todo') {
            ledger = receiptStore()
            receiptKey = `message:${digest([scope, input.messageId])}`
            const claim = ledger?.claim(receiptKey, fingerprint)
            if (claim?.status === 'completed') return claim.result
            if (claim?.status === 'conflict') return reply('此消息 ID 已处理其他内容，未转发。')
            if (claim?.status === 'uncertain') return reply('此消息曾提交，但结果尚未确认，已停止重复提交。请在 Todo 网站核对任务。')
          }
          const saved = await forward(input, destination)
          if (!saved.ok) {
            ledger?.uncertain(receiptKey, fingerprint)
            return reply(destination === 'studio'
            ? '未确认保存：下游接口未返回有效保存回执。请检查服务及密钥后重试原消息。'
            : '未确认保存：待办接口未返回有效回复。请先在 Todo 网站检查任务是否已收到，再决定是否重发。')
          }
          if (saved.remember) recent.set(scope, { input, destination, text: saved.text, time: Date.now() })
          const response = reply(`${correction && saved.remember ? '已另存，原记录保留。\n' : ''}${saved.text}`)
          ledger?.finish(receiptKey, fingerprint, response)
          completed.set(key, { fingerprint, result: response, time: Date.now() })
          return response
        } catch {
          try { ledger?.uncertain(receiptKey, fingerprint) } catch { /* fail closed */ }
          return reply('未确认保存：请求失败或超时。复盘可重试原消息；待办请先检查目标系统是否已收到，避免重复。')
        }
      })()
      pending.set(key, { fingerprint, result, scope })
      try { return await result } finally { pending.delete(key) }
    })
  },
}
