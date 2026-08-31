/**
 * Script to seed knowledge chunks and 1536-dimensional embeddings into PostgreSQL public_read.knowledge_embeddings
 */
import { execSync } from 'child_process'

function generate1536Vector(text) {
  const DIMENSIONS = 1536
  const vector = new Array(DIMENSIONS).fill(0)
  const normalized = text.toLowerCase().trim()

  if (!normalized) {
    vector[0] = 1
    return vector
  }

  for (let i = 0; i < normalized.length; i++) {
    const charCode = normalized.charCodeAt(i)
    const pos1 = (charCode * 31 + i * 17) % DIMENSIONS
    const pos2 = (charCode * 59 + i * 37 + (normalized.charCodeAt(i + 1) || 0) * 13) % DIMENSIONS
    const pos3 = (charCode * 97 + i * 79 + (normalized.charCodeAt(i - 1) || 0) * 23) % DIMENSIONS

    vector[pos1] += 1.0
    vector[pos2] += 0.75
    vector[pos3] += 0.5
  }

  let normSquared = 0
  for (let i = 0; i < DIMENSIONS; i++) {
    normSquared += vector[i] * vector[i]
  }

  const norm = Math.sqrt(normSquared) || 1
  for (let i = 0; i < DIMENSIONS; i++) {
    vector[i] = Number((vector[i] / norm).toFixed(6))
  }

  return vector
}

const RAW_CHUNKS = [
  {
    chunk_id: 'exp-internship-runmiao',
    category: 'internship',
    title: '广东润喵云科技 · 前端与全栈开发实习生',
    content: '【主要职责与产出】主导私有算力与资源监控平台前端重构，基于 Vue 3 + TypeScript 封装可复用大屏组件，将状态抖动降低 40%；与 Go 后端紧密联调 RESTful 及 WebSocket 接口，保障高并发下的状态一致性；沉淀自动化构建与组件规范文档。',
    evidence_tag: '广东润喵云科技 · 前端与全栈开发实习生',
    metadata: { org: '广东润喵云科技', period: '2026.06 — 2026.08', role: '前端与全栈开发实习生' },
  },
  {
    chunk_id: 'proj-todo-memo',
    category: 'project',
    title: '待办备忘 (Todo Memo PWA)',
    content: '【项目背景】解决日常轻量待办记录在弱网或多端切换时状态不同步的痛点。\n【技术方案】基于 React + TypeScript + Supabase + PWA 架构，封装离线 IndexedDB 本地缓存与 Service Worker 拦截；设计乐观更新与自动重试同步状态机；实现跨端 PWA 离线运行与 Web Push 通知。\n【交付成果】已上线交付，支持无网络离线新增与修改，网络恢复后秒级自动同步至 Supabase 云端。',
    evidence_tag: 'Todo Memo PWA 核心项目',
    metadata: { slug: 'todo-memo', status: '已上线 PWA', stack: ['React', 'TypeScript', 'Supabase', 'PWA'] },
  },
  {
    chunk_id: 'proj-ruili-resume',
    category: 'project',
    title: '锐历简历工作台 (Ruili Resume)',
    content: '【项目背景】开源求职简历工作台在中文字体抗锯齿、A4 换页断行与即时渲染排版上体验欠佳。\n【技术方案】基于开源项目深度二次开发，重构中文字体级联渲染引擎与 A4 页面物理标尺换页计算模型；优化实时响应式状态同步与本地 LocalStorage 瞬时草稿自动保存；集成一键导出抗锯齿高清 PDF。\n【交付成果】已开源并提供即开即用体验，完美解决中文换页断行重叠问题。',
    evidence_tag: '锐历简历工作台 核心项目',
    metadata: { slug: 'ruili-resume', status: '已开源 / 持续迭代', stack: ['React', 'Next.js', 'TailwindCSS', 'PDF'] },
  },
  {
    chunk_id: 'awards-summary',
    category: 'award',
    title: '竞赛荣誉与学业奖项',
    content: '国家级二等奖（2025 年全国职业院校技能大赛 · 大数据应用开发赛项）\n省级一等奖（2025 年广东省职业院校技能大赛 · 软件系统开发赛项）\n校级特等奖学金与优秀共青团员标兵（连续 2 年综合测评前 5%）',
    evidence_tag: '国家级/省级竞赛荣誉记录',
    metadata: { gpa: '3.67/4.0', rank: 'Top 5%' },
  },
  {
    chunk_id: 'skills-graph',
    category: 'skill',
    title: '技术栈与能力图谱',
    content: '【AI 应用开发】RAG 向量混合检索、Prompt Engineering、多智能体协同设计、pgvector 向量库\n【前端与全栈工程】React 19、Next.js 16、Vue 3、TypeScript、TailwindCSS、PWA、Payload CMS\n【后端与基础设施】Node.js、Go、PostgreSQL 17、Supabase、Docker、Caddy、Linux、Cloudflare',
    evidence_tag: '技术栈与工程能力图谱',
    metadata: { core: ['AI App', 'Fullstack', 'PostgreSQL', 'Docker'] },
  },
  {
    chunk_id: 'profile-intent',
    category: 'intent',
    title: '个人基本信息与 2026/2027 求职意向',
    content: '【姓名】张锦鹏 (Jaxson)\n【毕业院校】深圳职业技术大学（大数据技术专业，GPA 3.67/4.0 前 5%）\n【求职意向】AI 应用开发 / Web 全栈开发 / 前端开发工程师\n【期望地点】深圳（可即时到岗/线下实习）\n【联系方式】电话/微信：15347640609，邮箱：1822103245@qq.com，GitHub：https://github.com/Jaxson-zip',
    evidence_tag: '张锦鹏个人履历与联系方式',
    metadata: { name: '张锦鹏', city: '深圳', phone: '15347640609' },
  },
]

let sql = ''
for (const chunk of RAW_CHUNKS) {
  const vector = generate1536Vector(`${chunk.title} ${chunk.content}`)
  const vectorStr = `[${vector.join(',')}]`
  const metaJson = JSON.stringify(chunk.metadata).replace(/'/g, "''")
  const contentSafe = chunk.content.replace(/'/g, "''")
  const titleSafe = chunk.title.replace(/'/g, "''")
  const evidenceSafe = chunk.evidence_tag.replace(/'/g, "''")

  sql += `
INSERT INTO public_read.knowledge_embeddings 
  (chunk_id, category, title, content, evidence_tag, embedding, metadata)
VALUES 
  ('${chunk.chunk_id}', '${chunk.category}', '${titleSafe}', '${contentSafe}', '${evidenceSafe}', '${vectorStr}', '${metaJson}'::jsonb)
ON CONFLICT (chunk_id) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  evidence_tag = EXCLUDED.evidence_tag,
  embedding = EXCLUDED.embedding,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();
`
}

console.log('Inserting into PostgreSQL container jaxson-postgres-dev...')
try {
  execSync(`docker exec -i jaxson-postgres-dev psql -U jaxson_admin -d jaxson_space`, {
    input: sql,
    stdio: ['pipe', 'inherit', 'inherit'],
  })
  console.log('✅ Successfully seeded knowledge chunks and 1536-d vectors into public_read.knowledge_embeddings!')
} catch (err) {
  console.error('❌ Error inserting into Postgres:', err.message)
  process.exit(1)
}
