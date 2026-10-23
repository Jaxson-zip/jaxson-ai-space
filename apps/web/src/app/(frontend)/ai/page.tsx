'use client'

import React, { useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { Send, RotateCcw, ArrowLeft, ShieldCheck, ChevronDown } from 'lucide-react'
import './ai.css'
import { portfolioOrigin } from '@/components/public-site/links'
import { buildChatHistory, CHAT_LIMITS, type ConversationMessage as Message } from '@/features/ai/chat-history'
import { consumeChatStream } from '@/features/ai/chat-stream'
import { buildSuggestions, type Suggestion } from '@/features/ai/suggestions'
import { initialQuestion } from '@/features/ai/initial-question'

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: `你好！我是张锦鹏的 AI 分身，只根据他公开的项目、经历和技能回答，并标明出处。

可以先问我**做过哪些项目**，再追问某个项目的难题、做法和结果。

也可以粘贴岗位要求，我会对照公开资料说明哪些地方匹配；资料里没有的，我会直接说不知道。`,
  },
]

function renderInlineMarkdown(content: string) {
  // Matches **bold**, `code` and [n] citations of the numbered sources.
  const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`|\s?\[\d{1,2}\])/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>
    if (/^\s?\[\d{1,2}\]$/.test(part)) return <sup key={i} className="ai-cite">{part.trim().slice(1, -1)}</sup>
    return part
  })
}

function FormattedContent({ text, isUser }: { text: string; isUser?: boolean }) {
  if (isUser) return <p className="md-p">{text}</p>

  return (
    <div className="md">
      {text.split('\n').map((line, idx) => {
        const trimmed = line.trim()
        if (trimmed.startsWith('### ')) return <h3 key={idx}>{renderInlineMarkdown(trimmed.replace('### ', ''))}</h3>
        if (trimmed.startsWith('#### ')) return <h4 key={idx}>{renderInlineMarkdown(trimmed.replace('#### ', ''))}</h4>
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return <p key={idx} className="md-li">{renderInlineMarkdown(trimmed.replace(/^[-*]\s+/, ''))}</p>
        }
        if (trimmed === '---') return <hr key={idx} />
        if (!trimmed) return <div key={idx} className="md-gap" />
        return <p key={idx} className="md-p">{renderInlineMarkdown(line)}</p>
      })}
    </div>
  )
}

export default function AIPage() {
  const portfolioUrl = `${portfolioOrigin}/`
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

  // A question typed on the portfolio arrives prefilled; the visitor still sends it.
  const composerRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const question = initialQuestion(window.location.search)
    if (!question) return
    // After hydration, so the server-rendered empty field matches the first client render.
    const frame = requestAnimationFrame(() => {
      setInput(question)
      composerRef.current?.focus()
    })
    return () => cancelAnimationFrame(frame)
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
    <div className="jx-page jx-ai">
      <div className="ai-scroll" ref={scrollContainerRef} onScroll={handleScroll}>
        <div className="ai-column">
          <div className="ai-top">
            <Link ref={backLinkRef} href={portfolioUrl} className="ai-back">
              <ArrowLeft size={16} aria-hidden="true" />
              <span>返回作品集</span>
            </Link>
            <button type="button" className="ai-reset" onClick={handleResetChat}>
              <RotateCcw size={15} aria-hidden="true" />
              <span>清空记录</span>
            </button>
          </div>

          <header className="ai-intro">
            <p className="jx-badge"><ShieldCheck size={15} aria-hidden="true" />只引用公开资料回答</p>
            <h1>别只看简历，<em>直接问我的 AI 分身。</em></h1>
            <p className="jx-muted">想了解项目细节或岗位契合点？从一个问题开始。回答会标明出处，没有收录的事实会直接说明。</p>
          </header>

          {/* Project questions follow the published list. */}
          <div className="ai-chips">
            {suggestions.map((suggestion) => (
              <button key={suggestion.prompt} type="button" onClick={() => handlePresetClick(suggestion.prompt)}>
                {suggestion.label}
              </button>
            ))}
          </div>

          <div className="ai-thread">
            {messages.map((msg) => (
              <div key={msg.id} className={`ai-message ${msg.role}`}>
                <p className="ai-meta">
                  {msg.role === 'user' ? '你' : '张锦鹏的 AI 分身'}
                  {msg.role === 'assistant' && msg.isJdMatch && <span className="ai-mode">岗位匹配</span>}
                </p>
                <div className="ai-bubble">
                  {msg.content ? (
                    <FormattedContent text={msg.content} isUser={msg.role === 'user'} />
                  ) : msg.status === 'streaming' ? (
                    <p className="ai-pending">正在查找公开资料并生成回答…</p>
                  ) : null}

                  {(msg.status === 'interrupted' || msg.status === 'error') && (
                    <div className="ai-status" role="status">
                      <span>{msg.status === 'interrupted' ? '回答中断，已收到的内容保留在上方。' : '暂时未能生成回答，请重试。'}</span>
                      <button type="button" className="jx-btn" disabled={isLoading} onClick={() => {
                        const question = messages.find((message) => message.id === msg.replyTo)
                        if (question) void handleSendMessage(question.content, question.id)
                      }}>重试回答</button>
                    </div>
                  )}
                  {msg.generator === 'local' && msg.status === 'completed' && (
                    <p className="ai-status">此回答由公开资料直接整理。</p>
                  )}

                  {msg.evidence && msg.evidence.length > 0 && (
                    <div className="ai-sources">
                      <p>资料来源</p>
                      <ul className="jx-tags">
                        {msg.evidence.map((tag, i) => <li key={i}>{`${i + 1}. ${tag}`}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showScrollBottomBtn && (
        <button type="button" className="jx-btn ai-to-bottom" onClick={() => scrollToBottom(true)}>
          <ChevronDown size={16} aria-hidden="true" />
          <span>回到底部</span>
        </button>
      )}

      <div className="ai-dock">
        <div className="ai-column">
          {inputError && <p className="ai-input-error" role="alert">{inputError}</p>}
          <form
            className="ai-composer"
            onSubmit={(e) => {
              e.preventDefault()
              handleSendMessage()
            }}
          >
            <input
              type="text"
              ref={composerRef}
              placeholder="向 AI 分身提问，或直接粘贴贵司岗位 JD 需求..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !input.trim()} aria-label="发送消息">
              <Send size={17} aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
