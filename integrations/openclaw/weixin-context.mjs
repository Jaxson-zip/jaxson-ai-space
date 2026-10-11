import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export function repairWeixinContext(source) {
  const marker = '        From: from_user_id,\n'
  if (!source.includes('export function weixinMessageToMsgContext(msg, accountId, opts) {') || source.split(marker).length !== 2) throw new Error('Unsupported vendor context source')
  const corrected = marker + '        SenderId: from_user_id,\n'
  if (source.includes(corrected)) return source
  return source.replace(marker, corrected)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = '/opt/jaxson-openclaw/state/extensions/openclaw-weixin/dist/src/messaging/inbound.js'
  const source = readFileSync(file, 'utf8')
  const digest = createHash('sha256').update(source).digest('hex')
  if (digest !== 'f33a06a9641e8a34224017fd02d715d50a898b5784df0e2cfb401292f446030f') throw new Error('Unsupported Weixin inbound source')
  writeFileSync(file, repairWeixinContext(source))
  console.log(JSON.stringify({ sender_context_patched: true, plugin: '2.4.9' }))
}
