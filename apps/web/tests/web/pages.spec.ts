import { expect, test, type Page } from '@playwright/test'

// The CMS-served public pages share the home page's cool white and cobalt design
// (apps/portfolio/index.html): same palette, header, type and touch targets.

const portfolio = process.env.TEST_PORTFOLIO_URL || 'http://localhost:3000'
const pages = [
  { name: 'AI', path: '/ai' },
  { name: 'résumé', path: '/resume' },
  { name: 'project', path: '/projects/todo-memo' },
  { name: '404', path: '/projects/does-not-exist' },
]
const desktop = { width: 1440, height: 900 }
const phone = { width: 375, height: 812 }
const chatEvent = (type: string, data: object) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
type FullChatFixture = { push: (body: string) => void; requests: { signal?: AbortSignal | null; messages: unknown[] }[] }

async function installStreamingChat(page: Page) {
  await page.route('**/api/showcase-projects', route => route.fulfill({ json: { source: 'cms', projects: [] } }))
  await page.addInitScript(() => {
    const fixture: FullChatFixture = { push: () => {}, requests: [] }
    ;(window as unknown as { fullChat: FullChatFixture }).fullChat = fixture
    const nativeFetch = window.fetch.bind(window)
    window.fetch = async (input, options) => {
      if (String(input) !== '/api/chat') return nativeFetch(input, options)
      fixture.requests.push({ signal: options?.signal, messages: JSON.parse(String(options?.body)).messages })
      return new Response(new ReadableStream<Uint8Array>({ start(controller) {
        fixture.push = body => controller.enqueue(new TextEncoder().encode(body))
        options?.signal?.addEventListener('abort', () => controller.error(options.signal?.reason), { once: true })
      } }), { headers: { 'Content-Type': 'text/event-stream' } })
    }
  })
}

async function pushFullChat(page: Page, ...events: string[]) {
  await page.evaluate(body => (window as unknown as { fullChat: FullChatFixture }).fullChat.push(body), events.join(''))
}

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
  test('keeps the header and composer inside narrow and short viewports', async ({ page }) => {
    for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 480 }, { width: 768, height: 568 }, desktop]) {
      await open(page, '/ai', viewport)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), JSON.stringify(viewport)).toBeLessThanOrEqual(0)
      await expect(page.getByRole('banner').getByRole('link', { name: '张锦鹏 Jaxson' })).toBeInViewport({ ratio: 1 })
      await expect(page.getByRole('banner').getByRole('link', { name: '简历 PDF' })).toBeInViewport({ ratio: 1 })
      await expect(page.getByRole('banner').getByRole('link', { name: '问我的 AI' })).toBeInViewport({ ratio: 1 })
      const field = page.getByRole('textbox', { name: '问我的 AI 分身' })
      await field.fill('长问题第一行\n岗位要求：React\n第二项：TypeScript\n第三项：接口联调\n第四项：项目实践\n第五项：测试与部署')
      await expect(field).toBeInViewport({ ratio: 1 })
      await expect(page.getByRole('button', { name: '发送消息' })).toBeInViewport({ ratio: 1 })
    }
  })

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

test.describe('/ai interactions', () => {
  test('rejects oversized JSON before ignored fields can bypass the request budget', async ({ request }) => {
    const response = await request.post('/api/chat', { headers: { Origin: portfolio }, data: {
      messages: [{ role: 'user', content: '你好' }], padding: 'x'.repeat(65536),
    } })
    expect(response.status()).toBe(413)
    expect(response.headers()['access-control-allow-origin']).toBe(portfolio)
  })
  test('multiline JD grows within the viewport and sends with Enter while Shift+Enter keeps a new line', async ({ page }) => {
    const requests: { messages: { role: string; content: string }[]; isJdMatch: boolean }[] = []
    await page.route('**/api/chat', route => {
      requests.push(route.request().postDataJSON())
      return route.fulfill({ contentType: 'text/event-stream', body: chatEvent('text', { text: 'JD 匹配结果' }) + chatEvent('done', {}) })
    })
    for (const viewport of [desktop, phone]) {
      await open(page, '/ai', viewport)
      const field = page.getByRole('textbox', { name: '问我的 AI 分身' })
      const shortHeight = (await field.boundingBox())!.height
      await field.fill('请分析这个 JD\n岗位职责：开发业务应用\n任职要求：熟悉 React 和 TypeScript\n具备接口联调经验\n了解自动化测试')
      await expect.poll(async () => (await field.boundingBox())!.height).toBeGreaterThan(shortHeight)
      await expect(field).toBeInViewport({ ratio: 1 })
      await expect(page.getByRole('button', { name: '发送消息' })).toBeInViewport({ ratio: 1 })
      const before = requests.length
      await field.press('Shift+Enter')
      expect(requests).toHaveLength(before)
      await field.press('Enter')
      await expect(page.getByText('JD 匹配结果', { exact: true })).toBeVisible()
      expect(requests.at(-1)?.isJdMatch).toBe(true)
      expect(requests.at(-1)?.messages.at(-1)?.content).toContain('\n任职要求：')
    }
  })

  test('continues the real cross-origin home conversation and sources without making another model request', async ({ page, context }) => {
    test.skip(!process.env.HANDOFF_HOME_URL, 'Requires the paired local portfolio preview')
    const home = process.env.HANDOFF_HOME_URL!
    let calls = 0
    await context.route('**/api/chat', route => {
      calls++
      return route.fulfill({ headers: { 'Access-Control-Allow-Origin': home }, contentType: 'text/event-stream', body:
        chatEvent('meta', { evidence: ['项目档案'], sources: [{ tag: '项目档案', project: 'todo-memo' }], generator: 'local' }) +
        chatEvent('text', { text: '已完成的公开回答[1]' }) + chatEvent('done', {}) })
    })
    await page.goto(home)
    const field = page.getByRole('textbox', { name: '问我的 AI 分身' })
    await field.fill('首页里的原问题')
    await page.getByRole('button', { name: '提问', exact: true }).click()
    await expect(page.locator('#liveThread [data-retry]')).toBeEnabled()
    await field.fill('未发送草稿')
    const popupPromise = page.waitForEvent('popup')
    await page.getByRole('link', { name: '全屏对话', exact: true }).click()
    const full = await popupPromise
    await expect(full.locator('.ai-message.user')).toContainText('首页里的原问题')
    await expect(full.locator('.ai-message.assistant')).toContainText('已完成的公开回答')
    await expect(full.getByRole('textbox', { name: '问我的 AI 分身' })).toHaveValue('未发送草稿')
    await expect(full.getByRole('link', { name: '1. 项目档案' })).toHaveAttribute('href', '/projects/todo-memo')
    await expect(full).not.toHaveURL(/handoff=/)
    expect(calls).toBe(1)
    await full.getByRole('textbox', { name: '问我的 AI 分身' }).press('Enter')
    await expect(full.locator('.ai-message.user')).toHaveCount(2)
    expect(calls).toBe(2)
    await expect(page.locator('#liveThread .q')).toHaveText('首页里的原问题')
  })

  test('touch message tools copy, edit, cancel and regenerate while keeping the composer draft', async ({ browser }) => {
    const context = await browser.newContext({ viewport: phone, hasTouch: true, isMobile: true })
    const page = await context.newPage()
    try {
      await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async (text: string) => { (window as unknown as { copiedText: string }).copiedText = text },
      } }))
      const requests: { messages: { role: string; content: string }[] }[] = []
      await page.route('**/api/showcase-projects', route => route.fulfill({ json: { source: 'cms', projects: [] } }))
      await page.route('**/api/chat', route => {
        requests.push(route.request().postDataJSON())
        return route.fulfill({ contentType: 'text/event-stream', body: chatEvent('text', { text: `公开回答 ${requests.length}` }) + chatEvent('done', {}) })
      })
      await open(page, '/ai', phone)
      const field = page.getByRole('textbox', { name: '问我的 AI 分身' })
      await field.fill('原问题')
      await page.getByRole('button', { name: '发送消息', exact: true }).click()
      await page.getByRole('button', { name: '复制回答', exact: true }).click()
      await expect(page.getByText('已复制', { exact: true })).toBeVisible()
      expect(await page.evaluate(() => (window as unknown as { copiedText: string }).copiedText)).toBe('公开回答 1')
      await field.fill('保留草稿')
      const edit = page.getByRole('button', { name: '编辑问题', exact: true })
      await edit.click()
      const editor = page.getByRole('textbox', { name: '编辑问题', exact: true })
      await editor.fill('请介绍你在实习期间的具体工作、负责的模块，以及实际参与的交付内容。'.repeat(3))
      await page.setViewportSize({ width: 320, height: 740 })
      await expect.poll(() => editor.evaluate(input => input.scrollHeight - input.clientHeight)).toBeLessThanOrEqual(1)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
      await editor.press('Escape')
      await expect(edit).toBeFocused()
      await expect(field).toHaveValue('保留草稿')
      await edit.click()
      await page.getByRole('textbox', { name: '编辑问题', exact: true }).fill('修改后的问题')
      await page.getByRole('textbox', { name: '编辑问题', exact: true }).press('Control+Enter')
      await expect(page.getByText('公开回答 2', { exact: true })).toBeVisible()
      await expect(field).toHaveValue('保留草稿')
      expect(requests[1].messages).toEqual([{ role: 'user', content: '修改后的问题' }])
      await page.getByRole('button', { name: '重新生成回答', exact: true }).click()
      await expect(page.getByText('公开回答 3', { exact: true })).toBeVisible()
      await expect(page.locator('.ai-message.user')).toHaveCount(1)
      await expect(field).toHaveValue('保留草稿')
      expect(requests[2].messages).toEqual([{ role: 'user', content: '修改后的问题' }])
    } finally { await context.close() }
  })

  test('generation disables old editing and regeneration controls while copying remains available', async ({ page }) => {
    await installStreamingChat(page)
    await open(page, '/ai')
    const field = page.getByRole('textbox', { name: '问我的 AI 分身' })
    await field.fill('第一条问题')
    await page.getByRole('button', { name: '发送消息', exact: true }).click()
    await pushFullChat(page, chatEvent('text', { text: '第一条回答' }), chatEvent('done', {}))
    const regenerate = page.getByRole('button', { name: '重新生成回答', exact: true })
    await expect(regenerate).toBeEnabled()
    await field.fill('第二条问题')
    await page.getByRole('button', { name: '发送消息', exact: true }).click()
    await expect(regenerate).toBeDisabled()
    for (const button of await page.getByRole('button', { name: '编辑问题', exact: true }).all()) await expect(button).toBeDisabled()
    await expect(page.getByRole('button', { name: '复制回答', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: '停止生成', exact: true }).click()
    await expect(regenerate).toBeEnabled()
  })

  test('mobile visitors can stop an answer, retain their draft and send it without stopped history', async ({ page }) => {
    await installStreamingChat(page)
    await open(page, '/ai', phone)
    const field = page.getByRole('textbox', { name: '问我的 AI 分身' })
    await field.fill('第一个问题')
    await page.getByRole('button', { name: '发送消息', exact: true }).click()
    await pushFullChat(page, chatEvent('text', { text: '保留这段内容' }))
    await field.fill('下一条草稿')
    await page.getByRole('button', { name: '停止生成', exact: true }).click()
    await expect(page.getByText(/已停止生成/)).toBeVisible()
    await expect(page.getByText('保留这段内容', { exact: true })).toBeVisible()
    await expect(field).toHaveValue('下一条草稿')
    await expect(field).toBeInViewport({ ratio: 1 })
    expect(await page.evaluate(() => (window as unknown as { fullChat: FullChatFixture }).fullChat.requests[0].signal?.aborted)).toBe(true)
    await page.getByRole('button', { name: '发送消息', exact: true }).click()
    await pushFullChat(page, chatEvent('text', { text: '第二轮完成' }), chatEvent('done', {}))
    await expect(page.getByText('第二轮完成', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { fullChat: FullChatFixture }).fullChat.requests[1].messages)).toEqual([{ role: 'user', content: '下一条草稿' }])
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
  })

  test('reading above the latest text pauses following until the visitor returns to the bottom', async ({ page }) => {
    await installStreamingChat(page)
    await open(page, '/ai')
    await page.getByRole('textbox', { name: '问我的 AI 分身' }).fill('长一点的回答')
    await page.getByRole('button', { name: '发送消息', exact: true }).click()
    await pushFullChat(page, chatEvent('text', { text: Array.from({ length: 60 }, (_, i) => `第 ${i + 1} 行`).join('\n') }))
    await expect(page.getByText('第 60 行', { exact: true })).toBeVisible()
    const scroll = page.locator('.ai-scroll')
    const top = await scroll.evaluate(node => { node.scrollTop -= 100; node.dispatchEvent(new Event('scroll')); return node.scrollTop })
    await pushFullChat(page, chatEvent('text', { text: '\n新增加的一行' }))
    await expect(page.getByText('新增加的一行', { exact: true })).toBeAttached()
    expect(await scroll.evaluate(node => node.scrollTop)).toBe(top)
    await page.getByRole('button', { name: '回到底部', exact: true }).click()
    await pushFullChat(page, chatEvent('text', { text: '\n最后一行' }), chatEvent('done', {}))
    await expect.poll(() => scroll.evaluate(node => node.scrollHeight - node.clientHeight - node.scrollTop)).toBeLessThanOrEqual(2)
  })

  test('a numbered project source opens its details in another tab while keeping the conversation', async ({ page }) => {
    await page.route('**/api/showcase-projects', route => route.fulfill({ json: { source: 'cms', projects: [] } }))
    await page.route('**/api/chat', route => route.fulfill({ contentType: 'text/event-stream', body:
      chatEvent('meta', { evidence: ['项目档案：待办备忘'], sources: [{ tag: '项目档案：待办备忘', project: 'todo-memo' }], generator: 'external' }) +
      chatEvent('text', { text: '查看这个项目[1]。' }) + chatEvent('done', {}),
    }))
    await open(page, '/ai')
    await page.getByRole('textbox', { name: '问我的 AI 分身' }).fill('介绍项目')
    await page.getByRole('button', { name: '发送消息', exact: true }).click()
    const source = page.getByRole('link', { name: '1. 项目档案：待办备忘', exact: true })
    await expect(source).toBeVisible()
    const opened = page.waitForEvent('popup')
    await source.click()
    const details = await opened
    await expect(details).toHaveURL(/\/projects\/todo-memo$/)
    await details.close()
    await expect(page.getByText('介绍项目', { exact: true })).toBeVisible()
    await expect(page.locator('.ai-intro')).toBeHidden()
  })

  test('plain and linked sources share typography, padding and height on desktop and touch screens', async ({ browser }) => {
    for (const touch of [false, true]) {
      const context = await browser.newContext({ viewport: touch ? phone : desktop, hasTouch: touch, isMobile: touch })
      const page = await context.newPage()
      try {
        await page.route('**/api/chat', route => route.fulfill({ contentType: 'text/event-stream', body:
          chatEvent('meta', { evidence: ['实习经历', '本站项目', '待办备忘'], sources: [
            { tag: '实习经历' }, { tag: '本站项目', project: 'jaxson-ai-space' }, { tag: '待办备忘', project: 'todo-memo' },
          ] }) + chatEvent('text', { text: '这些是公开资料。' }) + chatEvent('done', {}),
        }))
        await open(page, '/ai', touch ? phone : desktop)
        await page.getByRole('textbox', { name: '问我的 AI 分身' }).fill('介绍经历和项目')
        await page.getByRole('button', { name: '发送消息', exact: true }).click()
        await expect(page.locator('.ai-sources li')).toHaveCount(3)
        const sources = await page.locator('.ai-sources li').evaluateAll(items => items.map(item => {
          const el = item.firstElementChild || item
          const style = getComputedStyle(el)
          return { height: el.getBoundingClientRect().height, font: style.fontFamily, size: style.fontSize,
            lineHeight: style.lineHeight, padding: style.padding }
        }))
        expect(sources[1]).toEqual(sources[0])
        expect(sources[2]).toEqual(sources[0])
        if (touch) expect(sources[0].height).toBeGreaterThanOrEqual(44)
        const link = page.getByRole('link', { name: '2. 本站项目', exact: true })
        await link.focus()
        expect(await link.evaluate(node => node === document.activeElement)).toBe(true)
      } finally { await context.close() }
    }
  })

  test('long mixed source names wrap without overflowing or cutting off the label', async ({ page }) => {
    const labels = ['广东润喵云科技有限公司 · 开发实习生', '项目档案：Jaxson AI Space（电子简历与 AI 分身）', '来源：' + 'LongUnbrokenProjectName'.repeat(8)]
    await page.route('**/api/chat', route => route.fulfill({ contentType: 'text/event-stream', body:
      chatEvent('meta', { evidence: labels, sources: labels.map((tag, index) => ({ tag, ...(index ? { project: 'todo-memo' } : {}) })) }) +
      chatEvent('text', { text: '这些是本次回答的资料来源。' }) + chatEvent('done', {}),
    }))
    for (const width of [320, 375, 768, 1440]) {
      await open(page, '/ai', { width, height: 812 })
      await page.getByRole('textbox', { name: '问我的 AI 分身' }).fill('查看公开资料')
      await page.getByRole('button', { name: '发送消息', exact: true }).click()
      await expect(page.locator('.ai-sources li')).toHaveCount(3)
      const boxes = await page.locator('.ai-sources li').evaluateAll(items => items.map(item => {
        const box = item.getBoundingClientRect()
        const el = item.firstElementChild || item
        return { left: box.left, right: box.right, overflow: el.scrollWidth - el.clientWidth, text: item.textContent }
      }))
      for (const [index, box] of boxes.entries()) {
        expect(box.left).toBeGreaterThanOrEqual(0)
        expect(box.right).toBeLessThanOrEqual(width)
        expect(box.overflow).toBeLessThanOrEqual(1)
        expect(box.text).toContain(labels[index])
      }
      await expect(page.getByRole('textbox', { name: '问我的 AI 分身' })).toBeInViewport({ ratio: 1 })
    }
  })
})

test.describe('/resume', () => {
  test('legacy Word résumé links redirect to the current PDF instead of serving an old file', async ({ request }) => {
    for (const path of ['/resume/zhang-jinpeng-resume.docx', '/assets/张锦鹏-秋招简历.docx']) {
      const response = await request.get(path, { maxRedirects: 0 })
      expect(response.status()).toBe(307)
      expect(new URL(response.headers().location, response.url()).pathname).toBe('/resume/zhang-jinpeng-ai-product-builder.pdf')
      expect(response.headers()['cache-control']).toContain('no-store')
    }
  })
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
  test('private and unreferenced uploads cannot be listed or downloaded anonymously', async ({ request }) => {
    test.skip(process.env.PUBLIC_TEST_FIXTURE !== 'true', 'Requires the isolated upload fixtures')
    const list = await request.get('/api/media?depth=0&limit=100')
    expect(list.status()).toBe(200)
    expect(JSON.stringify(await list.json())).not.toContain('private-fixture.png')
    expect((await request.get('/api/media/file/public-fixture.png')).status()).toBe(200)
    expect([403, 404]).toContain((await request.get('/api/media/file/private-fixture.png')).status())
    expect((await request.get('/projects/private-fixture')).status()).toBe(404)
  })
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
