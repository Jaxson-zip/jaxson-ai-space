import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const marker = '    const receivedAt = Date.now();'
const importLine = 'import { handleWeixinInbox } from "../../../../jaxson-inbox/weixin-inbox.mjs";\n'
const bridge = `    if (await handleWeixinInbox(full, deps, {
        send: sendMessageWeixin,
        messageId: getWeixinMessageId(full),
        content: extractTextBody(full.item_list),
    })) return;
`
export function routeWeixinInbox(source) {
  if (!source.includes('export async function processOneMessage(full, deps) {') || source.split(marker).length !== 2) throw new Error('Unsupported vendor source')
  const guard = '    if (!admittedSender || !admitted.includes(admittedSender)) return;'
  if (!source.includes(guard) || source.indexOf(guard) > source.indexOf(marker)) throw new Error('Owner guard required before private handler')
  if (source.includes(bridge) && source.startsWith(importLine)) return source
  return importLine + source.replace(marker, bridge + marker)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = '/opt/jaxson-openclaw/state/extensions/openclaw-weixin/dist/src/messaging/process-message.js'
  const source = readFileSync(file, 'utf8')
  // Tencent 2.4.9 after the reviewed sender-admission patch, before this bridge.
  if (createHash('sha256').update(source).digest('hex') !== 'ce296d3ef237b8505075035fae48e014c1319de08fcee9819102529654a90743') throw new Error('Unsupported guarded vendor source')
  readFileSync('/opt/jaxson-openclaw/state/extensions/jaxson-inbox/weixin-inbox.mjs')
  writeFileSync(file, routeWeixinInbox(source))
  console.log(JSON.stringify({ private_inbox_direct_path: true, plugin: '2.4.9' }))
}
