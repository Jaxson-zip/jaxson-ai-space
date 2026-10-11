import { z } from 'zod'

const identity = z.object({
  channelId: z.string().trim().min(1).max(100),
  accountId: z.string().trim().min(1).max(200),
  senderId: z.string().trim().min(1).max(200),
})
export function inboxIdentities(raw: string | undefined) {
  try {
    const result = z.array(identity).min(1).safeParse(JSON.parse(raw || '[]'))
    return result.success ? result.data : null
  } catch { return null }
}
