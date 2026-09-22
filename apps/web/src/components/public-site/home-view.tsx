'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Sparkles,
  ArrowRight,
  ExternalLink,
  Mail,
  Phone,
  FileText,
  Layers,
  Code2,
  Database,
  Cpu,
  Wrench,
  Award,
  Trophy,
  ChevronRight,
  Check,
  X,
  Radio,
} from 'lucide-react'
import { GithubIcon } from '@/components/public-site/icons'
import type { Award as AwardType, Experience, Profile, Project, SkillGroup } from '@/features/portfolio/types'

interface HomeViewProps {
  profile: Profile
  projects: readonly Project[]
  experiences: readonly Experience[]
  skillGroups: readonly SkillGroup[]
  awards: readonly AwardType[]
  isLiveDb?: boolean
}

function getAwardMeta(award: AwardType) {
  const { title, level } = award
  if (level.includes('全国一等') || level.includes('国家级一等')) {
    return {
      tier: 'gold',
      badgeText: '全国一等奖',
      icon: '🏆',
      subtitle: title.includes('泰迪杯')
        ? '全国高校数据智能与分析技能赛项'
        : '国家级一级行业技能竞赛',
    }
  }
  if (level.includes('省级一等') || level.includes('省一等')) {
    return {
      tier: 'emerald',
      badgeText: '省级一等奖',
      icon: '🥇',
      subtitle: title.includes('广东省')
        ? '高职组大数据应用开发 · 广东省教育厅'
        : '省部级重点学科技能竞赛',
    }
  }
  if (level.includes('二等') || level.includes('国家级') || level.includes('国赛')) {
    return {
      tier: 'amber',
      badgeText: '国家级二等奖',
      icon: '🥈',
      subtitle: title.includes('计算机设计')
        ? '教育部高等学校计算机类教指委主办'
        : title.includes('金砖')
        ? '金砖国家技能发展与技术创新大赛'
        : '国家级职业技能竞赛',
    }
  }
  if (level.includes('校级') || level.includes('奖学金') || title.includes('奖学金')) {
    return {
      tier: 'blue',
      badgeText: '综合学业一等',
      icon: '🎓',
      subtitle: 'GPA 3.85 / 4.0 · 综合素质考评专业排名前 2%',
    }
  }
  return {
    tier: 'slate',
    badgeText: level || '竞赛荣誉',
    icon: '🏅',
    subtitle: '重点专业学术与技能认证',
  }
}

export function HomeView({
  profile,
  projects,
  experiences,
  skillGroups,
  awards,
  isLiveDb,
}: HomeViewProps) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const sortedAwards = React.useMemo(() => {
    const getWeight = (lvl: string) => {
      if (lvl.includes('全国一等') || lvl.includes('国一')) return 100
      if (lvl.includes('省级一等') || lvl.includes('省一')) return 90
      if (lvl.includes('国家级二等') || lvl.includes('国二')) return 80
      if (lvl.includes('省级二等') || lvl.includes('省二')) return 70
      if (lvl.includes('奖学金') || lvl.includes('校级')) return 60
      return 50
    }
    return [...awards].sort((a, b) => getWeight(b.level) - getWeight(a.level))
  }, [awards])

  // Close modal on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedProject(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const getCategoryIcon = (category: string) => {
    if (category.includes('前端')) return <Code2 size={16} />
    if (category.includes('后端')) return <Database size={16} />
    if (category.includes('AI')) return <Cpu size={16} />
    return <Wrench size={16} />
  }

  return (
    <div className="portfolio-root">
      {/* Toast Notification */}
      {copiedKey && (
        <div className="toast-notification">
          <Check size={14} />
          <span>已成功复制到剪贴板</span>
        </div>
      )}

      {/* ========================================================
          1. Hero Section (macOS Minimalist Two-Column Layout)
          ======================================================== */}
      <section id="hero" className="hero-section">
        <div className="container">
          <div className="hero-grid-layout">
            {/* Left Column: Intro & Actions */}
            <div className="hero-left-col">
              <div className="hero-badge-row">
                <span className="macos-status-badge">
                  <span className="status-dot"></span>
                  <span>2027 届在读 · 深圳职业技术大学 · 随时到岗</span>
                </span>
              </div>

              <h1 className="hero-title">
                张锦鹏 <span className="hero-en-tag">Jaxson</span>
              </h1>
              <p className="hero-subtitle">
                大数据技术在读 · 全栈与实用 AI 应用工程实践
              </p>
              <p className="hero-desc">
                实事求是，注重业务真实痛点与高质量交付。在广东润喵云完成算力平台运维与 Docker 镜像交付；业余自主开发 PWA 工具与基于 RAG 的数字分身空间。
              </p>

              <div className="hero-cta-group">
                <a href="#portfolio" className="btn-macos-primary">
                  <span>查看精选作品 ({projects.length})</span>
                  <ArrowRight size={15} />
                </a>
                <a
                  href="/resume/zhang-jinpeng-resume.docx"
                  download="张锦鹏-个人简历.docx"
                  className="btn-macos-secondary"
                >
                  <FileText size={15} />
                  <span>下载简历 (DOCX)</span>
                </a>
                <Link href="/ai" className="btn-macos-ghost">
                  <Sparkles size={14} />
                  <span>AI 分身对话 ↗</span>
                </Link>
              </div>

              <div className="hero-mini-facts">
                <div className="fact-item">
                  <span className="fact-label">学业表现</span>
                  <strong className="fact-val">GPA 3.85 (专业前 2%) · 校一等奖</strong>
                </div>
                <div className="fact-item">
                  <span className="fact-label">企业历练</span>
                  <strong className="fact-val">润喵云 · 算力租赁平台全栈维护</strong>
                </div>
                <div className="fact-item">
                  <span className="fact-label">赛项荣誉</span>
                  <strong className="fact-val">全国一等奖 · 国家二等奖 ×2 · 省一等奖</strong>
                </div>
              </div>
            </div>

            {/* Right Column: macOS Developer Terminal Window */}
            <div className="hero-right-col">
              <div className="macos-window">
                <div className="macos-titlebar">
                  <div className="traffic-lights">
                    <span className="traffic-dot traffic-red" />
                    <span className="traffic-dot traffic-yellow" />
                    <span className="traffic-dot traffic-green" />
                  </div>
                  <div className="macos-window-title">
                    <Code2 size={13} className="window-icon" />
                    <span>jaxson.config.ts</span>
                  </div>
                  <div className="macos-titlebar-right">
                    <span className="badge-run">● Live</span>
                  </div>
                </div>

                <div className="macos-code-body">
                  <div className="code-line">
                    <span className="code-num">01</span>
                    <span className="code-kw">export const</span>{' '}
                    <span className="code-var">developer</span> = &#123;
                  </div>
                  <div className="code-line">
                    <span className="code-num">02</span>
                    <span className="code-indent-1">
                      <span className="code-prop">name:</span>{' '}
                      <span className="code-str">&apos;张锦鹏 (Jaxson)&apos;</span>,
                    </span>
                  </div>
                  <div className="code-line">
                    <span className="code-num">03</span>
                    <span className="code-indent-1">
                      <span className="code-prop">education:</span> &#123;
                    </span>
                  </div>
                  <div className="code-line">
                    <span className="code-num">04</span>
                    <span className="code-indent-2">
                      <span className="code-prop">university:</span>{' '}
                      <span className="code-str">&apos;深圳职业技术大学 (SZPU)&apos;</span>,
                    </span>
                  </div>
                  <div className="code-line">
                    <span className="code-num">05</span>
                    <span className="code-indent-2">
                      <span className="code-prop">gpa:</span>{' '}
                      <span className="code-str">&apos;3.85 / 4.0 (Top 2%)&apos;</span>,
                    </span>
                  </div>
                  <div className="code-line">
                    <span className="code-num">06</span>
                    <span className="code-indent-1">&#125;,</span>
                  </div>
                  <div className="code-line">
                    <span className="code-num">07</span>
                    <span className="code-indent-1">
                      <span className="code-prop">internship:</span>{' '}
                      <span className="code-str">&apos;广东润喵云科技 · 全栈实习&apos;</span>,
                    </span>
                  </div>
                  <div className="code-line">
                    <span className="code-num">08</span>
                    <span className="code-indent-1">
                      <span className="code-prop">stack:</span> [
                    </span>
                  </div>
                  <div className="code-line">
                    <span className="code-num">09</span>
                    <span className="code-indent-2">
                      <span className="code-str">&apos;Next.js 16&apos;</span>,{' '}
                      <span className="code-str">&apos;React 19&apos;</span>,{' '}
                      <span className="code-str">&apos;TypeScript&apos;</span>,
                    </span>
                  </div>
                  <div className="code-line">
                    <span className="code-num">10</span>
                    <span className="code-indent-2">
                      <span className="code-str">&apos;Go&apos;</span>,{' '}
                      <span className="code-str">&apos;Python&apos;</span>,{' '}
                      <span className="code-str">&apos;PostgreSQL 17 + pgvector&apos;</span>,
                    </span>
                  </div>
                  <div className="code-line">
                    <span className="code-num">11</span>
                    <span className="code-indent-2">
                      <span className="code-str">&apos;Docker&apos;</span>,{' '}
                      <span className="code-str">&apos;Vue 3&apos;</span>,{' '}
                      <span className="code-str">&apos;Tailwind CSS&apos;</span>,
                    </span>
                  </div>
                  <div className="code-line">
                    <span className="code-num">12</span>
                    <span className="code-indent-1">],</span>
                  </div>
                  <div className="code-line">
                    <span className="code-num">13</span>
                    <span className="code-indent-1">
                      <span className="code-prop">availability:</span>{' '}
                      <span className="code-str">&apos;随时到岗 (深圳本地)&apos;</span>,
                    </span>
                  </div>
                  <div className="code-line">
                    <span className="code-num">14</span>
                    &#125;
                  </div>
                </div>

                <div className="macos-statusbar">
                  <div className="status-left">
                    <span>UTF-8</span>
                    <span>TypeScript 5.7</span>
                    <span>Next.js 16</span>
                  </div>
                  <div className="status-right">
                    <span>Prettier ✓</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          2. About & AI Clone Teaser
          ======================================================== */}
      <section id="about" className="section">
        <div className="container">
          <div className="section-head">
            <div className="section-title-wrap">
              <h2 className="section-title">关于我</h2>
            </div>
            <p className="section-sub">实事求是，注重工程质量与落地闭环。</p>
          </div>

          <div className="about-layout">
            <div className="about-narrative">
              <p>
                我是<strong>张锦鹏</strong>，来自<strong>深圳职业技术大学</strong>大数据技术专业（2027 届大专在读，GPA 3.85 / 4.0，专业排名前 2%）。
                对现代 Web 全栈工程与实用 AI 应用落地保持持续的热情，习惯在真实需求和实际部署中打磨技术，把想法转化为可用、健壮的代码。
              </p>
              <p>
                在<strong>广东润喵云科技</strong>全栈开发实习期间，主要负责算力租赁平台的日常运维、全栈缺陷排查修复及平台 Docker 运行环境镜像的调优制作。在课余时间，独立开发并上线了 <strong>待办备忘 (Todo Memo PWA)</strong>，并自主架构交付了本站 <strong>Jaxson AI Space</strong>。
              </p>
              <p>
                平时在开发中深度结合 AI 效能工具（Cursor, Claude Code, Git Worktree）进行敏捷交付，同时注重代码类型安全、清晰文档与持续重构。
              </p>

              <div className="proof-row">
                <div className="proof-item">
                  <span>求职方向</span>
                  <strong>全栈开发 / AI 应用开发 / 前端开发</strong>
                </div>
                <div className="proof-item">
                  <span>求职状态</span>
                  <strong>2027 届 · 随时可到岗 (深圳本地)</strong>
                </div>
                <div className="proof-item">
                  <span>学业表现</span>
                  <strong>GPA 3.85 (专业前 2%) · 校一等奖学金</strong>
                </div>
              </div>
            </div>

            <div className="tech-profile-card">
              <div className="tech-profile-header">
                <div className="tech-profile-dot" />
                <h4>工程技术侧写</h4>
              </div>
              <div className="tech-profile-list">
                <div className="profile-spec-item">
                  <span className="spec-label">核心语言</span>
                  <span className="spec-val">TypeScript, JavaScript, Go, Python, SQL</span>
                </div>
                <div className="profile-spec-item">
                  <span className="spec-label">前端技术栈</span>
                  <span className="spec-val">Next.js 16, React 19, Vue 3, Tailwind CSS</span>
                </div>
                <div className="profile-spec-item">
                  <span className="spec-label">服务端与接口</span>
                  <span className="spec-val">Node.js, Go (Gin), Payload CMS 3.x, REST / GraphQL</span>
                </div>
                <div className="profile-spec-item">
                  <span className="spec-label">数据与检索</span>
                  <span className="spec-val">PostgreSQL 17, pgvector (向量检索), Supabase, Redis</span>
                </div>
                <div className="profile-spec-item">
                  <span className="spec-label">部署与基础设施</span>
                  <span className="spec-val">Docker 容器构建, Linux / PM2, Cloudflare Tunnel</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          3. Experience & Education & Awards
          ======================================================== */}
      <section id="resume" className="section">
        <div className="container">
          <div className="section-head">
            <div className="section-title-wrap">
              <h2 className="section-title">学习与实践经历</h2>
            </div>
            <p className="section-sub">扎实的高校计算机专业功底与真实的企业级研发历练。</p>
          </div>

          <div className="resume-columns">
            <div className="resume-col">
              <h3 className="col-header">
                <Layers size={17} />
                <span>工作与实习经历</span>
              </h3>
              <div className="timeline-flow">
                {experiences
                  .filter((e) => e.kind === 'internship')
                  .map((exp) => (
                    <div key={exp.id} className="timeline-card-wrapper">
                      <span className="timeline-period-tag">{exp.period}</span>
                      <div className="timeline-glass-card featured-card">
                        <h4>{exp.role}</h4>
                        <div className="timeline-org-name">{exp.organization}</div>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{exp.summary}</p>
                        <ul className="timeline-bullets">
                          {exp.bullets.map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                        <div className="card-tag-row">
                          {exp.technologies.map((t) => (
                            <span key={t} className="mini-tag">{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="resume-col">
              <h3 className="col-header">
                <Award size={17} />
                <span>教育背景与主修</span>
              </h3>
              <div className="timeline-flow">
                {experiences
                  .filter((e) => e.kind === 'education')
                  .map((edu) => (
                    <div key={edu.id} className="timeline-card-wrapper">
                      <span className="timeline-period-tag">{edu.period}</span>
                      <div className="timeline-glass-card">
                        <h4>{edu.organization}</h4>
                        <div className="timeline-org-name">{edu.role}</div>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{edu.summary}</p>
                        <ul className="timeline-bullets">
                          {edu.bullets.map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                        <div className="card-tag-row">
                          {edu.technologies.map((t) => (
                            <span key={t} className="mini-tag">{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Awards Banner */}
          <div className="awards-banner">
            <div className="awards-head-row">
              <div className="awards-title-box">
                <div className="awards-trophy-icon">
                  <Trophy size={20} />
                </div>
                <div>
                  <h3 className="awards-banner-title">竞赛荣誉与核心表彰</h3>
                  <p className="awards-banner-sub">
                    获国家级/全国技能赛项成果 3 项 · 省级 1 项 · 校级综合学业一等奖学金
                  </p>
                </div>
              </div>
              <div className="awards-badge-group">
                <span className="honor-pill honor-pill-gold">国家级 / 全国 3项</span>
                <span className="honor-pill honor-pill-emerald">省部级 1项</span>
                <span className="honor-pill honor-pill-cyan">综合 GPA 3.85 (前 2%)</span>
              </div>
            </div>

            <div className="awards-grid">
              {sortedAwards.map((a, idx) => {
                const meta = getAwardMeta(a)
                const isFeatured = sortedAwards.length === 5 ? idx < 2 : false
                return (
                  <div
                    key={a.id}
                    className={`award-card ${isFeatured ? 'award-card-featured' : 'award-card-standard'} award-tier-${meta.tier}`}
                  >
                    <div className="award-card-header">
                      <div className="award-badge-wrapper">
                        <span className="award-badge-icon">{meta.icon}</span>
                        <span className="award-badge-label">{meta.badgeText}</span>
                      </div>
                      <span className="award-period-tag">{a.period}</span>
                    </div>

                    <div className="award-card-body">
                      <h5 className="award-title">{a.title}</h5>
                      <p className="award-subtitle">{meta.subtitle}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          4. Portfolio Section
          ======================================================== */}
      <section id="portfolio" className="section">
        <div className="container">
          <div className="section-head">
            <div className="section-title-wrap">
              <h2 className="section-title">精选上线项目</h2>
            </div>
            <p className="section-sub">均具备在线可访问体验与开源代码，真实构建、真实部署。</p>
          </div>

          <div className="portfolio-grid-layout">
            {projects.map((project) => {
              const liveLink = project.links.find((l) => l.kind === 'live')
              const sourceLink = project.links.find((l) => l.kind === 'source')

              return (
                <article key={project.slug} className="project-glass-card">
                  <div className="macos-card-header">
                    <div className="traffic-lights">
                      <span className="traffic-dot traffic-red" />
                      <span className="traffic-dot traffic-yellow" />
                      <span className="traffic-dot traffic-green" />
                    </div>
                    <span className="macos-card-title">{project.slug}.app</span>
                    <span className="badge-status badge-live">{project.status}</span>
                  </div>

                  <div
                    className="card-cover-container"
                    onClick={() => setSelectedProject(project)}
                    style={{ cursor: 'pointer' }}
                  >
                    <Image
                      src={project.image || '/assets/todo-memo-cover.png'}
                      alt={project.title}
                      width={480}
                      height={240}
                      className="card-cover-img"
                    />
                    <div className="card-cover-overlay">
                      <span>点击查看技术架构与深度案例 →</span>
                    </div>
                  </div>

                  <div className="project-details-body">
                    <div className="card-meta-bar">
                      <span className="project-category-tag">{project.category}</span>
                    </div>

                    <h3 onClick={() => setSelectedProject(project)} style={{ cursor: 'pointer' }}>
                      {project.title}
                    </h3>
                    <p>{project.summary}</p>

                    <div className="card-tag-row" style={{ marginBottom: '1rem' }}>
                      {project.technologies.slice(0, 4).map((tech) => (
                        <span key={tech} className="mini-tag">{tech}</span>
                      ))}
                    </div>

                    <div className="project-action-row">
                      <button
                        type="button"
                        className="btn-case-study"
                        onClick={() => setSelectedProject(project)}
                      >
                        <span>案例详情</span>
                        <ChevronRight size={14} />
                      </button>

                      <div className="project-ext-links">
                        {liveLink && (
                          <a
                            href={liveLink.href}
                            target="_blank"
                            rel="noreferrer"
                            className="ext-icon-link"
                            title="在线体验 Demo"
                          >
                            <span>体验</span>
                            <ExternalLink size={13} />
                          </a>
                        )}
                        {sourceLink && (
                          <a
                            href={sourceLink.href}
                            target="_blank"
                            rel="noreferrer"
                            className="ext-icon-link"
                            title="查看 GitHub 仓库"
                          >
                            <GithubIcon size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* ========================================================
          5. Skills Grid
          ======================================================== */}
      <section id="skills" className="section">
        <div className="container">
          <div className="section-head">
            <div className="section-title-wrap">
              <h2 className="section-title">技术能力清单</h2>
            </div>
            <p className="section-sub">常用技术栈与工具链，注重实际业务交付与开发效能。</p>
          </div>

          <div className="skills-grid-row">
            {skillGroups.map((group) => (
              <div key={group.id} className="skill-category-card">
                <div className="skill-cat-head">
                  {getCategoryIcon(group.title)}
                  <h4>{group.title}</h4>
                </div>
                <div className="skill-pills-wrap">
                  {group.items.map((item) => (
                    <span key={item} className="skill-badge-item">{item}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================
          6. Contact Section
          ======================================================== */}
      <section id="contact" className="section">
        <div className="container">
          <div className="section-head">
            <div className="section-title-wrap">
              <h2 className="section-title">保持联系</h2>
            </div>
            <p className="section-sub">欢迎各类实习与校招机会交流，随时可通过以下方式联系我。</p>
          </div>

          <div className="contact-cards-grid">
            <div
              className="contact-glass-tile"
              onClick={() => copyToClipboard(profile.email, 'email')}
              style={{ cursor: 'pointer' }}
            >
              <div className="contact-tile-head">
                <Mail size={16} />
                <span>电子邮箱 (点击复制)</span>
              </div>
              <strong>{profile.email}</strong>
              <span className="contact-action-hint">
                {copiedKey === 'email' ? '✓ 已复制' : '点击直接复制'}
              </span>
            </div>

            <div
              className="contact-glass-tile"
              onClick={() => copyToClipboard(profile.phone, 'phone')}
              style={{ cursor: 'pointer' }}
            >
              <div className="contact-tile-head">
                <Phone size={16} />
                <span>电话 / 微信 (点击复制)</span>
              </div>
              <strong>{profile.phone}</strong>
              <span className="contact-action-hint">
                {copiedKey === 'phone' ? '✓ 已复制' : '点击直接复制'}
              </span>
            </div>

            <a
              href={profile.github}
              target="_blank"
              rel="noreferrer"
              className="contact-glass-tile"
            >
              <div className="contact-tile-head">
                <GithubIcon size={16} />
                <span>开源代码</span>
              </div>
              <strong>github.com/Jaxson-zip</strong>
              <span className="contact-action-hint">访问 GitHub 主页 ↗</span>
            </a>

            <a
              href="/resume/zhang-jinpeng-resume.docx"
              download="张锦鹏-个人简历.docx"
              className="contact-glass-tile highlight-tile"
            >
              <div className="contact-tile-head">
                <FileText size={16} />
                <span>离线简历</span>
              </div>
              <strong>张锦鹏-个人简历.docx</strong>
              <span className="contact-action-hint">点击下载 DOCX 简历 ↓</span>
            </a>
          </div>
        </div>
      </section>

      {/* ========================================================
          7. Case Study Modal Dialog
          ======================================================== */}
      {selectedProject && (
        <div className="project-modal-backdrop" onClick={() => setSelectedProject(null)}>
          <div className="project-modal-box" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setSelectedProject(null)}
              aria-label="关闭详情"
            >
              <X size={18} />
            </button>

            <div className="modal-cover-wrap">
              <Image
                src={selectedProject.image || '/assets/todo-memo-cover.png'}
                alt={selectedProject.title}
                width={640}
                height={260}
                className="modal-cover-img"
              />
            </div>

            <div className="modal-header-meta">
              <span className="badge-status badge-live">{selectedProject.status}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedProject.category}</span>
            </div>

            <h2 className="modal-title">{selectedProject.title}</h2>
            <p className="modal-role-text">{selectedProject.role}</p>

            <div className="modal-section-block">
              <h4>💡 业务痛点与初衷</h4>
              <p>{selectedProject.problem}</p>
            </div>

            <div className="modal-section-block">
              <h4>🛠️ 技术方案与实现</h4>
              <p>{selectedProject.approach}</p>
            </div>

            <div className="modal-section-block">
              <h4>📈 交付结果与当前状态</h4>
              <p>{selectedProject.outcome}</p>
            </div>

            <div className="modal-tags-row">
              {selectedProject.technologies.map((t) => (
                <span key={t} className="mini-tag">{t}</span>
              ))}
            </div>

            <div className="modal-footer-actions">
              {selectedProject.links.find((l) => l.kind === 'live') && (
                <a
                  href={selectedProject.links.find((l) => l.kind === 'live')?.href}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-modal-primary"
                >
                  <span>在线访问应用</span>
                  <ExternalLink size={14} />
                </a>
              )}
              {selectedProject.links.find((l) => l.kind === 'source') && (
                <a
                  href={selectedProject.links.find((l) => l.kind === 'source')?.href}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-modal-secondary"
                >
                  <GithubIcon size={15} />
                  <span>查看 GitHub 源码</span>
                </a>
              )}
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setSelectedProject(null)}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
