import { basename, resolve } from 'node:path'
import { getPayload } from 'payload'

// This fixture must never use the owner's development or production database.
if (process.env.PUBLIC_TEST_FIXTURE !== 'true' || process.env.NODE_ENV === 'production' ||
  process.env.USE_POSTGRES === 'true' || process.env.DATABASE_URI ||
  basename(process.env.SQLITE_DATABASE_FILE || '') !== 'payload-public-tests.db') {
  throw new Error('Refusing to seed outside the isolated public test database')
}
process.env.MEDIA_DIR ||= resolve('../../scratch/public-test-media')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })
try {
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
  const media = async (name: string) => {
    const found = await payload.find({ collection: 'media', where: { filename: { equals: name } }, limit: 1 })
    return found.docs[0] || await payload.create({ collection: 'media', data: { alt: '自动化验收用图片' }, file: { data: pixel, name, mimetype: 'image/png', size: pixel.length } })
  }
  const publicImage = await media('public-fixture.png')
  const privateImage = await media('private-fixture.png')
  for (const [slug, title, visibility, cover] of [
    ['todo-memo', '待办备忘（自动化验收样本）', 'public', publicImage.id],
    ['private-fixture', '私有自动化验收样本', 'private', privateImage.id],
  ] as const) {
    const found = await payload.find({ collection: 'projects', where: { slug: { equals: slug } }, limit: 1 })
    if (!found.docs.length) await payload.create({ collection: 'projects', data: {
      slug, title, visibility, coverImage: cover, category: '工具应用 · 原型落地',
      role: '自动化验收样本', status: '测试数据', summary: '仅用于隔离的页面自动化测试。',
      problem: '验证页面的完整展示。', approach: '使用隔离数据库和公开测试数据。', outcome: '测试页面、来源与权限。',
      tags: [{ tag: 'React' }], demoUrl: 'https://example.com', repoUrl: 'https://github.com/example/example',
    } })
  }
  console.log('Isolated public-page fixtures ready')
} finally { await payload.destroy() }
