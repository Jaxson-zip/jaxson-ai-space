import type { getSmtpOptions } from './smtp-config.mjs'
interface MailTransport {
  verify(): Promise<unknown>
  sendMail(message: { from: { name: string; address: string }; to: string; subject: string; text: string }): Promise<{ accepted?: unknown[]; rejected?: unknown[] }>
  close(): void
}
export function checkSmtp(options: {
  env?: Record<string, string | undefined>
  createTransport: (options: NonNullable<ReturnType<typeof getSmtpOptions>>['transportOptions']) => MailTransport
  sendTest?: boolean
}): Promise<{ ok: boolean; stage: string; sent?: boolean; code?: string; accepted?: number }>
