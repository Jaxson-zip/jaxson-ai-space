'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  Layers,
  FolderGit2,
  Cpu,
  ArrowUpRight,
  ShieldCheck,
  Zap,
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
import { projects, experiences, awards, skillGroups } from '@/features/portfolio/content'
import { generateYearlyActivityData, getRecruiterTopicInsights } from '@/features/studio/analytics'

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
  {
    name: '📅 每日研发攻坚复盘',
    title: '优化 Vue3 监控组件防抖与并发状态',
    type: 'daily',
    content: '今日跟进润喵云算力平台订单模块与资源监控页面开发，完成了多实例指标展示。',
    challenges: '高频轮询导致前端渲染轻微卡顿，且快速切换 Tab 时存在竞态不同步风险。',
    solution: '引入 useRequest 竞态取消机制与 300ms 动态防抖策略，组件重渲染频次降低 50%。',
    takeaways: '复杂异步场景下，必须在组件卸载或前序请求未完成时主动 AbortController。',
    nextSteps: '深入学习 pgvector 索引性能调优与 Cloudflare Access 鉴权规则。',
  },
  {
    name: '💼 面试与技术沟通复盘',
    title: '前端全栈岗位技术一面复盘',
    type: 'interview',
    content: '面试官重点考察了 Next.js App Router 渲染机制、SSE 流式打字机实现及 RAG 防幻觉设计。',
    challenges: '对 pgvector HNSW 与 IVFFlat 索引的内存与召回率差异回答略显粗糙。',
    solution: '后续准备专门的对比测试 Demo，并结合实际 1536 维 Embedding 数据进行压力测试。',
    takeaways: '面试中多结合具体线上落地数据（如首屏秒开率、内存优化比例）进行量化表达。',
    nextSteps: '完善 GitHub 作品集的架构图白皮书与本地离线演示脚本。',
  },
  {
    name: '🚀 架构与长远思考',
    title: '双面智能体架构物理隔离认知',
    type: 'technical',
    content: '确立了公开端 (public_read) 与私人端 (owner) 在 PostgreSQL 数据库层面的物理权限隔离。',
    challenges: '如何确保公开端 AI 即使发生 Prompt Injection 也绝对无法越权读取私人记忆。',
    solution: '通过数据库用户角色授予严格的只读快照视图，从根本上杜绝任何 SQL/ORM 越权。',
    takeaways: '安全边界永远应该建在最底层的物理层与数据库权限层，而不是只靠 Prompt 约束。',
    nextSteps: '编写 Docker Compose 生产环境自动化构建与 Caddy 反向代理脚本。',
  },
]

export default function StudioPage() {
  const [activeTab, setActiveTab] = useState<'reflection' | 'candidates' | 'approved_memories' | 'goals' | 'overview'>('reflection')

  // Reflection form state
  const [refTitle, setRefTitle] = useState('')
  const [refType, setRefType] = useState('daily')
  const [refDate, setRefDate] = useState(new Date().toISOString().slice(0, 10))
  const [refContent, setRefContent] = useState('')
  const [refChallenges, setRefChallenges] = useState('')
  const [refSolution, setRefSolution] = useState('')
  const [refTakeaways, setRefTakeaways] = useState('')
  const [refNextSteps, setRefNextSteps] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitFeedback, setSubmitFeedback] = useState<{ msg: string; isError?: boolean } | null>(null)

  // Remote data state
  const [candidates, setCandidates] = useState<CandidateMemoryItem[]>([])
  const [approvedMemories, setApprovedMemories] = useState<CandidateMemoryItem[]>([])
  const [reflectionsHistory, setReflectionsHistory] = useState<ReflectionItem[]>([])
  const [loading, setLoading] = useState(false)

  // Editing modal state
  const [editingItem, setEditingItem] = useState<CandidateMemoryItem | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editScenario, setEditScenario] = useState('')
  const [editSolution, setEditSolution] = useState('')
  const [editMode, setEditMode] = useState<'structured' | 'raw'>('structured')
  const [editRawContent, setEditRawContent] = useState('')

  // Helper to open edit modal with auto-parsed fields
  const openEditModal = (item: CandidateMemoryItem) => {
    setEditingItem(item)
    setEditTitle(item.title)
    setEditRawContent(item.content)

    // Parse scenario and solution
    const scenarioMatch = item.content.match(/【(?:业务场景|难点与场景|场景与难点|遇到难点|业务难点与场景)】([\s\S]*?)(?=【|$)/)
    const solutionMatch = item.content.match(/【(?:攻坚突破|技术方案|架构决策|解决方案|技术实现|技术方案与实现)】([\s\S]*?)(?=【|$)/)

    if (scenarioMatch || solutionMatch) {
      setEditScenario(scenarioMatch ? scenarioMatch[1].trim() : '')
      setEditSolution(solutionMatch ? solutionMatch[1].trim() : '')
      setEditMode('structured')
    } else {
      setEditScenario('')
      setEditSolution(item.content.trim())
      setEditMode('structured')
    }
  }

  // Load data
  const fetchData = React.useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const res = await fetch('/api/studio/memory')
      const data = await res.json()
      if (data.success) {
        setCandidates(data.candidateMemories || [])
        setApprovedMemories(data.approvedMemories || [])
        setReflectionsHistory(data.reflections || [])
      }
    } catch (e) {
      console.warn('Failed to load studio data:', e)
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
        if (!ignore && data.success) {
          setCandidates(data.candidateMemories || [])
          setApprovedMemories(data.approvedMemories || [])
          setReflectionsHistory(data.reflections || [])
        }
      } catch (e) {
        console.warn('Failed to load studio data:', e)
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
            date: refDate,
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
        setSubmitFeedback({ msg: result.message || '复盘提交成功！已智能提炼出候选记忆。' })
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

    let finalContent = ''
    if (editMode === 'structured') {
      const parts: string[] = []
      if (editScenario.trim()) {
        parts.push(`【业务难点与场景】${editScenario.trim()}`)
      }
      if (editSolution.trim()) {
        parts.push(`【技术方案与实现】${editSolution.trim()}`)
      }
      finalContent = parts.join('\n')
      if (!finalContent.trim()) {
        finalContent = editScenario.trim() || editSolution.trim()
      }
    } else {
      finalContent = editRawContent.trim()
    }

    if (!finalContent) return

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
              拒绝 AI 自动污染长期记忆库。日常复盘 ➔ 结构化提炼 ➔ 人工确认审批 ➔ 入库持久化。
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
            <span>正式长期记忆库 ({approvedMemories.length})</span>
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
                      以下由复盘提炼出的条目<strong>尚未写入正式知识库</strong>。请审查、修改或点击确认入库。
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
                        <div className="cand-conf">置信度: {(cand.confidence * 100).toFixed(0)}%</div>
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
                          <span>确认入库 (Approve)</span>
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
                    <h3>正式持久化长期记忆库 ({approvedMemories.length})</h3>
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      所有经过人工确认的记忆已自动进入 RAG 知识检索向量库，提供精准证据佐证。
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
          <div className="studio-view-content">
            <div className="studio-two-col">
              <div className="studio-panel">
                <div className="panel-head">
                  <div className="panel-title-wrap">
                    <Target size={18} className="stat-icon-indigo" />
                    <h3>🎯 2026 秋招投递目标与进度</h3>
                  </div>
                </div>
                <div className="goals-progress-list">
                  <div className="goal-item">
                    <div className="goal-head">
                      <strong>AI 应用开发 / 全栈开发 (深圳)</strong>
                      <span className="goal-percent">80% 准备度</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: '80%' }}></div>
                    </div>
                    <div className="goal-sub">目标公司：大厂 AI Lab / 头部 AI 出海独角兽 / 算力基础设施</div>
                  </div>

                  <div className="goal-item">
                    <div className="goal-head">
                      <strong>核心作品集与架构白皮书</strong>
                      <span className="goal-percent">95% 完成</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: '95%' }}></div>
                    </div>
                    <div className="goal-sub">Todo Memo + 锐历简历 + OPC Agent + 润喵云实习经历</div>
                  </div>
                </div>
              </div>

              <div className="studio-panel">
                <div className="panel-head">
                  <div className="panel-title-wrap">
                    <Zap size={18} className="stat-icon-amber" />
                    <h3>待补足技术缺口与攻坚项</h3>
                  </div>
                </div>
                <div className="skills-todo-list">
                  <div className="todo-row done">
                    <CheckCircle2 size={16} />
                    <span>Next.js 16 App Router + Payload CMS 3.x 嵌入架构</span>
                  </div>
                  <div className="todo-row done">
                    <CheckCircle2 size={16} />
                    <span>TypeScript 纯原生余弦相似度 + BM25 混合检索</span>
                  </div>
                  <div className="todo-row done">
                    <CheckCircle2 size={16} />
                    <span>私人复盘 ➔ 候选记忆 ➔ 人工确认审批闭环系统</span>
                  </div>
                  <div className="todo-row pending">
                    <Clock size={16} />
                    <span>PostgreSQL + pgvector 双 Schema 物理隔离与生产部署</span>
                  </div>
                  <div className="todo-row pending">
                    <Clock size={16} />
                    <span>Cloudflare Zero Trust 针对 `/studio` 的邮箱拦截配置</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* Tab 5: Overview (Projects & Base Data) */}
        {/* ======================================================== */}
        {activeTab === 'overview' && (
          <div className="studio-view-content">
            {/* Stat Cards Grid */}
            <div className="studio-stats-grid">
              <div className="stat-card">
                <div className="stat-card-header">
                  <span>精选作品</span>
                  <FolderGit2 size={16} className="stat-icon-blue" />
                </div>
                <div className="stat-value">{projects.length} <small>个</small></div>
                <div className="stat-desc">2 个已公开上线 / 1 个私有探索</div>
              </div>

              <div className="stat-card">
                <div className="stat-card-header">
                  <span>企业与学术经历</span>
                  <Layers size={16} className="stat-icon-indigo" />
                </div>
                <div className="stat-value">{experiences.length} <small>段</small></div>
                <div className="stat-desc">广东润喵云实习 + 深职大大数据</div>
              </div>

              <div className="stat-card">
                <div className="stat-card-header">
                  <span>竞赛荣誉与认证</span>
                  <Zap size={16} className="stat-icon-amber" />
                </div>
                <div className="stat-value">{awards.length} <small>项</small></div>
                <div className="stat-desc">国家级二等奖 · 省级一等奖</div>
              </div>

              <div className="stat-card">
                <div className="stat-card-header">
                  <span>已沉淀正式记忆</span>
                  <ShieldCheck size={16} className="stat-icon-emerald" />
                </div>
                <div className="stat-value">{approvedMemories.length} <small>条</small></div>
                <div className="stat-desc">已与 RAG 向量库实时联动</div>
              </div>
            </div>

            {/* Quick Management Center */}
            <div className="studio-two-col">
              <div className="studio-panel">
                <div className="panel-head">
                  <div className="panel-title-wrap">
                    <FolderGit2 size={16} />
                    <h3>核心作品快速入口</h3>
                  </div>
                  <a href="/admin/collections/projects" className="panel-tip" target="_blank" rel="noreferrer">
                    在 CMS 中编辑 ↗
                  </a>
                </div>

                <div className="project-list-compact">
                  {projects.map((p) => (
                    <div key={p.slug} className="project-row-item">
                      <div className="row-left">
                        <span className={`status-dot-mini ${p.sourceVisibility === 'public' ? 'live' : 'private'}`}></span>
                        <div>
                          <strong>{p.title}</strong>
                          <div className="row-sub">{p.category} · {p.status}</div>
                        </div>
                      </div>
                      <div className="row-right">
                        {p.links.map((l) => (
                          <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="row-ext-btn">
                            <span>{l.label}</span>
                            <ArrowUpRight size={11} />
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="studio-panel">
                <div className="panel-head">
                  <div className="panel-title-wrap">
                    <Sparkles size={16} />
                    <h3>AI 知识库与岗位匹配看板</h3>
                  </div>
                  <Link href="/ai" className="panel-tip">
                    打开 AI 对话室 ➔
                  </Link>
                </div>

                <div className="ai-knowledge-preview">
                  <div className="knowledge-chip-row">
                    <span className="k-badge">🏢 广东润喵云科技 (Vue 3 + Go 算力平台)</span>
                    <span className="k-badge">📱 待办备忘 (React + Supabase + PWA)</span>
                    <span className="k-badge">📄 锐历简历 (中文化排版优化开源)</span>
                    <span className="k-badge">🤖 OPC Agent Company (多智能体协同)</span>
                    <span className="k-badge">🎓 深圳职业技术大学 (GPA 3.67 前 5%)</span>
                  </div>

                  <div className="ai-status-box">
                    <div className="ai-status-head">
                      <Clock size={13} />
                      <span>RAG 向量上下文注入就绪</span>
                    </div>
                    <p>访客在 `/ai` 页面提问或粘贴招聘岗位 JD 时，系统将基于上述事实自动匹配契合度与事实证据。</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 365-Day Reflection & Growth Heatmap */}
            <div className="studio-heatmap-wrap">
              <div className="heatmap-head">
                <div className="heatmap-title-group">
                  <Flame size={18} className="stat-icon-emerald" />
                  <h3>365 天复盘与工程沉淀打卡热力图</h3>
                </div>
                <div className="heatmap-meta">
                  <span>过去一年活跃 <strong>{generateYearlyActivityData().totalActiveDays}</strong> 天</span>
                  <span>累计复盘与提交 <strong>{generateYearlyActivityData().totalCount}</strong> 次</span>
                </div>
              </div>

              <div className="heatmap-scroll-area">
                <div className="heatmap-weeks-row">
                  {generateYearlyActivityData().weeks.map((week, wIdx) => (
                    <div key={wIdx} className="heatmap-week-col">
                      {week.map((day) => (
                        <div
                          key={day.date}
                          className={`heatmap-cell level-${day.level}`}
                          title={`${day.date}：${day.count > 0 ? `${day.count} 次复盘与技术沉淀` : '暂无提交'}`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="heatmap-legend">
                <span>少</span>
                <div className="legend-cells">
                  <div className="heatmap-cell level-0" />
                  <div className="heatmap-cell level-1" />
                  <div className="heatmap-cell level-2" />
                  <div className="heatmap-cell level-3" />
                  <div className="heatmap-cell level-4" />
                </div>
                <span>多</span>
              </div>
            </div>

            {/* Recruiter Insights & Search Trends */}
            <div className="studio-panel" style={{ marginTop: '1.5rem' }}>
              <div className="panel-head">
                <div className="panel-title-wrap">
                  <Activity size={18} className="stat-icon-blue" />
                  <h3>招聘方与面试官提问热词洞察</h3>
                </div>
                <span className="panel-tip">基于 /ai 分身对话室实时检索热度聚合</span>
              </div>

              <div className="recruiter-analytics-wrap">
                {getRecruiterTopicInsights().map((item) => (
                  <div key={item.keyword} className="insight-stat-card">
                    <div className="insight-info">
                      <span className="insight-keyword">{item.keyword}</span>
                      <span className="insight-cat-tag">分类：{item.category}</span>
                    </div>
                    <span className="insight-count-badge">
                      🔥 {item.count} 次检索
                    </span>
                  </div>
                ))}
              </div>
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
                  onClick={() => setEditMode('structured')}
                  className={`modal-mode-btn ${editMode === 'structured' ? 'active' : ''}`}
                >
                  📋 结构化分段编辑 (自动保持【】格式)
                </button>
                <button
                  type="button"
                  onClick={() => setEditMode('raw')}
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
                    <label>事实内容（纯文本编辑）</label>
                    <textarea
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
                  保存并确认入库 ➔
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
