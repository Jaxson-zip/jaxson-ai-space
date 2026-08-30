/**
 * Jaxson Unified Multi-Intent WeChat Hook for OpenClaw
 * 
 * Routes incoming WeChat messages between:
 * 1. Jaxson AI Space Studio (Reflection & Candidate Memory Pipeline)
 * 2. Todo Memo Bot (Task Management & Reminders)
 */

interface OpenClawContext {
  channelId?: string
  channel?: string
  content?: string
  text?: string
  message?: string
  from?: string
  senderId?: string
  metadata?: Record<string, any>
}

interface OpenClawEvent {
  context?: OpenClawContext
  messages?: string[]
}

// In-memory cache for one-click correction ("转复盘" / "转待办") with TTL & Capacity Cap
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes
const MAX_CACHE_ENTRIES = 1000
const lastUserMessageMap = new Map<string, { text: string; routedTo: 'todo' | 'studio'; timestamp: number }>()

function setCachedMessage(senderId: string, entry: { text: string; routedTo: 'todo' | 'studio' }) {
  const now = Date.now()
  // Clean up expired items if map grows large
  if (lastUserMessageMap.size >= MAX_CACHE_ENTRIES) {
    for (const [key, val] of lastUserMessageMap.entries()) {
      if (now - val.timestamp > CACHE_TTL_MS) {
        lastUserMessageMap.delete(key)
      }
    }
    // If still at cap, evict oldest
    if (lastUserMessageMap.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = lastUserMessageMap.keys().next().value
      if (oldestKey) lastUserMessageMap.delete(oldestKey)
    }
  }
  lastUserMessageMap.set(senderId, { ...entry, timestamp: now })
}

function getCachedMessage(senderId: string) {
  const item = lastUserMessageMap.get(senderId)
  if (!item) return null
  if (Date.now() - item.timestamp > CACHE_TTL_MS) {
    lastUserMessageMap.delete(senderId)
    return null
  }
  return item
}

export default async function handleUnifiedWechatMessage(event: OpenClawEvent) {
  if (!Array.isArray(event.messages)) event.messages = []
  const context = event?.context ?? {}

  const text = firstString(context.content, context.text, context.message, context.metadata?.content)
  if (!text) return

  const senderId = getSenderId(context) || 'default-user'

  try {
    const trimmed = text.trim()

    // 0. Handle One-Click Correction ("转复盘" / "转待办")
    if (trimmed === '转复盘' || trimmed === '转为复盘') {
      const last = getCachedMessage(senderId)
      if (last && last.text) {
        const reply = await forwardToStudioInbox({ senderId, text: last.text })
        event.messages.push(`🔄 【已撤回并转存至复盘库】\n\n${reply}`)
        return
      }
    }

    if (trimmed === '转待办' || trimmed === '转为待办') {
      const last = getCachedMessage(senderId)
      if (last && last.text) {
        const reply = await forwardToTodoBot({ senderId, text: last.text })
        event.messages.push(`🔄 【已撤回并转存至待办备忘】\n\n${reply}`)
        return
      }
    }

    // 1. Tier 1: Explicit Prefix Matching (100% Deterministic)
    if (/^(fp|复盘|总结|心得|踩坑|经验|学习)[\s:：,，]+/i.test(trimmed)) {
      setCachedMessage(senderId, { text: trimmed, routedTo: 'studio' })
      const reply = await forwardToStudioInbox({ senderId, text: trimmed })
      if (reply) event.messages.push(reply)
      return
    }

    if (/^(td|待办|提醒|todo|备忘)[\s:：,，]+/i.test(trimmed)) {
      setCachedMessage(senderId, { text: trimmed, routedTo: 'todo' })
      const reply = await forwardToTodoBot({ senderId, text: trimmed })
      if (reply) event.messages.push(reply)
      return
    }

    // 2. Tier 2: Semantic Structure & Time Signals
    const isReflectionPattern =
      trimmed.length > 35 ||
      /(遇到[了过]|踩坑|解决[了过]|优化了|重构了|方案是|架构|代码|报错|上线|交付|实习)/i.test(trimmed)

    const isTodoPattern =
      /(明天|后天|今天|周[一二三四五六日天]|点|分|半小时|买|去|交|提醒|别忘|记得)/i.test(trimmed)

    if (isReflectionPattern && !isTodoPattern) {
      setCachedMessage(senderId, { text: trimmed, routedTo: 'studio' })
      const reply = await forwardToStudioInbox({ senderId, text: trimmed })
      if (reply) event.messages.push(reply)
      return
    }

    // Default: Route to Todo Bot
    setCachedMessage(senderId, { text: trimmed, routedTo: 'todo' })
    const reply = await forwardToTodoBot({ senderId, text: trimmed })
    if (reply) event.messages.push(reply)
  } catch (error: any) {
    console.error('[unified-wechat-hook] error dispatching message:', error)
    event.messages.push('消息处理遇到微小波动，请稍后再试一次。')
  }
}

export async function onMessageReceived(event: OpenClawEvent) {
  return handleUnifiedWechatMessage(event)
}

/**
 * Forward to Jaxson AI Space Studio Inbox API
 */
async function forwardToStudioInbox(payload: { senderId: string; text: string }): Promise<string> {
  const baseUrl = (process.env.SPACE_BOT_BASE_URL || 'http://127.0.0.1:3000').replace(/\/+$/g, '')
  const secret = process.env.SPACE_BOT_SECRET || process.env.STUDIO_INBOX_SECRET || 'jaxson_studio_secret_2026'

  const response = await fetch(`${baseUrl}/api/studio/inbox`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-studio-token': secret,
    },
    body: JSON.stringify({ message: payload.text, senderId: payload.senderId }),
  })

  const data = await response.json().catch(() => ({}))
  return typeof data.reply === 'string' ? data.reply : '🧠 复盘已成功录入待确认看板！'
}

/**
 * Forward to Todo Bot API
 */
async function forwardToTodoBot(payload: { senderId: string; text: string }): Promise<string> {
  const baseUrl = (process.env.TODO_BOT_BASE_URL || 'http://127.0.0.1:8787').replace(/\/+$/g, '')
  const secret = process.env.TODO_BOT_SECRET || ''

  const response = await fetch(`${baseUrl}/api/bot/message`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-bot-secret': secret,
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))
  const replyText = typeof data.reply === 'string' ? data.reply.trim() : ''
  return replyText ? `${replyText}\n\n(若想转为复盘，回复「转复盘」)` : ''
}

function getSenderId(context: OpenClawContext): string {
  const metadata = context.metadata ?? {}
  return firstString(
    metadata.senderId,
    metadata.userId,
    metadata.openid,
    context.from,
    context.senderId
  )
}

function firstString(...values: any[]): string {
  for (const val of values) {
    if (typeof val === 'string' && val.trim()) {
      return val.trim()
    }
  }
  return ''
}
