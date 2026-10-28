'use client'

import React, { useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { Send, Square, Copy, Check, Pencil, RotateCcw, ArrowLeft, ShieldCheck, ChevronDown } from 'lucide-react'
import './ai.css'
import { portfolioOrigin } from '@/components/public-site/links'
import { buildChatHistory, CHAT_LIMITS, type ConversationMessage as Message, type ConversationSource } from '@/features/ai/chat-history'
import { consumeChatStream } from '@/features/ai/chat-stream'
import { buildSuggestions, type Suggestion } from '@/features/ai/suggestions'
import { initialQuestion } from '@/features/ai/initial-question'
import { isJobMatchRequest } from '@/features/ai/jd-intent'
import { readConversationSnapshot } from '@/features/ai/conversation-handoff'

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

/** The sources the answer cites by [n], keeping their numbers; every source while it cites none yet. */
function citedSources(content: string, evidence: readonly string[], sources?: readonly ConversationSource[]) {
  const cited = new Set([...content.matchAll(/\[(\d{1,2})\]/g)].map((match) => Number(match[1])))
  const available: readonly ConversationSource[] = sources?.length ? sources : evidence.map(tag => ({ tag }))
  const all = available.map((source, index) => ({ ...source, number: index + 1 }))
  const kept = all.filter(({ number }) => cited.has(number))
  return kept.length ? kept : all
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

function MessageTools({ message, busy, onEdit, onRegenerate }: {
  message: Message
  busy: boolean
  onEdit?: () => void
  onRegenerate?: () => void
}) {
  const isUser = message.role === 'user'
  const label = isUser ? '复制问题' : '复制回答'
  const retryLabel = message.status === 'completed' ? '重新生成回答' : '重试回答'
  const [feedback, setFeedback] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; if (timer.current) clearTimeout(timer.current) }
  }, [])
  const copy = async () => {
    let result: 'copied' | 'failed'
    try { await navigator.clipboard.writeText(message.content); result = 'copied' }
    catch { result = 'failed' }
    if (!mounted.current) return
    setFeedback(result)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setFeedback('idle'), 1800)
  }
  return <div className="ai-message-tools" role="group" aria-label={isUser ? '消息操作' : '回答操作'}>
    {isUser && message.createdAt && <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}</time>}
    {message.content && <button type="button" aria-label={label} title={label} onClick={() => void copy()}>
      {feedback === 'copied' ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
    </button>}
    {onEdit && <button id={`ai-edit-${message.id}`} type="button" aria-label="编辑问题" title="编辑问题" disabled={busy} onClick={onEdit}><Pencil size={14} aria-hidden="true" /></button>}
    {onRegenerate && <button type="button" aria-label={retryLabel} title={retryLabel} disabled={busy} onClick={onRegenerate}><RotateCcw size={14} aria-hidden="true" /></button>}
    <span className="ai-action-feedback" role="status" hidden={feedback === 'idle'}>{feedback === 'copied' ? '已复制' : feedback === 'failed' ? '复制失败，请手动选择文字' : ''}</span>
  </div>
}

function fitQuestionEditor(input: HTMLTextAreaElement | null) {
  if (!input) return
  input.style.height = 'auto'
  input.style.height = Math.max(48, Math.min(input.scrollHeight, 180)) + 'px'
}

function QuestionEditor({ content, onCancel, onSave }: { content: string; onCancel: () => void; onSave: (value: string) => void }) {
  const [value, setValue] = useState(content)
  const field = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => fitQuestionEditor(field.current), [value])
  useEffect(() => {
    const input = field.current
    input?.focus()
    if (!input?.form || typeof ResizeObserver === 'undefined') return
    let width = 0
    const observer = new ResizeObserver(([entry]) => {
      if (Math.abs(entry.contentRect.width - width) < .5) return
      width = entry.contentRect.width
      fitQuestionEditor(input)
    })
    observer.observe(input.form)
    return () => observer.disconnect()
  }, [])
  return <form className="ai-question-editor" onSubmit={event => {
    event.preventDefault()
    if (value.trim()) onSave(value.trim())
  }} onKeyDown={event => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape') { event.preventDefault(); onCancel() }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); event.currentTarget.requestSubmit() }
  }}>
    <textarea ref={field} aria-label="编辑问题" rows={2} maxLength={CHAT_LIMITS.messageChars} value={value} onChange={event => setValue(event.target.value)} required />
    <div className="ai-question-edit-actions">
      <button type="button" onClick={onCancel}>取消</button>
      <button type="submit" className="ai-question-edit-send" disabled={!value.trim()}>发送</button>
    </div>
  </form>
}

export default function AIPage() {
  const portfolioUrl = `${portfolioOrigin}/`
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [longWait, setLongWait] = useState(false)
  const [handoffPending, setHandoffPending] = useState(false)
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false)
  const [inputError, setInputError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const restoreEditFocus = useRef<string | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>(() => buildSuggestions([]))
  const hasConversation = messages.some(message => message.role === 'user')
  useLayoutEffect(() => {
    if (editingId || !restoreEditFocus.current) return
    document.getElementById(`ai-edit-${restoreEditFocus.current}`)?.focus()
    restoreEditFocus.current = null
  }, [editingId])

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
  const clearWaitRef = useRef<() => void>(() => {})

  useEffect(() => () => {
    clearWaitRef.current()
    activeRequestRef.current?.abort()
    activeRequestRef.current = null
    requestGenerationRef.current++
  }, [])

  // A question typed on the portfolio arrives prefilled; the visitor still sends it.
  const composerRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const field = composerRef.current
    if (!field) return
    const fit = () => {
      field.style.height = 'auto'
      field.style.height = Math.max(44, Math.min(field.scrollHeight, 180)) + 'px'
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    let width = field.getBoundingClientRect().width
    const observer = new ResizeObserver(([entry]) => {
      if (Math.abs(entry.contentRect.width - width) < .5) return
      width = entry.contentRect.width
      fit()
    })
    observer.observe(field)
    return () => observer.disconnect()
  }, [input])
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('handoff')) return
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
    const params = new URLSearchParams(window.location.search)
    const token = params.get('handoff')
    if (!token) return
    const opener = window.opener as Window | null
    const origin = new URL(portfolioUrl).origin
    let from: URL | undefined
    try { from = new URL(params.get('from') || '') } catch { /* Reject malformed senders. */ }
    const removeToken = () => {
      const url = new URL(window.location.href)
      url.searchParams.delete('handoff')
      window.history.replaceState(null, '', url)
    }
    if (!opener || opener.closed || from?.origin !== origin || token.length > 100) {
      removeToken()
      const frame = requestAnimationFrame(() => setInputError('未能接续首页对话，请返回原页面重试。'))
      return () => cancelAnimationFrame(frame)
    }
    let finished = false
    const frame = requestAnimationFrame(() => { if (!finished) setHandoffPending(true) })
    const ready = () => opener.postMessage({ type: 'jaxson-chat:ready', token }, origin)
    const receive = (event: MessageEvent) => {
      if (finished || event.origin !== origin || event.source !== opener || event.data?.type !== 'jaxson-chat:state' || event.data.token !== token) return
      const snapshot = readConversationSnapshot(event.data.state)
      finished = true
      clearInterval(retry)
      clearTimeout(deadline)
      removeToken()
      setHandoffPending(false)
      if (!snapshot) { setInputError('对话内容未能接续，请返回原页面重试。'); return }
      setMessages(snapshot.messages.length ? snapshot.messages : INITIAL_MESSAGES)
      setInput(snapshot.draft)
      opener.postMessage({ type: 'jaxson-chat:received', token }, origin)
      composerRef.current?.focus()
    }
    window.addEventListener('message', receive)
    const retry = setInterval(ready, 500)
    const deadline = setTimeout(() => {
      finished = true
      clearInterval(retry)
      removeToken()
      setHandoffPending(false)
      setInputError('未能接续首页对话，请返回原页面重试。原对话仍保留在首页。')
    }, 15000)
    ready()
    return () => { finished = true; cancelAnimationFrame(frame); window.removeEventListener('message', receive); clearInterval(retry); clearTimeout(deadline) }
  }, [portfolioUrl])

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
    const isUserFarFromBottom = distanceFromBottom > 48
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
    const userMessage: Message = retryIndex >= 0 ? {
      ...messages[retryIndex], content: textToSend,
      ...(messages[retryIndex].content !== textToSend ? { createdAt: new Date().toISOString() } : {}),
    } : {
      id: crypto.randomUUID(), role: 'user', content: textToSend, createdAt: new Date().toISOString(),
    }
    const requestHistory = buildChatHistory(retryIndex >= 0 ? messages.slice(0, retryIndex) : messages, userMessage)
    const previousAnswer = retryUserId ? messages.find((message) => message.replyTo === retryUserId) : undefined
    const assistantMsgId = previousAnswer?.id ?? crypto.randomUUID()
    const request = new AbortController()
    activeRequestRef.current = request
    const generation = ++requestGenerationRef.current
    const isActive = () => requestGenerationRef.current === generation && !request.signal.aborted
    if (queryText === undefined) setInput('')
    setInputError('')
    restoreEditFocus.current = null
    setEditingId(null)
    setIsLoading(true)
    setLongWait(false)
    isAutoScrollEnabled.current = true

    const isJdMatch = isJobMatchRequest(textToSend)

    const answer: Message = {
      id: assistantMsgId, role: 'assistant', replyTo: userMessage.id,
      content: '', status: 'streaming', isJdMatch, evidence: [],
    }
    setMessages(retryIndex >= 0
      ? [...messages.slice(0, retryIndex), userMessage, answer]
      : [...messages, userMessage, answer])
    let accumulatedText = ''
    let waitTimer: ReturnType<typeof setTimeout>
    let idleTimer: ReturnType<typeof setTimeout>
    const clearWait = () => { clearTimeout(waitTimer); clearTimeout(idleTimer) }
    clearWaitRef.current = clearWait
    const resetWait = () => {
      clearWait()
      setLongWait(false)
      waitTimer = setTimeout(() => { if (isActive()) setLongWait(true) }, 12000)
      idleTimer = setTimeout(() => {
        if (!isActive()) return
        const errorMessage = accumulatedText ? '回答长时间未更新，已保留收到的内容，请重试。' : '等待回答超时，请重试。'
        setMessages(previous => previous.map(message => message.id === assistantMsgId
          ? { ...message, status: accumulatedText ? 'interrupted' : 'error', errorMessage } : message))
        request.abort()
      }, 45000)
    }
    const updateAnswer = (update: Partial<Message>) => {
      if (!isActive()) return
      setMessages((prev) => isActive() ? prev.map((message) => message.id === assistantMsgId ? { ...message, ...update } : message) : prev)
    }

    try {
      resetWait()
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: requestHistory,
          isJdMatch,
        }),
        signal: request.signal,
      })

      if (response.status === 429) {
        updateAnswer({ status: 'error', errorMessage: '提问太频繁，请稍后再试。' })
        return
      }
      if (!response.ok || !response.body) {
        throw new Error('网络请求失败')
      }

      await consumeChatStream(response.body, (event) => {
        if (!isActive()) return
        resetWait()
        if (event.type === 'text') {
          accumulatedText += event.text
          updateAnswer({ content: accumulatedText })
        } else {
          updateAnswer({ evidence: event.evidence, sources: event.sources, generator: event.generator })
        }
      }, request.signal)
      updateAnswer({ status: 'completed' })
    } catch {
      updateAnswer({ status: accumulatedText ? 'interrupted' : 'error' })
    } finally {
      clearWait()
      if (activeRequestRef.current !== request) return
      activeRequestRef.current = null
      setLongWait(false)
      setIsLoading(false)
      // Final guarantee scroll
      if (isAutoScrollEnabled.current && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
      }
    }
  }

  const handleStopMessage = () => {
    const request = activeRequestRef.current
    if (!request) return
    activeRequestRef.current = null
    clearWaitRef.current()
    setLongWait(false)
    requestGenerationRef.current++
    request.abort()
    setIsLoading(false)
    setMessages(previous => previous.map(message => message.status === 'streaming'
      ? { ...message, status: 'stopped' as const }
      : message))
  }

  const handlePresetClick = (query: string) => {
    handleSendMessage(query)
  }

  const handleResetChat = () => {
    clearWaitRef.current()
    setLongWait(false)
    activeRequestRef.current?.abort()
    activeRequestRef.current = null
    requestGenerationRef.current++
    setIsLoading(false)
    isAutoScrollEnabled.current = false
    setMessages(INITIAL_MESSAGES)
    setInput('')
    setInputError('')
    restoreEditFocus.current = null
    setEditingId(null)
    setShowScrollBottomBtn(false)
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }

  return (
    <div className={`jx-page jx-ai${hasConversation ? ' is-live' : ''}`}>
      <div className="ai-scroll" ref={scrollContainerRef} onScroll={handleScroll}>
        <div className="ai-column">
          <div className="ai-top">
            <Link ref={backLinkRef} href={portfolioUrl} className="ai-back">
              <ArrowLeft size={16} aria-hidden="true" />
              <span>返回作品集</span>
            </Link>
            <button type="button" className="ai-reset" disabled={handoffPending} onClick={handleResetChat}>
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
              <button key={suggestion.prompt} type="button" disabled={isLoading || handoffPending} onClick={() => handlePresetClick(suggestion.prompt)}>
                {suggestion.label}
              </button>
            ))}
          </div>

          <div className="ai-thread">
            {messages.filter(msg => !hasConversation || msg.id !== '1').map((msg) => (
              <div key={msg.id} className={`ai-message ${msg.role}${editingId === msg.id ? ' is-editing' : ''}`}>
                {msg.role === 'user' && editingId === msg.id ? <QuestionEditor content={msg.content} onCancel={() => {
                  restoreEditFocus.current = msg.id
                  setEditingId(null)
                }} onSave={value => { void handleSendMessage(value, msg.id); composerRef.current?.focus() }} /> : <>
                {msg.role === 'assistant' && <p className="ai-meta">
                  张锦鹏的 AI 分身
                  {msg.isJdMatch && <span className="ai-mode">岗位匹配</span>}
                </p>}
                <div className="ai-bubble">
                  {msg.content ? (
                    <FormattedContent text={msg.content} isUser={msg.role === 'user'} />
                  ) : msg.status === 'streaming' ? (
                    <p className="ai-pending">正在查找公开资料并生成回答…</p>
                  ) : null}

                  {(msg.status === 'interrupted' || msg.status === 'error' || msg.status === 'stopped') && (
                    <div className="ai-status" role="status">
                      <span>{msg.status === 'stopped' ? (msg.content ? '已停止生成，已收到的内容保留在上方。' : '已停止生成。') : msg.errorMessage || (msg.status === 'interrupted' ? '回答中断，已收到的内容保留在上方。' : '暂时未能生成回答，请重试。')}</span>
                    </div>
                  )}
                  {msg.generator === 'local' && msg.status === 'completed' && (
                    <p className="ai-status">此回答由公开资料直接整理。</p>
                  )}
                  {msg.status === 'streaming' && longWait && <p className="ai-status" role="status">等待时间较长，可以继续等待，或停止后重试。</p>}

                  {msg.evidence && msg.evidence.length > 0 && (
                    <div className="ai-sources">
                      <p>资料来源</p>
                      <ul className="ai-source-list">
                        {citedSources(msg.content, msg.evidence, msg.sources).map(({ number, tag, project }) => <li key={number}>{project
                          ? <Link className="ai-source" href={`/projects/${encodeURIComponent(project)}`} target="_blank" rel="noopener noreferrer"><span className="ai-source-label">{`${number}. ${tag}`}</span></Link>
                          : <span className="ai-source"><span className="ai-source-label">{`${number}. ${tag}`}</span></span>}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
                {msg.role === 'user' ? <MessageTools message={msg} busy={isLoading} onEdit={() => setEditingId(msg.id)} /> : msg.status && msg.status !== 'streaming' ? <MessageTools message={msg} busy={isLoading} onRegenerate={() => {
                  const question = messages.find(message => message.id === msg.replyTo)
                  if (question) void handleSendMessage(question.content, question.id)
                }} /> : null}
                </>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ai-dock">
      {showScrollBottomBtn && (
        <button type="button" className="jx-btn ai-to-bottom" onClick={() => scrollToBottom(true)}>
          <ChevronDown size={16} aria-hidden="true" />
          <span>回到底部</span>
        </button>
      )}

        <div className="ai-column">
          {handoffPending && <p className="ai-status" role="status">正在接续首页对话…</p>}
          {inputError && <p className="ai-input-error" role="alert">{inputError}</p>}
          <form
            className="ai-composer"
            onSubmit={(e) => {
              e.preventDefault()
              handleSendMessage()
            }}
          >
            <textarea
              rows={1}
              disabled={handoffPending}
              ref={composerRef}
              placeholder="向 AI 分身提问，或直接粘贴贵司岗位 JD 需求..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={event => {
                if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return
                event.preventDefault()
                if (!activeRequestRef.current) event.currentTarget.form?.requestSubmit()
              }}
              aria-label="问我的 AI 分身"
            />
            <button type={isLoading ? 'button' : 'submit'} disabled={handoffPending || (!isLoading && !input.trim())} aria-label={isLoading ? '停止生成' : '发送消息'} onClick={event => {
              if (isLoading) { event.preventDefault(); handleStopMessage() }
            }}>
              {isLoading ? <Square size={16} aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
