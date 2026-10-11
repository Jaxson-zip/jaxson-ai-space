import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { browserConfig } from './config.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const output = join(root, 'dist')

await mkdir(output, { recursive: true })
const html = (await readFile(join(root, 'index.html'), 'utf8'))
  .replace('<script src="./config.js"></script>', `<script>${browserConfig()}</script>`)
await writeFile(join(output, 'index.html'), html)
await cp(join(root, 'public'), output, { recursive: true })
await writeFile(join(output, 'config.js'), browserConfig())

console.log(`Portfolio built in ${output}`)
