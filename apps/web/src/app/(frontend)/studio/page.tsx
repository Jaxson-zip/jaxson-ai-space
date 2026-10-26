'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  Cpu,
  ShieldCheck,
  Activity,
  ExternalLink,
  PlusCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Edit3,
  Flame,
  Send,
  RefreshCw,
  RotateCcw,
  BookOpen,
  Target,
  FileCheck,
  AlertTriangle,
} from 'lucide-react'
import { generateYearlyActivityData } from '@/features/studio/analytics'
import { parseMemorySections, serializeMemorySections } from '@/features/studio/memory-editor'
import { localDate } from '@/features/studio/local-date'

interface ReflectionItem {
  id?: string
  title: string
  type: string
  date: string
  content: string
  challenges?: string
  solution?: string
  takeaways?: string
  nextSteps?: string
  createdAt?: string
}

interface CandidateMemoryItem {
  id: string
  title: string
  category: string
  content: string
  evidenceTag: string
  confidence: number
  tags?: string[]
  status: 'candidate' | 'approved' | 'archived'
}

const TEMPLATES = [
  { name: '每日复盘', type: 'daily' },
  { name: '面试复盘', type: 'interview' },
  { name: '技术复盘', type: 'technical' },
].map((template) => ({ ...template, title: '', content: '', challenges: '', solution: '', takeaways: '', nextSteps: '' }))

export default function StudioPage() {
  const [activeTab, setActiveTab] = useState<'reflection' | 'candidates' | 'approved_memories' | 'goals' | 'overview'>('reflection')

  // Reflection form state
  const [refTitle, setRefTitle] = useState('')
  const [refType, setRefType] = useState('daily')
  const [refDate, setRefDate] = useState('')
  const [today, setToday] = useState('')
  const [refContent, setRefContent] = useState('')
  const [refChallenges, setRefChallenges] = useState('')
  const [refSolution, setRefSolution] = useState('')
  const [refTakeaways, setRefTakeaways] = useState('')
  const [refNextSteps, setRefNextSteps] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitFeedback, setSubmitFeedback] = useState<{ msg: string; isError?: boolean } | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const refreshToday = () => {
      clearTimeout(timer)
      setToday(localDate())
      const midnight = new Date()
      midnight.setHours(24, 0, 0, 0)
      timer = setTimeout(refreshToday, Math.max(50, midnight.getTime() - Date.now() + 50))
    }
    refreshToday()
    window.addEventListener('focus', refreshToday)
    document.addEventListener('visibilitychange', refreshToday)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', refreshToday)
      document.removeEventListener('visibilitychange', refreshToday)
    }
  }, [])

  // Remote data state
  const [candidates, setCandidates] = useState<CandidateMemoryItem[]>([])
  const [approvedMemories, setApprovedMemories] = useState<CandidateMemoryItem[]>([])
  const [reflectionsHistory, setReflectionsHistory] = useState<ReflectionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [draftLinks, setDraftLinks] = useState<Record<string, string>>({})
  const [draftPending, setDraftPending] = useState<string | null>(null)
  const activityDates = reflectionsHistory.reduce<Record<string, number>>((dates, item) => {
    const date = item.date?.slice(0, 10)
    if (date) dates[date] = (dates[date] || 0) + 1
    return dates
  }, {})
  const activity = today ? generateYearlyActivityData(activityDates) : { weeks: [], totalActiveDays: 0, totalCount: 0 }
  const createKnowledgeDraft = async (item: CandidateMemoryItem) => {
    setDraftPending(String(item.id))
    setDataError(null)
    try {
      const res = await fetch('/api/studio/memory', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'create_knowledge_draft', memoryId: String(item.id) }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || '知识草稿创建失败')
      setDraftLinks((links) => ({ ...links, [item.id]: data.editUrl }))
    } catch (error) {
      setDataError(error instanceof Error ? error.message : '知识草稿创建失败，请重试。')
    } finally { setDraftPending(null) }
  }

  // Editing modal state
  const [editingItem, setEditingItem] = useState<CandidateMemoryItem | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editScenario, setEditScenario] = useState('')
  const [editSolution, setEditSolution] = useState('')
  const [editMode, setEditMode] = useState<'structured' | 'raw'>('structured')
  const [editRawContent, setEditRawContent] = useState('')
  const editedContent = () => editMode === 'raw' ? editRawContent : serializeMemorySections(editRawContent, {
    scenario: editScenario, solution: editSolution,
  })

  const switchEditMode = (mode: 'structured' | 'raw') => {
    if (mode === editMode) return
    if (mode === 'raw') {
      setEditRawContent(editedContent())
    } else {
      const sections = parseMemorySections(editRawContent)
      if (!sections) return
      setEditScenario(sections.scenario)
      setEditSolution(sections.solution)
    }
    setEditMode(mode)
  }

  // Helper to open edit modal with auto-parsed fields
  const openEditModal = (item: CandidateMemoryItem) => {
    setEditingItem(item)
    setEditTitle(item.title)
    setEditRawContent(item.content)

    const sections = parseMemorySections(item.content)
    setEditScenario(sections?.scenario || '')
    setEditSolution(sections?.solution || '')
    setEditMode(sections ? 'structured' : 'raw')
  }

  // Load data
  const fetchData = React.useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const res = await fetch('/api/studio/memory')
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || '工作台读取失败')
      setDataError(null)
      if (data.success) {
        setCandidates(data.candidateMemories || [])
        setApprovedMemories(data.approvedMemories || [])
        setReflectionsHistory(data.reflections || [])
      }
    } catch (e) {
      setDataError(e instanceof Error ? e.message : '工作台读取失败，请刷新重试。')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let ignore = false
    async function loadInitial() {
      try {
        const res = await fetch('/api/studio/memory')
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || '工作台读取失败')
        if (!ignore && data.success) {
          setCandidates(data.candidateMemories || [])
          setApprovedMemories(data.approvedMemories || [])
          setReflectionsHistory(data.reflections || [])
        }
      } catch (e) {
        setDataError(e instanceof Error ? e.message : '工作台读取失败，请刷新重试。')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    loadInitial()
    return () => {
      ignore = true
    }
  }, [])

  // Apply template
  const applyTemplate = (tpl: (typeof TEMPLATES)[0]) => {
    setRefTitle(tpl.title)
    setRefType(tpl.type)
    setRefContent(tpl.content)
    setRefChallenges(tpl.challenges)
    setRefSolution(tpl.solution)
    setRefTakeaways(tpl.takeaways)
    setRefNextSteps(tpl.nextSteps)
  }

  // Handle reflection submission
  const handleSubmitReflection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!refTitle.trim() || !refContent.trim()) {
      setSubmitFeedback({ msg: '请至少填写复盘主题和工作内容！', isError: true })
      return
    }

    setSubmitting(true)
    setSubmitFeedback(null)

    try {
      const res = await fetch('/api/studio/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_reflection',
          reflection: {
            title: refTitle,
            type: refType,
            date: refDate || localDate(),
            content: refContent,
            challenges: refChallenges,
            solution: refSolution,
            takeaways: refTakeaways,
            nextSteps: refNextSteps,
          },
        }),
      })

      const result = await res.json()
      if (result.success) {
        setSubmitFeedback({ msg: result.message || '复盘已保存，规则提炼出的候选记忆等待人工核对。' })
        // Clear form
        setRefTitle('')
        setRefContent('')
        setRefChallenges('')
        setRefSolution('')
        setRefTakeaways('')
        setRefNextSteps('')
        fetchData()
        // Switch to candidate tab to show extracted cards
        setTimeout(() => {
          setActiveTab('candidates')
        }, 1200)
      } else {
        setSubmitFeedback({ msg: result.error || '提交失败，请重试', isError: true })
      }
    } catch (err: any) {
      setSubmitFeedback({ msg: err.message || '网络或接口异常', isError: true })
    } finally {
      setSubmitting(false)
    }
  }

  // Approve candidate memory
  const handleApprove = async (item: CandidateMemoryItem) => {
    try {
      const res = await fetch('/api/studio/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_candidate',
          memoryId: item.id,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setCandidates((prev) => prev.filter((c) => c.id !== item.id))
        setApprovedMemories((prev) => [{ ...item, status: 'approved' }, ...prev])
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Reject candidate memory
  const handleReject = async (item: CandidateMemoryItem) => {
    try {
      const res = await fetch('/api/studio/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject_candidate',
          memoryId: item.id,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setCandidates((prev) => prev.filter((c) => c.id !== item.id))
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Delete approved memory directly from formal base
  const handleDeleteApproved = async (item: CandidateMemoryItem) => {
    try {
      const res = await fetch('/api/studio/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_approved',
          memoryId: item.id,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setApprovedMemories((prev) => prev.filter((m) => m.id !== item.id))
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Save edit and approve
  const handleSaveEdit = async () => {
    if (!editingItem || !editTitle.trim()) return

    const finalContent = editedContent()
    if (!finalContent.trim()) return

    try {
      const res = await fetch('/api/studio/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit_and_approve',
          memoryId: editingItem.id,
          title: editTitle,
          content: finalContent,
          category: editingItem.category,
          tags: editingItem.tags,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setCandidates((prev) => prev.filter((c) => c.id !== editingItem.id))
        setApprovedMemories((prev) => [
          { ...editingItem, title: editTitle, content: finalContent, status: 'approved' },
          ...prev.filter((m) => m.id !== editingItem.id),
        ])
        setEditingItem(null)
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="studio-root">
      <div className="container studio-container">
        {/* Studio Top Header */}
        <div className="studio-header">
          <div className="studio-title-group">
            <div className="studio-badge">
              <span className="studio-pulse-dot"></span>
              <span>JAXSON STUDIO · 私人成长工作台</span>
            </div>
            <h1 className="studio-main-title">长期复盘与智能记忆审批工作台</h1>
            <p className="studio-sub-title">
              复盘记录与确认记忆均保持私有。需要对外展示时，再整理为知识草稿并在 CMS 审核公开。
            </p>
          </div>

          <div className="studio-actions-group">
            <button
              type="button"
              onClick={() => fetchData(true)}
              className="btn-studio-site"
              disabled={loading}
              title="刷新数据"
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              <span>刷新</span>
            </button>
            <a
              href="/admin"
              target="_blank"
              rel="noreferrer"
              className="btn-studio-admin"
            >
              <Cpu size={14} />
              <span>Payload CMS 集合后台 ↗</span>
            </a>
            <Link href="/" className="btn-studio-site">
              <ExternalLink size={14} />
              <span>返回前台主页</span>
            </Link>
          </div>
        </div>

        {dataError && <div role="alert" className="empty-board-box">{dataError}</div>}

        {/* Tab Navigation */}
        <div className="studio-tabs-bar">
          <button
            type="button"
            className={`studio-tab-item ${activeTab === 'reflection' ? 'active' : ''}`}
            onClick={() => setActiveTab('reflection')}
          >
            <BookOpen size={16} />
            <span>个人复盘输入</span>
          </button>

          <button
            type="button"
            className={`studio-tab-item ${activeTab === 'candidates' ? 'active' : ''}`}
            onClick={() => setActiveTab('candidates')}
          >
            <Flame size={16} />
            <span>
              候选记忆待确认
              {candidates.length > 0 && <span className="tab-pill-badge">{candidates.length}</span>}
            </span>
          </button>

          <button
            type="button"
            className={`studio-tab-item ${activeTab === 'approved_memories' ? 'active' : ''}`}
            onClick={() => setActiveTab('approved_memories')}
          >
            <ShieldCheck size={16} />
            <span>私人已确认记忆 ({approvedMemories.length})</span>
          </button>

          <button
            type="button"
            className={`studio-tab-item ${activeTab === 'goals' ? 'active' : ''}`}
            onClick={() => setActiveTab('goals')}
          >
            <Target size={16} />
            <span>秋招与技能目标</span>
          </button>

          <button
            type="button"
            className={`studio-tab-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Activity size={16} />
            <span>全局概览</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* Tab 1: Reflection Input Form */}
        {/* ======================================================== */}
        {activeTab === 'reflection' && (
          <div className="studio-view-content">
            <div className="studio-two-col">
              {/* Left Column: Form */}
              <div className="studio-panel">
                <div className="panel-head">
                  <div className="panel-title-wrap">
                    <Edit3 size={16} />
                    <h3>提交新的成长复盘</h3>
                  </div>
                  <span className="panel-tip">提交后将自动为您提炼结构化事实候选条目</span>
                </div>

                <form onSubmit={handleSubmitReflection} className="studio-form">
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>复盘主题 *</label>
                      <input
                        type="text"
                        placeholder="例如：优化 Vue3 监控组件防抖与并发状态"
                        value={refTitle}
                        onChange={(e) => setRefTitle(e.target.value)}
                        required
                        className="studio-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>复盘类型</label>
                      <select
                        value={refType}
                        onChange={(e) => setRefType(e.target.value)}
                        className="studio-select"
                      >
                        <option value="daily">📅 每日工作/学习复盘</option>
                        <option value="weekly">📊 每周总结复盘</option>
                        <option value="interview">💼 面试与沟通复盘</option>
                        <option value="technical">🚀 技术攻坚复盘</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="reflection-date">复盘日期</label>
                    <input
                      id="reflection-date"
                      type="date"
                      value={refDate || today}
                      onChange={(e) => setRefDate(e.target.value)}
                      className="studio-input"
                    />
                    <p className="field-tip">默认使用本地今天，也可以选择日期补记。</p>
                  </div>

                  <div className="form-group">
                    <label>主要工作内容与产出事实 *</label>
                    <textarea
                      rows={4}
                      placeholder="记录今天做了什么、交付了什么模块..."
                      value={refContent}
                      onChange={(e) => setRefContent(e.target.value)}
                      required
                      className="studio-textarea"
                    />
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>遇到的难点 / 踩坑 / 挑战</label>
                      <textarea
                        rows={3}
                        placeholder="遇到什么技术或业务卡点..."
                        value={refChallenges}
                        onChange={(e) => setRefChallenges(e.target.value)}
                        className="studio-textarea"
                      />
                    </div>
                    <div className="form-group">
                      <label>解决方案 / 架构决策</label>
                      <textarea
                        rows={3}
                        placeholder="通过什么方案或代码解决了问题..."
                        value={refSolution}
                        onChange={(e) => setRefSolution(e.target.value)}
                        className="studio-textarea"
                      />
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>心得收获 / 认知提升</label>
                      <textarea
                        rows={3}
                        placeholder="沉淀了什么方法论或工程认知..."
                        value={refTakeaways}
                        onChange={(e) => setRefTakeaways(e.target.value)}
                        className="studio-textarea"
                      />
                    </div>
                    <div className="form-group">
                      <label>后续行动 / 待补足技能</label>
                      <textarea
                        rows={3}
                        placeholder="下一步还要补什么、跟进什么..."
                        value={refNextSteps}
                        onChange={(e) => setRefNextSteps(e.target.value)}
                        className="studio-textarea"
                      />
                    </div>
                  </div>

                  {submitFeedback && (
                    <div className={`feedback-alert ${submitFeedback.isError ? 'error' : 'success'}`}>
                      {submitFeedback.isError ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                      <span>{submitFeedback.msg}</span>
                    </div>
                  )}

                  <div className="form-actions">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn-studio-submit"
                    >
                      <Send size={15} />
                      <span>{submitting ? '提炼中...' : '提交复盘并提炼候选记忆 ➔'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Column: Templates & History */}
              <div className="studio-side-col">
                <div className="studio-panel">
                  <div className="panel-head">
                    <div className="panel-title-wrap">
                      <Sparkles size={16} />
                      <h3>快捷预置模版</h3>
                    </div>
                  </div>
                  <div className="templates-list">
                    {TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.name}
                        type="button"
                        onClick={() => applyTemplate(tpl)}
                        className="template-card-btn"
                      >
                        <strong>{tpl.name}</strong>
                        <p>{tpl.title}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="studio-panel" style={{ marginTop: '1.25rem' }}>
                  <div className="panel-head">
                    <div className="panel-title-wrap">
                      <FileCheck size={16} />
                      <h3>近期复盘记录 ({reflectionsHistory.length})</h3>
                    </div>
                  </div>
                  <div className="recent-reflections-list">
                    {reflectionsHistory.length === 0 ? (
                      <div className="empty-tip">暂无历史复盘，在左侧提交你的第一条复盘吧！</div>
                    ) : (
                      reflectionsHistory.slice(0, 5).map((r, i) => (
                        <div key={r.id || i} className="ref-history-item">
                          <div className="ref-h-top">
                            <span className="ref-badge">{r.type}</span>
                            <span className="ref-date">{r.date}</span>
                          </div>
                          <strong>{r.title}</strong>
                          <p>{r.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* Tab 2: Candidate Memory Approval Board */}
        {/* ======================================================== */}
        {activeTab === 'candidates' && (
          <div className="studio-view-content">
            <div className="studio-panel">
              <div className="panel-head">
                <div className="panel-title-wrap">
                  <Flame size={18} className="stat-icon-amber" />
                  <div>
                    <h3>待确认候选记忆看板 ({candidates.length})</h3>
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      以下条目由规则提炼，<strong>尚未人工确认</strong>。请核对真实情况；确认后仍只在私人工作台保存。
                    </p>
                  </div>
                </div>
              </div>

              {candidates.length === 0 ? (
                <div className="empty-board-box">
                  <CheckCircle2 size={36} className="stat-icon-emerald" />
                  <h4>太棒了，所有候选记忆均已完成审批！</h4>
                  <p>当前没有待处理的候选记忆。你可以前往「📝 个人复盘输入」提交新的复盘。</p>
                </div>
              ) : (
                <div className="candidates-grid">
                  {candidates.map((cand) => (
                    <div key={cand.id} className="candidate-card">
                      <div className="cand-head">
                        <div className="cand-cat-badge">
                          <span className="cand-dot"></span>
                          <span>{cand.category}</span>
                        </div>
                        <div className="cand-conf">规则提炼 · 待人工核对</div>
                      </div>

                      <h4 className="cand-title">{cand.title}</h4>
                      <div className="cand-body">{cand.content}</div>

                      {cand.tags && Array.isArray(cand.tags) && cand.tags.length > 0 && (
                        <div className="cand-tags-row">
                          {cand.tags.map((t: any, idx: number) => {
                            const tagText = typeof t === 'string' ? t : t?.tag || ''
                            if (!tagText) return null
                            return (
                              <span key={idx} className="cand-tag-pill">#{tagText}</span>
                            )
                          })}
                        </div>
                      )}

                      <div className="cand-evidence">
                        <strong>证据溯源：</strong> {cand.evidenceTag}
                      </div>

                      <div className="cand-actions">
                        <button
                          type="button"
                          onClick={() => handleApprove(cand)}
                          className="btn-cand-approve"
                        >
                          <CheckCircle2 size={14} />
                          <span>确认私人记忆</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(cand)}
                          className="btn-cand-edit"
                        >
                          <Edit3 size={14} />
                          <span>编辑</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(cand)}
                          className="btn-cand-reject"
                        >
                          <XCircle size={14} />
                          <span>丢弃</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* Tab 3: Approved Formal Memory Base */}
        {/* ======================================================== */}
        {activeTab === 'approved_memories' && (
          <div className="studio-view-content">
            <div className="studio-panel">
              <div className="panel-head">
                <div className="panel-title-wrap">
                  <ShieldCheck size={18} className="stat-icon-emerald" />
                  <div>
                    <h3>私人已确认记忆 ({approvedMemories.length})</h3>
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      这里仅保存私人记忆。创建知识草稿后，在 CMS 审查内容并勾选公开，访客 AI 才能读取。
                    </p>
                  </div>
                </div>
              </div>

              {approvedMemories.length === 0 ? (
                <div className="empty-board-box">
                  <Clock size={36} className="stat-icon-amber" />
                  <h4>暂无已确认记忆</h4>
                  <p>在候选记忆看板中确认通过后，条目将持久化归档在此。</p>
                </div>
              ) : (
                <div className="approved-memories-grid">
                  {approvedMemories.map((m) => (
                    <div key={m.id} className="approved-card">
                      <div className="app-card-top">
                        <span className="app-cat-badge">🔒 {m.category}</span>
                        <div className="app-card-actions">
                          <button
                            type="button"
                            onClick={() => openEditModal(m)}
                            className="btn-app-action"
                            title="编辑此条长期记忆"
                          >
                            <Edit3 size={13} />
                            <span>编辑</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteApproved(m)}
                            className="btn-app-action delete"
                            title="从正式库删除此条记忆"
                          >
                            <XCircle size={13} />
                            <span>删除</span>
                          </button>
                        </div>
                      </div>
                      <h4>{m.title}</h4>
                      <p>{m.content}</p>
                      {m.tags && Array.isArray(m.tags) && m.tags.length > 0 && (
                        <div className="cand-tags-row" style={{ marginTop: '0.45rem', marginBottom: '0.45rem' }}>
                          {m.tags.map((t: any, idx: number) => {
                            const tagText = typeof t === 'string' ? t : t?.tag || ''
                            if (!tagText) return null
                            return (
                              <span key={idx} className="cand-tag-pill">#{tagText}</span>
                            )
                          })}
                        </div>
                      )}
                      <div className="app-card-foot">
                        {draftLinks[m.id] ? (
                          <a href={draftLinks[m.id]} target="_blank" rel="noreferrer">在 CMS 审核知识草稿 ↗</a>
                        ) : (
                          <button type="button" className="btn-app-action" disabled={draftPending !== null} onClick={() => createKnowledgeDraft(m)}>
                            {draftPending === String(m.id) ? '正在创建…' : '创建 AI 知识草稿'}
                          </button>
                        )}
                        <span>{m.evidenceTag}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* Tab 4: Goals & Milestones */}
        {/* ======================================================== */}
        {activeTab === 'goals' && (
          <div className="studio-panel">
            <h3>已记录的技能与行动目标</h3>
            <p>来自你已确认的目标类记忆，不预设完成百分比。</p>
            {approvedMemories.filter((item) => item.category === 'skill_gap_goal').length === 0 ? (
              <p>尚未记录目标。可在复盘的“后续行动”中写下计划，再到候选看板确认。</p>
            ) : approvedMemories.filter((item) => item.category === 'skill_gap_goal').map((item) => (
              <article key={item.id}><h4>{item.title}</h4><p>{item.content}</p></article>
            ))}
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="studio-view-content">
            <div className="studio-stats-grid">
              <div className="stat-card"><div className="stat-card-header">复盘记录</div><div className="stat-value">{reflectionsHistory.length}</div></div>
              <div className="stat-card"><div className="stat-card-header">待确认记忆</div><div className="stat-value">{candidates.length}</div></div>
              <div className="stat-card"><div className="stat-card-header">私人已确认记忆</div><div className="stat-value">{approvedMemories.length}</div></div>
            </div>
            <div className="studio-panel">
              <h3>内容管理</h3>
              <p>作品、项目经历与公开 AI 知识以 CMS 中保存的数据为准。</p>
              <div className="app-card-actions">
                <Link href="/admin/collections/projects">管理项目 ↗</Link>
                <Link href="/admin/collections/experiences">管理经历 ↗</Link>
                <Link href="/admin/collections/ai-knowledge">审核 AI 知识 ↗</Link>
              </div>
              <p>招聘方提问统计尚未接入。</p>
            </div>
            <div className="studio-heatmap-wrap">
              <div className="heatmap-head"><h3>过去一年复盘记录</h3><span>{activity.totalActiveDays} 天 · {activity.totalCount} 条</span></div>
              <div className="heatmap-scroll-area"><div className="heatmap-weeks-row">
                {activity.weeks.map((week, index) => <div key={index} className="heatmap-week-col">
                  {week.map((day) => <div key={day.date} className={`heatmap-cell level-${day.level}`} title={`${day.date}：${day.count} 条复盘`} />)}
                </div>)}
              </div></div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingItem && (
          <div className="studio-modal-overlay">
            <div className="studio-modal-card" style={{ maxWidth: '620px' }}>
              <div className="modal-head">
                <h3>编辑结构化记忆条目</h3>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="btn-modal-close"
                >
                  ✕
                </button>
              </div>

              {/* Mode Switch Bar */}
              <div className="modal-mode-tabs">
                <button
                  type="button"
                  onClick={() => switchEditMode('structured')}
                  disabled={editMode === 'raw' && !parseMemorySections(editRawContent)}
                  className={`modal-mode-btn ${editMode === 'structured' ? 'active' : ''}`}
                >
                  📋 结构化分段编辑 (自动保持【】格式)
                </button>
                <button
                  type="button"
                  onClick={() => switchEditMode('raw')}
                  className={`modal-mode-btn ${editMode === 'raw' ? 'active' : ''}`}
                >
                  📝 自由纯文本模式
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label>记忆主题 / 攻坚项目 *</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="studio-input"
                  />
                </div>

                {editMode === 'structured' ? (
                  <>
                    <div className="form-group">
                      <div className="field-label-row">
                        <label>🎯 遇到的难点与业务场景</label>
                        <span className="field-tip">系统将自动打上【业务难点与场景】前缀</span>
                      </div>
                      <textarea
                        rows={3}
                        placeholder="描述业务场景背景、遇到的痛点或技术挑战..."
                        value={editScenario}
                        onChange={(e) => setEditScenario(e.target.value)}
                        className="studio-textarea"
                      />
                    </div>

                    <div className="form-group">
                      <div className="field-label-row">
                        <label>⚡ 采用的技术方案与实现细节</label>
                        <span className="field-tip">系统将自动打上【技术方案与实现】前缀</span>
                      </div>
                      <textarea
                        rows={3}
                        placeholder="描述采用的架构、算法、库或工程化解决方案..."
                        value={editSolution}
                        onChange={(e) => setEditSolution(e.target.value)}
                        className="studio-textarea"
                      />
                    </div>

                    <div className="modal-live-preview">
                      <span className="preview-tag">✨ 最终规范格式实时预览</span>
                      <pre className="preview-content">
                        {`【业务难点与场景】${editScenario.trim() || '（暂无）'}\n【技术方案与实现】${editSolution.trim() || '（暂无）'}`}
                      </pre>
                    </div>
                  </>
                ) : (
                  <div className="form-group">
                    <label htmlFor="memory-content">事实内容（纯文本编辑）</label>
                    {!parseMemorySections(editRawContent) && <p className="field-tip">此条内容使用纯文本编辑，以保留全部正文和自定义分段。</p>}
                    <textarea
                      id="memory-content"
                      rows={6}
                      value={editRawContent}
                      onChange={(e) => setEditRawContent(e.target.value)}
                      className="studio-textarea"
                    />
                  </div>
                )}
              </div>

              <div className="modal-foot">
                <button
                  type="button"
                  onClick={() => {
                    if (editingItem) {
                      openEditModal(editingItem)
                    }
                  }}
                  className="btn-modal-reset"
                  title="恢复为原本自动提炼的内容"
                >
                  <RotateCcw size={13} />
                  <span>还原初版</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="btn-modal-cancel"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="btn-studio-submit"
                >
                  保存并确认私人记忆 ➔
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
