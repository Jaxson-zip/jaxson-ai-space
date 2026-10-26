import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, URL as NodeUrl } from 'node:url'
import { describe, expect, it } from 'vitest'
import { awards, experiences, profile, projects, skillGroups } from './content'

// The owner confirmed these on 2026-10-23. Every public copy must say the same thing; the CMS records and the
// downloadable résumés are checked separately (docs/事实口径统一-2026-10-24.md).
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

  it('the fallback content agrees', () => {
    const internship = experiences.find((entry) => entry.id === 'runmiaoyun-internship')!
    expect(internship.role).toBe('开发实习生')
    expect(internship.period).toBe('2026.06 - 2026.08')
    const education = experiences.find((entry) => entry.id === 'szpu-education')!
    expect(education.summary).toContain('专业前 2%')
    expect(education.bullets.join(' ')).toContain('国家级奖项 3 项、省市级奖项 8 项')
    expect(awards.map((award) => award.level).join(' ')).toContain('专业前 2%')
  })

  it('does not claim PM2 practice in public skills or project descriptions', () => {
    for (const file of ['apps/portfolio/index.html', 'apps/web/src/features/portfolio/content.ts', 'apps/web/public/assets/jaxson-ai-space-cover.svg']) {
      expect(readFileSync(join(root, file), 'utf8'), file).not.toContain('PM2')
    }
    expect(skillGroups.flatMap((group) => [...group.items])).toContain('Cloudflare Tunnel')
  })

  it('describes the current site deployment separately from general tool experience', () => {
    const site = projects.find((project) => project.slug === 'jaxson-ai-space')!
    expect(site.outcome).toContain('Docker Compose')
    expect(site.outcome).toContain('Caddy')
    expect(site.technologies).not.toContain('Cloudflare Tunnel')
    expect(site.technologies).toContain('Caddy')
    expect(readFileSync(join(root, 'apps/portfolio/index.html'), 'utf8')).toContain('Cloudflare Tunnel')
  })

  it('presents AI application development as the main role and full stack as supporting delivery', () => {
    expect(profile.title).toBe('AI 应用开发 · 全栈交付')
    const home = readFileSync(join(root, 'apps/portfolio/index.html'), 'utf8')
    expect(home).toContain('AI 应用开发为主，全栈开发为辅')
    expect(home).not.toContain('AI 应用与全栈开发</p>')
  })

  it('credits the confirmed product decisions and AI collaboration without claiming a completed solo build', () => {
    const site = projects.find((project) => project.slug === 'jaxson-ai-space')!
    expect(site.role).toBe('产品设计与 AI 协作开发')
    expect(site.status).toBe('已部署 · 持续迭代')
    expect(site.featured).toBe(true)
    expect(site.approach).toContain('旧版首页用途')
    expect(site.approach).toContain('AI 对话')
    expect(site.approach).toContain('AI 协作')
  })
})
