export const MAX_ACTIVE_CHATS = 8
let active = 0

export function acquireChatSlot(): (() => void) | undefined {
  if (active >= MAX_ACTIVE_CHATS) return
  active++
  let released = false
  return () => { if (!released) { released = true; active-- } }
}

export function trackChatStream(body: ReadableStream<Uint8Array>, release: () => void, signal: AbortSignal) {
  const reader = body.getReader()
  let cancelled = false
  const finish = () => { signal.removeEventListener('abort', abort); release() }
  const abort = () => { finish(); void reader.cancel().catch(() => {}) }
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) abort()
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) { finish(); reader.releaseLock(); if (!cancelled) controller.close() }
        else if (!cancelled) controller.enqueue(value)
      } catch (error) { finish(); reader.releaseLock(); if (!cancelled) controller.error(error) }
    },
    async cancel(reason) { cancelled = true; finish(); await reader.cancel(reason).catch(() => {}); reader.releaseLock() },
  })
}
