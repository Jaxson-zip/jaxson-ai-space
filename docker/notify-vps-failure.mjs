import { getSmtpOptions } from '../apps/web/scripts/lib/smtp-config.mjs'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseEnv } from 'node:util'
import { pathToFileURL } from 'node:url'

export async function notifyVpsFailure({ unit, env = process.env, createTransport, testOnly = false }) {
  if (unit !== 'jaxson-vps-backup.service') return { ok: false, stage: 'configuration', code: 'UNIT_NOT_ALLOWED', sent: false }
  let options
  try { options = getSmtpOptions(env) } catch { return { ok: false, stage: 'configuration', code: 'INVALID_CONFIG', sent: false } }
  if (!options) return { ok: false, stage: 'configuration', code: 'NOT_CONFIGURED', sent: false }
  const to = testOnly ? options.defaultFromAddress : (env.JAXSON_OPS_ALERT_TO?.trim() || options.defaultFromAddress)
  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(to)) return { ok: false, stage: 'configuration', code: 'INVALID_RECIPIENT', sent: false }
  let transport
  try {
    transport = createTransport(options.transportOptions)
    const receipt = await transport.sendMail({
      from: { name: options.defaultFromName, address: options.defaultFromAddress },
      to,
      subject: testOnly ? 'Jaxson 备份提醒测试' : 'Jaxson VPS backup failed',
      text: `${testOnly ? 'This is a notification delivery test; no backup failure was induced.' : 'The scheduled Jaxson release backup failed.'}\nUnit: ${unit}\nTime (UTC): ${new Date().toISOString()}\n\nInspect the server with: journalctl -u jaxson-vps-backup.service\nNo backup logs or credentials are included in this notification.`,
    })
    if (receipt.accepted?.length !== 1 || receipt.rejected?.length) return { ok: false, stage: 'delivery', code: 'NOT_ACCEPTED', sent: false }
    return { ok: true, stage: 'accepted', sent: true, accepted: 1 }
  } catch { return { ok: false, stage: 'delivery', code: 'SMTP_FAILED', sent: false } }
  finally { transport?.close() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2)
    if (args.length !== 1 || !['jaxson-vps-backup.service', '--send-test'].includes(args[0])) throw new Error('Invalid arguments')
    const raw = parseEnv(readFileSync('/run/jaxson/production.env', 'utf8'))
    const env = Object.fromEntries(Object.entries(raw).filter(([key]) => key.startsWith('SMTP_') || key === 'JAXSON_OPS_ALERT_TO'))
    const webRequire = createRequire('/app/apps/web/package.json')
    const require = createRequire(webRequire.resolve('@payloadcms/email-nodemailer'))
    const result = await notifyVpsFailure({ unit: 'jaxson-vps-backup.service', env, createTransport: require('nodemailer').createTransport, testOnly: args[0] === '--send-test' })
    console.log(JSON.stringify(result))
    process.exitCode = result.ok ? 0 : 1
  } catch {
    console.log(JSON.stringify({ ok: false, stage: 'configuration', code: 'NOTIFIER_SETUP_FAILED', sent: false }))
    process.exitCode = 1
  }
}
