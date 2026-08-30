'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  Bot,
  User,
  Send,
  Download,
  Layers,
  Briefcase,
  GraduationCap,
  Award as AwardIcon,
  CheckCircle,
} from 'lucide-react'
import { profile, experiences, projects } from '@/features/portfolio/content'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  evidence?: readonly string[]
}

const INITIAL_BENTO_CHATS: ChatMessage[] = [
  {
    id: 'bento-intro',
    role: 'assistant',
    content:
      '你好！我是张锦鹏的实时 AI 助理。左侧是他的核心资产与项目看板；你可以直接在此**粘贴岗位 JD**，我将实时给出匹配度推演并联动左侧证据。',
  },
]

export function VariantBento() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_BENTO_CHATS)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  const handleSend = (presetText?: string) => {
    const text = (presetText || input).trim()
    if (!text || isLoading) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    setTimeout(() => {
      let replyText = ''
      let evidence: string[] = []

      const lower = text.toLowerCase()
      if (text.length > 50 || lower.includes('jd') || lower.includes('匹配') || lower.includes('要求') || lower.includes('全栈') || lower.includes('前端')) {
        replyText = `### 📋 岗位匹配度分析：**90% (高度吻合)**

- **前端与全栈开发**：熟练掌握 React、TypeScript、Vue 3 与 Go 接口联调，拥有真实算力平台（润喵云）迭代经验；
- **AI 产品原型构建**：具备从 0 到 1 交付 PWA 与 Agent 探索原型的敏捷交付能力；
- **基础与工程素质**：深职大大数据专业 GPA 3.67（前5%），获金砖技能大赛国赛二等奖。`
        evidence = ['广东润喵云科技', 'Todo Memo PWA', '金砖技能大赛二等奖']
      } else if (lower.includes('润喵') || lower.includes('实习')) {
        replyText = `张锦鹏在**广东润喵云科技有限公司 (2026.06 - 2026.08)** 担任开发实习生，负责算力租赁平台用户端/管理端功能迭代、接口联调与日常维护。`
        evidence = ['广东润喵云科技有限公司']
      } else {
        replyText = `张锦鹏主要技术栈覆盖：React, Vue, TypeScript, Go, Supabase 及大模型 API 集成。你可以点击左侧项目卡片查看真实细节！`
        evidence = ['个人技能矩阵', 'Todo Memo 项目']
      }

      const asstMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: replyText,
        evidence,
      }

      setMessages((prev) => [...prev, asstMsg])
      setIsLoading(false)
    }, 600)
  }

  const internships = experiences.filter((e) => e.kind === 'internship')
  const education = experiences.filter((e) => e.kind === 'education')

  return (
    <div className="bento-dashboard-layout shell">
      {/* Left Panel: Bento Grid Cards (55%) */}
      <div className="bento-left-panel">
        {/* Profile Card */}
        <div className="bento-card bento-profile-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="status-badge" style={{ marginBottom: '0.6rem' }}>
                <span className="status-dot"></span>
                <span>2026 届秋招中 · 深圳/全国</span>
              </div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                {profile.name}
              </h2>
              <p style={{ color: 'var(--accent-cyan)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                {profile.title}
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6, maxWidth: '420px' }}>
                {profile.summary}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <a href="/resume/zhang-jinpeng-resume.docx" download className="btn-primary" style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem' }}>
                <Download size={14} />
                <span>Word 简历</span>
              </a>
              <Link href="/resume" className="btn-secondary" style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem', justifyContent: 'center' }}>
                <span>在线简历</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 3 Projects Bento Row */}
        <div className="bento-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={17} color="var(--accent-cyan)" />
              <span>精选项目作品 (Projects)</span>
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>真实边界 · 拒绝虚构</span>
          </div>

          <div className="bento-projects-row">
            {projects.map((p) => (
              <div key={p.slug} className="bento-mini-project">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{p.title}</strong>
                  <span className={`project-status ${p.status.includes('Demo') ? 'status-demo' : p.status.includes('开源') ? 'status-opensource' : 'status-private'}`} style={{ fontSize: '0.7rem' }}>
                    {p.status}
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.5rem' }}>
                  {p.summary}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="project-tags">
                    {p.technologies.slice(0, 3).map((t) => (
                      <span key={t} className="tech-tag" style={{ fontSize: '0.7rem' }}>{t}</span>
                    ))}
                  </div>
                  <Link href={`/projects/${p.slug}`} className="project-link-primary" style={{ fontSize: '0.75rem' }}>
                    <span>详情 →</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Experience & Education Card */}
        <div className="bento-card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem', color: 'var(--accent-cyan)' }}>
                <Briefcase size={16} />
                <span>实习经历</span>
              </h4>
              {internships.map((exp) => (
                <div key={exp.id} style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
                    <span>{exp.organization}</span>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{exp.period}</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {exp.role} · {exp.summary}
                  </p>
                </div>
              ))}
            </div>

            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem', color: 'var(--accent-violet)' }}>
                <GraduationCap size={16} />
                <span>教育背景</span>
              </h4>
              {education.map((edu) => (
                <div key={edu.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
                    <span>{edu.organization}</span>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{edu.period}</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', marginTop: '0.2rem' }}>
                    {edu.summary}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Skills & Awards Mini Card */}
        <div className="bento-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AwardIcon size={16} color="#fbbf24" />
              <span>技能与荣誉认可</span>
            </h4>
            <span style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 600 }}>金砖国家技能大赛二等奖 · 广东省一等奖</span>
          </div>
          <div className="skill-tags-row">
            {['React', 'TypeScript', 'Vue 3', 'Go', 'Supabase', 'Agent 流程', 'PWA', '大模型 API'].map((s) => (
              <span key={s} className="skill-pill" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel: Live AI Chat Terminal (45%) */}
      <div className="bento-right-panel">
        <div className="bento-chat-widget">
          <div className="bento-chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div className="brand-logo-icon" style={{ width: '24px', height: '24px', fontSize: '0.75rem' }}>AI</div>
              <strong>实时智能体问答 & JD 匹配</strong>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>🟢 在线推演</span>
          </div>

          {/* Quick preset pills */}
          <div style={{ display: 'flex', gap: '0.4rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', overflowX: 'auto' }}>
            <button
              type="button"
              onClick={() => handleSend('请评估张锦鹏与全栈/AI产品开发岗位的匹配度')}
              className="prompt-pill"
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', whiteSpace: 'nowrap' }}
            >
              📋 测测匹配度
            </button>
            <button
              type="button"
              onClick={() => handleSend('介绍你在润喵云实习期间主要负责什么？')}
              className="prompt-pill"
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', whiteSpace: 'nowrap' }}
            >
              💼 润喵云实习
            </button>
            <button
              type="button"
              onClick={() => handleSend('介绍 Todo Memo 和 OPC Agent 项目')}
              className="prompt-pill"
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', whiteSpace: 'nowrap' }}
            >
              🚀 项目细节
            </button>
          </div>

          {/* Chat Messages stream */}
          <div className="bento-chat-messages">
            {messages.map((m) => (
              <div key={m.id} className={`chat-bubble ${m.role === 'user' ? 'bubble-user' : 'bubble-assistant'}`} style={{ fontSize: '0.85rem', padding: '0.85rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem', fontSize: '0.75rem', fontWeight: 700, color: m.role === 'user' ? 'rgba(255,255,255,0.7)' : 'var(--accent-cyan)' }}>
                  {m.role === 'user' ? <User size={13} /> : <Bot size={13} />}
                  <span>{m.role === 'user' ? '访客 / HR' : 'Jaxson AI'}</span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{m.content}</div>

                {m.evidence && m.evidence.length > 0 && (
                  <div style={{ marginTop: '0.6rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                      <CheckCircle size={11} />
                      <span>对应左侧证据：</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.2rem' }}>
                      {m.evidence.map((ev) => (
                        <span key={ev} className="tech-tag" style={{ fontSize: '0.7rem' }}>{ev}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="chat-bubble bubble-assistant" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={14} className="status-dot" style={{ animation: 'spin 1s linear infinite' }} />
                <span>正在推演分析...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Compact Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="bento-chat-input-bar"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="提问或粘贴 JD 进行实时推演..."
              className="composer-input"
              style={{ fontSize: '0.85rem' }}
              disabled={isLoading}
            />
            <button type="submit" disabled={!input.trim() || isLoading} className="composer-send" style={{ padding: '0.4rem' }}>
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
