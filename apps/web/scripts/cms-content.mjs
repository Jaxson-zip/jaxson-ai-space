import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createCmsClient, exportContent, importContent } from './lib/cms-transfer.mjs'

const [command, ...args] = process.argv.slice(2)
const value = (flag) => args[args.indexOf(flag) + 1]
if (!['export', 'import'].includes(command) || !args.includes('--file') || !args.includes('--url')) {
  throw new Error('Usage: cms-content.mjs export|import --url <CMS origin> --file <archive.json> [--apply] [--update-existing]')
}
const filename = resolve(value('--file'))
const client = await createCmsClient(value('--url'), process.env.CMS_EMAIL || process.env.OWNER_EMAIL, process.env.CMS_PASSWORD || process.env.OWNER_INITIAL_PASSWORD)
if (command === 'export') {
  const archive = await exportContent(client)
  await mkdir(dirname(filename), { recursive: true, mode: 0o700 })
  await writeFile(filename, JSON.stringify(archive, null, 2), { flag: 'wx', mode: 0o600 })
  console.log(JSON.stringify({ file: filename, counts: Object.fromEntries(Object.entries(archive.records).map(([key, docs]) => [key, docs.length])), covers: archive.media.length }))
} else {
  const archive = JSON.parse(await readFile(filename, 'utf8'))
  console.log(JSON.stringify(await importContent(client, archive, { apply: args.includes('--apply'), updateExisting: args.includes('--update-existing') })))
}
