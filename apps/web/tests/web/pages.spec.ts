import { expect, test, type Page } from '@playwright/test'

// The CMS-served public pages share the home page's cool white and cobalt design
// (apps/portfolio/index.html): same palette, header, type and touch targets.

const portfolio = 'http://localhost:3000'
const pages = [
  { name: 'AI', path: '/ai' },
  { name: 'résumé', path: '/resume' },
  { name: 'project', path: '/projects/todo-memo' },
  { name: '404', path: '/projects/does-not-exist' },
]
const desktop = { width: 1440, height: 900 }
const phone = { width: 375, height: 812 }

async function open(page: Page, path: string, viewport = desktop) {
  await page.setViewportSize(viewport)
  const response = await page.goto(path, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  return response
}

test.describe('every public page', () => {
  for (const { name, path } of pages) {
    test(`${name}: cobalt palette, shared header, local fonts only`, async ({ page }) => {
      const thirdParty: string[] = []
      page.on('request', request => { if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) thirdParty.push(request.url()) })
      await open(page, path)
      expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(243, 244, 247)')
      expect(thirdParty).toEqual([])

      const header = page.getByRole('banner')
      await expect(header.getByRole('link', { name: '张锦鹏 Jaxson' })).toHaveAttribute('href', `${portfolio}/`)
      const nav = header.getByRole('navigation', { name: '主导航' })
      for (const [label, hash] of [['作品', '#works'], ['履历', '#bio'], ['联系', '#beyond']]) {
        await expect(nav.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', `${portfolio}/${hash}`)
      }
      await expect(nav.getByRole('link', { name: '简历 PDF' })).toHaveAttribute('href', '/resume/zhang-jinpeng-ai-product-builder.pdf')
      await expect(nav.getByRole('link', { name: '问我的 AI' })).toHaveAttribute('href', '/ai')
      // The CMS root redirects to the admin login: no public link may point there.
      const rootLinks = await page.locator('a[href="/"], a[href^="/#"]').count()
      expect(rootLinks).toBe(0)
      await expect(page.locator('.site-header, .site-footer')).toHaveCount(0)
    })

    test(`${name}: no sideways scrolling, text at least 14px, touch targets at least 44px`, async ({ page }) => {
      for (const viewport of [phone, desktop]) {
        await open(page, path, viewport)
        const where = `${path} ${viewport.width}px`
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), where).toBeLessThanOrEqual(0)
        const small = await page.evaluate(() => [...document.querySelectorAll('body *')]
          .filter(el => !el.closest('nextjs-portal, [data-nextjs-toast]'))
          .filter(el => [...el.childNodes].some(node => node.nodeType === 3 && node.textContent!.trim()) && el.getBoundingClientRect().width > 0)
          .map(el => ({ size: parseFloat(getComputedStyle(el).fontSize), text: el.textContent!.trim().slice(0, 16) }))
          .filter(item => item.size < 14).map(item => `${item.size}px ${item.text}`))
        expect(small, where).toEqual([])
        const tiny = await page.evaluate(() => [...document.querySelectorAll('a, button, input')]
          .filter(el => !el.closest('nextjs-portal'))
          .filter(el => { const box = el.getBoundingClientRect(); return box.width > 0 && box.height > 0 && box.height < 44 })
          .map(el => `${Math.round(el.getBoundingClientRect().height)}px ${(el.textContent || (el as HTMLInputElement).placeholder || '').trim().slice(0, 16)}`))
        expect(tiny, where).toEqual([])
      }
    })
  }

  test('marks the current page in the header', async ({ page }) => {
    await open(page, '/ai')
    await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '问我的 AI' })).toHaveAttribute('aria-current', 'page')
  })
})

test.describe('/ai', () => {
  test('a light conversation page with the composer always on screen', async ({ page }) => {
    for (const viewport of [desktop, phone]) {
      await open(page, '/ai', viewport)
      await expect(page.getByRole('heading', { level: 1 })).toContainText('AI 分身')
      await expect(page.getByText('只引用公开资料回答')).toBeVisible()
      const field = page.getByPlaceholder('向 AI 分身提问，或直接粘贴贵司岗位 JD 需求...')
      await expect(field, JSON.stringify(viewport)).toBeInViewport({ ratio: 1 })
      const send = page.getByRole('button', { name: '发送消息' })
      await expect(send).toBeInViewport({ ratio: 1 })
      await field.fill('你会哪些技术？')
      await expect(send).toBeEnabled()
      // Wait out the colour transition from the disabled state.
      await expect.poll(() => send.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(41, 82, 227)')
      await field.fill('')
    }
  })

  test('suggested questions sit above the conversation as chips', async ({ page }) => {
    await open(page, '/ai')
    const chips = page.locator('.ai-chips button')
    expect(await chips.count()).toBeGreaterThanOrEqual(3)
    await expect(chips.first()).toBeVisible()
  })

  test('the opening answer reads as the assistant on a white panel', async ({ page }) => {
    await open(page, '/ai')
    const first = page.locator('.ai-message.assistant').first()
    await expect(first).toBeVisible()
    expect(await first.locator('.ai-bubble').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)')
  })
})

test.describe('/resume', () => {
  test('one clear download action in cobalt', async ({ page }) => {
    await open(page, '/resume')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('简历')
    const download = page.getByRole('main').getByRole('link', { name: '下载 PDF 简历' })
    await expect(download).toHaveAttribute('href', '/resume/zhang-jinpeng-ai-product-builder.pdf')
    await expect(download).toHaveAttribute('download', /.pdf$/)
    expect(await download.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(41, 82, 227)')
    await expect(page.getByRole('main').getByRole('link', { name: '查看最新作品' })).toHaveAttribute('href', `${portfolio}/#works`)
  })
})

test.describe('/projects/[slug]', () => {
  test('title, story sections, role, stack and links like a featured card', async ({ page }) => {
    await open(page, '/projects/todo-memo')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('待办备忘')
    await expect(page.locator('main h2')).toHaveText(['要解决的问题', '做法', '结果'])
    await expect(page.getByText('角色', { exact: true })).toBeVisible()
    await expect(page.locator('.project-stack li').first()).toBeVisible()
    for (const link of await page.locator('.project-links a').all()) await expect(link).toHaveAttribute('rel', /noopener/)
    await expect(page.getByRole('link', { name: '返回作品列表' })).toHaveAttribute('href', `${portfolio}/#works`)
  })

  test('a missing project is a 404 that leads back to the portfolio', async ({ page }) => {
    const response = await open(page, '/projects/does-not-exist')
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('页面未找到')
    await expect(page.getByRole('link', { name: '回到作品集' })).toHaveAttribute('href', `${portfolio}/`)
  })
})

test.describe('names and greeting', () => {
  test('page titles use the same name as the home page, with a site icon', async ({ page }) => {
    for (const [path, title] of [['/ai', '问我的 AI 分身 · 张锦鹏 Jaxson'], ['/resume', '简历 · 张锦鹏 Jaxson'], ['/projects/todo-memo', /^待办备忘.* · 张锦鹏 Jaxson$/]] as const) {
      await open(page, path)
      await expect(page).toHaveTitle(title)
      expect(await page.locator('link[rel="icon"]').count()).toBeGreaterThan(0)
    }
  })

  test('the AI greets visitors in plain words', async ({ page }) => {
    await open(page, '/ai')
    const greeting = page.locator('.ai-message.assistant').first()
    await expect(greeting).toContainText('张锦鹏')
    await expect(greeting).not.toContainText('后台')
  })
})
