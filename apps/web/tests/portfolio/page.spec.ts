import { expect, test, type Page } from '@playwright/test'

// Acceptance tests for the "AI workspace" portfolio: profile, sample conversation and retrieval trace on the
// first screen; works, résumé and contact below (scratch/directions/冷白钴蓝-打磨版).

const project = (slug: string, title: string, extra: Record<string, unknown> = {}) => ({
  slug, title, shortTitle: title, category: '工具应用', role: '独立全栈开发', date: '',
  summary: '已上线的待办与备忘工具，覆盖登录鉴权、云端持久化与离线运行。',
  problem: '任务容易分散在临时记录里，缺少一个统一收集与同步的入口。',
  action: '围绕极速收集与按场景分组组织界面流，用 Supabase 实现跨端同步。',
  outcome: '部署在 Vercel，支持 PWA 安装与多设备同步。',
  technologies: ['React', 'TypeScript', 'Supabase'], image: 'todo-memo-cover.png',
  demoUrl: 'https://todo.example.test/', repoUrl: 'https://github.com/example/todo', ...extra,
})
const twoProjects = [
  project('todo-memo', '待办备忘 (Todo Memo)'),
  project('jaxson-ai-space', 'Jaxson AI Space (本站 · 全栈个人门户与 AI 分身)', { shortTitle: 'Jaxson AI Space', image: 'project-dossier-cover.svg' }),
]

const sse = (event: string, data: object) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

/** Opens the page with the chat API answering every question with `events`; returns the request bodies. */
async function askable(page: Page, events: string[]) {
  const bodies: { messages: { role: string, content: string }[] }[] = []
  await page.route('https://cms.example.test/api/chat', route => {
    bodies.push(route.request().postDataJSON())
    return route.fulfill({ contentType: 'text/event-stream', body: events.join('') })
  })
  await open(page, { width: 1440, height: 900 })
  return bodies
}

async function open(page: Page, viewport: { width: number, height: number }, projects: object[] = twoProjects) {
  await page.route('**/api/showcase-projects', route => route.fulfill({ json: { source: 'cms', projects } }))
  await page.setViewportSize(viewport)
  await page.goto('/')
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
}

const widths = [320, 375, 414, 768, 1024, 1366, 1440]

test.describe('whole page', () => {
  test('never scrolls sideways at any common width', async ({ page }) => {
    for (const width of widths) {
      await open(page, { width, height: 800 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${width}px`).toBeLessThanOrEqual(0)
    }
  })

  test('keeps body text at 16px and every text at 14px or larger', async ({ page }) => {
    for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
      await open(page, viewport)
      const small = await page.evaluate(() => [...document.querySelectorAll('body *')]
        .filter(el => [...el.childNodes].some(node => node.nodeType === 3 && node.textContent!.trim()) &&
          el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== 'hidden')
        .map(el => ({ size: parseFloat(getComputedStyle(el).fontSize), text: el.textContent!.trim().slice(0, 16) }))
        .filter(item => item.size < 14).map(item => `${item.size}px ${item.text}`))
      expect(small, JSON.stringify(viewport)).toEqual([])
      expect(await page.evaluate(() => getComputedStyle(document.body).fontSize), JSON.stringify(viewport)).toBe('16px')
    }
  })

  test('renders Chinese with one sans font per element and never a Song (serif) face', async ({ page }) => {
    // Latin and symbol fallbacks (e.g. Cambria Math for arrows) are not Chinese faces.
    const latin = /JetBrains|Jakarta|Anton|Consolas|Impact|Arial|Segoe|Helvetica|Liberation|DejaVu|Roboto|Verdana|Tahoma|Cambria Math|Symbol|Emoji/i
    for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }]) {
      await open(page, viewport)
      const count = await page.evaluate(() => {
        let index = 0
        for (const el of document.querySelectorAll('body *')) {
          const own = [...el.childNodes].filter(node => node.nodeType === 3).map(node => node.textContent).join('')
          if (/[一-龥]/.test(own) && el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== 'hidden') el.setAttribute('data-font-probe', String(index++))
        }
        return index
      })
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('DOM.enable')
      await cdp.send('CSS.enable')
      const { root } = await cdp.send('DOM.getDocument', { depth: -1 })
      const problems: string[] = []
      for (let index = 0; index < count; index++) {
        const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `[data-font-probe="${index}"]` })
        const families = (await cdp.send('CSS.getPlatformFontsForNode', { nodeId })).fonts.map(font => font.familyName)
        const chinese = [...new Set(families.filter(family => !latin.test(family)))]
        if (families.some(family => /SimSun|NSimSun|宋/i.test(family)) || chinese.length > 1) problems.push(families.join(' + '))
      }
      await cdp.detach()
      expect(count, JSON.stringify(viewport)).toBeGreaterThan(5)
      expect(problems, JSON.stringify(viewport)).toEqual([])
    }
  })

  test('gives every link, button and field a touch target of at least 44px', async ({ page }) => {
    for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
      await open(page, viewport)
      const small = await page.evaluate(() => [...document.querySelectorAll('a, button, input')]
        .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' })
        .filter(el => el.getBoundingClientRect().height < 44)
        .map(el => `${Math.round(el.getBoundingClientRect().height)}px ${el.textContent!.trim().slice(0, 16)}`))
      expect(small, JSON.stringify(viewport)).toEqual([])
    }
  })

  test('uses the cobalt accent for primary actions and keeps secondary text readable', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    const colours = await page.evaluate(() => {
      const style = (selector: string) => getComputedStyle(document.querySelector(selector)!)
      return {
        page: getComputedStyle(document.body).backgroundColor,
        primary: style('.btn-primary').backgroundColor,
        send: style('#askForm button').backgroundColor,
      }
    })
    expect(colours).toEqual({ page: 'rgb(243, 244, 247)', primary: 'rgb(41, 82, 227)', send: 'rgb(41, 82, 227)' })
    // WCAG AA (4.5:1) for every muted text colour against the panel it sits on.
    const ratios = await page.evaluate(() => {
      const luminance = (rgb: string) => {
        const [r, g, b] = rgb.match(/\d+/g)!.slice(0, 3).map(Number).map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const panel = luminance('rgb(255, 255, 255)')
      return ['.muted', '.facts dt', '.step small', '.work-role'].flatMap(selector => [...document.querySelectorAll(selector)].slice(0, 1))
        .map(el => { const l = luminance(getComputedStyle(el).color); return Math.round((panel + 0.05) / (l + 0.05) * 10) / 10 })
    })
    expect(ratios.length).toBeGreaterThanOrEqual(3)
    for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5)
  })
})

test.describe('header', () => {
  test('one navigation: chapter links, résumé download and the AI entry; nothing floating', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    const nav = page.getByRole('navigation', { name: '主导航' })
    for (const name of ['作品', '履历', '联系', '简历 PDF', '问我的 AI']) await expect(nav.getByRole('link', { name, exact: true })).toBeVisible()
    await expect(nav.getByRole('link', { name: '简历 PDF' })).toHaveAttribute('href', '/resume/zhang-jinpeng-ai-product-builder.pdf')
    await expect(page.locator('#chapterNext, .chapter-next, .bottom-player-bar')).toHaveCount(0)
  })

  test('phones keep the résumé and AI entry in the header', async ({ page }) => {
    await open(page, { width: 375, height: 812 })
    const nav = page.getByRole('navigation', { name: '主导航' })
    await expect(nav.getByRole('link', { name: '问我的 AI' })).toBeInViewport({ ratio: 1 })
    await expect(nav.getByRole('link', { name: '简历 PDF' })).toBeInViewport({ ratio: 1 })
  })

  test('the full-screen AI page link carries the page to return to', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    const links = page.locator('[data-ai-link]')
    expect(await links.count()).toBeGreaterThanOrEqual(1)
    for (const href of await links.evaluateAll(all => all.map(link => (link as HTMLAnchorElement).href))) {
      const url = new URL(href)
      expect(url.origin).toBe('https://cms.example.test')
      expect(url.pathname).toBe('/ai')
      expect(url.searchParams.get('from')).toContain('http://127.0.0.1:4174/')
    }
  })

  test('“问我的 AI” takes you to the conversation on this page, not to another site', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight))
    await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '问我的 AI' }).click()
    await expect(page).toHaveURL(/127\.0\.0\.1:4174/)
    await expect(page.getByRole('textbox', { name: '问我的 AI 分身' })).toBeFocused()
    await expect(page.getByRole('textbox', { name: '问我的 AI 分身' })).toBeInViewport()
  })
})

test.describe('first screen', () => {
  test('profile: name, role, portrait, four facts and the résumé and email actions', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    const profile = page.locator('#hero .profile')
    await expect(profile.getByRole('heading', { level: 1 })).toHaveText('张锦鹏')
    await expect(profile).toContainText('AI 应用与全栈开发')
    await expect(page.locator('#heroAvatarImg')).toBeVisible()
    await expect(profile.locator('.facts dt')).toHaveText(['在读', '实习', '方向', '地点'])
    await expect(profile.getByRole('link', { name: '下载简历' })).toHaveAttribute('href', '/resume/zhang-jinpeng-ai-product-builder.pdf')
    await expect(profile.getByRole('link', { name: '发邮件' })).toHaveAttribute('href', 'mailto:1822103245@qq.com')
  })

  test('conversation: a sample exchange marked as an example, answered from the published projects', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    const chat = page.locator('#hero .chat')
    await expect(chat).toContainText('示例')
    await expect(chat.locator('.q').first()).toHaveText('你做过哪些项目？')
    await expect(chat.locator('.a').first()).toContainText('我一共公开了 2 个项目')
    await expect(chat.locator('.src b')).toHaveText(['待办备忘 (Todo Memo)', 'Jaxson AI Space'])
    await expect(chat.locator('.a sup')).toHaveText(['1', '2'])
  })

  test('trace: the four retrieval steps and the public knowledge base, hits marked', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    const trace = page.locator('#hero .trace')
    await expect(trace.locator('.step b')).toHaveText(['理解问题', '关键词 + 向量双路检索', '挑出最相关的资料', 'DeepSeek 生成回答'])
    await expect(trace.locator('.doc.hit')).toHaveCount(2)
    expect(await trace.locator('.doc').count()).toBeGreaterThanOrEqual(6)
  })

  test('asking answers right here: the question, the streamed answer and its sources', async ({ page }) => {
    const bodies = await askable(page, [sse('meta', { evidence: ['项目档案：待办备忘'], generator: 'external' }), sse('text', { text: '我会 **React**' }), sse('text', { text: ' 和 TypeScript。' }), sse('done', {})])
    const field = page.getByRole('textbox', { name: '问我的 AI 分身' })
    await expect(field).toHaveAttribute('maxlength', '200')
    await field.fill('你会哪些技术？')
    await page.locator('#askForm button').click()
    const chat = page.locator('#hero .chat')
    await expect(chat.locator('.live .q')).toHaveText(['你会哪些技术？'])
    await expect(chat.locator('.live .a').last()).toHaveText('我会 React 和 TypeScript。')
    await expect(chat.locator('.live .a b')).toHaveText('React')
    await expect(chat.locator('.sample')).toHaveCount(0)
    await expect(chat).not.toContainText('示例对话')
    await expect(page).toHaveURL(/127\.0\.0\.1:4174/)
    expect(bodies[0]).toEqual({ messages: [{ role: 'user', content: '你会哪些技术？' }] })
    const trace = page.locator('#hero .trace')
    await expect(trace.locator('.doc.hit')).toHaveText([/项目档案：待办备忘/])
    await expect(trace.locator('.step small').nth(2)).toHaveText('命中 1 篇资料')
    await expect(field).toHaveValue('')
  })

  test('a long answer scrolls inside the panel; the first screen keeps its size', async ({ page }) => {
    const long = Array.from({ length: 60 }, (_, index) => `第 ${index + 1} 行回答内容`).join('\n')
    await askable(page, [sse('text', { text: long }), sse('done', {})])
    const before = await page.evaluate(() => ({ hero: document.getElementById('hero')!.getBoundingClientRect().height, works: document.getElementById('works')!.getBoundingClientRect().top }))
    await page.getByRole('textbox', { name: '问我的 AI 分身' }).fill('长一点的回答')
    await page.keyboard.press('Enter')
    await expect(page.locator('#hero .live .a').last()).toContainText('第 60 行回答内容')
    const after = await page.evaluate(() => ({ hero: document.getElementById('hero')!.getBoundingClientRect().height, works: document.getElementById('works')!.getBoundingClientRect().top }))
    expect(after).toEqual(before)
    await expect(page.locator('#hero .live .a').last().getByText('第 60 行回答内容')).toBeInViewport()
    await expect(page.getByRole('textbox', { name: '问我的 AI 分身' })).toBeInViewport({ ratio: 1 })
    // Measure after the panels' entrance animation.
    await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished)))
    const clipped = await page.locator('#hero .panel').evaluateAll(panels => panels.map(panel => {
      const box = panel.getBoundingClientRect(), hero = document.getElementById('hero')!.getBoundingClientRect()
      return box.bottom <= hero.bottom + 1
    }))
    expect(clipped).toEqual([true, true, true])
  })

  test('a follow-up question carries the earlier round', async ({ page }) => {
    const bodies = await askable(page, [sse('meta', { evidence: [] }), sse('text', { text: '第一轮回答' }), sse('done', {})])
    await page.getByRole('textbox', { name: '问我的 AI 分身' }).fill('第一个问题')
    await page.keyboard.press('Enter')
    await expect(page.locator('#hero .live .a')).toHaveText(['第一轮回答'])
    await page.getByRole('textbox', { name: '问我的 AI 分身' }).fill('追问')
    await page.keyboard.press('Enter')
    await expect(page.locator('#hero .live .q')).toHaveText(['第一个问题', '追问'])
    expect(bodies[1].messages).toEqual([
      { role: 'user', content: '第一个问题' }, { role: 'assistant', content: '第一轮回答' }, { role: 'user', content: '追问' },
    ])
    await expect(page.locator('#hero .trace .step small').nth(2)).toHaveText('没有找到相关的公开资料')
  })

  test('suggested questions ask right away', async ({ page }) => {
    const bodies = await askable(page, [sse('text', { text: '答案' }), sse('done', {})])
    const chips = page.locator('#hero .chips button')
    expect(await chips.count()).toBeGreaterThanOrEqual(3)
    const label = (await chips.first().textContent())!.trim()
    await chips.first().click()
    await expect(page.locator('#hero .live .q')).toHaveText([label])
    expect(bodies[0].messages).toEqual([{ role: 'user', content: label }])
  })

  test('explains failures and offers a retry; keeps a partial answer when the stream breaks', async ({ page }) => {
    let call = 0
    await page.route('https://cms.example.test/api/chat', route => {
      call++
      if (call === 1) return route.fulfill({ status: 503, json: { error: 'down' } })
      if (call === 2) return route.fulfill({ status: 429, json: { error: 'slow down' } })
      if (call === 3) return route.fulfill({ contentType: 'text/event-stream', body: sse('text', { text: '说到一半' }) + sse('error', { code: 'upstream_interrupted' }) })
      return route.fulfill({ contentType: 'text/event-stream', body: sse('text', { text: '重试成功' }) + sse('done', {}) })
    })
    await open(page, { width: 1440, height: 900 })
    const field = page.getByRole('textbox', { name: '问我的 AI 分身' })
    await field.fill('问题')
    await page.keyboard.press('Enter')
    await expect(page.locator('#hero .live .status').last()).toContainText('暂时连不上 AI')
    await page.locator('#hero .live').getByRole('button', { name: '重试' }).last().click()
    await expect(page.locator('#hero .live .status').last()).toContainText('提问太频繁')
    await page.locator('#hero .live').getByRole('button', { name: '重试' }).last().click()
    await expect(page.locator('#hero .live .a').last()).toHaveText('说到一半')
    await expect(page.locator('#hero .live .status').last()).toContainText('回答中断')
    await page.locator('#hero .live').getByRole('button', { name: '重试' }).last().click()
    await expect(page.locator('#hero .live .a').last()).toHaveText('重试成功')
    await expect(page.locator('#hero .live .q')).toHaveText(['问题'])
  })

  test('renders the answer as text, never as markup', async ({ page }) => {
    await askable(page, [sse('text', { text: '<img src=x onerror="window.__pwned=1">' }), sse('done', {})])
    await page.getByRole('textbox', { name: '问我的 AI 分身' }).fill('试试')
    await page.keyboard.press('Enter')
    await expect(page.locator('#hero .live .a').last()).toHaveText('<img src=x onerror="window.__pwned=1">')
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined()
  })

  test('the whole first screen fits on desktop and laptop windows', async ({ page }) => {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 1366, height: 657 }]) {
      await open(page, viewport)
      const where = JSON.stringify(viewport)
      await expect(page.locator('#hero .profile h1'), where).toBeInViewport({ ratio: 1 })
      await expect(page.getByRole('link', { name: '下载简历' }), where).toBeInViewport({ ratio: 1 })
      await expect(page.getByRole('textbox', { name: '问我的 AI 分身' }), where).toBeInViewport({ ratio: 1 })
      await expect(page.locator('#hero .trace .step').first(), where).toBeInViewport({ ratio: 1 })
      // Panels never cut their own content off.
      const clipped = await page.locator('#hero .panel').evaluateAll(panels => panels
        .filter(panel => panel.scrollHeight > panel.clientHeight + 1).map(panel => panel.className))
      expect(clipped, where).toEqual([])
    }
  })

  test('phones stack profile, conversation and trace in one column', async ({ page }) => {
    await open(page, { width: 375, height: 812 })
    await expect(page.locator('#hero .profile h1')).toBeInViewport()
    const lefts = await page.locator('#hero .panel').evaluateAll(panels => panels.map(panel => Math.round(panel.getBoundingClientRect().left)))
    expect(new Set(lefts).size).toBe(1)
  })
})

test.describe('more than two projects', () => {
  // Five projects, the third and fifth featured in the CMS.
  const five = Array.from({ length: 5 }, (_, index) => project(`p${index}`, `项目${index}`, { featured: index === 2 || index === 4 }))

  test('the first screen answers with the total and cites the featured projects', async ({ page }) => {
    await open(page, { width: 1440, height: 900 }, five)
    const chat = page.locator('#hero .chat')
    await expect(chat.locator('.a').first()).toContainText('我一共公开了 5 个项目')
    await expect(chat.locator('.a').first()).toContainText('其余 3 个在下面的作品区')
    await expect(chat.locator('.src b')).toHaveText(['项目2', '项目4'])
    const trace = page.locator('#hero .trace')
    await expect(trace.locator('.doc.hit')).toHaveText([/项目2/, /项目4/])
    await expect(trace.locator('.doc').nth(2)).toContainText('还有 3 篇项目档案')
    await expect(trace.locator('.step small').nth(2)).toHaveText('命中 2 篇项目档案')
  })

  test('without featured projects the first two stand in, and long summaries are shortened', async ({ page }) => {
    const eight = Array.from({ length: 8 }, (_, index) => project(`p${index}`, `项目${index}`, { summary: '这是一段非常长的项目简介，'.repeat(8) }))
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
      await open(page, viewport, eight)
      await expect(page.locator('#hero .src b')).toHaveText(['项目0', '项目1'])
      expect((await page.locator('#hero .a').first().textContent())!.length).toBeLessThan(140)
      await expect(page.getByRole('textbox', { name: '问我的 AI 分身' })).toBeInViewport({ ratio: 1 })
      const clipped = await page.locator('#hero .panel').evaluateAll(panels => panels
        .filter(panel => panel.scrollHeight > panel.clientHeight + 1).map(panel => panel.className))
      expect(clipped, JSON.stringify(viewport)).toEqual([])
    }
  })

  test('says so in the first screen when nothing is published, and keeps the default when the feed fails', async ({ page }) => {
    await open(page, { width: 1440, height: 900 }, [])
    await expect(page.locator('#hero .a').first()).toContainText('正在整理')
    await expect(page.locator('#hero .src, #hero .doc.hit')).toHaveCount(0)
    await page.unroute('**/api/showcase-projects')
    await page.route('**/api/showcase-projects', route => route.fulfill({ status: 503, json: { error: 'unavailable' } }))
    await page.goto('/')
    await expect(page.locator('#works')).toContainText('项目暂时无法加载')
    await expect(page.locator('#hero .a').first()).toContainText('最有代表性的两个')
    await expect(page.locator('#hero .src')).toHaveCount(2)
  })

  test('featured projects get large cards; the rest are rows in one list, each on a single line', async ({ page }) => {
    await open(page, { width: 1440, height: 900 }, five)
    await expect(page.locator('#works .project.featured h3')).toHaveText(['项目2', '项目4'])
    const list = page.locator('#works .more-list')
    await expect(list.getByRole('heading', { level: 3, name: '更多项目' })).toBeVisible()
    await expect(list.locator('.row h4')).toHaveText(['项目0', '项目1', '项目3'])
    await expect(list.locator('img, .cover')).toHaveCount(0)
    await expect(list.locator('.row').first().locator('.tags li')).toHaveText(['React', 'TypeScript', 'Supabase'])
    await expect(list.locator('.row').first().getByRole('link', { name: '在线体验' })).toHaveAttribute('href', 'https://todo.example.test/')
    // On wide screens name, summary, stack and links sit side by side.
    const heights = await list.locator('.row').evaluateAll(rows => rows.map(row => Math.round(row.getBoundingClientRect().height)))
    for (const height of heights) expect(height).toBeLessThan(110)
  })

  test('the list stacks each row on phones without sideways scrolling', async ({ page }) => {
    await open(page, { width: 375, height: 812 }, five)
    const row = page.locator('#works .more-list .row').first()
    const [name, summary] = await Promise.all(['h4', '.summary'].map(selector => row.locator(selector).evaluate(el => el.getBoundingClientRect().top)))
    expect(summary).toBeGreaterThan(name)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
  })

  test('a single featured project spans the full width', async ({ page }) => {
    await open(page, { width: 1440, height: 900 }, five.map((item, index) => ({ ...item, featured: index === 2 })))
    const [card, list] = await Promise.all([
      page.locator('#works .project.featured').evaluate(el => el.getBoundingClientRect().width),
      page.locator('#works').evaluate(el => el.querySelector('.works')!.getBoundingClientRect().width),
    ])
    expect(Math.abs(card - list)).toBeLessThanOrEqual(2)
  })

  test('without other projects there is no list', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    await expect(page.locator('#works .more-list')).toHaveCount(0)
  })

  test('lists six more projects, then a button reveals the rest', async ({ page }) => {
    const twelve = Array.from({ length: 12 }, (_, index) => project(`p${index}`, `项目${index}`))
    await open(page, { width: 1440, height: 900 }, twelve)
    await expect(page.locator('#works .more-list .row')).toHaveCount(6)
    const more = page.getByRole('button', { name: '显示全部 12 个项目' })
    await expect(more).toHaveAttribute('aria-expanded', 'false')
    await more.click()
    await expect(page.locator('#works .more-list .row')).toHaveCount(10)
    await expect(more).toHaveCount(0)
  })

  test('featured projects without a screenshot get a light cover with their initial and stack', async ({ page }) => {
    await open(page, { width: 1440, height: 900 }, [
      project('a', '项目甲', { image: '', featured: true }),
      project('b', '项目乙', { image: 'project-dossier-cover.svg', featured: true }),
      project('c', '项目丙'),
    ])
    const covers = page.locator('#works .cover')
    await expect(covers).toHaveCount(2)
    for (const index of [0, 1]) {
      await expect(covers.nth(index)).toHaveClass(/placeholder/)
      await expect(covers.nth(index).locator('b')).toHaveText('项')
      await expect(covers.nth(index).locator('span')).toHaveText('React · TypeScript · Supabase')
      await expect(covers.nth(index).locator('img')).toHaveCount(0)
    }
    await expect(page.locator('#hero .src img')).toHaveCount(0)
    await expect(page.locator('#hero .src .thumb')).toHaveText(['项', '项'])
  })

  test('renders featured CMS text in the first screen as text, never as markup', async ({ page }) => {
    await open(page, { width: 1440, height: 900 }, [project('x', '<img src=x onerror="window.__pwned=1">标题', { summary: '<b>粗</b>' })])
    await expect(page.locator('#hero .src b')).toHaveText('<img src=x onerror="window.__pwned=1">标题')
    await expect(page.locator('#hero .a').first()).toContainText('<b>粗</b>')
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined()
  })
})

test.describe('works', () => {
  test('shows each published project as a card with its evidence, in CMS order', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    const cards = page.locator('#works .project')
    await expect(cards).toHaveCount(2)
    await expect(cards.locator('h3')).toHaveText(['待办备忘 (Todo Memo)', 'Jaxson AI Space'])
    const first = cards.first()
    await expect(first.locator('.story dt')).toHaveText(['难题', '做法', '结果'])
    await expect(first.getByText('已上线的待办与备忘工具', { exact: false })).toBeVisible()
    await expect(first.locator('.stack li')).toHaveText(['React', 'TypeScript', 'Supabase'])
    await expect(first.getByRole('link', { name: '在线体验' })).toHaveAttribute('href', 'https://todo.example.test/')
    await expect(first.getByRole('link', { name: '源码' })).toHaveAttribute('href', 'https://github.com/example/todo')
    await expect(first.getByRole('link', { name: '在线体验' })).toHaveAttribute('rel', /noopener/)
    await expect(first.locator('img')).toHaveAttribute('src', './optimized/todo-memo-cover-900.765d77142054.webp')
    await expect(first.locator('img')).toHaveAttribute('alt', '待办备忘 (Todo Memo)界面截图')
  })

  test('sits two cards per row on wide screens and one per row on phones', async ({ page }) => {
    const tops = async () => page.locator('#works .project').evaluateAll(cards => cards.map(card => Math.round(card.getBoundingClientRect().top)))
    await open(page, { width: 1440, height: 900 })
    const [a, b] = await tops()
    expect(a).toBe(b)
    await open(page, { width: 375, height: 812 })
    const [c, d] = await tops()
    expect(d).toBeGreaterThan(c)
  })

  test('has no carousel, automatic advance or archive dialog', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    await expect(page.locator('#works button:not(.show-all), #works dialog, .coverflow-slide')).toHaveCount(0)
    const before = await page.locator('#works .project h3').allTextContents()
    await page.waitForTimeout(7000)
    expect(await page.locator('#works .project h3').allTextContents()).toEqual(before)
  })

  test('says so when there is nothing published, and when the CMS cannot be reached', async ({ page }) => {
    await open(page, { width: 375, height: 812 }, [])
    await expect(page.locator('#works .project')).toHaveCount(0)
    await expect(page.locator('#works')).toContainText('目前没有公开项目。')
    await page.unroute('**/api/showcase-projects')
    await page.route('**/api/showcase-projects', route => route.fulfill({ status: 503, json: { error: 'unavailable' } }))
    await page.goto('/')
    await expect(page.locator('#works')).toContainText('项目暂时无法加载，请稍后刷新页面。')
  })

  test('handles twenty projects with long unbroken titles and missing links on a small phone', async ({ page }) => {
    const many = Array.from({ length: 20 }, (_, index) => project(`p-${index}`, `SuperLongPortfolioProjectTitleWithoutAnySpaces${index}`,
      index % 2 ? { demoUrl: '', repoUrl: '', image: '' } : {}))
    await open(page, { width: 320, height: 568 }, many)
    await page.getByRole('button', { name: '显示全部 20 个项目' }).click()
    await expect(page.locator('#works .project, #works .more-list .row')).toHaveCount(20)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
    await expect(page.locator('#works .project').nth(1).locator('.links')).toHaveCount(0)
    await expect(page.locator('#works .project').nth(1).locator('.cover.placeholder b')).toHaveText('S')
  })

  test('renders CMS text as text, never as markup', async ({ page }) => {
    await open(page, { width: 1440, height: 900 }, [project('x', '<img src=x onerror="window.__pwned=1">标题')])
    await expect(page.locator('#works .project h3')).toHaveText('<img src=x onerror="window.__pwned=1">标题')
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined()
  })
})

test.describe('résumé', () => {
  test('shows internship, education and competitions at once, with no stage switching', async ({ page }) => {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }]) {
      await open(page, viewport)
      const bio = page.locator('#bio')
      await expect(bio.locator('.entry h3')).toHaveText(['开发实习生', '大数据技术专业（专科），2027 届', '技能竞赛'])
      for (const text of ['广东润喵云科技有限公司', '深圳职业技术大学', 'GPA 3.85 / 4.0，专业排名前 3%', '一带一路暨金砖国家技能大赛']) {
        await expect(bio.getByText(text, { exact: false }).first(), `${text} ${JSON.stringify(viewport)}`).toBeVisible()
      }
      await expect(bio.getByRole('button')).toHaveCount(0)
      await expect(page.locator('.bio-proof-strip, .milestone-step-btn')).toHaveCount(0)
    }
  })

  test('lists the four skill groups as tags, AI first', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    await expect(page.locator('#bio .skills h3')).toHaveText(['AI 应用开发', '前端开发', '后端与数据', '工程交付'])
    for (const group of await page.locator('#bio .skills .group').all()) expect(await group.locator('li').count()).toBeGreaterThanOrEqual(4)
  })

  test('puts experience and skills side by side on wide screens, dates beside entries', async ({ page }) => {
    const layout = async () => page.locator('#bio .entry').first().evaluate(entry => {
      const when = entry.querySelector('.when')!.getBoundingClientRect(), title = entry.querySelector('h3')!.getBoundingClientRect()
      return when.right <= title.left ? 'side' : when.bottom <= title.top ? 'above' : 'overlap'
    })
    await open(page, { width: 1440, height: 900 })
    expect(await layout()).toBe('side')
    const [timeline, skills] = await page.locator('#bio .panel').evaluateAll(panels => panels.map(panel => Math.round(panel.getBoundingClientRect().top)))
    expect(timeline).toBe(skills)
    await open(page, { width: 375, height: 812 })
    expect(await layout()).toBe('above')
  })
})

test.describe('contact and footer', () => {
  test('offers email, the AI and GitHub, then a footer with the résumé', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    const contact = page.locator('#beyond')
    await expect(contact.getByRole('heading', { level: 2 })).toHaveText('想聊聊？')
    await expect(contact).toContainText('1822103245@qq.com')
    await expect(contact.getByRole('link', { name: '发邮件' })).toHaveAttribute('href', 'mailto:1822103245@qq.com')
    await expect(contact.getByRole('link', { name: '问 AI 分身' })).toHaveAttribute('href', '#ask')
    await expect(contact.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/Jaxson-zip')
    const footer = page.locator('footer')
    await expect(footer).toContainText('© 2026 张锦鹏')
    await expect(footer.getByRole('link', { name: '下载 PDF 简历' })).toHaveAttribute('href', '/resume/zhang-jinpeng-ai-product-builder.pdf')
  })

  test('keeps old chapter links working and leaves none of the old page behind', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    for (const id of ['hero', 'bio', 'works', 'beyond']) await expect(page.locator(`#${id}`)).toHaveCount(1)
    await expect(page.locator('.chapter-next, .bottom-player-bar, #audioToggle, .coverflow-track, #workDetailModal, #worksArchive, .gaze-tracker-card')).toHaveCount(0)
    await page.goto('/#folder')
    await expect(page).toHaveURL(/#works$/)
  })
})

test.describe('motion and keyboard', () => {
  test('the first-screen panels fade in only when motion is allowed', async ({ page }, testInfo) => {
    await open(page, { width: 1440, height: 900 })
    const animations = await page.locator('#hero .panel').evaluateAll(panels => panels.map(panel => getComputedStyle(panel).animationName))
    expect(animations).toEqual(Array(3).fill(testInfo.project.name === 'reduced-motion' ? 'none' : 'rise'))
  })

  test('leaves the mouse wheel and paging keys to the browser', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    const prevented = await page.evaluate(() => {
      const wheel = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true })
      document.querySelector('#hero')!.dispatchEvent(wheel)
      return [wheel, ...['PageDown', 'PageUp', ' '].map(key => {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
        document.body.dispatchEvent(event)
        return event
      })].map(event => event.defaultPrevented)
    })
    expect(prevented).toEqual([false, false, false, false])
  })

  test('keyboard focus is always visible', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    await page.keyboard.press('Tab')
    const outline = await page.evaluate(() => { const style = getComputedStyle(document.activeElement!); return `${style.outlineStyle} ${style.outlineWidth}` })
    expect(outline).toBe('solid 2px')
  })
})

test.describe('navigation', () => {
  test('chapter links land the chapter just below the header', async ({ page }) => {
    await open(page, { width: 1366, height: 657 })
    for (const [name, id] of [['作品', 'works'], ['联系', 'beyond'], ['履历', 'bio']]) {
      await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name, exact: true }).click()
      // A last chapter shorter than the window cannot reach the header; then the page is at its end.
      await expect.poll(() => page.evaluate(id => {
        const offset = Math.round(document.getElementById(id)!.getBoundingClientRect().top - document.querySelector('header')!.getBoundingClientRect().bottom)
        const atEnd = Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight
        return offset === 0 || (offset > 0 && atEnd)
      }, id), name).toBe(true)
    }
  })
})

test.describe('polish', () => {
  test('has a site icon and link-preview details for sharing', async ({ page, request }) => {
    await open(page, { width: 1440, height: 900 })
    const icon = await page.locator('link[rel="icon"]').getAttribute('href')
    expect(icon).toBeTruthy()
    expect((await request.get(icon!)).status()).toBe(200)
    expect((await request.get('/favicon.ico')).status()).toBe(200)
    for (const [property, pattern] of [['og:title', /张锦鹏/], ['og:description', /AI/], ['og:image', /^https:\/\/jaxson\.bond\/.+\.(webp|png)$/], ['og:url', /^https:\/\/jaxson\.bond\/$/]] as const) {
      await expect(page.locator(`meta[property="${property}"]`)).toHaveAttribute('content', pattern)
    }
    const image = await page.locator('meta[property="og:image"]').getAttribute('content')
    expect((await request.get(new URL(image!).pathname)).status()).toBe(200)
  })

  test('an unknown address gets a real 404 page that leads home', async ({ page }) => {
    const response = await page.goto('/no-such-page')
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('页面未找到')
    await expect(page.getByRole('link', { name: '回到首页' })).toHaveAttribute('href', '/')
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(243, 244, 247)')
  })

  test('suggested questions are ones the AI can answer without more input', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    const chips = await page.locator('#hero .chips button').allTextContents()
    expect(chips).toContain('你最有代表性的项目是什么？')
    expect(chips.join(' ')).not.toMatch(/岗位匹配/)
  })

  test('on phones a long answer keeps the composer close by', async ({ page }) => {
    const long = Array.from({ length: 60 }, (_, index) => `第 ${index + 1} 行回答内容`).join('\n')
    await page.route('https://cms.example.test/api/chat', route => route.fulfill({ contentType: 'text/event-stream', body: sse('text', { text: long }) + sse('done', {}) }))
    await open(page, { width: 375, height: 812 })
    const field = page.getByRole('textbox', { name: '问我的 AI 分身' })
    await field.scrollIntoViewIfNeeded()
    await field.fill('长一点的回答')
    await page.keyboard.press('Enter')
    await expect(page.locator('#hero .live .a').last()).toContainText('第 60 行回答内容')
    await field.scrollIntoViewIfNeeded()
    await expect(page.locator('#hero .live .a').last().getByText('第 60 行回答内容')).toBeInViewport()
  })
})
