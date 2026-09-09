/**
 * Script to seed real initial portfolio data into Payload CMS PostgreSQL database (schema: owner)
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
  {
    title: '锐历简历工作台 (Ruili Resume)',
    slug: 'ruili-resume',
    role: '独立二次开发 / 中文本地化优化',
    category: '求职工具 · 开源二次开发',
    visibility: 'public',
    status: '已开源',
    summary: '基于 Reactive Resume 完成本土化改造，围绕中文排版层级、国内招聘习惯和 PDF 导出体验打造在线工作台。',
    problem: '通用海外简历开源项目对中文排版、字号层级和国内招聘表达支持欠佳，模板风格和操作流不符合本土习惯。',
    approach: '重构中文排版规范与样式层级，深度优化实时双向预览与浏览器端 PDF 渲染中的中文字符断行与字体适配问题。',
    outcome: '项目已在 GitHub 开源并保留原项目 MIT 协议，提供了开箱即用的本土化高质量简历排版工作流。',
    demo_url: null,
    repo_url: 'https://github.com/Jaxson-zip/ruili',
    tags: ['React', 'TypeScript', '中文排版引擎', 'PDF 渲染', '开源贡献'],
  },
  {
    title: 'OPC Agent Company',
    slug: 'opc-agent-company',
    role: '独立产品设计与全栈实现',
    category: 'AI 产品 · 私有概念探索',
    visibility: 'private',
    status: '持续迭代',
    summary: '把软件研发流组织成多智能体协作公司的本地优先工作台，探索 AI 产品工作流调度与协同状态管理。',
    problem: '在实际研发中协作调度多个专业编码 Agent 时，任务分派、代码审查、阻塞排查和交付证据容易散落在不同会话中。',
    approach: '按“规划、架构、开发、审计”四个部门岗位组织 Agent 智能体，提供标准化的任务派发看板、审批节点与 Git 隔离开发流程。',
    outcome: '已完成核心工作台研发协同状态机与本地持久化，用于个人探索多智能体在真实工程交付中的提效边界。',
    demo_url: null,
    repo_url: null,
    tags: ['Agent 工作流', 'Local-first', 'SQLite', 'Git Worktree', 'LLM API'],
  },
]

const EXPERIENCES = [
  {
    organization: '广东润喵云科技有限公司',
    role: '全栈开发实习生',
    period: '2026.06 - 2026.08',
    type: 'internship',
    description: '参与基于 Vue 3 与 Go 的算力租赁平台功能开发与日常维护。',
    bullets: [
      '负责用户端与管理端算力订单、资源监控与配置页面的前端交互实现与组件封装。',
      '配合后端完成 Go 语言微服务 API 接口对接、联调与数据契约校验。',
      '修复生产环境缺陷，排查定位前端状态不同步与高并发场景下的接口超时问题。',
    ],
    tags: ['Vue 3', 'Go', 'RESTful API', 'Element Plus', 'Vite'],
  },
  {
    organization: '广东润喵云科技有限公司 (珠海研发中心)',
    role: '算力平台前端研发实习生',
    period: '2026.06 - 2026.08',
    type: 'internship',
    description: '参与算力租赁管理后台与调度看板的前端业务模块研发与联调交付。',
    bullets: [
      '主导算力节点监控与订单管理界面的高响应式排版与状态缓存。',
      '与 Go 后端团队协同制定 REST 规范，编写接口自动化回归测试脚本。',
    ],
    tags: ['Vue 3', 'Go', 'TypeScript', 'Vite', 'Pinia'],
  },
  {
    organization: '深圳职业技术大学',
    role: '大数据技术专业 · 本科在读',
    period: '2024 — 2027 (2027 届)',
    type: 'education',
    description: 'GPA 3.67 / 4.0 (专业前 5%)，系统学习现代软件工程、算法与大数据处理架构。',
    bullets: [
      '主修课程：数据结构与算法、Web 全栈工程、分布式计算、数据库系统原理、机器学习导论。',
      '担任院学信委人工智能学院副主席、班级学习委员、甲骨文社团社长。',
      '连续获得校级一等学业奖学金，多次代表学院参与国家级与省部级软件创新竞赛。',
    ],
    tags: ['TypeScript', 'Python', 'SQL', '数据结构', '分布式系统'],
  },
]

const CREDENTIALS = [
  {
    name: '全国大学生计算机系统与软件创新大赛',
    category: 'award',
    year: '2025',
    level: '国家级二等奖',
    items: '全国职业院校技能大赛 · 大数据应用开发赛项',
  },
  {
    name: '广东省大学生程序设计技能竞赛 (GDCPC)',
    category: 'award',
    year: '2025',
    level: '省级一等奖',
    items: '广东省职业院校技能大赛 · 软件系统开发赛项',
  },
  {
    name: '校级综合素质与学业特等奖学金',
    category: 'award',
    year: '2024 — 2025',
    level: '校级一等 (专业前 5%)',
    items: '连续获得校级特等学业奖学金与优秀共青团员标兵',
  },
  {
    name: '前端开发技能',
    category: 'skill',
    year: '2026',
    level: '熟练掌握',
    items: 'React, Vue 3, TypeScript, Tailwind CSS, Next.js, Vite, 响应式布局与交互设计',
  },
  {
    name: '后端与数据技能',
    category: 'skill',
    year: '2026',
    level: '良好掌握',
    items: 'Go, Python, Flask, MySQL, PostgreSQL, SQLite, Supabase, RESTful API 设计',
  },
  {
    name: 'AI 应用开发技能',
    category: 'skill',
    year: '2026',
    level: '精通 / 主攻方向',
    items: '大模型 API 对接, Prompt 工程与结构化输出, Agent 协同架构, RAG 检索增强, 上下文工程, pgvector 向量库',
  },
  {
    name: '工程交付与工具',
    category: 'skill',
    year: '2026',
    level: '熟练掌握',
    items: 'Git & GitHub, Vercel 自动化部署, PWA 离线应用, Cursor / Claude Code 效能工具, Docker 基础, Linux',
  },
]

const AI_KNOWLEDGE = [
  {
    title: '广东润喵云科技 · 算力租赁平台全栈实习',
    category: 'internship',
    content: '在广东润喵云科技有限公司实习期间，主导私有算力与资源监控平台前端重构，基于 Vue 3 + TypeScript 封装可复用大屏组件，将状态抖动降低 40%；与 Go 后端紧密联调 RESTful 及 WebSocket 接口，保障高并发下的状态一致性；沉淀自动化构建与组件规范文档。',
    is_public: true,
    evidence_tag: '广东润喵云科技 · 前端与全栈开发实习生',
  },
  {
    title: '待办备忘 (Todo Memo PWA) 架构与交付事实',
    category: 'project',
    content: '【项目背景】解决日常轻量待办记录在弱网或多端切换时状态不同步的痛点。\n【技术方案】基于 React + TypeScript + Supabase + PWA 架构，封装离线 IndexedDB 本地缓存与 Service Worker 拦截；设计乐观更新与自动重试同步状态机；实现跨端 PWA 离线运行与 Web Push 通知。\n【交付成果】已上线交付（todo-theta-mauve-75.vercel.app），源码开源（github.com/Jaxson-zip/to_do）。',
    is_public: true,
    evidence_tag: 'Todo Memo PWA 核心项目',
  },
  {
    title: '锐历简历工作台 (Ruili Resume) 本土化重构事实',
    category: 'project',
    content: '【项目背景】开源求职简历工作台在中文字体抗锯齿、A4 换页断行与即时渲染排版上体验欠佳。\n【技术方案】基于开源项目深度二次开发，重构中文字体级联渲染引擎与 A4 页面物理标尺换页计算模型；优化实时响应式状态同步与本地 LocalStorage 瞬时草稿自动保存；集成一键导出抗锯齿高清 PDF。\n【交付成果】已开源（github.com/Jaxson-zip/ruili），完美解决中文换页断行重叠问题。',
    is_public: true,
    evidence_tag: '锐历简历工作台 核心项目',
  },
  {
    title: '竞赛荣誉与学业奖项事实',
    category: 'education',
    content: '国家级二等奖（2025 年全国职业院校技能大赛 · 大数据应用开发赛项）\n省级一等奖（2025 年广东省职业院校技能大赛 · 软件系统开发赛项）\n校级特等奖学金与优秀共青团员标兵（连续 2 年综合测评前 5%）',
    is_public: true,
    evidence_tag: '国家级/省级竞赛荣誉记录',
  },
  {
    title: '技术栈与能力图谱',
    category: 'skill',
    content: '【AI 应用开发】RAG 向量混合检索、Prompt Engineering、多智能体协同设计、pgvector 向量库\n【前端与全栈工程】React 19、Next.js 16、Vue 3、TypeScript、TailwindCSS、PWA、Payload CMS\n【后端与基础设施】Node.js、Go、PostgreSQL 17、Supabase、Docker、Linux',
    is_public: true,
    evidence_tag: '技术栈与工程能力图谱',
  },
  {
    title: '个人基本信息与求职意向',
    category: 'jd_match',
    content: '【姓名】张锦鹏 (Jaxson)\n【毕业院校】深圳职业技术大学（大数据技术专业，GPA 3.67/4.0 前 5%）\n【求职意向】AI 应用开发 / Web 全栈开发 / 前端开发工程师\n【期望地点】深圳（可即时到岗/线下实习）\n【联系方式】电话/微信：15347640609，邮箱：1822103245@qq.com，GitHub：https://github.com/Jaxson-zip',
    is_public: true,
    evidence_tag: '张锦鹏个人履历与联系方式',
  },
]

async function seed() {
  const client = await pool.connect()
  try {
    console.log('🚀 开始向 Payload CMS 数据库导入初始数据...')
    await client.query('BEGIN')

    // 1. Projects
    console.log('📦 导入作品与项目 (owner.projects)...')
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
    console.log('💼 导入工作与实践经历 (owner.experiences)...')
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

    // 3. Credentials
    console.log('🏆 导入荣誉与技能分类 (owner.credentials)...')
    for (const cred of CREDENTIALS) {
      const existing = await client.query(
        'SELECT id FROM owner.credentials WHERE name = $1',
        [cred.name]
      )
      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE owner.credentials
           SET category = $1, year = $2, level = $3, items = $4, updated_at = NOW()
           WHERE id = $5`,
          [cred.category, cred.year, cred.level, cred.items, existing.rows[0].id]
        )
      } else {
        await client.query(
          `INSERT INTO owner.credentials
           (name, category, year, level, items)
           VALUES ($1, $2, $3, $4, $5)`,
          [cred.name, cred.category, cred.year, cred.level, cred.items]
        )
      }
      console.log(`  ✓ 证书/技能: ${cred.name}`)
    }

    // 4. AI Knowledge
    console.log('🧠 导入 AI 知识条目 (owner.ai_knowledge)...')
    for (const k of AI_KNOWLEDGE) {
      const existing = await client.query(
        'SELECT id FROM owner.ai_knowledge WHERE title = $1',
        [k.title]
      )
      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE owner.ai_knowledge
           SET category = $1, content = $2, is_public = $3, evidence_tag = $4, updated_at = NOW()
           WHERE id = $5`,
          [k.category, k.content, k.is_public, k.evidence_tag, existing.rows[0].id]
        )
      } else {
        await client.query(
          `INSERT INTO owner.ai_knowledge
           (title, category, content, is_public, evidence_tag)
           VALUES ($1, $2, $3, $4, $5)`,
          [k.title, k.category, k.content, k.is_public, k.evidence_tag]
        )
      }
      console.log(`  ✓ 知识条目: ${k.title}`)
    }

    await client.query('COMMIT')
    console.log('🎉 所有初始数据已成功导入至 Payload CMS 数据库！')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ 导入数据失败:', err)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

seed().catch(() => process.exit(1))
