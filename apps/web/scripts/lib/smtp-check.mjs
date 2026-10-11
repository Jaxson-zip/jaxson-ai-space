import { getSmtpOptions } from './smtp-config.mjs'

const safeCodes = new Set(['EAUTH', 'ESOCKET', 'ETIMEDOUT', 'ECONNECTION', 'ETLS', 'EENVELOPE', 'EMESSAGE'])

export async function checkSmtp({ env = process.env, createTransport, sendTest = false }) {
  let options
  try {
    options = getSmtpOptions(env)
    if (!options?.transportOptions.auth) return { ok: false, stage: 'configuration', code: 'NOT_CONFIGURED' }
    if (sendTest && env.SMTP_TEST_TO?.trim().toLowerCase() !== options.defaultFromAddress.toLowerCase()) {
      return { ok: false, stage: 'configuration', code: 'TEST_RECIPIENT_MISMATCH' }
    }
  } catch { return { ok: false, stage: 'configuration', code: 'INVALID_CONFIG' } }
  let transport
  let stage = 'authentication'
  try {
    transport = createTransport(options.transportOptions)
    await transport.verify()
    if (!sendTest) return { ok: true, stage: 'verified', sent: false }
    stage = 'send'
    const result = await transport.sendMail({
      from: { name: options.defaultFromName, address: options.defaultFromAddress },
      to: env.SMTP_TEST_TO.trim(),
      subject: 'Jaxson CMS 邮件接入测试',
      text: '这是你授权的 SMTP 接入测试邮件。收到此邮件后即可确认实际收信。此邮件不包含登录凭据。',
    })
    if (result.rejected?.length || result.accepted?.length !== 1) return { ok: false, stage, code: 'RECIPIENT_REJECTED' }
    return { ok: true, stage: 'accepted', sent: true, accepted: 1 }
  } catch (error) {
    return { ok: false, stage, code: safeCodes.has(error?.code) ? error.code : 'SMTP_FAILED' }
  } finally { transport?.close() }
}
