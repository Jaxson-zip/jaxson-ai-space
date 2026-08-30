import type { Award, Experience, Profile, Project, SkillGroup } from './types'

export const profile = {
  name: '张锦鹏',
  title: 'AI 应用开发 · 全栈开发',
  location: '深圳',
  availability: '2027 届 · 深圳 (可线下到岗)',
  summary: '专注于 AI 应用与全栈工程落地，喜欢把想法和业务痛点转化为界面、数据与真正可用的交付流程。',
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
    summary: '参与基于 Vue 3 与 Go 的算力租赁平台功能开发与日常维护。',
    bullets: [
      '负责用户端与管理端算力订单、资源监控与配置页面的前端交互实现与组件封装。',
      '配合后端完成 Go 语言微服务 API 接口对接、联调与数据契约校验。',
      '修复生产环境缺陷，排查定位前端状态不同步与高并发场景下的接口超时问题。',
    ],
    technologies: ['Vue 3', 'Go', 'RESTful API', 'Element Plus', 'Vite'],
    kind: 'internship',
  },
  {
    id: 'zhuhai-vocational-internship',
    organization: '广东润喵云科技有限公司 (珠海研发中心)',
    role: '算力平台前端研发实习生',
    period: '2026.06 - 2026.08',
    summary: '参与算力租赁管理后台与调度看板的前端业务模块研发与联调交付。',
    bullets: [
      '主导算力节点监控与订单管理界面的高响应式排版与状态缓存。',
      '与 Go 后端团队协同制定 REST 规范，编写接口自动化回归测试脚本。',
    ],
    technologies: ['Vue 3', 'Go', 'TypeScript', 'Vite', 'Pinia'],
    kind: 'internship',
  },
  {
    id: 'szpu-education',
    organization: '深圳职业技术大学',
    role: '大数据技术专业 · 本科在读',
    period: '2024 — 2027 (2027 届)',
    summary: 'GPA 3.67 / 4.0 (专业前 5%)，系统学习现代软件工程、算法与大数据处理架构。',
    bullets: [
      '主修课程：数据结构与算法、Web 全栈工程、分布式计算、数据库系统原理、机器学习导论。',
      '担任院学信委人工智能学院副主席、班级学习委员、甲骨文社团社长。',
      '连续获得校级一等学业奖学金，多次代表学院参与国家级与省部级软件创新竞赛。',
    ],
    technologies: ['TypeScript', 'Python', 'SQL', '数据结构', '分布式系统'],
    kind: 'education',
  },
] as const satisfies readonly Experience[]

export const projects = [
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
  {
    slug: 'ruili-resume',
    title: '锐历简历工作台 (Ruili Resume)',
    category: '求职工具 · 开源二次开发',
    sourceVisibility: 'public',
    status: '已开源',
    role: '独立二次开发 / 中文本地化优化',
    summary: '基于 Reactive Resume 完成本土化改造，围绕中文排版层级、国内招聘习惯和 PDF 导出体验打造在线工作台。',
    problem: '通用海外简历开源项目对中文排版、字号层级和国内招聘表达支持欠佳，模板风格和操作流不符合本土习惯。',
    approach: '重构中文排版规范与样式层级，深度优化实时双向预览与浏览器端 PDF 渲染中的中文字符断行与字体适配问题。',
    outcome: '项目已在 GitHub 开源并保留原项目 MIT 协议，提供了开箱即用的本土化高质量简历排版工作流。',
    technologies: ['React', 'TypeScript', '中文排版引擎', 'PDF 渲染', '开源贡献'],
    image: '/assets/ruili-cover.svg',
    links: [
      { label: 'GitHub 仓库', href: 'https://github.com/Jaxson-zip/ruili', kind: 'source' },
    ],
  },
  {
    slug: 'opc-agent-company',
    title: 'OPC Agent Company',
    category: 'AI 产品 · 私有概念探索',
    sourceVisibility: 'private',
    status: '持续迭代',
    role: '独立产品设计与全栈实现',
    summary: '把软件研发流组织成多智能体协作公司的本地优先工作台，探索 AI 产品工作流调度与协同状态管理。',
    problem: '在实际研发中协作调度多个专业编码 Agent 时，任务分派、代码审查、阻塞排查和交付证据容易散落在不同会话中。',
    approach: '按“规划、架构、开发、审计”四个部门岗位组织 Agent 智能体，提供标准化的任务派发看板、审批节点与 Git 隔离开发流程。',
    outcome: '已完成核心工作台研发协同状态机与本地持久化，用于个人探索多智能体在真实工程交付中的提效边界。',
    technologies: ['Agent 工作流', 'Local-first', 'SQLite', 'Git Worktree', 'LLM API'],
    image: '/assets/opc-cover.svg',
    links: [],
  },
] as const satisfies readonly Project[]

export const skillGroups = [
  {
    id: 'frontend',
    title: '前端开发',
    items: ['React', 'Vue 3', 'TypeScript', 'Tailwind CSS', 'Next.js', 'Vite', '响应式布局与交互设计'],
  },
  {
    id: 'backend',
    title: '后端与数据',
    items: ['Go', 'Python', 'Flask', 'MySQL', 'PostgreSQL', 'SQLite', 'Supabase', 'RESTful API 设计'],
  },
  {
    id: 'ai',
    title: 'AI 应用开发',
    items: ['大模型 API 对接', 'Prompt 工程与结构化输出', 'Agent 协同架构', 'RAG 检索增强', '上下文工程'],
  },
  {
    id: 'engineering',
    title: '工程交付与工具',
    items: ['Git & GitHub', 'Vercel 自动化部署', 'PWA 离线应用', 'Cursor / Claude Code 效能工具', 'Docker 基础'],
  },
] as const satisfies readonly SkillGroup[]

export const awards = [
  {
    id: 'award-national-systems',
    period: '2025',
    title: '全国大学生计算机系统与软件创新大赛',
    level: '国家级二等奖',
  },
  {
    id: 'award-gdcpc',
    period: '2025',
    title: '广东省大学生程序设计技能竞赛 (GDCPC)',
    level: '省级一等奖',
  },
  {
    id: 'award-scholarship',
    period: '2024 — 2025',
    title: '校级综合素质与学业特等奖学金',
    level: '校级一等 (专业前 5%)',
  },
] as const satisfies readonly Award[]
