import { expect, it, vi } from 'vitest'
import { checkSmtp } from '../../../scripts/lib/smtp-check.mjs'

const env = { SMTP_HOST: 'smtp.qq.com', SMTP_PORT: '465', SMTP_USER: 'owner@qq.com', SMTP_PASSWORD: 'private-fixture', SMTP_FROM_ADDRESS: 'owner@qq.com', SMTP_TEST_TO: 'owner@qq.com' }
const transport = () => ({ verify: vi.fn().mockResolvedValue(true), sendMail: vi.fn().mockResolvedValue({ accepted: ['owner@qq.com'], rejected: [] }), close: vi.fn() })

it('authenticates with validated TLS settings without sending mail by default', async () => {
  const smtp = transport(), factory = vi.fn(() => smtp)
  expect(await checkSmtp({ env, createTransport: factory })).toEqual({ ok: true, stage: 'verified', sent: false })
  expect(factory).toHaveBeenCalledWith(expect.objectContaining({ secure: true, connectionTimeout: 10000, auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }))
  expect(smtp.sendMail).not.toHaveBeenCalled()
  expect(smtp.close).toHaveBeenCalledOnce()
})

it('does not connect with incomplete authentication', async () => {
  const factory = vi.fn()
  const result = await checkSmtp({ env: { ...env, SMTP_PASSWORD: '' }, createTransport: factory })
  expect(result).toMatchObject({ ok: false, stage: 'configuration' })
  expect(factory).not.toHaveBeenCalled()
})

it('reports only a safe code on authentication failure and always closes the transport', async () => {
  const smtp = transport()
  smtp.verify.mockRejectedValue({ code: 'EAUTH', message: 'private-fixture leaked response', response: 'server secret' })
  expect(await checkSmtp({ env, createTransport: () => smtp })).toEqual({ ok: false, stage: 'authentication', code: 'EAUTH' })
  expect(smtp.close).toHaveBeenCalledOnce()
})

it('requires an explicit test flag and only sends to the configured sender', async () => {
  const smtp = transport()
  expect(await checkSmtp({ env, createTransport: () => smtp, sendTest: true })).toEqual({ ok: true, stage: 'accepted', sent: true, accepted: 1 })
  expect(smtp.sendMail).toHaveBeenCalledOnce()
  const forbidden = transport()
  expect(await checkSmtp({ env: { ...env, SMTP_TEST_TO: 'someone-else@qq.com' }, createTransport: () => forbidden, sendTest: true })).toMatchObject({ ok: false, stage: 'configuration' })
  expect(forbidden.sendMail).not.toHaveBeenCalled()
})
