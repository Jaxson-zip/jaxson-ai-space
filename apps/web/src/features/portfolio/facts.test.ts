import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, URL as NodeUrl } from 'node:url'
import { describe, expect, it } from 'vitest'
import { awards, experiences } from './content'

// The owner confirmed these on 2026-10-23. Every public copy must say the same thing.
// docker/tests/test_public_delivery.py checks both shipped PDFs; CMS records are maintained separately.
const root = fileURLToPath(new NodeUrl('../../../../../', import.meta.url))
const publicSources = [
  'apps/portfolio/index.html',
  'apps/portfolio/public/ruili-cover.svg',
  'apps/web/public/assets/ruili-cover.svg',
  'apps/web/src/app/(frontend)/layout.tsx',
  'apps/web/src/features/portfolio/content.ts',
]
const retired = ['前 3%', '前 5%', 'GPA 3.67', '至今', '2026 年起', '现于', '全栈开发实习生', '5 项、省市级奖项 6 项', '连续获得']

describe('résumé facts', () => {
  it('no public page repeats a retired or conflicting fact', () => {
    const found = publicSources.flatMap((file) => {
      const text = readFileSync(join(root, file), 'utf8')
      return retired.filter((phrase) => text.includes(phrase)).map((phrase) => `${file}: ${phrase}`)
    })
    expect(found).toEqual([])
  })

  it('the home page states the confirmed facts', () => {
    const home = readFileSync(join(root, 'apps/portfolio/index.html'), 'utf8')
    for (const fact of ['2026.06 – 2026.08', '开发实习生', 'GPA 3.85 / 4.0，专业排名前 2%', '国家级奖项 3 项、省市级奖项 8 项']) {
      expect(home, fact).toContain(fact)
    }
  })

  it('keeps the internship summary concise and puts its dates in the résumé', () => {
    const home = readFileSync(join(root, 'apps/portfolio/index.html'), 'utf8')
    const page = new DOMParser().parseFromString(home, 'text/html')
    const facts = page.querySelector('#hero .facts')?.textContent || ''
    expect(facts).toContain('实习')
    expect(facts).not.toContain('已结束')
    expect(page.querySelector('#bio .entry .when')?.textContent).toBe('2026.06 – 2026.08')
  })

  it('describes the internship with the same maintenance scope as the confirmed record', () => {
    const home = readFileSync(join(root, 'apps/portfolio/index.html'), 'utf8')
    const page = new DOMParser().parseFromString(home, 'text/html')
    const entry = page.querySelector('#bio .entry')?.textContent || ''
    for (const fact of ['Vue', 'Go', '订单调度', 'Docker', '镜像', 'AI 编程']) {
      expect(entry, fact).toContain(fact)
    }
    for (const unsupported of ['数据统计', '需求评审', '开发与修复订单管理']) {
      expect(entry).not.toContain(unsupported)
    }
  })

  it('the fallback content agrees', () => {
    const internship = experiences.find((entry) => entry.id === 'runmiaoyun-internship')!
    expect(internship.role).toBe('开发实习生')
    expect(internship.period).toBe('2026.06 - 2026.08')
    const education = experiences.find((entry) => entry.id === 'szpu-education')!
    expect(education.summary).toContain('专业前 2%')
    expect(education.bullets.join(' ')).toContain('国家级奖项 3 项、省市级奖项 8 项')
    expect(awards.map((award) => award.level).join(' ')).toContain('专业前 2%')
  })
})
