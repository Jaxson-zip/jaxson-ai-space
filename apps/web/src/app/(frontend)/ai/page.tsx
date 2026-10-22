'use client'

import React, { useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react'
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
  Layers,
  ChevronDown,
} from 'lucide-react'
import './ai-cinematic.css'
import { buildChatHistory, CHAT_LIMITS, type ConversationMessage as Message } from '@/features/ai/chat-history'
import { consumeChatStream } from '@/features/ai/chat-stream'
import { buildSuggestions, type Suggestion } from '@/features/ai/suggestions'

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: `你好！我会依据后台已公开的项目和知识条目回答问题，并在回答中列出资料来源。

你可以先问我**有哪些公开项目**，再进一步了解某个项目的背景、工作与结果。

你也可以粘贴岗位要求，让我仅根据现有资料做对照；未收录的信息我会明确说明。`,
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
  const portfolioUrl = process.env.NEXT_PUBLIC_PORTFOLIO_URL || '/'
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false)
  const [inputError, setInputError] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>(() => buildSuggestions([]))

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/showcase-projects', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (Array.isArray(data?.projects)) setSuggestions(buildSuggestions(data.projects))
      })
      // Without the list, the general questions remain.
      .catch(() => {})
    return () => controller.abort()
  }, [])

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const backLinkRef = useRef<HTMLAnchorElement>(null)
  const isAutoScrollEnabled = useRef(true)
  const activeRequestRef = useRef<AbortController | null>(null)
  const requestGenerationRef = useRef(0)

  useEffect(() => () => {
    activeRequestRef.current?.abort()
    activeRequestRef.current = null
    requestGenerationRef.current++
  }, [])

  useEffect(() => {
    const from = new URLSearchParams(window.location.search).get('from')
    if (!from) return
    try {
      const url = new URL(from)
      const portfolioOrigin = new URL(portfolioUrl, window.location.origin).origin
      if ((url.origin === window.location.origin || url.origin === portfolioOrigin) && backLinkRef.current) {
        backLinkRef.current.href = url.href
      }
    } catch {
      // Invalid return URL: keep the configured portfolio link.
    }
  }, [portfolioUrl])

  // Guarantee continuous auto-follow scroll to bottom on every DOM update
  useLayoutEffect(() => {
    if (messages.length === INITIAL_MESSAGES.length && !isLoading) return
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

  const handleSendMessage = async (queryText?: string, retryUserId?: string) => {
    if (activeRequestRef.current) return
    const textToSend = (queryText ?? input).trim()
    if (!textToSend) return
    if (textToSend.length > CHAT_LIMITS.messageChars) {
      setInputError(`单次问题最多 ${CHAT_LIMITS.messageChars} 字，请缩短后再发送。`)
      return
    }
    const retryIndex = retryUserId ? messages.findIndex((message) => message.id === retryUserId && message.role === 'user') : -1
    if (retryUserId && retryIndex < 0) return
    const userMessage: Message = retryIndex >= 0 ? messages[retryIndex] : {
      id: crypto.randomUUID(), role: 'user', content: textToSend,
    }
    const requestHistory = buildChatHistory(retryIndex >= 0 ? messages.slice(0, retryIndex) : messages, userMessage)
    const previousAnswer = retryUserId ? messages.find((message) => message.replyTo === retryUserId) : undefined
    const assistantMsgId = previousAnswer?.id ?? crypto.randomUUID()
    const request = new AbortController()
    activeRequestRef.current = request
    const generation = ++requestGenerationRef.current
    const isActive = () => requestGenerationRef.current === generation && !request.signal.aborted
    setInput('')
    setInputError('')
    setIsLoading(true)
    isAutoScrollEnabled.current = true

    const isJdMatch =
      textToSend.toLowerCase().includes('jd') ||
      textToSend.includes('岗位') ||
      textToSend.includes('招聘') ||
      textToSend.includes('要求') ||
      textToSend.includes('任职')

    const answer: Message = {
      id: assistantMsgId, role: 'assistant', replyTo: userMessage.id,
      content: '', status: 'streaming', isJdMatch, evidence: [],
    }
    setMessages((prev) => previousAnswer
      ? prev.map((message) => message.id === assistantMsgId ? answer : message)
      : [...prev, ...(retryUserId ? [] : [userMessage]), answer])
    let accumulatedText = ''
    const updateAnswer = (update: Partial<Message>) => {
      if (!isActive()) return
      setMessages((prev) => isActive() ? prev.map((message) => message.id === assistantMsgId ? { ...message, ...update } : message) : prev)
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: requestHistory,
          isJdMatch,
        }),
        signal: request.signal,
      })

      if (!response.ok || !response.body) {
        throw new Error('网络请求失败')
      }

      await consumeChatStream(response.body, (event) => {
        if (event.type === 'text') {
          accumulatedText += event.text
          updateAnswer({ content: accumulatedText })
        } else {
          updateAnswer({ evidence: event.evidence, generator: event.generator })
        }
      }, request.signal)
      updateAnswer({ status: 'completed' })
    } catch {
      updateAnswer({ status: accumulatedText ? 'interrupted' : 'error' })
    } finally {
      if (activeRequestRef.current !== request) return
      activeRequestRef.current = null
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
    activeRequestRef.current?.abort()
    activeRequestRef.current = null
    requestGenerationRef.current++
    setIsLoading(false)
    isAutoScrollEnabled.current = false
    setMessages(INITIAL_MESSAGES)
    setInput('')
    setInputError('')
    setShowScrollBottomBtn(false)
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
            <Link ref={backLinkRef} href={portfolioUrl} className="ai-back-link">
              <ArrowLeft size={14} />
              <span>返回作品集</span>
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
              <span>仅依据已公开的后台资料回答</span>
            </div>
            <p className="ai-page-kicker">JAXSON / ASK ME ANYTHING</p>
            <h1 className="ai-page-title">有问题，直接问我<span>的 AI 分身</span>。</h1>
            <p className="ai-page-subtitle">
              想了解项目细节或岗位契合点？从一个问题开始。回答会标明来源，未收录的事实会明确说明。
            </p>
          </div>

          {/* Prompt Chips: project questions follow the published list. */}
          <div className="ai-preset-chips-wrap">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.prompt}
                type="button"
                className="prompt-chip-btn"
                onClick={() => handlePresetClick(suggestion.prompt)}
              >
                {suggestion.label === '岗位 JD 匹配' ? <FileCheck2 size={13} /> : <Layers size={13} />}
                <span>{suggestion.label}</span>
              </button>
            ))}
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
                            background: 'rgba(183, 199, 171, 0.1)',
                            border: '1px solid rgba(183, 199, 171, 0.3)',
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
                  ) : msg.status === 'streaming' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                      <Sparkles size={14} className="db-pulse" />
                      <span>正在查找公开资料并生成回答…</span>
                    </div>
                  ) : null}

                  {(msg.status === 'interrupted' || msg.status === 'error') && (
                    <div className="chat-response-status" role="status">
                      <span>{msg.status === 'interrupted' ? '回答中断，已收到的内容保留在上方。' : '暂时未能生成回答，请重试。'}</span>
                      <button type="button" disabled={isLoading} onClick={() => {
                        const question = messages.find((message) => message.id === msg.replyTo)
                        if (question) void handleSendMessage(question.content, question.id)
                      }}>重试回答</button>
                    </div>
                  )}
                  {msg.generator === 'local' && msg.status === 'completed' && (
                    <p className="chat-response-status">此回答由公开资料直接整理。</p>
                  )}

                  {msg.evidence && msg.evidence.length > 0 && (
                    <div className="bubble-evidence-box">
                      <div className="evidence-title">
                        <CheckCircle2 size={12} />
                        <span>资料来源</span>
                      </div>
                      <div className="evidence-tags-row">
                        {msg.evidence.map((tag, i) => (
                          <span key={i} className="evidence-tag">
                            {tag}
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
          {inputError && <p className="chat-input-error" role="alert">{inputError}</p>}
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
