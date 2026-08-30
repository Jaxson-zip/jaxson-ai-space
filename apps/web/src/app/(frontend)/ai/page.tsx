'use client'

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  Bot,
  User,
  Send,
  RotateCcw,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  FileCheck2,
  Briefcase,
  Layers,
  GraduationCap,
  Award,
  ChevronDown,
} from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isJdMatch?: boolean
  evidence?: readonly string[]
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: `你好！我是张锦鹏 (Jaxson) 的 AI 数字分身，你可以直接把我当成我本人来沟通！

我完整同步了我在**广东润喵云科技的实习实战（Vue 3 + Go 算力平台大屏与接口联调）**、**精选核心交付项目（Todo Memo PWA / 锐历简历开源工作台）**以及我的求职意向与技术栈。

你可以直接向我提问，或者**把贵司的岗位要求/JD 直接发给我**，我来为你分析我的背景契合度！`,
  },
]

function renderInlineMarkdown(content: string) {
  // Matches **bold**, `code`, etc.
  const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          style={{
            background: 'var(--bg-root)',
            border: '1px solid var(--border-subtle)',
            padding: '1px 5px',
            borderRadius: '4px',
            fontSize: '0.85em',
            color: 'var(--accent-blue)',
            fontFamily: 'monospace',
          }}
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}

function FormattedContent({ text, isUser }: { text: string; isUser?: boolean }) {
  if (isUser) {
    return (
      <p style={{ fontSize: '0.92rem', color: '#ffffff', lineHeight: '1.65', margin: 0, fontWeight: 500 }}>
        {text}
      </p>
    )
  }

  const lines = text.split('\n')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={idx} style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.4rem 0 0.2rem' }}>
              {renderInlineMarkdown(trimmed.replace('### ', ''))}
            </h3>
          )
        }
        if (trimmed.startsWith('#### ')) {
          return (
            <h4 key={idx} style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-blue)', margin: '0.3rem 0 0.1rem' }}>
              {renderInlineMarkdown(trimmed.replace('#### ', ''))}
            </h4>
          )
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', paddingLeft: '4px' }}>
              <span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>•</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {renderInlineMarkdown(trimmed.replace(/^[-*]\s+/, ''))}
              </span>
            </div>
          )
        }
        if (trimmed === '---') {
          return <hr key={idx} style={{ borderColor: 'var(--border-subtle)', margin: '0.4rem 0' }} />
        }
        if (!trimmed) {
          return <div key={idx} style={{ height: '0.25rem' }} />
        }
        return (
          <p key={idx} style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.65' }}>
            {renderInlineMarkdown(line)}
          </p>
        )
      })}
    </div>
  )
}

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isAutoScrollEnabled = useRef(true)

  // Guarantee continuous auto-follow scroll to bottom on every DOM update
  useLayoutEffect(() => {
    if (isAutoScrollEnabled.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [messages, isLoading])

  const scrollToBottom = useCallback((smooth = true) => {
    const container = scrollContainerRef.current
    if (!container) return
    isAutoScrollEnabled.current = true
    if (smooth) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    } else {
      container.scrollTop = container.scrollHeight
    }
    setShowScrollBottomBtn(false)
  }, [])

  const handleScroll = () => {
    const container = scrollContainerRef.current
    if (!container) return
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    // If user scrolled up significantly (> 180px), pause auto-follow so they can read
    const isUserFarFromBottom = distanceFromBottom > 180
    isAutoScrollEnabled.current = !isUserFarFromBottom
    setShowScrollBottomBtn(isUserFarFromBottom)
  }

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || input
    if (!textToSend.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)
    isAutoScrollEnabled.current = true

    const isJdMatch =
      textToSend.toLowerCase().includes('jd') ||
      textToSend.includes('岗位') ||
      textToSend.includes('招聘') ||
      textToSend.includes('要求') ||
      textToSend.includes('任职')

    const assistantMsgId = (Date.now() + 1).toString()
    let currentEvidence: string[] = []

    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        isJdMatch,
        evidence: [],
      },
    ])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          isJdMatch,
        }),
      })

      if (!response.ok || !response.body) {
        throw new Error('网络请求失败')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulatedText = ''
      let sseBuffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        sseBuffer += decoder.decode(value, { stream: true })
        const events = sseBuffer.split('\n\n')
        sseBuffer = events.pop() || '' // Keep incomplete trailing chunk in buffer

        for (const evt of events) {
          if (!evt.trim()) continue

          const lines = evt.split('\n')
          const eventLine = lines.find((l) => l.startsWith('event: '))
          const dataLine = lines.find((l) => l.startsWith('data: '))

          const eventType = eventLine ? eventLine.replace('event: ', '').trim() : 'text'
          const rawData = dataLine ? dataLine.replace('data: ', '').trim() : '{}'

          try {
            const data = JSON.parse(rawData)

            if (eventType === 'meta') {
              if (data.evidence && Array.isArray(data.evidence)) {
                currentEvidence = data.evidence
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId ? { ...msg, evidence: currentEvidence } : msg
                  )
                )
              }
            } else if (eventType === 'text') {
              if (data.text) {
                accumulatedText += data.text
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId ? { ...msg, content: accumulatedText } : msg
                  )
                )
              }
            }
          } catch {
            // Ignore incomplete partial JSON
          }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content:
                  '非常抱歉，网络或检索服务出现短暂波动。请稍后重试，或直接添加锦鹏微信：15347640609 联系本人！',
              }
            : msg
        )
      )
    } finally {
      setIsLoading(false)
      // Final guarantee scroll
      if (isAutoScrollEnabled.current && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
      }
    }
  }

  const handlePresetClick = (query: string) => {
    handleSendMessage(query)
  }

  const handleResetChat = () => {
    setMessages(INITIAL_MESSAGES)
    setInput('')
    isAutoScrollEnabled.current = true
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }

  return (
    <div className="ai-workspace-layout">
      {/* Scrollable Main Area */}
      <div
        className="ai-messages-scroll-area"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        <div className="ai-content-centered">
          {/* Top Bar */}
          <div className="ai-page-top-bar">
            <Link href="/" className="ai-back-link">
              <ArrowLeft size={14} />
              <span>返回主页</span>
            </Link>
            <button type="button" className="ai-reset-btn" onClick={handleResetChat} title="清空对话">
              <RotateCcw size={13} />
              <span>清空记录</span>
            </button>
          </div>

          {/* Main Header */}
          <div className="ai-page-header">
            <div className="ai-privacy-badge">
              <ShieldCheck size={13} />
              <span>RAG 向量混合检索与防幻觉护栏已激活</span>
            </div>
            <h1 className="ai-page-title">张锦鹏 · AI 岗位匹配分身</h1>
            <p className="ai-page-subtitle">
              基于 Payload CMS 动态知识库实时推理，提供精准的事实溯源与岗位契合度分析。
            </p>
          </div>

          {/* Prompt Chips */}
          <div className="ai-preset-chips-wrap">
            <button
              type="button"
              className="prompt-chip-btn"
              onClick={() => handlePresetClick('📋 请帮我做一下针对前端/全栈开发岗位的 JD 匹配分析')}
            >
              <FileCheck2 size={13} />
              <span>📋 测测岗位 JD 匹配度</span>
            </button>
            <button
              type="button"
              className="prompt-chip-btn"
              onClick={() => handlePresetClick('🏢 请详细介绍一下你在广东润喵云科技的实习工作与产出')}
            >
              <Briefcase size={13} />
              <span>🏢 介绍润喵云实习经历</span>
            </button>
            <button
              type="button"
              className="prompt-chip-btn"
              onClick={() => handlePresetClick('📱 介绍一下 Todo Memo PWA 项目的核心架构与交付状态')}
            >
              <Layers size={13} />
              <span>📱 了解 Todo Memo 项目</span>
            </button>
            <button
              type="button"
              className="prompt-chip-btn"
              onClick={() => handlePresetClick('🎓 介绍一下你的教育背景、GPA 以及在校领导经历')}
            >
              <GraduationCap size={13} />
              <span>🎓 教育背景与绩点</span>
            </button>
            <button
              type="button"
              className="prompt-chip-btn"
              onClick={() => handlePresetClick('🏆 你获得过哪些国家级与省级竞赛荣誉？')}
            >
              <Award size={13} />
              <span>🏆 竞赛荣誉奖项</span>
            </button>
          </div>

          {/* Chat Stream */}
          <div className="ai-chat-stream">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-bubble-row ${msg.role === 'user' ? 'bubble-user-row' : 'bubble-assistant-row'}`}
              >
                <div className="bubble-header">
                  {msg.role === 'user' ? (
                    <>
                      <User size={13} />
                      <span>您</span>
                    </>
                  ) : (
                    <>
                      <Bot size={13} />
                      <span>张锦鹏 AI 分身</span>
                      {msg.isJdMatch && (
                        <span
                          style={{
                            marginLeft: '4px',
                            fontSize: '0.72rem',
                            padding: '1px 6px',
                            background: 'rgba(56, 189, 248, 0.1)',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            borderRadius: '4px',
                            color: 'var(--accent-blue)',
                          }}
                        >
                          🎯 岗位匹配模式
                        </span>
                      )}
                    </>
                  )}
                </div>

                <div className="bubble-body">
                  {msg.content ? (
                    <FormattedContent text={msg.content} isUser={msg.role === 'user'} />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                      <Sparkles size={14} className="db-pulse" />
                      <span>正在检索知识库并生成思考...</span>
                    </div>
                  )}

                  {msg.evidence && msg.evidence.length > 0 && (
                    <div className="bubble-evidence-box">
                      <div className="evidence-title">
                        <CheckCircle2 size={12} />
                        <span>事实证据溯源切片：</span>
                      </div>
                      <div className="evidence-tags-row">
                        {msg.evidence.map((tag, i) => (
                          <span key={i} className="evidence-tag">
                            📌 {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {/* Scroll bottom spacer */}
            <div style={{ height: '24px' }} />
          </div>
        </div>
      </div>

      {/* Floating Scroll-to-Bottom Button */}
      {showScrollBottomBtn && (
        <button
          type="button"
          className="btn-scroll-bottom"
          onClick={() => scrollToBottom(true)}
          title="滚动到底部"
        >
          <ChevronDown size={16} />
          <span>回到底部</span>
        </button>
      )}

      {/* Fixed Bottom Dock Composer */}
      <div className="ai-bottom-dock">
        <div className="ai-composer-container">
          <form
            className="composer-form"
            onSubmit={(e) => {
              e.preventDefault()
              handleSendMessage()
            }}
          >
            <input
              type="text"
              className="composer-input-field"
              placeholder="向 AI 分身提问，或直接粘贴贵司岗位 JD 需求..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
            />
            <button
              type="submit"
              className="composer-send-btn"
              disabled={isLoading || !input.trim()}
              aria-label="发送消息"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
