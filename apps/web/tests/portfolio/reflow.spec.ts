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

test('zoomed desktop wheel gestures retain screen-sized paging', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 540 })
  await openScene(page, 'hero')
  const before = await page.evaluate(() => ({ y: scrollY, available: innerHeight - document.querySelector('.site-header')!.getBoundingClientRect().height }))
  await page.mouse.move(10, 300)
  await page.mouse.wheel(0, 40)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before.y + 200)
  const distance = await page.evaluate(y => scrollY - y, before.y)
  expect(distance).toBeLessThanOrEqual(before.available + 1)
  await page.waitForTimeout(900) // A fresh gesture after the transition and inertia guard.
  await page.mouse.wheel(0, 40)
  await expect.poll(() => page.locator('.scene-active').getAttribute('id')).toBe('bio')
  await expect.poll(() => page.evaluate(() => Math.abs(document.querySelector('#bio')!.getBoundingClientRect().top - document.querySelector('.site-header')!.getBoundingClientRect().bottom))).toBeLessThan(2)
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



test('a fitting desktop chapter still advances as a whole and PageUp returns', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openScene(page, 'hero')
  await page.mouse.move(10, 300)
  await page.mouse.wheel(0, 40)
  await expect.poll(() => page.evaluate(() => Math.abs(document.querySelector('#bio')!.getBoundingClientRect().top - 72))).toBeLessThan(2)
  await page.waitForTimeout(900)
  await page.keyboard.press('PageUp')
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
})

test('zoomed chapter paging reaches the final chapter without sticky-preview loops', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 540 })
  await openScene(page, 'hero')
  let reachedFinalChapter = false
  for (let step = 0; step < 14; step++) {
    reachedFinalChapter = await page.evaluate(() => Math.abs(document.querySelector('#beyond')!.getBoundingClientRect().top - document.querySelector('.site-header')!.getBoundingClientRect().bottom) < 2)
    if (reachedFinalChapter) break
    await page.keyboard.press('PageDown')
    await page.waitForTimeout(900)
  }
  expect(reachedFinalChapter).toBe(true)
  // Reading all intermediate pages is optional: navigation jumps directly.
  await page.locator('nav a[href="#hero"]').click()
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
  await page.locator('nav a[href="#beyond"]').click()
  await expect.poll(() => page.evaluate(() => Math.abs(document.querySelector('#beyond')!.getBoundingClientRect().top - document.querySelector('.site-header')!.getBoundingClientRect().bottom))).toBeLessThan(2)
})

test('continuous resize retains the current chapter after paging changes', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await openScene(page, 'works')
  for (const [width, height] of [[1536, 864], [1280, 720], [960, 540], [1920, 1080]]) {
    await page.setViewportSize({ width, height })
    await settle(page)
    await expect.poll(() => page.evaluate(() => Math.abs(document.querySelector('#works')!.getBoundingClientRect().top - document.querySelector('.site-header')!.getBoundingClientRect().bottom))).toBeLessThan(2)
  }
})

test('a fresh wheel gesture is accepted as soon as the previous page arrives', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openScene(page, 'hero')
  await page.mouse.move(10, 300)
  const gestureStarted = Date.now()
  await page.mouse.wheel(0, 60)
  await page.waitForFunction(() => Math.abs(document.querySelector('#bio')!.getBoundingClientRect().top - 72) < 2, null, { polling: 'raf' })
  // Separate gestures, including with instant reduced motion. Do not wait out
  // the old 850ms lock or poll slowly enough to conceal its dead time.
  await page.waitForTimeout(Math.max(0, 300 - (Date.now() - gestureStarted)))
  await page.mouse.wheel(0, 60)
  await expect.poll(() => page.evaluate(() => Math.abs(document.querySelector('#works')!.getBoundingClientRect().top - 72))).toBeLessThan(2)
})

test('reversing the wheel can return to the previous page during a transition', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openScene(page, 'hero')
  await page.mouse.move(10, 300)
  await page.mouse.wheel(0, 60)
  await page.waitForTimeout(160)
  await page.mouse.wheel(0, -60)
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
})

test('small trackpad tail events cannot nudge a settled chapter out of alignment', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openScene(page, 'hero')
  await page.mouse.move(10, 300)
  await page.mouse.wheel(0, 60)
  await page.waitForFunction(() => Math.abs(document.querySelector('#bio')!.getBoundingClientRect().top - 72) < 2, null, { polling: 'raf' })
  for (let tail = 0; tail < 12; tail++) {
    await page.mouse.wheel(0, 1)
    await page.waitForTimeout(20)
  }
  await settle(page)
  expect(await page.evaluate(() => Math.abs(document.querySelector('#bio')!.getBoundingClientRect().top - 72))).toBeLessThan(2)
})

test('navigation cancels the previous wheel transition before the next gesture', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openScene(page, 'hero')
  await page.mouse.move(10, 300)
  await page.mouse.wheel(0, 60)
  await page.waitForTimeout(160)
  await page.locator('nav a[href="#works"]').click()
  await page.waitForFunction(() => Math.abs(document.querySelector('#works')!.getBoundingClientRect().top - 72) < 2, null, { polling: 'raf' })
  await page.mouse.move(10, 300)
  await page.mouse.wheel(0, 60)
  await expect.poll(() => page.evaluate(() => Math.abs(document.querySelector('#beyond')!.getBoundingClientRect().top - 72))).toBeLessThan(2)
})

test('one continuous wheel gesture stays on one page and releases for the next gesture', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openScene(page, 'hero')
  await page.mouse.move(10, 300)
  for (let tick = 0; tick < 24; tick++) {
    await page.mouse.wheel(0, 25)
    await page.waitForTimeout(30)
  }
  await expect.poll(() => page.evaluate(() => Math.abs(document.querySelector('#bio')!.getBoundingClientRect().top - 72))).toBeLessThan(2)
  await page.waitForTimeout(300)
  await page.mouse.wheel(0, 60)
  await expect.poll(() => page.evaluate(() => Math.abs(document.querySelector('#works')!.getBoundingClientRect().top - 72))).toBeLessThan(2)
})

test('resizing during a transition does not leave the previous wheel target locked', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openScene(page, 'hero')
  await page.mouse.move(10, 300)
  await page.mouse.wheel(0, 60)
  await page.waitForTimeout(160)
  await page.setViewportSize({ width: 960, height: 540 })
  await settle(page)
  await page.waitForTimeout(300)
  const before = await page.evaluate(() => scrollY)
  await page.mouse.wheel(0, 60)
  // The last reading step of a long chapter can be shorter than a viewport.
  // Verify the new gesture is handled rather than requiring an arbitrary jump.
  await expect.poll(() => page.evaluate(y => Math.abs(scrollY - y), before)).toBeGreaterThan(2)
})
