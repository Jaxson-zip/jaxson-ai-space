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

export function HomeView({
  profile,
  projects,
  experiences,
  skillGroups,
  awards,
  isLiveDb,
}: HomeViewProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'public' | 'private'>('all')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const filteredProjects = projects.filter((p) => {
    if (activeFilter === 'public') return p.sourceVisibility === 'public'
    if (activeFilter === 'private') return p.sourceVisibility === 'private'
    return true
  })

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
          1. Hero Section
          ======================================================== */}
      <section id="hero" className="hero-section">
        <div className="container">
          <div className="hero-badge-row">
            <span className="status-badge">
              <span className="status-dot"></span>
              <span>求职中 · 2027 届 · 深圳 (可线下到岗)</span>
            </span>
            {isLiveDb && (
              <span className="db-live-indicator" title="已与 Payload CMS 数据库实时连接">
                <Radio size={11} className="db-pulse" />
                <span>数据库实时联通</span>
              </span>
            )}
            <span className="hero-sub-tag">全栈开发 · AI 应用与 Agent 探索</span>
          </div>

          <h1 className="hero-title">
            你好，我是 <span className="hero-highlight">{profile.name}</span>
          </h1>
          <p className="hero-subtitle">全栈与 AI 应用开发 · 喜欢把想法做成真正可用的交付物</p>
          <p className="hero-desc">{profile.summary}</p>

          <div className="hero-cta-group">
            <a href="#portfolio" className="btn-cta-primary">
              <span>浏览精选作品 ({projects.length})</span>
              <ArrowRight size={15} />
            </a>
            <Link href="/ai" className="btn-cta-ai">
              <Sparkles size={15} />
              <span>AI 岗位匹配分身</span>
            </Link>
            <a href="/assets/张锦鹏-秋招简历.docx" download className="btn-cta-secondary">
              <FileText size={15} />
              <span>下载 Word 简历</span>
            </a>
          </div>

          <div className="hero-trust-bar">
            <div className="trust-item">
              <span>教育背景与绩点</span>
              <strong>深圳职业技术大学 · 大数据技术 (GPA 3.67 前 5%)</strong>
            </div>
            <div className="trust-item">
              <span>企业实践产出</span>
              <strong>广东润喵云科技 · Vue 3 + Go 算力平台联调交付</strong>
            </div>
            <div className="trust-item">
              <span>核心项目落地</span>
              <strong>待办备忘 PWA · 锐历简历开源工作台</strong>
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
            <p className="section-sub">立足业务真实痛点，以工程化思维实现闭环交付。</p>
          </div>

          <div className="about-layout">
            <div className="about-narrative">
              <p>
                我是<strong>张锦鹏</strong>，来自<strong>深圳职业技术大学</strong>大数据技术专业（2027 届）。
                平时热衷于前沿 Web 全栈与 AI 应用开发，喜欢将一个模糊的想法逐步拆解为清晰的交互界面、数据架构、后端接口与可用流程。
              </p>
              <p>
                在<strong>广东润喵云科技</strong>的实习中，我参与了算力租赁平台的前后端联调与上线维护；业余时间独立上线了
                <strong>待办备忘 (Todo Memo PWA)</strong>、二开开源了<strong>锐历简历</strong>，并深入探索<strong>多 Agent 研发协同工作台</strong>。
              </p>

              <div className="proof-row">
                <div className="proof-item">
                  <span>期望岗位</span>
                  <strong>AI 应用开发 / 前端 / 全栈</strong>
                </div>
                <div className="proof-item">
                  <span>到岗时间</span>
                  <strong>随时到岗 · 深圳本地</strong>
                </div>
                <div className="proof-item">
                  <span>工程习惯</span>
                  <strong>强类型 · 文档清晰 · 持续重构</strong>
                </div>
              </div>
            </div>

            <div className="pillars-grid">
              <div className="pillar-card">
                <span className="pillar-num">01 / 全栈打通</span>
                <h3>从界面到数据流闭环</h3>
                <p>具备 React/Vue 3 前端及 Go/Python 后端接口设计能力，注重状态流清晰与异常兜底。</p>
              </div>
              <div className="pillar-card">
                <span className="pillar-num">02 / AI 深度融合</span>
                <h3>Prompt 工程与 Agent 协作</h3>
                <p>不只调 API，更关注结构化上下文组装、多智能体角色分工及 RAG 知识事实溯源。</p>
              </div>
              <div className="pillar-card">
                <span className="pillar-num">03 / 本土与体验</span>
                <h3>中文排版与人机交互</h3>
                <p>对中文字符断行、字体层级、深色暗夜模式及响应式移动端体验有严苛追求。</p>
              </div>
              <div className="pillar-card">
                <span className="pillar-num">04 / 敏捷与交付</span>
                <h3>现代效能工具流</h3>
                <p>深度运用 Git Worktree、Cursor、Claude Code 与自动化部署，高标准推进工程进度。</p>
              </div>
            </div>
          </div>

          {/* AI Teaser Banner */}
          <div className="ai-teaser-banner">
            <div className="ai-teaser-content">
              <div className="ai-teaser-tag">
                <Sparkles size={15} />
                <span>AI 数字分身互动空间已就绪</span>
              </div>
              <h3>想深入了解我的项目技术选型与团队契合度？</h3>
              <p>你可以自由向我的 AI 数字分身提问，或直接粘贴贵司招聘 JD 进行智能匹配分析。</p>
              <div className="ai-teaser-chips">
                <Link href="/ai" className="ai-teaser-chip">📋 测测岗位 JD 匹配度</Link>
                <Link href="/ai" className="ai-teaser-chip">🏢 聊聊润喵云实习经历</Link>
                <Link href="/ai" className="ai-teaser-chip">🤖 介绍核心项目架构</Link>
                <Link href="/ai" className="ai-teaser-chip">📬 求职意向与联系方式</Link>
              </div>
            </div>
            <Link href="/ai" className="btn-enter-ai">
              <span>进入 AI 空间</span>
              <ArrowRight size={16} />
            </Link>
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
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                🏆 竞赛荣誉与学业奖项
              </h4>
            </div>
            <div className="awards-grid">
              {awards.map((a) => (
                <div key={a.id} className="award-item">
                  <strong>{a.title}</strong>
                  <span>{a.period} · {a.level}</span>
                </div>
              ))}
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
              <h2 className="section-title">精选落地项目</h2>
            </div>
            <p className="section-sub">实时同步自 Payload CMS 数据库，点击卡片可查看深度技术案例。</p>
          </div>

          <div className="filter-tabs-row">
            <button
              type="button"
              className={`filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              全部项目 ({projects.length})
            </button>
            <button
              type="button"
              className={`filter-pill ${activeFilter === 'public' ? 'active' : ''}`}
              onClick={() => setActiveFilter('public')}
            >
              公开项目 ({projects.filter((p) => p.sourceVisibility === 'public').length})
            </button>
            <button
              type="button"
              className={`filter-pill ${activeFilter === 'private' ? 'active' : ''}`}
              onClick={() => setActiveFilter('private')}
            >
              私有案例 ({projects.filter((p) => p.sourceVisibility === 'private').length})
            </button>
          </div>

          <div className="portfolio-grid-layout">
            {filteredProjects.map((project) => {
              const liveLink = project.links.find((l) => l.kind === 'live')
              const sourceLink = project.links.find((l) => l.kind === 'source')

              return (
                <article key={project.slug} className="project-glass-card">
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
                      <span>点击查看完整深度案例 →</span>
                    </div>
                  </div>

                  <div className="project-details-body">
                    <div className="card-meta-bar">
                      <span
                        className={`badge-status ${
                          project.sourceVisibility === 'public'
                            ? project.status.includes('上线')
                              ? 'badge-live'
                              : 'badge-oss'
                            : 'badge-private'
                        }`}
                      >
                        {project.status}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{project.category}</span>
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
              href="/assets/张锦鹏-秋招简历.docx"
              download
              className="contact-glass-tile highlight-tile"
            >
              <div className="contact-tile-head">
                <FileText size={16} />
                <span>离线简历</span>
              </div>
              <strong>张锦鹏-个人简历.docx</strong>
              <span className="contact-action-hint">点击下载 Word 简历 ↓</span>
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
