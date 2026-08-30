'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  Send,
  Sparkles,
  Bot,
  User,
  Download,
  CheckCircle,
  Briefcase,
  Layers,
  ArrowRight,
} from 'lucide-react'
import { profile, experiences, projects } from '@/features/portfolio/content'

interface ChatItem {
  id: string
  role: 'user' | 'assistant'
  content?: string
  type?: 'text' | 'projects' | 'experience' | 'jd-match' | 'resume'
  evidence?: readonly string[]
}

const INITIAL_AGENT_MESSAGES: ChatItem[] = [
  {
    id: 'intro',
    role: 'assistant',
    type: 'text',
    content:
      '你好！我是张锦鹏的公开 AI 数字分身。\n\n我汇聚了他在**广东润喵云科技的实习产出 (Vue+Go)**、**3 项核心落地项目 (Todo Memo / OPC Agent / Ruili)** 以及深职大与技能竞赛的真实经历。\n\n你可以随时提问，或者**直接粘贴招聘 JD** 进行岗位契合度推演！',
  },
]

export function VariantAgentFirst() {
  const [messages, setMessages] = useState<ChatItem[]>(INITIAL_AGENT_MESSAGES)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  const handleSend = (customPrompt?: string) => {
    const text = (customPrompt || input).trim()
    if (!text || isLoading) return

    const userMsg: ChatItem = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      type: 'text',
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    setTimeout(() => {
      const lower = text.toLowerCase()
      let reply: ChatItem

      if (lower.includes('项目') || lower.includes('作品') || lower.includes('demo')) {
        reply = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          type: 'projects',
          content: '以下是张锦鹏目前公开的主要项目成果与探索边界：',
          evidence: ['Todo Memo (已上线 PWA)', 'Ruili Resume (开源二开)', 'OPC Agent Company (私有探索)'],
        }
      } else if (lower.includes('实习') || lower.includes('经历') || lower.includes('背景') || lower.includes('学校') || lower.includes('教育')) {
        reply = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          type: 'experience',
          content: '这里是张锦鹏的实习历程与深职大教育背景：',
          evidence: ['广东润喵云科技有限公司 (2026.06 - 2026.08)', '深圳职业技术大学 (GPA 3.67)'],
        }
      } else if (lower.includes('简历') || lower.includes('下载') || lower.includes('联系') || lower.includes('电话') || lower.includes('邮箱')) {
        reply = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          type: 'resume',
          content: '你可以直接查看结构化简历或下载 Word 原件，欢迎随时沟通！',
          evidence: ['张锦鹏_个人简历.docx (2026秋招版)'],
        }
      } else if (text.length > 50 || lower.includes('jd') || lower.includes('匹配') || lower.includes('岗位') || lower.includes('要求')) {
        reply = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          type: 'jd-match',
          content: `### 📋 岗位匹配度综合评估：**89% (高度契合)**

#### 🎯 优势分析：
1. **全栈与接口工程能力**：在广东润喵云实习期间负责 Vue 3 + Go 算力租赁平台功能新增与接口联调，具备生产级协作能力；
2. **AI 原型与 Agent 思维**：独立研发 Todo Memo PWA 与 OPC Agent 流程验证，习惯敏捷迭代交付；
3. **扎实基础与高自驱力**：深职大大数据专业 GPA 3.67（前5%），获金砖技能大赛国赛二等奖、广东省技能大赛一等奖。`,
          evidence: ['广东润喵云实习', 'Todo Memo PWA', 'OPC Agent 架构实验', '金砖国家技能大赛奖项'],
        }
      } else {
        reply = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          type: 'text',
          content: `收到你的提问！张锦鹏主攻 **AI Product & 全栈开发**（2026 届秋招，深圳/全国）。\n\n你可以点击下方的快捷卡片，或者把具体的岗位 JD 粘贴进来，我将为你进行深度分析！`,
          evidence: ['个人知识库 (公开只读)'],
        }
      }

      setMessages((prev) => [...prev, reply])
      setIsLoading(false)
    }, 600)
  }

  return (
    <div className="agent-first-layout shell">
      {/* Centered Ambient Header */}
      <div className="agent-hero-header">
        <div className="status-badge" style={{ marginBottom: '1rem' }}>
          <span className="status-dot"></span>
          <span>张锦鹏的 AI 数字分身 · 2026 秋招中</span>
        </div>
        <h1 className="agent-main-title">
          用对话探索我的 <span className="hero-title-gradient">产品、工程与经历</span>
        </h1>
        <p className="agent-main-desc">
          基于真实项目与实习经历的只读知识库 · 支持岗位 JD 深度匹配与事实追溯
        </p>
      </div>

      {/* Preset Action Pills */}
      <div className="agent-preset-grid">
        <button
          type="button"
          onClick={() => handleSend('请帮我评估张锦鹏与全栈 / AI 应用开发岗位的匹配度')}
          className="agent-pill-btn"
        >
          <Sparkles size={16} color="var(--accent-cyan)" />
          <span>📋 测测岗位匹配度</span>
        </button>

        <button
          type="button"
          onClick={() => handleSend('查看精选项目作品及在线 Demo')}
          className="agent-pill-btn"
        >
          <Layers size={16} color="var(--accent-violet)" />
          <span>🚀 核心项目与 Demo</span>
        </button>

        <button
          type="button"
          onClick={() => handleSend('介绍你在广东润喵云的实习工作与产出')}
          className="agent-pill-btn"
        >
          <Briefcase size={16} color="var(--accent-emerald)" />
          <span>💼 润喵云实习产出</span>
        </button>

        <button
          type="button"
          onClick={() => handleSend('获取简历下载与联系方式')}
          className="agent-pill-btn"
        >
          <Download size={16} color="#fbbf24" />
          <span>📥 简历下载与联系</span>
        </button>
      </div>

      {/* Interactive Conversation Stream */}
      <div className="agent-stream-container">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`agent-message-row ${m.role === 'user' ? 'row-user' : 'row-assistant'}`}
          >
            <div className="agent-bubble-header">
              {m.role === 'user' ? (
                <>
                  <User size={15} />
                  <span>访客 / HR</span>
                </>
              ) : (
                <>
                  <Bot size={15} color="var(--accent-cyan)" />
                  <span style={{ color: 'var(--accent-cyan)' }}>Jaxson AI Agent</span>
                </>
              )}
            </div>

            <div className="agent-bubble-content">
              {m.content && <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{m.content}</div>}

              {/* Rich Inline Component: Projects */}
              {m.type === 'projects' && (
                <div className="agent-inline-projects">
                  {projects.map((p) => (
                    <div className="agent-inline-card" key={p.slug}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <span className="project-category">{p.category}</span>
                        <span className={`project-status ${p.status.includes('Demo') ? 'status-demo' : p.status.includes('开源') ? 'status-opensource' : 'status-private'}`}>
                          {p.status}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                        {p.title}
                      </h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                        {p.summary}
                      </p>
                      <div className="project-tags" style={{ marginBottom: '0.75rem' }}>
                        {p.technologies.slice(0, 4).map((t) => (
                          <span className="tech-tag" key={t}>{t}</span>
                        ))}
                      </div>
                      <Link href={`/projects/${p.slug}`} className="project-link-primary" style={{ fontSize: '0.8rem' }}>
                        <span>查看详细案例</span>
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  ))}
                </div>
              )}

              {/* Rich Inline Component: Experience */}
              {m.type === 'experience' && (
                <div className="agent-inline-exp">
                  {experiences.map((exp) => (
                    <div key={exp.id} className="agent-inline-card" style={{ marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.95rem' }}>
                        <span>{exp.organization}</span>
                        <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                          {exp.period}
                        </span>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                        <strong>{exp.role}</strong> · {exp.summary}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Rich Inline Component: Resume & Contact */}
              {m.type === 'resume' && (
                <div className="agent-inline-resume">
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    <a href="/resume/zhang-jinpeng-resume.docx" download className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                      <Download size={15} />
                      <span>下载 Word 简历 (.docx)</span>
                    </a>
                    <Link href="/resume" className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                      <span>浏览在线网页简历</span>
                      <ArrowRight size={14} />
                    </Link>
                    <a href={`mailto:${profile.email}`} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                      <span>发邮件: {profile.email}</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Evidence Footer */}
              {m.evidence && m.evidence.length > 0 && (
                <div className="agent-evidence-footer">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--accent-cyan)', fontSize: '0.75rem', fontWeight: 600 }}>
                    <CheckCircle size={12} />
                    <span>事实证据来源：</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                    {m.evidence.map((ev) => (
                      <span key={ev} className="tech-tag" style={{ fontSize: '0.75rem' }}>{ev}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="agent-message-row row-assistant">
            <div className="agent-bubble-content" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
              <Sparkles size={16} className="status-dot" style={{ animation: 'spin 1s linear infinite' }} />
              <span>正在调取知识库并推演事实...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Bottom Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSend()
        }}
        className="agent-composer-bar"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="问问他的技术栈、项目细节，或直接粘贴岗位 JD..."
          className="agent-composer-input"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="composer-send"
          aria-label="发送"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}
