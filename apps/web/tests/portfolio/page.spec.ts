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

type StreamingFixture = { chatFixture: {
  push: (body: string) => void
  requests: { signal?: AbortSignal | null; cancelled: boolean; messages: unknown[] }[]
} }

/** Deterministic, open response body: chunks arrive independently until the test completes it. */
async function streamingChat(page: Page) {
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window)
    const fixture: StreamingFixture['chatFixture'] = { push: () => {}, requests: [] }
    const fixtureWindow = window as unknown as StreamingFixture
    fixtureWindow.chatFixture = fixture
    window.fetch = async (input, options) => {
      if (String(input) !== 'https://cms.example.test/api/chat') return nativeFetch(input, options)
      const request = { signal: options?.signal, cancelled: false, messages: JSON.parse(String(options?.body)).messages }
      fixture.requests.push(request)
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          fixture.push = chunk => controller.enqueue(new TextEncoder().encode(chunk))
          options?.signal?.addEventListener('abort', () => controller.error(options.signal?.reason), { once: true })
        },
        cancel() { request.cancelled = true },
      })
      return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })
    }
  })
}

async function pushChat(page: Page, ...events: string[]) {
  await page.evaluate(body => (window as unknown as StreamingFixture).chatFixture.push(body), events.join(''))
}

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
  test('keeps everything in a centred column no wider than 1120px, with open margins on wide screens', async ({ page }) => {
    for (const width of [1440, 1920]) {
      await open(page, { width, height: 900 })
      const boxes = await page.locator('#hero, #works, #bio, #beyond').evaluateAll(sections => sections.map(section => section.getBoundingClientRect().toJSON()))
      for (const box of boxes) {
        expect(box.width, `${width}px`).toBeLessThanOrEqual(1120)
        expect(box.left, `${width}px`).toBeGreaterThanOrEqual((width - 1120) / 2 - 1)
      }
    }
  })

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
        // Chromium's animated transforms can report a 44px target as 43.999992px.
        .filter(el => el.getBoundingClientRect().height < 44 - 1e-3)
        .map(el => `${el.getBoundingClientRect().height}px ${el.textContent!.trim().slice(0, 16)}`))
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
      expect(url.searchParams.get('from')).toBe(page.url())
    }
  })

  test('hands completed history, sources and the unsent draft to the configured full-screen window without putting text in its URL', async ({ page, context }) => {
    await context.route('https://cms.example.test/ai?**', route => route.fulfill({ contentType: 'text/html', body: `<main id="state"></main><script>
      const token = new URLSearchParams(location.search).get('handoff');
      const origin = new URL(new URLSearchParams(location.search).get('from')).origin;
      addEventListener('message', event => {
        if (event.origin !== origin || event.source !== opener || event.data.type !== 'jaxson-chat:state') return;
        document.getElementById('state').textContent = JSON.stringify(event.data.state);
        opener.postMessage({ type: 'jaxson-chat:received', token }, origin);
      });
      opener.postMessage({ type: 'jaxson-chat:ready', token }, origin);
      </script>` }))
    await askable(page, [sse('meta', { evidence: ['项目档案'], sources: [{ tag: '项目档案', project: 'todo-memo' }], generator: 'external' }), sse('text', { text: '之前的回答[1]' }), sse('done', {})])
    await page.getByRole('textbox', { name: '问我的 AI 分身' }).fill('之前的问题')
    await page.getByRole('button', { name: '提问', exact: true }).click()
    await expect(page.locator('#liveThread [data-retry]')).toHaveCount(1)
    await page.getByRole('textbox', { name: '问我的 AI 分身' }).fill('没发出的草稿')
    const popupPromise = page.waitForEvent('popup')
    await page.getByRole('link', { name: '全屏对话', exact: true }).click()
    const popup = await popupPromise
    await expect(popup.locator('#state')).toContainText('之前的问题')
    const snapshot = JSON.parse(await popup.locator('#state').innerText())
    expect(snapshot.draft).toBe('没发出的草稿')
    expect(snapshot.messages).toHaveLength(2)
    expect(snapshot.messages[1]).toMatchObject({ content: '之前的回答[1]', status: 'completed', sources: [{ tag: '项目档案', project: 'todo-memo' }] })
    expect(decodeURIComponent(popup.url())).not.toMatch(/之前的|没发出/)
    await expect(page.locator('#liveThread .q')).toHaveText('之前的问题')
  })

  test('keeps the original conversation when the full-screen popup is blocked', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    await page.evaluate(() => { window.open = () => null })
    const url = page.url()
    await page.getByRole('link', { name: '全屏对话', exact: true }).click()
    await expect(page.getByText(/浏览器阻止了新窗口/)).toBeVisible()
    await expect(page).toHaveURL(url)
  })

  test('asks the visitor to finish or stop generation before continuing in full screen', async ({ page }) => {
    await streamingChat(page)
    await open(page, { width: 1440, height: 900 })
    await page.getByRole('textbox', { name: '问我的 AI 分身' }).fill('正在问的问题')
    await page.getByRole('button', { name: '提问', exact: true }).click()
    const expand = page.getByRole('link', { name: '全屏对话', exact: true })
    await expect(expand).toHaveAttribute('aria-disabled', 'true')
    await expand.click({ force: true })
    await expect(page.getByText(/回答完成或停止后/)).toBeVisible()
    await page.getByRole('button', { name: '停止', exact: true }).click()
    await expect(expand).not.toHaveAttribute('aria-disabled', 'true')
  })

  test('“问我的 AI” takes you to the conversation on this page, not to another site', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    const initialUrl = page.url()
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight))
    await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '问我的 AI' }).click()
    await expect(page).toHaveURL(initialUrl)
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

  test('keeps the education major together at normal and zoom-equivalent widths', async ({ page }) => {
    for (const viewport of [
      { width: 1440, height: 900 }, { width: 1309, height: 818 },
      { width: 1600, height: 900 }, { width: 1920, height: 1080 },
      { width: 760, height: 900 }, { width: 375, height: 812 }, { width: 320, height: 640 },
    ]) {
      await open(page, viewport)
      const majorLines = await page.locator('#hero .facts dd').first().evaluate(element => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
        let node: Node | null
        while ((node = walker.nextNode())) {
          const offset = node.textContent?.indexOf('大数据技术专业') ?? -1
          if (offset < 0) continue
          const range = document.createRange()
          range.setStart(node, offset)
          range.setEnd(node, offset + '大数据技术专业'.length)
          return range.getClientRects().length
        }
        return 0
      })
      expect(majorLines, JSON.stringify(viewport)).toBe(1)
    }
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

  test('two things on the first screen: who I am, beside the conversation', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    await expect(page.locator('#hero > .panel')).toHaveCount(2)
    await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished)))
    const [profile, chat] = await page.locator('#hero > .panel').evaluateAll(panels => panels.map(panel => panel.getBoundingClientRect().toJSON()))
    expect(Math.round(profile.top)).toBe(Math.round(chat.top))
    expect(chat.left).toBeGreaterThan(profile.right)
  })

  test('how the answer was found sits between question and answer, folded like a model’s thinking', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    const thinking = page.locator('#hero .sample details.thinking')
    await expect(thinking).toHaveCount(1)
    await expect(thinking).not.toHaveAttribute('open', '')
    await expect(thinking.locator('summary')).toContainText('已检索公开资料')
    await expect(thinking.locator('summary')).toContainText('命中 2 篇')
    await expect(thinking.locator('.step').first()).toBeHidden()
    const [question, summary, answer] = await Promise.all(['#hero .sample .q', '#hero .thinking summary', '#introAnswer'].map(selector => page.locator(selector).first().evaluate(el => el.getBoundingClientRect().toJSON())))
    expect(summary.top).toBeGreaterThanOrEqual(question.bottom)
    expect(answer.top).toBeGreaterThanOrEqual(summary.bottom)
    // A quiet line, not a box.
    expect(await thinking.evaluate(el => [getComputedStyle(el).borderTopWidth, getComputedStyle(el).backgroundColor])).toEqual(['0px', 'rgba(0, 0, 0, 0)'])
    await thinking.locator('summary').click()
    await expect(thinking.locator('.step').first()).toBeVisible()
  })

  test('the thinking lists the four retrieval steps and the sources it hit', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    const thinking = page.locator('#hero .thinking')
    await expect(thinking.locator('.step b')).toHaveText(['理解问题', '关键词 + 向量双路检索', '挑出最相关的资料', 'DeepSeek 生成回答'])
    await expect(thinking.locator('.doc.hit')).toHaveText([/待办备忘/, /Jaxson AI Space/])
  })

  test('a live answer thinks in the open, then folds the thinking away once it starts answering', async ({ page }) => {
    await page.route('https://cms.example.test/api/chat', async route => {
      await new Promise(resolve => setTimeout(resolve, 1200))
      await route.fulfill({ contentType: 'text/event-stream', body: sse('meta', { evidence: ['项目档案：待办备忘', '广东润喵云科技 · 开发实习生'], generator: 'external' }) + sse('text', { text: '回答。' }) + sse('done', {}) })
    })
    await open(page, { width: 1440, height: 900 })
    await page.locator('#hero .chips button').first().click()
    const thinking = page.locator('#hero .live .round').last().locator('details.thinking')
    await expect(thinking).toHaveAttribute('open', '')
    await expect(thinking.locator('summary')).toContainText('正在检索公开资料')
    await expect(page.locator('#hero .live .a').last()).toHaveText('回答。')
    await expect(thinking).not.toHaveAttribute('open', '')
    await expect(thinking.locator('summary')).toContainText('命中 2 篇')
    await expect(thinking.locator('summary')).toContainText(/用时 \d+(\.\d)? 秒/)
    await expect(thinking.locator('.doc.hit')).toHaveText([/项目档案：待办备忘/, /开发实习生/])
    // Every answer keeps its own thinking.
    await page.getByRole('textbox', { name: '问我的 AI 分身' }).fill('你会哪些技术？')
    await page.keyboard.press('Enter')
    await expect(page.locator('#hero .live .a')).toHaveCount(2)
    await expect(page.locator('#hero .live .round .thinking')).toHaveCount(2)
  })

  test('asking answers right here: the question, the streamed answer and its sources', async ({ page }) => {
    const bodies = await askable(page, [sse('meta', { evidence: ['项目档案：待办备忘'], generator: 'external' }), sse('text', { text: '我会 **React**' }), sse('text', { text: ' 和 TypeScript。' }), sse('done', {})])
    const initialUrl = page.url()
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
    await expect(page).toHaveURL(initialUrl)
    expect(bodies[0]).toEqual({ messages: [{ role: 'user', content: '你会哪些技术？' }] })
    const thinking = page.locator('#hero .live .thinking')
    await expect(thinking.locator('.doc.hit')).toHaveText([/项目档案：待办备忘/])
    await expect(thinking.locator('.step small').nth(2)).toHaveText('命中 1 篇资料')
    await expect(field).toHaveValue('')
  })

  test('a live answer cites like the sample: numbered marks, then a card for each cited source', async ({ page }) => {
    await askable(page, [
      sse('meta', { evidence: ['项目档案：待办备忘 (Todo Memo)', '广东润喵云科技 · 开发实习生', '没被引用的资料'], generator: 'external',
        sources: [{ tag: '项目档案：待办备忘 (Todo Memo)', project: 'todo-memo' }, { tag: '广东润喵云科技 · 开发实习生' }, { tag: '没被引用的资料' }] }),
      sse('text', { text: '我做过**待办备忘**[1]，也在润喵云实习过[2]。' }),
      sse('text', { text: '\n\n---\n**引用事实证据**：事实证据 1、事实证据 2。' }),
      sse('done', {}),
    ])
    await page.locator('.chips button').first().click()
    const live = page.locator('#hero .live')
    await expect(live.locator('.a sup')).toHaveText(['1', '2'])
    await expect(live.locator('.a')).toHaveText('我做过待办备忘1，也在润喵云实习过2。')
    await expect(live.locator('.src div span')).toHaveText(['来源 1', '来源 2'])
    await expect(live.locator('.src b')).toHaveText(['待办备忘 (Todo Memo)', '广东润喵云科技 · 开发实习生'])
    await expect(live.locator('.src').first().locator('img')).toHaveAttribute('src', /todo-memo-cover/)
    await expect(live.locator('.src').first()).toHaveAttribute('href', '#works')
    await expect(live.locator('.src').nth(1).locator('.thumb')).toHaveText('广')
  })

  test('without numbered marks every source gets a card; tags alone still find the project', async ({ page }) => {
    await askable(page, [
      sse('meta', { evidence: ['项目档案：Jaxson AI Space (本站 · 全栈个人门户与 AI 分身)', '张锦鹏个人履历'], generator: 'local' }),
      sse('text', { text: '这是本站。' }), sse('done', {}),
    ])
    await page.locator('.chips button').first().click()
    const live = page.locator('#hero .live')
    await expect(live.locator('.src b')).toHaveText(['Jaxson AI Space', '张锦鹏个人履历'])
    await expect(live.locator('.src').first().locator('img')).toHaveAttribute('src', /jaxson-ai-space-home/)
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
    expect(clipped).toEqual([true, true])
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
    await expect(page.locator('#hero .thinking .step small').nth(2)).toHaveText('没有找到相关的公开资料')
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
      // On short windows the conversation scrolls; the fold line may sit below its fold.
      if (viewport.height >= 768) await expect(page.locator('#hero .thinking summary'), where).toBeInViewport({ ratio: 1 })
      // Panels never cut their own content off.
      const clipped = await page.locator('#hero .panel').evaluateAll(panels => panels
        .filter(panel => panel.scrollHeight > panel.clientHeight + 1).map(panel => panel.className))
      expect(clipped, where).toEqual([])
    }
  })

  test('phones stack profile and conversation in one column', async ({ page }) => {
    await open(page, { width: 375, height: 812 })
    await expect(page.locator('#hero .profile h1')).toBeInViewport()
    const lefts = await page.locator('#hero .panel').evaluateAll(panels => panels.map(panel => Math.round(panel.getBoundingClientRect().left)))
    expect(new Set(lefts).size).toBe(1)
  })
})

test.describe('conversation controls', () => {
  test('accepts CRLF events and multiline data split between network chunks', async ({ page }) => {
    await streamingChat(page)
    await open(page, { width: 1440, height: 900 })
    await page.getByRole('textbox', { name: '问我的 AI 分身' }).fill('协议回归')
    await page.getByRole('button', { name: '提问', exact: true }).click()
    await pushChat(page, 'event: text\r\ndata: {\r\ndata: "text": "格式兼容的回答"}\r\n\r')
    await pushChat(page, '\nevent: done\r\ndata: {}\r\n\r\n')
    await expect(page.locator('#liveThread .a')).toHaveText('格式兼容的回答')
    await expect(page.locator('#liveThread .status')).toHaveCount(0)
  })
  test('a long question fits its editor when opened and after narrowing the phone viewport', async ({ page }) => {
    const question = '请详细介绍你在实习期间负责的工作内容和具体贡献。'.repeat(3)
    await askable(page, [sse('text', { text: '收到这个问题。' }), sse('done', {})])
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('textbox', { name: '问我的 AI 分身' }).fill(question)
    await page.keyboard.press('Enter')
    await expect(page.locator('.live .a')).toHaveText('收到这个问题。')
    await page.getByRole('button', { name: '编辑问题', exact: true }).click()
    const editor = page.getByRole('textbox', { name: '编辑问题', exact: true })
    await expect(editor).toHaveValue(question)
    await expect.poll(() => editor.evaluate(input => input.scrollHeight - input.clientHeight)).toBeLessThanOrEqual(1)
    await page.setViewportSize({ width: 320, height: 740 })
    await expect.poll(() => editor.evaluate(input => input.scrollHeight - input.clientHeight)).toBeLessThanOrEqual(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
  })

  test('older answers cannot start regeneration while another answer is streaming', async ({ page }) => {
    await streamingChat(page)
    await open(page, { width: 1440, height: 900 })
    await page.locator('.chips button').first().click()
    await pushChat(page, sse('text', { text: '第一轮回答' }), sse('done', {}))
    const retry = page.getByRole('group', { name: '回答操作' }).first().getByRole('button', { name: '重试', exact: true })
    await expect(retry).toBeEnabled()
    await page.getByRole('textbox', { name: '问我的 AI 分身' }).fill('继续问一个问题')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: '停止', exact: true })).toBeEnabled()
    await expect(retry).toBeDisabled()
    await pushChat(page, sse('text', { text: '第二轮回答' }), sse('done', {}))
    await expect(retry).toBeEnabled()
    await expect(page.locator('.live .q')).toHaveCount(2)
  })

  test('user messages keep their timestamp, copy and edit controls under the right-hand bubble', async ({ page }) => {
    await askable(page, [sse('text', { text: '收到你的问题。' }), sse('done', {})])
    await page.locator('.chips button').first().click()
    const user = page.locator('.live .user-message')
    await expect(user.getByRole('group', { name: '消息操作' })).toBeVisible()
    await expect(user.locator('time')).toHaveText(/^\d{2}:\d{2}$/)
    const field = page.getByRole('textbox', { name: '问我的 AI 分身' })
    await field.fill('未发送的草稿')
    await user.getByRole('button', { name: '编辑问题' }).click()
    await expect(user.getByRole('textbox', { name: '编辑问题' })).toHaveValue('你的实习做了什么？')
    await expect(user.locator('.q')).toHaveCount(0)
    await expect(user.locator('.user-tools')).toHaveCount(0)
    await expect(field).toHaveValue('未发送的草稿')
    await user.getByRole('button', { name: '取消', exact: true }).click()
    await expect(user.locator('.q')).toHaveText('你的实习做了什么？')
    await user.getByRole('button', { name: '编辑问题' }).click()
    await page.keyboard.press('Escape')
    await expect(user.locator('.question-editor')).toHaveCount(0)
    await expect(field).toHaveValue('未发送的草稿')
    await expect(page.locator('.greet')).toBeHidden()
    await expect(page.locator('.chips')).toBeHidden()
  })

  test('completed answers have a copy action with success feedback', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: {
      writeText: async (text: string) => { (window as unknown as { copiedAnswer: string }).copiedAnswer = text },
    } }))
    await askable(page, [sse('text', { text: '可复制的回答 [1]' }), sse('done', {})])
    await page.locator('.chips button').first().click()
    const tools = page.getByRole('group', { name: '回答操作' })
    await expect(tools.locator('time')).toHaveCount(0)
    const copy = tools.getByRole('button', { name: '复制回答' })
    await expect(copy).toHaveText('')
    await expect(copy).toHaveAttribute('title', '复制回答')
    await copy.click()
    await expect(tools.getByRole('status')).toHaveText('已复制')
    expect(await page.evaluate(() => (window as unknown as { copiedAnswer: string }).copiedAnswer)).toBe('可复制的回答 [1]')
  })

  test('editing a question replaces that branch and does not send the old answers as history', async ({ page }) => {
    const bodies = await askable(page, [sse('text', { text: '一条完整回答' }), sse('done', {})])
    const field = page.getByRole('textbox', { name: '问我的 AI 分身' })
    await field.fill('原问题')
    await page.keyboard.press('Enter')
    await expect(page.locator('.live .a')).toHaveCount(1)
    await field.fill('后续问题')
    await page.keyboard.press('Enter')
    await expect(page.locator('.live .a')).toHaveCount(2)
    const user = page.locator('.live .user-message').first()
    await user.getByRole('button', { name: '编辑问题' }).click()
    await user.getByRole('textbox', { name: '编辑问题' }).fill('修改后的问题')
    await user.getByRole('button', { name: '发送', exact: true }).click()
    await expect(page.locator('.live .q')).toHaveText(['修改后的问题'])
    await expect(page.locator('.live .a')).toHaveText(['一条完整回答'])
    expect(bodies[2].messages).toEqual([{ role: 'user', content: '修改后的问题' }])
  })

  test('regenerating a completed answer reuses the question without including its old answer', async ({ page }) => {
    const bodies = await askable(page, [sse('text', { text: '可重新生成的回答' }), sse('done', {})])
    await page.locator('.chips button').first().click()
    await page.getByRole('group', { name: '回答操作' }).getByRole('button', { name: '重试', exact: true }).click()
    await expect(page.locator('.live .a')).toHaveText(['可重新生成的回答'])
    await expect(page.locator('.live .q')).toHaveCount(1)
    expect(bodies[1].messages).toEqual([{ role: 'user', content: '你的实习做了什么？' }])
  })

  test('a rejected clipboard write gives feedback without breaking the answer', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: {
      writeText: async () => { throw new Error('Clipboard unavailable') },
    } }))
    await askable(page, [sse('text', { text: '保留这段回答' }), sse('done', {})])
    await page.locator('.chips button').first().click()
    await page.getByRole('button', { name: '复制回答' }).click()
    await expect(page.getByRole('status')).toHaveText('复制失败，请手动选择文字')
    await expect(page.locator('.live .a')).toHaveText('保留这段回答')
  })

  test('stops a pending request on mobile and allows another question with the draft intact', async ({ page }) => {
    await streamingChat(page)
    await open(page, { width: 375, height: 812 })
    await page.locator('.chips button').first().click()
    const field = page.getByRole('textbox', { name: '问我的 AI 分身' })
    await field.fill('下一条问题草稿')
    await expect(page.locator('.chips button').first()).toBeDisabled()
    await page.getByRole('button', { name: '停止', exact: true }).click()
    await expect(page.locator('.live .status')).toContainText('已停止本次提问')
    await expect(page.getByRole('button', { name: '复制回答' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '重试', exact: true })).toHaveText('')
    await expect(field).toHaveValue('下一条问题草稿')
    expect(await page.evaluate(() => (window as unknown as StreamingFixture).chatFixture.requests[0].signal?.aborted)).toBe(true)
    await page.getByRole('button', { name: '提问', exact: true }).click()
    await pushChat(page, sse('text', { text: '第二次成功' }), sse('done', {}))
    await expect(page.locator('.live .a')).toHaveText(['第二次成功'])
    expect(await page.evaluate(() => (window as unknown as StreamingFixture).chatFixture.requests[1].messages)).toEqual([{ role: 'user', content: '下一条问题草稿' }])
    expect(await page.evaluate(() => (window as unknown as StreamingFixture).chatFixture.requests[1].cancelled)).toBe(true)
  })

  test('stopping a partial answer retains its text and retries in the same round', async ({ page }) => {
    await streamingChat(page)
    await open(page, { width: 1440, height: 900 })
    await page.locator('.chips button').first().click()
    await pushChat(page, sse('text', { text: '已经生成的内容' }))
    await expect(page.locator('.live .a')).toHaveText('已经生成的内容')
    await page.getByRole('button', { name: '停止', exact: true }).click()
    await expect(page.locator('.live .status')).toContainText('已停止生成')
    await expect(page.locator('.live .thinking')).not.toHaveAttribute('open', '')
    await expect(page.locator('.live .a')).toHaveText('已经生成的内容')
    await page.locator('.live').getByRole('button', { name: '重试' }).click()
    await pushChat(page, sse('text', { text: '完整的新回答' }), sse('done', {}))
    await expect(page.locator('.live .q')).toHaveCount(1)
    await expect(page.locator('.live .a')).toHaveText('完整的新回答')
    await expect(page.locator('.live .status')).toHaveCount(0)
  })

  test('offers feedback during a stall, times out, and resets the idle timer on progress', async ({ page }) => {
    await page.clock.install()
    await streamingChat(page)
    await open(page, { width: 1440, height: 900 })
    await page.locator('.chips button').first().click()
    await page.clock.fastForward(12001)
    await expect(page.locator('.live .wait-note')).toBeVisible()
    await pushChat(page, sse('text', { text: '开始回答' }))
    await expect(page.locator('.live .wait-note')).toBeHidden()
    await page.clock.fastForward(34000)
    await expect(page.getByRole('button', { name: '停止', exact: true })).toBeEnabled()
    await page.clock.fastForward(11001)
    await expect(page.locator('.live .status')).toContainText('长时间未更新')
    await expect(page.locator('.live .a')).toHaveText('开始回答')
    await expect(page.getByRole('button', { name: '提问', exact: true })).toBeEnabled()
  })

  test('lets the reader scroll up during streaming and resumes following at the bottom', async ({ page }) => {
    await streamingChat(page)
    await open(page, { width: 1440, height: 900 })
    await page.locator('.chips button').first().click()
    await pushChat(page, sse('text', { text: Array.from({ length: 50 }, (_, i) => `第 ${i + 1} 行`).join('\n') }))
    const thread = page.locator('#hero .thread')
    await expect(page.locator('.live .a')).toContainText('第 50 行')
    await thread.evaluate(node => { node.scrollTop = 0; node.dispatchEvent(new Event('scroll')) })
    await pushChat(page, sse('text', { text: '\n新增内容' }))
    await expect(page.locator('.live .a')).toContainText('新增内容')
    expect(await thread.evaluate(node => node.scrollTop)).toBe(0)
    await thread.evaluate(node => { node.scrollTop = node.scrollHeight; node.dispatchEvent(new Event('scroll')) })
    await pushChat(page, sse('text', { text: '\n最新内容' }), sse('done', {}))
    await expect(page.locator('.live .a')).toContainText('最新内容')
    expect(await thread.evaluate(node => node.scrollHeight - node.clientHeight - node.scrollTop)).toBeLessThan(2)
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
    const thinking = page.locator('#hero .thinking')
    await expect(thinking.locator('.doc.hit')).toHaveText([/项目2/, /项目4/])
    await expect(thinking.locator('.doc').nth(2)).toContainText('还有 3 篇项目档案')
    await expect(thinking.locator('.step small').nth(2)).toHaveText('命中 2 篇项目档案')
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

  test('every project is the same small card; featured ones lead, the rest follow in CMS order', async ({ page }) => {
    await open(page, { width: 1440, height: 900 }, five)
    await expect(page.locator('#works .project h3')).toHaveText(['项目2', '项目4', '项目0', '项目1', '项目3'])
    const sizes = await page.locator('#works .project').evaluateAll(cards => cards.map(card => {
      const box = card.getBoundingClientRect()
      return `${Math.round(box.width)}x${Math.round(box.height)}`
    }))
    expect(new Set(sizes.slice(0, 3)).size, sizes.join(' ')).toBe(1)
    await expect(page.locator('#works .more-list, #works .row')).toHaveCount(0)
  })

  test('three cards per row on wide screens, two on tablets, one on phones', async ({ page }) => {
    for (const [width, perRow] of [[1440, 3], [768, 2], [375, 1]]) {
      await open(page, { width, height: 900 }, five)
      const tops = await page.locator('#works .project').evaluateAll(cards => cards.map(card => Math.round(card.getBoundingClientRect().top)))
      expect(tops.filter(top => top === tops[0]).length, `${width}px`).toBe(perRow)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
    }
  })

  test('fewer than three projects share the whole row instead of leaving a gap', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    const [grid, last] = await Promise.all([
      page.locator('#works .works').evaluate(el => el.getBoundingClientRect().right),
      page.locator('#works .project').last().evaluate(el => el.getBoundingClientRect().right),
    ])
    expect(Math.abs(grid - last)).toBeLessThanOrEqual(1)
  })

  test('shows six cards, then a button reveals the rest', async ({ page }) => {
    const twelve = Array.from({ length: 12 }, (_, index) => project(`p${index}`, `项目${index}`))
    await open(page, { width: 1440, height: 900 }, twelve)
    await expect(page.locator('#works .project')).toHaveCount(6)
    const more = page.getByRole('button', { name: '显示全部 12 个项目' })
    await expect(more).toHaveAttribute('aria-expanded', 'false')
    await more.click()
    await expect(page.locator('#works .project')).toHaveCount(12)
    await expect(more).toHaveCount(0)
  })

  test('projects without a screenshot get a light cover with their initial and stack', async ({ page }) => {
    await open(page, { width: 1440, height: 900 }, [
      project('a', '项目甲', { image: '', featured: true }),
      project('b', '项目乙', { image: 'project-dossier-cover.svg', featured: true }),
    ])
    const covers = page.locator('#works .cover')
    await expect(covers).toHaveCount(2)
    for (const index of [0, 1]) {
      await expect(covers.nth(index)).toHaveClass(/placeholder/)
      await expect(covers.nth(index).locator('b')).toHaveText('项')
      await expect(covers.nth(index).locator('b')).toHaveCSS('opacity', '1')
      await expect(covers.nth(index).locator('li')).toHaveText(['React', 'TypeScript', 'Supabase'])
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
  test('project essentials are readable immediately without disclosures or truncated sentences', async ({ page }) => {
    const summary = '面向招聘方展示项目与公开经历，支持查看项目和提问。'
    const action = '通过产品设计、界面审计和 AI 协作完善项目。'.repeat(12)
    const note = '代码主要通过 AI 协作完成，负责产品定位与交互方向。'
    const technologies = ['Next.js', 'React', 'TypeScript', 'Payload', 'PostgreSQL', 'pgvector']
    await open(page, { width: 1440, height: 900 }, [project('compact', '项目展示', {
      summary, action, note, technologies, outcome: '已部署上线，支持流式回答与来源引用。',
    })])
    await page.locator('#works .project button').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.locator('details, summary')).toHaveCount(0)
    await expect(dialog.getByText(action, { exact: true })).toHaveCount(0)
    await expect(dialog.locator('.project-stack li')).toHaveText(technologies)
    await expect(dialog.locator('p.summary')).toHaveText(summary)
    await expect(dialog.getByText(note, { exact: true })).toBeVisible()
    await expect(dialog.locator('.project-highlights li')).toHaveText([
      '通过产品设计、界面审计和 AI 协作完善项目。',
      '已部署上线，支持流式回答与来源引用。',
    ])
    const stack = await dialog.locator('.project-stack').boundingBox()
    const links = await dialog.locator('.links').boundingBox()
    expect(links!.y - stack!.y - stack!.height).toBeLessThanOrEqual(28)
    expect(await dialog.innerText()).not.toContain('…')
    await expect(dialog.getByRole('link', { name: '在线体验' })).toBeInViewport()
  })

  test('a project source opens that project directly and returns focus when closed', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    const initialUrl = page.url()
    const source = page.locator('#hero .src').first()
    await source.click()
    await expect(page.getByRole('dialog', { name: '待办备忘 (Todo Memo)', exact: true })).toBeVisible()
    await expect(page).toHaveURL(initialUrl)
    await page.keyboard.press('Escape')
    await expect(source).toBeFocused()
  })

  test('shows the CMS participation note separately from the technologies the project uses', async ({ page }) => {
    const note = '负责产品定位、页面信息组织与交互方向；通过 AI 协作完成代码实现，并参与功能验证和迭代。'
    await open(page, { width: 1440, height: 900 }, [project('jaxson-ai-space', 'Jaxson AI Space', {
      role: '产品定位、交互设计与 AI 协作开发', note,
    })])
    await page.locator('#works .project').getByRole('button').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText(note, { exact: true })).toBeVisible()
    await expect(dialog.getByText('主要技术', { exact: true })).toBeVisible()
    await expect(dialog.locator('.work-role')).toContainText(note)
  })

  test('each card shows the screenshot, name, summary and main stack, and opens its details', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    const cards = page.locator('#works .project')
    await expect(cards).toHaveCount(2)
    await expect(cards.locator('h3')).toHaveText(['待办备忘 (Todo Memo)', 'Jaxson AI Space'])
    const first = cards.first()
    await expect(first.getByText('已上线的待办与备忘工具', { exact: false })).toBeVisible()
    await expect(first.locator('.tags li')).toHaveText(['React', 'TypeScript', 'Supabase'])
    await expect(first.locator('img')).toHaveAttribute('src', './optimized/todo-memo-cover-900.765d77142054.webp')
    await expect(first.locator('.story, a')).toHaveCount(0)
    const opener = first.getByRole('button', { name: /待办备忘 \(Todo Memo\)/ })
    await expect(opener).toHaveAttribute('aria-haspopup', 'dialog')
    await opener.click()
    const dialog = page.getByRole('dialog', { name: '待办备忘 (Todo Memo)' })
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('.story, details')).toHaveCount(0)
    await expect(dialog.locator('.project-highlights')).toContainText('支持 PWA 安装与多设备同步。')
    await expect(dialog.locator('.tags li')).toHaveText(['React', 'TypeScript', 'Supabase'])
    await expect(dialog.getByRole('link', { name: '在线体验' })).toHaveAttribute('href', 'https://todo.example.test/')
    await expect(dialog.getByRole('link', { name: '在线体验' })).toHaveAttribute('rel', /noopener/)
    await expect(dialog.getByRole('link', { name: '源码' })).toHaveAttribute('href', 'https://github.com/example/todo')
    await expect(dialog.locator('.media img')).toHaveAttribute('alt', '待办备忘 (Todo Memo)界面截图')
  })

  test('desktop project dialogs keep the same compact frame while longer details scroll independently', async ({ page }, testInfo) => {
    const note = '参与说明保留完整内容，不因布局收起或删减。'
    for (const [width, height] of [[1440, 900], [1280, 720], [1100, 520]]) {
      await open(page, { width, height }, [
        project('short', '简短项目'),
        project('long', 'Jaxson AI Space（电子简历与 AI 分身）', {
          summary: '参与产品定位、信息层级、界面审计与交互验证。'.repeat(12), note,
        }),
      ])
      const dialog = page.getByRole('dialog')
      const cards = page.locator('#works .project button')
      const frames: { width: number; height: number; y: number }[] = []
      for (const card of [cards.nth(0), cards.nth(1)]) {
        await card.click()
        await dialog.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)))
        const box = await dialog.boundingBox()
        expect(box).not.toBeNull()
        frames.push(box!)
        expect(box!.height).toBeLessThanOrEqual(Math.min(640, height - 64) + 1)
        if (width === 1440) await page.screenshot({ path: testInfo.outputPath(`project-dialog-${frames.length}.png`) })
        await page.keyboard.press('Escape')
      }
      expect(Math.abs(frames[0].height - frames[1].height)).toBeLessThanOrEqual(1)
      expect(Math.abs(frames[0].y - frames[1].y)).toBeLessThanOrEqual(1)
      await cards.nth(1).click()
      await dialog.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)))
      const info = dialog.locator('.info')
      const media = dialog.locator('.media')
      const mediaBefore = await media.boundingBox()
      expect(await info.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
      await dialog.getByText(note, { exact: true }).scrollIntoViewIfNeeded()
      await dialog.getByRole('link', { name: '源码' }).scrollIntoViewIfNeeded()
      expect(await info.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
      expect(await media.boundingBox()).toEqual(mediaBefore)
      expect(await dialog.locator('.frame').evaluate(el => el.scrollTop)).toBe(0)
      await page.keyboard.press('Escape')
      await cards.nth(1).click()
      expect(await info.evaluate(el => el.scrollTop)).toBe(0)
      await page.keyboard.press('Escape')
    }
  })

  test('long project details remain reachable in the stacked phone dialog', async ({ page }) => {
    const note = '完整参与说明'
    await open(page, { width: 375, height: 667 }, [project('phone', '较长的项目介绍', {
      summary: '产品设计、交互审计与功能验证。'.repeat(16), note,
    })])
    await page.locator('#works .project button').click()
    const dialog = page.getByRole('dialog')
    await dialog.getByText(note, { exact: true }).scrollIntoViewIfNeeded()
    await dialog.getByRole('link', { name: '源码' }).scrollIntoViewIfNeeded()
    expect(await dialog.locator('.frame').evaluate(el => el.scrollTop)).toBeGreaterThan(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
    await dialog.getByRole('button', { name: '关闭' }).click()
    await expect(dialog).toBeHidden()
  })

  test('the dialog plays the demo video when the project has one, with the screenshot as its poster', async ({ page }) => {
    await page.route('https://cms.example.test/media/**', route => route.fulfill({ status: 404 }))
    await open(page, { width: 1440, height: 900 }, [project('demo', '演示项目', { video: 'https://cms.example.test/media/demo.mp4' }), project('still', '无视频项目')])
    await page.locator('#works .project').first().getByRole('button').click()
    const video = page.getByRole('dialog').locator('.media video')
    await expect(video).toHaveAttribute('src', 'https://cms.example.test/media/demo.mp4')
    await expect(video).toHaveAttribute('poster', './optimized/todo-memo-cover-900.765d77142054.webp')
    expect(await video.evaluate((el: HTMLVideoElement) => [el.controls, el.muted, el.playsInline, el.loop])).toEqual([true, true, true, true])
    await expect(page.locator('#works .project').first().locator('.badge')).toHaveText('演示视频')
    await page.keyboard.press('Escape')
    await expect(page.locator('#projectDialog video')).toHaveCount(0)
    await page.locator('#works .project').nth(1).getByRole('button').click()
    await expect(page.getByRole('dialog').locator('.media video')).toHaveCount(0)
    await expect(page.getByRole('dialog').locator('.media img')).toBeVisible()
  })

  test('the dialog closes by its button, Escape or a click outside, and hands focus back to the card', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    const card = page.locator('#works .project').first().getByRole('button')
    const dialog = page.getByRole('dialog')
    for (const close of [
      () => dialog.getByRole('button', { name: '关闭' }).click(),
      () => page.keyboard.press('Escape'),
      () => page.mouse.click(8, 8),
    ]) {
      await card.click()
      await expect(dialog).toBeVisible()
      await close()
      await expect(dialog).toBeHidden()
      await expect(card).toBeFocused()
    }
  })

  test('in the dialog the media sits left of the details on wide screens and above them on phones', async ({ page }) => {
    for (const [width, height, beside] of [[1440, 900, true], [375, 812, false]] as const) {
      await open(page, { width, height })
      await page.locator('#works .project').first().getByRole('button').click()
      const dialog = page.getByRole('dialog')
      await dialog.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)))
      const [media, info] = await Promise.all(['.media', '.info'].map(selector => dialog.locator(selector).evaluate(el => el.getBoundingClientRect().toJSON())))
      if (beside) expect(info.left).toBeGreaterThanOrEqual(media.right - 1)
      else expect(info.top).toBeGreaterThanOrEqual(media.bottom - 1)
      const box = await dialog.evaluate(el => el.getBoundingClientRect().toJSON())
      expect(box.width).toBeLessThanOrEqual(width)
      expect(box.height).toBeLessThanOrEqual(height)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
    }
  })

  test('this site gets its own screenshot even while the CMS still names the stock image', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    const cover = page.locator('#works .project').nth(1).locator('.cover')
    await expect(cover).not.toHaveClass(/placeholder/)
    await expect(cover.locator('img')).toHaveAttribute('src', /jaxson-ai-space-home/)
    await expect(page.locator('#hero .src').nth(1).locator('img')).toHaveAttribute('src', /jaxson-ai-space-home/)
  })

  test('has no carousel and nothing advances by itself', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    await expect(page.locator('.coverflow-slide')).toHaveCount(0)
    await expect(page.getByRole('dialog')).toBeHidden()
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
    await expect(page.locator('#works')).toContainText('项目暂时无法加载，可以重试。')
  })

  test('handles twenty projects with long unbroken titles and missing links on a small phone', async ({ page }) => {
    const many = Array.from({ length: 20 }, (_, index) => project(`p-${index}`, `SuperLongPortfolioProjectTitleWithoutAnySpaces${index}`,
      index % 2 ? { demoUrl: '', repoUrl: '', image: '' } : {}))
    await open(page, { width: 320, height: 568 }, many)
    await page.getByRole('button', { name: '显示全部 20 个项目' }).click()
    await expect(page.locator('#works .project')).toHaveCount(20)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
    await expect(page.locator('#works .project').nth(1).locator('.cover.placeholder b')).toHaveText('S')
    await page.locator('#works .project').nth(1).getByRole('button').click()
    await expect(page.getByRole('dialog').locator('.links')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
  })

  test('retries an unavailable project feed without clearing the question draft', async ({ page }) => {
    await open(page, { width: 375, height: 812 })
    let calls = 0
    await page.route('**/api/showcase-projects', route => ++calls === 1
      ? route.fulfill({ status: 503, json: { error: 'unavailable' } })
      : route.fulfill({ json: { source: 'cms', projects: twoProjects } }))
    await page.goto('/')
    const field = page.getByRole('textbox', { name: '问我的 AI 分身' })
    await field.fill('还没发出的问题')
    const reload = page.locator('#works').getByRole('button', { name: '重新加载' })
    await expect(reload).toBeVisible()
    await reload.click()
    await expect(page.locator('#works .project')).toHaveCount(2)
    await expect(field).toHaveValue('还没发出的问题')
    expect(calls).toBe(2)
    await expect(page.locator('#works').getByRole('button', { name: '重新加载' })).toHaveCount(0)
  })

  test('unavailable screenshots fall back in cards, sources and the project dialog', async ({ page }) => {
    await page.route('**/missing-project.png', route => route.fulfill({ status: 404 }))
    await open(page, { width: 375, height: 812 }, [project('broken', '失效截图项目', { image: '/missing-project.png' })])
    await expect(page.locator('#hero .src .thumb')).toHaveText('失')
    await page.locator('#works .project').getByRole('button').scrollIntoViewIfNeeded()
    await expect(page.locator('#works .cover.placeholder b')).toHaveText('失')
    await expect(page.locator('#works .cover img')).toHaveCount(0)
    await page.locator('#works .project').getByRole('button').click()
    await expect(page.getByRole('dialog').locator('.cover.placeholder b')).toHaveText('失')
    await expect(page.getByRole('dialog').locator('.cover img')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
  })

  test('a stalled project feed times out and can be loaded again', async ({ page }) => {
    await page.clock.install()
    await open(page, { width: 375, height: 812 })
    let calls = 0
    await page.route('**/api/showcase-projects', route => {
      if (++calls === 1) return // Keep the request open until the client aborts it.
      return route.fulfill({ json: { source: 'cms', projects: twoProjects } })
    })
    await page.goto('/')
    await expect(page.locator('#works')).toContainText('正在加载项目')
    await page.clock.fastForward(10001)
    const reload = page.locator('#works').getByRole('button', { name: '重新加载' })
    await expect(reload).toBeVisible()
    await reload.click()
    await expect(page.locator('#works .project')).toHaveCount(2)
    expect(calls).toBe(2)
  })

  test('renders CMS text as text, never as markup', async ({ page }) => {
    await open(page, { width: 1440, height: 900 }, [project('x', '<img src=x onerror="window.__pwned=1">标题', { video: 'javascript:alert(1)' })])
    await expect(page.locator('#works .project h3')).toHaveText('<img src=x onerror="window.__pwned=1">标题')
    await page.locator('#works .project').getByRole('button').click()
    await expect(page.getByRole('dialog').locator('h3')).toHaveText('<img src=x onerror="window.__pwned=1">标题')
    await expect(page.getByRole('dialog').locator('video')).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined()
  })
})

test.describe('résumé', () => {
  test('shows internship, education and competitions at once, with no stage switching', async ({ page }) => {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }]) {
      await open(page, viewport)
      const bio = page.locator('#bio')
      await expect(bio.locator('.entry h3')).toHaveText(['开发实习生', '大数据技术专业（专科），2027 届', '技能竞赛'])
      for (const text of ['广东润喵云科技有限公司', '深圳职业技术大学', 'GPA 3.85 / 4.0，专业排名前 2%', '2026.06 – 2026.08', '国家级奖项 3 项、省市级奖项 8 项', '一带一路暨金砖国家技能大赛']) {
        await expect(bio.getByText(text, { exact: false }).first(), `${text} ${JSON.stringify(viewport)}`).toBeVisible()
      }
      await expect(bio.getByRole('button')).toHaveCount(0)
      await expect(page.locator('.bio-proof-strip, .milestone-step-btn')).toHaveCount(0)
    }
  })

  test('lists the four skill groups as tags, AI first', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    await expect(page.locator('#bio .skills h3')).toHaveText(['AI 应用开发', '前端开发', '后端与数据', '工程交付'])
    // Four main tools as tags per group; the rest in one quiet line.
    for (const group of await page.locator('#bio .skills .group').all()) {
      expect(await group.locator('li').count()).toBe(4)
      await expect(group.locator('.also')).toHaveCount(1)
    }
  })

  test('the AI group names the retrieval and generation pieces this site really uses', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    const ai = page.locator('#bio .skills .group').first()
    await expect(ai.locator('li')).toHaveText(['RAG 检索增强', 'pgvector 向量检索', 'BM25 + 向量混合检索', '大模型 API 接入（DeepSeek）'])
    for (const item of ['Embedding 向量化', 'SSE 流式输出', '来源引用与回答约束']) await expect(ai.locator('.also')).toContainText(item)
  })

  test('scopes the technology list to project practice and the current deployment', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    await expect(page.locator('#bio .skills-context')).toContainText('产品定位、交互设计、AI 协作开发和功能验证')
    await expect(page.locator('#bio .skills-context')).toContainText('项目与实习中使用的技术')
    const delivery = page.locator('#bio .skills .group').last()
    await expect(delivery.locator('li')).toHaveText(['Docker Compose', 'Linux 运维', 'Git 与 GitHub', 'Caddy'])
    await expect(delivery.locator('.also')).toContainText('本站使用 Cloudflare；待办备忘使用 Vercel')
    await expect(delivery).not.toContainText(/PM2|Cloudflare Tunnel/)
  })

  test('the résumé sits on the page itself: no boxes around experience or skills', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    await expect(page.locator('#bio .panel')).toHaveCount(0)
    const styles = await page.locator('#bio .bio > *').evaluateAll(columns => columns.map(column => {
      const style = getComputedStyle(column)
      return [style.borderTopWidth, style.backgroundColor, style.boxShadow].join(' ')
    }))
    expect(styles).toEqual(['0px rgba(0, 0, 0, 0) none', '0px rgba(0, 0, 0, 0) none'])
  })

  test('puts experience and skills side by side on wide screens, dates beside entries', async ({ page }) => {
    const layout = async () => page.locator('#bio .entry').first().evaluate(entry => {
      const when = entry.querySelector('.when')!.getBoundingClientRect(), title = entry.querySelector('h3')!.getBoundingClientRect()
      return when.right <= title.left ? 'side' : when.bottom <= title.top ? 'above' : 'overlap'
    })
    await open(page, { width: 1440, height: 900 })
    expect(await layout()).toBe('side')
    const [timeline, skills] = await page.locator('#bio .bio > *').evaluateAll(columns => columns.map(column => Math.round(column.getBoundingClientRect().top)))
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

  test('the page ends on an open line, not a dark block', async ({ page }) => {
    await open(page, { width: 1440, height: 900 })
    expect(await page.locator('#beyond').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
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
    expect(animations).toEqual(Array(2).fill(testInfo.project.name === 'reduced-motion' ? 'none' : 'rise'))
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
