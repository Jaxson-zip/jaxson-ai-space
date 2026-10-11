import assert from 'node:assert/strict'
import test from 'node:test'
import { notifyVpsFailure } from '../notify-vps-failure.mjs'

const env = {
  SMTP_HOST: 'smtp.example.test', SMTP_PORT: '465', SMTP_SECURE: 'true',
  SMTP_USER: 'sender@example.test', SMTP_PASSWORD: 'fixture-secret',
  SMTP_FROM_ADDRESS: 'sender@example.test', SMTP_FROM_NAME: 'Jaxson',
  JAXSON_OPS_ALERT_TO: 'owner@example.test',
}

test('backup failure sends one notification to the configured owner without private data', async () => {
  let message
  let closed = false
  const result = await notifyVpsFailure({
    unit: 'jaxson-vps-backup.service', env,
    createTransport: () => ({
      sendMail: async (mail) => { message = mail; return { accepted: [mail.to], rejected: [] } },
      close: () => { closed = true },
    }),
  })
  assert.deepEqual(result, { ok: true, stage: 'accepted', sent: true, accepted: 1 })
  assert.equal(message.to, 'owner@example.test')
  assert.match(message.subject, /backup failed/)
  assert.match(message.text, /jaxson-vps-backup\.service/)
  assert.doesNotMatch(JSON.stringify(message), /fixture-secret|SMTP_PASSWORD|database|production\.env/)
  assert.equal(closed, true)
})

test('unrelated services and injected unit text never trigger email', async () => {
  for (const unit of ['docker.service', 'jaxson-vps-backup-notify@jaxson-vps-backup.service.service', 'jaxson-vps-backup.service\nsecret']) {
    const result = await notifyVpsFailure({
      unit, env, createTransport: () => { throw new Error('transport must not be created') },
    })
    assert.deepEqual(result, { ok: false, stage: 'configuration', code: 'UNIT_NOT_ALLOWED', sent: false })
  }
})

test('missing or partial SMTP configuration fails safely without creating a transport', async () => {
  for (const fixture of [{}, { ...env, SMTP_PASSWORD: undefined }]) {
    const result = await notifyVpsFailure({
      unit: 'jaxson-vps-backup.service', env: fixture,
      createTransport: () => { throw new Error('transport must not be created') },
    })
    assert.equal(result.ok, false)
    assert.equal(result.stage, 'configuration')
    assert.equal(result.sent, false)
    assert.ok(['NOT_CONFIGURED', 'INVALID_CONFIG'].includes(result.code))
  }
})

test('SMTP exceptions expose no credentials and close the transport', async () => {
  let closed = false
  const result = await notifyVpsFailure({ unit: 'jaxson-vps-backup.service', env, createTransport: () => ({ sendMail: async () => { throw new Error('fixture-secret') }, close: () => { closed = true } }) })
  assert.equal(result.code, 'SMTP_FAILED')
  assert.equal(closed, true)
  assert.doesNotMatch(JSON.stringify(result), /fixture-secret/)
})

test('test delivery is always addressed to the sender and rejection is not success', async () => {
  let message
  const result = await notifyVpsFailure({ unit: 'jaxson-vps-backup.service', env, testOnly: true, createTransport: () => ({ sendMail: async (mail) => { message = mail; return { accepted: [], rejected: [mail.to] } }, close() {} }) })
  assert.equal(message.to, env.SMTP_FROM_ADDRESS)
  assert.match(message.subject, /测试/)
  assert.equal(result.code, 'NOT_ACCEPTED')
})

test('multiple recipients and header injection are rejected before transport creation', async () => {
  for (const target of ['owner@example.test,other@example.test', 'owner@example.test\r\nBcc: other@example.test']) {
    const result = await notifyVpsFailure({ unit: 'jaxson-vps-backup.service', env: { ...env, JAXSON_OPS_ALERT_TO: target }, createTransport: () => { throw new Error('must not create transport') } })
    assert.equal(result.code, 'INVALID_RECIPIENT')
  }
})
