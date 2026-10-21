import { expect, test, type Page } from '@playwright/test'

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  })
}

async function openScene(page: Page, id: string) {
  await page.goto('/#' + id)
  await expect(page.locator('.coverflow-slide[data-pos="0"]')).toBeVisible()
  await settle(page)
  await page.locator('#' + id).evaluate(el => el.scrollIntoView({ behavior: 'instant' }))
  await settle(page)
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/showcase-projects', route => route.fulfill({
    json: { source: 'cms', projects: [{ slug: 'reflow', title: '跨端项目档案', summary: '用于回归验证的测试项目。',
      problem: '桌面放大后仍应保持文字可读，项目说明与操作按钮不能重叠。',
      action: '使用网格组织内容，并验证导航、项目档案和分屏浏览。',
      outcome: '文字完整可读，导航能够跳过章节。' }] },
  }))
})

test('navigation has space between its brand and links after zoom reflow', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 540 })
  await openScene(page, 'hero')
  const boxes = await page.evaluate(() => {
    const brand = document.querySelector('.brand-logo')!.getBoundingClientRect()
    const nav = document.querySelector('.nav-links')!.getBoundingClientRect()
    return { brandRight: brand.right, navLeft: nav.left, navRight: nav.right, width: innerWidth }
  })
  expect(boxes.navLeft - boxes.brandRight).toBeGreaterThanOrEqual(16)
  expect(boxes.navRight).toBeLessThanOrEqual(boxes.width)
})

test('the AI entry stays fully visible in the phone header', async ({ page }) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 812 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await openScene(page, 'hero')
    const ai = page.locator('.site-header .nav-ai-link')
    await expect(ai, JSON.stringify(viewport)).toBeInViewport({ ratio: 1 })
    const covered = await ai.evaluate(link => {
      const box = link.getBoundingClientRect()
      return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)?.closest('.nav-ai-link') !== link
    })
    expect(covered, JSON.stringify(viewport)).toBe(false)
    expect((await ai.boundingBox())!.height, JSON.stringify(viewport)).toBeGreaterThanOrEqual(24)
  }
})

test('the desktop finale keeps its contacts and footer on the first screen', async ({ page }) => {
  for (const viewport of [{ width: 1920, height: 900 }, { width: 1440, height: 700 }, { width: 1280, height: 600 },
    { width: 960, height: 540 }, { width: 1780, height: 572 }, { width: 2048, height: 600 }]) {
    await page.setViewportSize(viewport)
    await openScene(page, 'beyond')
    const boxes = await page.evaluate(() => {
      const header = document.querySelector('.site-header')!.getBoundingClientRect()
      const section = document.querySelector('#beyond')!.getBoundingClientRect()
      const info = document.querySelector('.beyond-info-col')!.getBoundingClientRect()
      const footer = document.querySelector('.beyond-footnote')!.getBoundingClientRect()
      return { headerBottom: header.bottom, sectionTop: section.top, sectionHeight: section.height,
        infoTop: info.top, footerBottom: footer.bottom, height: innerHeight }
    })
    expect(Math.abs(boxes.sectionTop - boxes.headerBottom), JSON.stringify(viewport)).toBeLessThan(2)
    expect(boxes.sectionHeight).toBeLessThanOrEqual(boxes.height - boxes.headerBottom + 1)
    expect(boxes.infoTop).toBeGreaterThanOrEqual(boxes.headerBottom + 16)
    expect(boxes.footerBottom).toBeLessThanOrEqual(boxes.height - 16)
    await expect(page.getByRole('link', { name: /发邮件至/ })).toBeInViewport({ ratio: 1 })
    await expect(page.locator('.beyond-secondary')).toBeInViewport({ ratio: 1 })
  }
})

test('the portrait stays alongside the introduction at the tablet-width zoom breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 540 })
  await openScene(page, 'hero')
  const boxes = await page.evaluate(() => {
    const text = document.querySelector('.hero-col-left')!.getBoundingClientRect()
    const portrait = document.querySelector('.hero-col-center')!.getBoundingClientRect()
    return { textRight: text.right, portraitLeft: portrait.left, portraitTop: portrait.top, height: innerHeight }
  })
  expect(boxes.portraitLeft - boxes.textRight).toBeGreaterThanOrEqual(16)
  expect(boxes.portraitTop).toBeLessThan(boxes.height - 100)
})

test('the mouse wheel and paging keys are left to the browser', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 960, height: 540 }]) {
    await page.setViewportSize(viewport)
    await openScene(page, 'hero')
    const prevented = await page.evaluate(() => {
      const target = document.querySelector('#hero')!
      const wheel = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true })
      target.dispatchEvent(wheel)
      return [wheel, ...['PageDown', 'PageUp', ' '].map(key => {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
        document.body.dispatchEvent(event)
        return event
      })].map(event => event.defaultPrevented)
    })
    expect(prevented, JSON.stringify(viewport)).toEqual([false, false, false, false])
  }
})

test('a wheel tick scrolls by its native distance instead of a chapter', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openScene(page, 'hero')
  await page.mouse.move(10, 300)
  await page.mouse.wheel(0, 100)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0)
  await page.waitForTimeout(400)
  expect(await page.evaluate(() => scrollY)).toBeLessThanOrEqual(300)
  expect(await page.locator('.scene-active').getAttribute('id')).toBe('hero')
})

test('native scrolling keeps the chapter indicator in sync', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openScene(page, 'hero')
  for (const [id, progress] of [['bio', '02 / 04'], ['works', '03 / 04'], ['beyond', '04 / 04'], ['hero', '01 / 04']]) {
    await page.evaluate(id => scrollTo({ top: document.getElementById(id)!.offsetTop - 72, behavior: 'instant' }), id)
    await expect.poll(() => page.locator('.scene-active').getAttribute('id')).toBe(id)
    await expect(page.locator('#chapterProgress')).toHaveText(progress)
  }
})

test('header links and the next-chapter button jump to chapter starts', async ({ page }) => {
  const offset = (id: string) => page.evaluate(id => Math.abs(document.getElementById(id)!.getBoundingClientRect().top -
    document.querySelector('.site-header')!.getBoundingClientRect().bottom), id)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openScene(page, 'hero')
  await page.locator('#chapterNext').click()
  await expect.poll(() => offset('bio')).toBeLessThan(2)
  await page.locator('#chapterNext').click()
  await expect.poll(() => offset('works')).toBeLessThan(2)
  // The button is hidden in shorter windows; header links remain.
  await page.setViewportSize({ width: 960, height: 540 })
  await openScene(page, 'hero')
  await page.locator('nav a[href="#beyond"]').click()
  await expect.poll(() => offset('beyond')).toBeLessThan(2)
  await page.locator('nav a[href="#hero"]').click()
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
})

test('long project titles do not run into the cover action after zoom reflow', async ({ page }) => {
  await page.route('**/api/showcase-projects', route => route.fulfill({ json: { source: 'cms', projects: [{
    slug: 'long-title', title: 'SuperLongPortfolioProjectWithoutAnySpaces', summary: '长标题回归测试项目。',
  }] } }))
  await page.setViewportSize({ width: 320, height: 568 })
  await openScene(page, 'works')
  await expect(page.locator('.coverflow-slide[data-pos="0"]')).toBeVisible()
  const boxes = await page.evaluate(() => {
    const slide = document.querySelector('.coverflow-slide[data-pos="0"]')!
    const title = slide.querySelector('h4')!.getBoundingClientRect()
    const link = slide.querySelector('.coverflow-view-link')!.getBoundingClientRect()
    return { titleRight: title.right, titleBottom: title.bottom, titleTop: title.top, linkLeft: link.left, linkTop: link.top,
      slideRight: slide.getBoundingClientRect().right }
  })
  expect(boxes.titleRight).toBeLessThanOrEqual(boxes.slideRight)
  expect(boxes.titleBottom <= boxes.linkTop || boxes.titleRight + 8 <= boxes.linkLeft).toBe(true)
})

test('continuous resize retains the current chapter', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await openScene(page, 'works')
  for (const [width, height] of [[1536, 864], [1280, 720], [960, 540], [1920, 1080]]) {
    await page.setViewportSize({ width, height })
    await settle(page)
    await expect.poll(() => page.evaluate(() => Math.abs(document.querySelector('#works')!.getBoundingClientRect().top - document.querySelector('.site-header')!.getBoundingClientRect().bottom))).toBeLessThan(2)
  }
})

