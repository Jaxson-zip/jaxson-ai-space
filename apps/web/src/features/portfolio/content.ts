import type { Award, Experience, Profile, Project, SkillGroup } from './types'

export const profile = {
  name: '张锦鹏',
  title: '全栈开发 · AI 应用开发',
  location: '深圳',
  availability: '2027 届 · 大专在读 · 深圳 (可线下到岗)',
  summary: '专注于现代 Web 全栈与 AI 应用工程落地，喜欢把想法和业务痛点转化为可靠、高可用的交付产品。',
  phone: '15347640609',
  email: '1822103245@qq.com',
  github: 'https://github.com/Jaxson-zip',
} as const satisfies Profile

export const experiences = [
  {
    id: 'runmiaoyun-internship',
    organization: '广东润喵云科技有限公司',
    role: '全栈开发实习生',
    period: '2026.06 - 2026.08',
    summary: '负责基于 Vue 前端与 Golang 后端的算力租赁调度平台日常运维、缺陷修复与环境镜像制作。',
    bullets: [
      '负责算力租赁管理与订单调度模块的日常缺陷排查（Bug Fix）与功能联调维护。',
      '负责平台 Docker 运行环境镜像制作、依赖调优与标准化构建交付。',
      '深度借助 AI 效能工具（AI 辅助编程）高效定位全栈业务缺陷，敏捷完成交付任务。',
    ],
    technologies: ['Vue', 'Go', 'Docker 镜像制作', '算力调度平台运维', 'AI 辅助编程'],
    kind: 'internship',
  },
  {
    id: 'szpu-education',
    organization: '深圳职业技术大学',
    role: '大数据技术专业 · 大专在读',
    period: '2024 — 2027 (2027 届)',
    summary: 'GPA 3.85 / 4.0 (专业前 2%)，扎实掌握现代软件工程、大数据处理架构与 Web 全栈开发。',
    bullets: [
      '主修课程：数据结构与算法、Web 全栈工程、分布式计算、数据库系统原理、机器学习导论。',
      '担任院学信委人工智能学院副主席、班级学习委员、甲骨文社团社长。',
      '连续获得校级一等学业奖学金，累计获国家级奖项 5 项、省市级奖项 6 项。',
    ],
    technologies: ['TypeScript', 'Python', 'SQL', '数据结构', '分布式系统', '大数据应用开发'],
    kind: 'education',
  },
] as const satisfies readonly Experience[]

export const projects = [
  {
    slug: 'jaxson-ai-space',
    title: 'Jaxson AI Space (本站 · 全栈个人门户与 AI 分身)',
    category: '全栈工程 · 生产交付',
    sourceVisibility: 'public',
    status: '已全量上线',
    role: '独立全栈架构与开发',
    summary: '真正生产交付的现代化工程师数字分身空间，集成第一人称 RAG 向量知识库检索、Payload CMS 无头内容管理与双 Schema 数据隔离。',
    problem: '传统个人作品集为纯静态单向展示，招聘方无法深度交互探索候选人技术栈；个人知识碎片与真实案例缺少动态易维护的后端体系。',
    approach: '基于 Next.js 16 + React 19 构建流式交互界面，嵌入 Payload CMS 3.x 动态管理内容；后端基于 PostgreSQL 17 + pgvector 构建知识切片余弦相似度检索与物理权限隔离。',
    outcome: '项目已完整部署至外网生产环境（结合 Docker、PM2 与 Cloudflare Tunnel），实现毫秒级首屏加载与稳定第一人称防幻觉 RAG 问答流。',
    technologies: ['Next.js 16', 'React 19', 'TypeScript', 'Payload CMS 3.x', 'PostgreSQL 17', 'pgvector', 'Docker', 'Cloudflare Tunnel'],
    image: '/assets/jaxson-ai-space-cover.png',
    links: [
      { label: '在线体验', href: 'https://space.jaxson.bond/', kind: 'live' },
      { label: '开源仓库', href: 'https://github.com/Jaxson-zip/jaxson-ai-space', kind: 'source' },
    ],
  },
  {
    slug: 'todo-memo',
    title: '待办备忘 (Todo Memo)',
    category: '工具应用 · 原型落地',
    sourceVisibility: 'public',
    status: '已上线 PWA',
    role: '独立全栈开发 / 云端任务管理应用',
    summary: '已真正上线的待办与备忘工具，覆盖登录鉴权、云端持久化、任务多级分组、标签过滤、即时检索与离线运行。',
    problem: '日常工作与学习中任务容易分散在散乱的临时记录中，缺少一个轻量入口把收集、归类和多端同步高效统一起来。',
    approach: '围绕“极速收集、按场景分组、离线可用和云端持久化”组织界面流，高频操作一键直达，并通过 Supabase 实现跨端实时同步。',
    outcome: '项目已完整部署至 Vercel，提供顺畅的桌面与移动端 PWA 安装体验，支持离线缓存与多设备实时同步。',
    technologies: ['React', 'TypeScript', 'Supabase', 'PWA', 'Vercel', 'Tailwind CSS'],
    image: '/assets/todo-memo-cover.png',
    links: [
      { label: '在线体验', href: 'https://todo-theta-mauve-75.vercel.app/', kind: 'live' },
      { label: 'GitHub 源码', href: 'https://github.com/Jaxson-zip/to_do', kind: 'source' },
    ],
  },
] as const satisfies readonly Project[]

export const skillGroups = [
  {
    id: 'frontend',
    title: '前端开发技能',
    items: ['React 19', 'Vue 3', 'TypeScript', 'Tailwind CSS', 'Next.js 16', 'Vite', '响应式布局与组件封装'],
  },
  {
    id: 'backend',
    title: '后端与数据技能',
    items: ['Go', 'Python', 'PostgreSQL', 'pgvector', 'MySQL', 'Supabase', 'RESTful API 设计', '分布式大数据'],
  },
  {
    id: 'ai',
    title: 'AI 应用开发技能',
    items: ['大模型 API 接入', 'RAG 向量检索增强', 'Prompt 上下文工程', 'AI 编程效能实践 (Cursor/Claude)'],
  },
  {
    id: 'engineering',
    title: '工程交付与工具',
    items: ['Docker & 镜像制作', 'Linux 运维', 'Git & GitHub', 'PM2 进程守护', 'Cloudflare Tunnel', 'Vercel 自动化部署'],
  },
] as const satisfies readonly SkillGroup[]

export const awards = [
  {
    id: 'award-taidibei',
    period: '2023 — 2024',
    title: '第六届“泰迪杯”数据分析技能赛',
    level: '全国一等奖',
  },
  {
    id: 'award-gd-vocational-high',
    period: '2025 — 2026',
    title: '广东省职业院校技能大赛（高职组）大数据应用开发赛项',
    level: '省级一等奖',
  },
  {
    id: 'award-computer-design',
    period: '2024 — 2025',
    title: '中国大学生计算机设计大赛 - 大数据实践赛',
    level: '国家级二等奖',
  },
  {
    id: 'award-brics-security',
    period: '2023 — 2024',
    title: '一带一路暨金砖国家技能大赛 - 企业信息系统安全国赛',
    level: '国家级二等奖',
  },
  {
    id: 'award-scholarship-first',
    period: '2024 — 2025',
    title: '校级综合学业一等奖学金',
    level: '校级一等 (GPA 3.85 专业前 2%)',
  },
] as const satisfies readonly Award[]
