/**
 * Script to seed 100% verified portfolio data into Payload CMS PostgreSQL database (schema: owner)
 */
import pg from 'pg'
import crypto from 'crypto'

const { Pool } = pg

const databaseUri =
  process.env.DATABASE_URI ||
  'postgresql://owner_app:f507d423018cb7864a5074d1@127.0.0.1:5432/jaxson_space'

const pool = new Pool({
  connectionString: databaseUri,
  max: 2,
  idleTimeoutMillis: 5000,
})

const PROJECTS = [
  {
    title: 'Jaxson AI Space (本站 · 全栈个人门户与 AI 分身)',
    slug: 'jaxson-ai-space',
    role: '独立全栈架构与开发',
    category: '全栈工程 · 真实交付',
    visibility: 'public',
    status: '已全量上线',
    summary: '真正生产交付的现代化工程师数字分身空间，集成第一人称 RAG 向量知识库检索、Payload CMS 无头内容管理与双 Schema 数据隔离。',
    problem: '传统作品集为纯静态单向展示，招聘方无法深度交互探索候选人技术栈；个人知识碎片与真实案例缺少动态易维护的后端体系。',
    approach: '基于 Next.js 16 + React 19 构建流式交互界面，嵌入 Payload CMS 3.x 动态管理内容；后端基于 PostgreSQL 17 + pgvector 构建知识切片余弦相似度检索与物理权限隔离。',
    outcome: '项目已完整部署至外网生产环境（结合 Docker、PM2 与 Cloudflare Tunnel），实现毫秒级首屏加载与稳定第一人称防幻觉 RAG 问答流。',
    demo_url: 'http://space.jaxson.bond/',
    repo_url: 'https://github.com/Jaxson-zip/jaxson-ai-space',
    tags: ['Next.js 16', 'React 19', 'TypeScript', 'Payload CMS 3.x', 'PostgreSQL 17', 'pgvector', 'Docker', 'Cloudflare Tunnel'],
  },
  {
    title: '待办备忘 (Todo Memo)',
    slug: 'todo-memo',
    role: '独立全栈开发 / 云端任务管理应用',
    category: '工具应用 · 原型落地',
    visibility: 'public',
    status: '已上线 PWA',
    summary: '已真正上线的待办与备忘工具，覆盖登录鉴权、云端持久化、任务多级分组、标签过滤、即时检索与离线运行。',
    problem: '日常工作与学习中任务容易分散在散乱的临时记录中，缺少一个轻量入口把收集、归类和多端同步高效统一起来。',
    approach: '围绕“极速收集、按场景分组、离线可用和云端持久化”组织界面流，高频操作一键直达，并通过 Supabase 实现跨端实时同步。',
    outcome: '项目已完整部署至 Vercel，提供顺畅的桌面与移动端 PWA 安装体验，支持离线缓存与多设备实时同步。',
    demo_url: 'https://todo-theta-mauve-75.vercel.app/',
    repo_url: 'https://github.com/Jaxson-zip/to_do',
    tags: ['React', 'TypeScript', 'Supabase', 'PWA', 'Vercel', 'Tailwind CSS'],
  },
]

const EXPERIENCES = [
  {
    organization: '广东润喵云科技有限公司',
    role: '全栈开发实习生',
    period: '2026.06 - 2026.08',
    type: 'internship',
    description: '负责基于 Vue 前端与 Golang 后端的算力租赁调度平台日常运维、缺陷修复与环境镜像制作。',
    bullets: [
      '负责算力租赁管理与订单调度模块的日常缺陷排查（Bug Fix）与功能联调维护。',
      '负责平台 Docker 运行环境镜像制作、依赖调优与标准化构建交付。',
      '深度借助 AI 效能工具（AI 辅助编程）高效定位全栈业务缺陷，敏捷完成交付任务。',
    ],
    tags: ['Vue', 'Go', 'Docker 镜像制作', '算力调度平台运维', 'AI 辅助编程'],
  },
  {
    organization: '深圳职业技术大学',
    role: '大数据技术专业 · 大专在读',
    period: '2024 — 2027 (2027 届)',
    type: 'education',
    description: 'GPA 3.85 / 4.0 (专业前 2%)，扎实掌握现代软件工程、大数据处理架构与 Web 全栈开发。',
    bullets: [
      '主修课程：数据结构与算法、Web 全栈工程、分布式计算、数据库系统原理、机器学习导论。',
      '担任院学信委人工智能学院副主席、班级学习委员、甲骨文社团社长。',
      '连续获得校级一等学业奖学金，累计获国家级奖项 5 项、省市级奖项 6 项。',
    ],
    tags: ['TypeScript', 'Python', 'SQL', '数据结构', '分布式系统', '大数据应用开发'],
  },
]

const CREDENTIALS = [
  {
    name: '中国大学生计算机设计大赛 - 大数据实践赛',
    category: 'award',
    year: '2024 — 2025',
    level: '国家级二等奖',
    items: '全国普通高校大学生竞赛榜单重点赛事 · 大数据实践赛项',
  },
  {
    name: '广东省职业院校技能大赛（高职组）大数据应用开发赛项',
    category: 'award',
    year: '2025 — 2026',
    level: '省级一等奖',
    items: '广东省教育厅主办职业院校技能大赛 · 大数据全流程开发',
  },
  {
    name: '一带一路暨金砖国家技能大赛 - 企业信息系统安全国赛',
    category: 'award',
    year: '2023 — 2024',
    level: '国家级二等奖',
    items: '一带一路暨金砖国家技能大赛金砖国家技能标准化与创新技术竞赛',
  },
  {
    name: '第六届“泰迪杯”数据分析技能赛',
    category: 'award',
    year: '2023 — 2024',
    level: '全国一等奖',
    items: '中国高校大数据与数据科学权威赛事 · 行业一等奖',
  },
  {
    name: '校级综合学业一等奖学金',
    category: 'award',
    year: '2024 — 2025',
    level: '校级一等 (GPA 3.85 专业前 2%)',
    items: '深圳职业技术大学综合学业奖学金 · 连续获评优秀学生',
  },
  {
    name: '前端开发技能',
    category: 'skill',
    year: '2026',
    level: '熟练掌握',
    items: 'React 19, Vue 3, TypeScript, Tailwind CSS, Next.js 16, Vite, 响应式布局与组件封装',
  },
  {
    name: '后端与数据技能',
    category: 'skill',
    year: '2026',
    level: '良好掌握',
    items: 'Go, Python, PostgreSQL, pgvector, MySQL, Supabase, RESTful API 设计, 分布式大数据',
  },
  {
    name: 'AI 应用开发技能',
    category: 'skill',
    year: '2026',
    level: '主攻方向 / 熟练落地',
    items: '大模型 API 接入, RAG 向量检索增强, Prompt 上下文工程, AI 编程效能实践 (Cursor/Claude)',
  },
  {
    name: '工程交付与工具',
    category: 'skill',
    year: '2026',
    level: '熟练掌握',
    items: 'Docker & 镜像制作, Linux 运维, Git & GitHub, PM2 进程守护, Cloudflare Tunnel, Vercel 自动化部署',
  },
]

const AI_KNOWLEDGE = [
  {
    title: '广东润喵云科技 · 算力租赁平台全栈实习事实',
    category: 'internship',
    content: '在广东润喵云科技有限公司实习期间（2026.06 - 2026.08），担任全栈开发实习生。负责算力租赁调度平台的日常运维与缺陷排查修复；负责平台 Docker 运行环境镜像制作与优化；协同维护基于 Vue 前端与 Golang 后端的算力调度业务模块；深度借助 AI 编程工具高效定位并修复业务缺陷。',
    is_public: true,
    evidence_tag: '广东润喵云科技 · 全栈开发实习生',
  },
  {
    title: 'Jaxson AI Space (本站) 全栈架构与技术实现',
    category: 'project',
    content: '【项目背景】传统作品集为静态单向展示，无法实现深度双向互动分析；缺少统一易维护的生产级全栈后台。\n【技术方案】基于 Next.js 16 + React 19 构建流式响应界面，嵌入 Payload CMS 3.x 统一管理内容；后端采用 PostgreSQL 17 + pgvector 搭建 dual schema（owner 与 public_read）物理隔离架构；集成第一人称 RAG 混合向量检索与知识切片溯源。\n【交付成果】已上线生产环境（space.jaxson.bond），开源于 github.com/Jaxson-zip/jaxson-ai-space。',
    is_public: true,
    evidence_tag: 'Jaxson AI Space 核心项目',
  },
  {
    title: '待办备忘 (Todo Memo PWA) 架构与交付事实',
    category: 'project',
    content: '【项目背景】解决日常轻量待办记录在弱网或多端切换时状态不同步的痛点。\n【技术方案】基于 React + TypeScript + Supabase + PWA 架构，设计离线缓存与 Service Worker 拦截；支持跨端 PWA 离线安装与实时云端同步。\n【交付成果】已真正上线部署至 Vercel（todo-theta-mauve-75.vercel.app），源码开源（github.com/Jaxson-zip/to_do）。',
    is_public: true,
    evidence_tag: 'Todo Memo PWA 核心项目',
  },
  {
    title: '竞赛荣誉与学业奖项事实',
    category: 'education',
    content: '张锦鹏在校期间累计获国家级奖项 5 项、省市级奖项 6 项：\n1. 中国大学生计算机设计大赛大数据实践赛 - 国家级二等奖（2024-2025）\n2. 广东省职业院校技能大赛（高职组）大数据应用开发赛项 - 省级一等奖（2025-2026）\n3. 一带一路暨金砖国家技能大赛企业信息系统安全国赛 - 国家级二等奖（2023-2024）\n4. 第六届“泰迪杯”数据分析技能赛 - 全国一等奖（2023-2024）\n5. 深圳职业技术大学校级综合学业一等奖学金（GPA 3.85 / 4.0，专业前 2%）。',
    is_public: true,
    evidence_tag: '真实国家级/省级竞赛荣誉记录',
  },
  {
    title: '技术栈与能力图谱',
    category: 'skill',
    content: '【前端与全栈工程】React 19、Next.js 16、Vue 3、TypeScript、Tailwind CSS、PWA、Vite\n【后端与大数据】Go、Python、PostgreSQL 17、pgvector 向量库、MySQL、Supabase、分布式计算\n【AI 原生开发】大模型 API 接入、RAG 向量检索增强、Prompt 上下文工程、AI 效能工具协同 (Cursor/Claude Code)\n【运维与交付】Docker 镜像制作、Linux、PM2 守护、Cloudflare Tunnel、Vercel',
    is_public: true,
    evidence_tag: '技术栈与工程能力图谱',
  },
  {
    title: '个人基本信息与求职意向',
    category: 'jd_match',
    content: '【姓名】张锦鹏 (Jaxson)\n【毕业院校】深圳职业技术大学（大数据技术专业 · 大专在读，2027 届毕业，GPA 3.85/4.0 前 2%）\n【校园职务】院学信委人工智能学院副主席、班级学习委员、甲骨文社团社长\n【求职意向】AI 应用开发 / Web 全栈开发 / 前端开发工程师\n【期望地点】深圳（可即时到岗/线下实习）\n【联系方式】电话/微信：15347640609，邮箱：1822103245@qq.com，GitHub：https://github.com/Jaxson-zip',
    is_public: true,
    evidence_tag: '张锦鹏个人履历与联系方式',
  },
]

function generate1536Vector(text) {
  const dimensions = 1536
  const vector = new Array(dimensions).fill(0)
  const normalized = String(text).toLowerCase().trim()
  if (!normalized) {
    vector[0] = 1
    return vector
  }
  for (let i = 0; i < normalized.length; i += 1) {
    const code = normalized.charCodeAt(i)
    vector[(code * 31 + i * 17) % dimensions] += 1
    vector[(code * 59 + i * 37 + (normalized.charCodeAt(i + 1) || 0) * 13) % dimensions] += 0.75
    vector[(code * 97 + i * 79 + (normalized.charCodeAt(i - 1) || 0) * 23) % dimensions] += 0.5
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
  return vector.map((value) => Number((value / norm).toFixed(6)))
}

async function seed() {
  const client = await pool.connect()
  try {
    console.log('🚀 开始向 Payload CMS 数据库注入真实数据...')
    await client.query('BEGIN')

    // 0. Clean up deprecated / fake projects
    console.log('🧹 清理废弃或半成品项目 (ruili-resume, opc-agent-company)...')
    const oldProjects = await client.query(
      `SELECT id FROM owner.projects WHERE slug IN ('ruili-resume', 'opc-agent-company')`
    )
    for (const row of oldProjects.rows) {
      await client.query('DELETE FROM owner.projects_tags WHERE _parent_id = $1', [row.id])
      await client.query('DELETE FROM owner.projects WHERE id = $1', [row.id])
    }

    // Clean up deprecated fake experiences (珠海研发中心)
    console.log('🧹 清理非真实经历 (珠海研发中心)...')
    const oldExps = await client.query(
      `SELECT id FROM owner.experiences WHERE organization LIKE '%珠海%'`
    )
    for (const row of oldExps.rows) {
      await client.query('DELETE FROM owner.experiences_bullets WHERE _parent_id = $1', [row.id])
      await client.query('DELETE FROM owner.experiences_tags WHERE _parent_id = $1', [row.id])
      await client.query('DELETE FROM owner.experiences WHERE id = $1', [row.id])
    }

    // 1. Projects
    console.log('📦 注入核心上线项目 (owner.projects)...')
    for (const proj of PROJECTS) {
      const existing = await client.query(
        'SELECT id FROM owner.projects WHERE slug = $1',
        [proj.slug]
      )
      let projId
      if (existing.rows.length > 0) {
        projId = existing.rows[0].id
        await client.query(
          `UPDATE owner.projects
           SET title = $1, role = $2, category = $3, visibility = $4, status = $5,
               summary = $6, problem = $7, approach = $8, outcome = $9,
               demo_url = $10, repo_url = $11, updated_at = NOW()
           WHERE id = $12`,
          [
            proj.title,
            proj.role,
            proj.category,
            proj.visibility,
            proj.status,
            proj.summary,
            proj.problem,
            proj.approach,
            proj.outcome,
            proj.demo_url,
            proj.repo_url,
            projId,
          ]
        )
        await client.query('DELETE FROM owner.projects_tags WHERE _parent_id = $1', [projId])
      } else {
        const res = await client.query(
          `INSERT INTO owner.projects
           (title, slug, role, category, visibility, status, summary, problem, approach, outcome, demo_url, repo_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING id`,
          [
            proj.title,
            proj.slug,
            proj.role,
            proj.category,
            proj.visibility,
            proj.status,
            proj.summary,
            proj.problem,
            proj.approach,
            proj.outcome,
            proj.demo_url,
            proj.repo_url,
          ]
        )
        projId = res.rows[0].id
      }

      for (let i = 0; i < proj.tags.length; i++) {
        await client.query(
          `INSERT INTO owner.projects_tags (_order, _parent_id, id, tag)
           VALUES ($1, $2, $3, $4)`,
          [i + 1, projId, crypto.randomUUID(), proj.tags[i]]
        )
      }
      console.log(`  ✓ 项目: ${proj.title} (ID: ${projId})`)
    }

    // 2. Experiences
    console.log('💼 注入工作与学习经历 (owner.experiences)...')
    for (const exp of EXPERIENCES) {
      const existing = await client.query(
        'SELECT id FROM owner.experiences WHERE organization = $1 AND role = $2',
        [exp.organization, exp.role]
      )
      let expId
      if (existing.rows.length > 0) {
        expId = existing.rows[0].id
        await client.query(
          `UPDATE owner.experiences
           SET period = $1, type = $2, description = $3, updated_at = NOW()
           WHERE id = $4`,
          [exp.period, exp.type, exp.description, expId]
        )
        await client.query('DELETE FROM owner.experiences_bullets WHERE _parent_id = $1', [expId])
        await client.query('DELETE FROM owner.experiences_tags WHERE _parent_id = $1', [expId])
      } else {
        const res = await client.query(
          `INSERT INTO owner.experiences
           (organization, role, period, type, description)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [exp.organization, exp.role, exp.period, exp.type, exp.description]
        )
        expId = res.rows[0].id
      }

      for (let i = 0; i < exp.bullets.length; i++) {
        await client.query(
          `INSERT INTO owner.experiences_bullets (_order, _parent_id, id, bullet)
           VALUES ($1, $2, $3, $4)`,
          [i + 1, expId, crypto.randomUUID(), exp.bullets[i]]
        )
      }
      for (let i = 0; i < exp.tags.length; i++) {
        await client.query(
          `INSERT INTO owner.experiences_tags (_order, _parent_id, id, tag)
           VALUES ($1, $2, $3, $4)`,
          [i + 1, expId, crypto.randomUUID(), exp.tags[i]]
        )
      }
      console.log(`  ✓ 经历: ${exp.organization} - ${exp.role} (ID: ${expId})`)
    }

    // 3. Credentials (Clear and recreate with 100% verified credentials)
    console.log('🏆 注入真实奖项与技能分类 (owner.credentials)...')
    await client.query('DELETE FROM owner.credentials')
    for (const cred of CREDENTIALS) {
      await client.query(
        `INSERT INTO owner.credentials
         (name, category, year, level, items)
         VALUES ($1, $2, $3, $4, $5)`,
        [cred.name, cred.category, cred.year, cred.level, cred.items]
      )
      console.log(`  ✓ 证书/技能: ${cred.name} (${cred.level || cred.category})`)
    }

    // 4. AI Knowledge
    console.log('🧠 注入真实 AI 问答知识条目 (owner.ai_knowledge)...')
    await client.query('DELETE FROM owner.ai_knowledge')
    for (const k of AI_KNOWLEDGE) {
      await client.query(
        `INSERT INTO owner.ai_knowledge
         (title, category, content, is_public, evidence_tag)
         VALUES ($1, $2, $3, $4, $5)`,
        [k.title, k.category, k.content, k.is_public, k.evidence_tag]
      )
      console.log(`  ✓ 知识条目: ${k.title}`)
    }

    // 5. Sync knowledge_embeddings in public_read
    console.log('⚡ 刷新向量知识库切片 (public_read.knowledge_embeddings)...')
    await client.query('DELETE FROM public_read.knowledge_embeddings')
    for (let i = 0; i < AI_KNOWLEDGE.length; i++) {
      const k = AI_KNOWLEDGE[i]
      const vec = `[${generate1536Vector(`${k.title} ${k.content}`).join(',')}]`
      await client.query(
        `INSERT INTO public_read.knowledge_embeddings
         (chunk_id, category, title, content, evidence_tag, embedding, metadata, is_active)
         VALUES ($1, $2, $3, $4, $5, $6::vector, $7::jsonb, TRUE)`,
        [
          `ai_chunk_${i + 1}`,
          k.category,
          k.title,
          k.content,
          k.evidence_tag,
          vec,
          JSON.stringify({ title: k.title, category: k.category, evidence_tag: k.evidence_tag }),
        ]
      )
    }

    await client.query('COMMIT')
    console.log('🎉 所有 100% 真实数据已全量写入 Payload CMS 数据库！')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ 注入数据失败:', err)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
