import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const marker = '    const receivedAt = Date.now();'
const guard = `    // Jaxson: fail closed before vendor slash commands or media processing.
    const admittedSender = full.from_user_id?.trim();
    const approved = readFrameworkAllowFromList(deps.accountId);
    const scannerId = loadWeixinAccount(deps.accountId)?.userId?.trim();
    const admitted = approved.length ? approved : (scannerId ? [scannerId] : []);
    if (!admittedSender || !admitted.includes(admittedSender)) return;
`
export function gateWeixinSource(source) {
  if (!source.includes('export async function processOneMessage(full, deps) {') || source.split(marker).length !== 2) throw new Error('Unsupported vendor source')
  if (source.includes(guard)) return source
  return source.replace(marker, guard + marker)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = '/opt/jaxson-openclaw/state/extensions/openclaw-weixin/dist/src/messaging/process-message.js'
  const source = readFileSync(file, 'utf8')
  const digest = createHash('sha256').update(source).digest('hex')
  if (digest !== process.env.JAXSON_WEIXIN_SOURCE_SHA256) throw new Error('Vendor source integrity mismatch; gateway remains stopped')
  writeFileSync(file, gateWeixinSource(source))
  const manifest = '/opt/jaxson-openclaw/state/extensions/openclaw-weixin/package.json'
  const pkg = JSON.parse(readFileSync(manifest, 'utf8'))
  if (pkg.version !== '2.4.9') throw new Error('Unexpected plugin version')
  pkg.openclaw.extensions = ['./dist/index.js']
  writeFileSync(manifest, JSON.stringify(pkg, null, 2) + '\n')
  console.log(JSON.stringify({ guarded: true, plugin: '2.4.9', gateway_started: false }))
}
