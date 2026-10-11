import { createRequire } from 'node:module'
import { checkSmtp } from './lib/smtp-check.mjs'

const args = process.argv.slice(2)
if (args.some((arg) => arg !== '--send-test')) {
  console.error('Usage: node --env-file=PRIVATE_FILE scripts/check-smtp.mjs [--send-test]')
  process.exitCode = 1
} else {
  try {
    const require = createRequire(import.meta.resolve('@payloadcms/email-nodemailer'))
    const nodemailer = require('nodemailer')
    const result = await checkSmtp({ createTransport: nodemailer.createTransport, sendTest: args.includes('--send-test') })
    console.log(JSON.stringify(result))
    if (!result.ok) process.exitCode = 1
  } catch {
    console.error('SMTP checker could not start; no credentials were printed.')
    process.exitCode = 1
  }
}
