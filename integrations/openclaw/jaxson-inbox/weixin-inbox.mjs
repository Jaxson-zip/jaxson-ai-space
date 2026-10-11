import inbox from './index.mjs'

// Private text commands do not need OpenClaw's agent/session admission pipeline.
// Reuse the same hook so authorization, durable receipts and bounded retries stay identical.
let receive
inbox.register({ on(name, handler) { if (name === 'before_dispatch') receive = handler } })

export async function handleWeixinInbox(full, deps, tools) {
  if (process.env.JAXSON_INBOX_ONLY !== 'true') return false
  const started = Date.now()
  const senderId = full.from_user_id?.trim()
  let allowed = []
  try { allowed = JSON.parse(process.env.STUDIO_INBOX_ALLOWED_IDENTITIES || '[]') } catch {}
  const owner = Array.isArray(allowed) && allowed.some(item => item?.channelId === 'openclaw-weixin' && item.accountId === deps.accountId && item.senderId === senderId)
  if (!owner || full.group_id || full.groupId || full.isGroup === true) return true
  // No context token means there is no trustworthy reply channel. Do not save silently.
  if (typeof full.context_token !== 'string' || !full.context_token.trim()) {
    deps.errLog('private-inbox: missing reply context; not forwarded')
    return true
  }
  try {
    const content = typeof tools.content === 'string' ? tools.content : ''
    const result = content.trim()
      ? await receive({ content, isGroup: false }, {
        channelId: 'openclaw-weixin', accountId: deps.accountId,
        senderId, conversationId: senderId, messageId: tools.messageId,
      })
      : { handled: true, text: '目前仅接收文字复盘。请发送「fp 内容」；图片和文件不会自动解析或保存。' }
    if (result?.text) await tools.send({
      to: senderId, text: result.text,
      opts: { baseUrl: deps.baseUrl, token: deps.token, accountId: deps.accountId, contextToken: full.context_token, timeoutMs: 5000 },
    })
    deps.log(`private-inbox: completed elapsedMs=${Date.now() - started}`)
  } catch {
    // Persistence receipts make retries safe; failed delivery must never enter an AI fallback.
    deps.errLog('private-inbox: reply delivery failed; retry original message')
  }
  return true
}
