/** Incremental SSE framing; a trailing, unfinished frame is never a completion event. */
export class SSEParser {
  private decoder = new TextDecoder()
  private buffer = ''
  private event = ''
  private data: string[] = []

  push(bytes: Uint8Array): { event: string; data: string }[] {
    this.buffer += this.decoder.decode(bytes, { stream: true })
    const events: { event: string; data: string }[] = []
    let newline: number
    while ((newline = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newline).replace(/\r$/, '')
      this.buffer = this.buffer.slice(newline + 1)
      if (!line) {
        if (this.data.length) events.push({ event: this.event || 'message', data: this.data.join('\n') })
        this.event = ''
        this.data = []
      } else if (!line.startsWith(':')) {
        const colon = line.indexOf(':')
        const field = colon === -1 ? line : line.slice(0, colon)
        const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '')
        if (field === 'event') this.event = value
        if (field === 'data') this.data.push(value)
      }
    }
    if (this.buffer.length + this.data.reduce((sum, line) => sum + line.length, 0) > 65536) {
      throw new Error('SSE frame exceeds the stream budget')
    }
    return events
  }
}
