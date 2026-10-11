import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareCinematicHtml } from './prepare-cinematic-html.mjs'

const source = process.argv[2] || process.env.CINEMATIC_SOURCE_DIR

if (!source) {
  console.error('Usage: pnpm sync:cinematic <source-directory>')
  process.exit(1)
}

const files = [
  'jaxson_studio_wall_plate_v2.png',
  'pure_studio_wall_1080p.jpg',
  'jaxson_bio_gesture_matched_v2.png',
  'jaxson_character_olive_v1.png',
  'nutrinet-cover.svg',
  'portfolio-actual-20260928.png',
  'ruili-cover.svg',
  'todo-memo-cover.png',
  'project-dossier-cover.svg',
]

const output = resolve(dirname(fileURLToPath(import.meta.url)), '../../portfolio')
const publicOutput = join(output, 'public')

await Promise.all(['jaxson_biaoge_restart.html', ...files].map((file) => access(join(source, file))))
await mkdir(publicOutput, { recursive: true })

const html = prepareCinematicHtml(await readFile(join(source, 'jaxson_biaoge_restart.html'), 'utf8'))

await writeFile(join(output, 'index.html'), html)
await Promise.all(files.map((file) => copyFile(join(source, file), join(publicOutput, file))))

console.log(`Synced portfolio page and ${files.length} assets to ${output}`)
