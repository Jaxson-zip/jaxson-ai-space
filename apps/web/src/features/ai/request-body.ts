export const CHAT_BODY_BYTES = 65536
export class ChatBodyError extends Error {
  constructor(public status: 400 | 413) { super(status === 413 ? 'Request body too large' : 'Invalid JSON body') }
}

/** Bound actual bytes, including chunked requests and fields the schema would discard. */
export async function readChatBody(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > CHAT_BODY_BYTES) throw new ChatBodyError(413)
  if (!request.body) throw new ChatBodyError(400)
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let text = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > CHAT_BODY_BYTES) { await reader.cancel().catch(() => {}); throw new ChatBodyError(413) }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
  } finally { reader.releaseLock() }
  try { return JSON.parse(text) } catch { throw new ChatBodyError(400) }
}
