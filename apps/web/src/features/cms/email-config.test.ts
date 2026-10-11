import { describe, expect, it } from 'vitest'
import { getSmtpOptions } from './email-config'

describe('CMS SMTP configuration', () => {
  it('leaves email optional when no SMTP settings are supplied', () => {
    expect(getSmtpOptions({})).toBeUndefined()
  })
  it('rejects incomplete mail settings', () => {
    expect(() => getSmtpOptions({ SMTP_HOST: 'smtp.example.test' })).toThrow('SMTP_FROM_ADDRESS')
  })
  it('requires both authentication values', () => {
    expect(() => getSmtpOptions({ SMTP_HOST: 'smtp.example.test', SMTP_FROM_ADDRESS: 'owner@example.test', SMTP_USER: 'owner' })).toThrow('SMTP_USER')
  })
  it('uses STARTTLS with a bounded connection timeout on port 587', () => {
    expect(getSmtpOptions({ SMTP_HOST: 'smtp.example.test', SMTP_FROM_ADDRESS: 'owner@example.test', SMTP_PORT: '587' }))
      .toMatchObject({ transportOptions: { secure: false, requireTLS: true, connectionTimeout: 10000 } })
  })
})
