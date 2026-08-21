import type { Award, Experience, Profile, Project, SkillGroup } from './types'

export const profile = {
  name: '张锦鹏',
  title: 'AI 应用开发 / 全栈开发',
  location: '深圳',
  availability: '2027 届，可接受线下机会',
  summary: '关注 AI 应用与全栈开发，习惯把想法快速转化为可使用、可验证的产品原型。',
  phone: '15347640609',
  email: '1822103245@qq.com',
  github: 'https://github.com/Jaxson-zip',
} as const satisfies Profile

export const experiences = [
  {
    id: 'runmiaoyun-internship',
    organization: '广东润喵云科技有限公司',
    role: '开发实习生',
    period: '2026.06 - 2026.08',
    summary: '参与基于 Vue 与 Go 的算力租赁平台功能迭代和日常维护。',
    bullets: [
      '参与用户端与管理端的功能迭代，根据需求补充和调整页面功能。',
      '配合完成接口联调、样式修复与缺陷修复，跟进问题定位和验证。',
      '结合前后端运行情况诊断开发问题，并与团队协作推进处理。',
    ],
    technologies: ['Vue', 'Go', 'API integration'],
    kind: 'internship',
  },
  {
    id: 'szpu-education',
    organization: '深圳职业技术大学',
    role: '大数据技术',
    period: '2024.09 - 2027.06',
    summary: 'GPA 3.67/4.0，专业排名前 5%。',
    bullets: ['担任院学信委人工智能学院副主席、班级学习委员、甲骨文社团社长。'],
    technologies: ['大数据应用开发', '数据分析'],
    kind: 'education',
  },
  {
    id: 'zhuhai-vocational-internship',
    organization: '珠海市第一中等职业技术学校',
    role: '综合岗实习生',
    period: '2023.09 - 2024.06',
    summary: '完成综合岗位实习，参与日常事务支持与团队协作。',
    bullets: [],
    technologies: [],
    kind: 'internship',
  },
] as const satisfies readonly Experience[]

export const projects = [
  {
    slug: 'todo-memo',
    title: 'Todo Memo',
    category: '效率工具原型',
    sourceVisibility: 'public',
    status: '在线 Demo',
    summary: '一个可在线访问的待办与备忘录原型，用于验证跨设备记录和 PWA 使用体验。',
    problem: '日常想法和待办容易分散，希望用一个轻量入口完成记录、查看与整理。',
    approach:
      '使用 React 与 TypeScript 构建交互，借助 Supabase 保存数据，并以 PWA 形式部署到 Vercel。',
    outcome:
      '已提供可访问 Demo；目前仍是持续打磨中的原型，功能复杂度和实际使用价值还在进一步验证。',
    role: '产品原型与前端实现',
    technologies: ['React', 'TypeScript', 'Supabase', 'PWA', 'Vercel'],
    image: '/projects/todo-memo.png',
    links: [
      {
        label: '在线 Demo',
        href: 'https://todo-theta-mauve-75.vercel.app/',
        kind: 'live',
      },
      {
        label: '源代码',
        href: 'https://github.com/Jaxson-zip/to_do',
        kind: 'source',
      },
    ],
  },
  {
    slug: 'ruili-resume',
    title: 'Ruili Resume',
    category: '开源二次开发',
    sourceVisibility: 'public',
    status: '开源二次开发',
    summary: '基于 Reactive Resume 的中文化二次开发，聚焦中文用户的简历编辑体验。',
    problem: '原项目的默认语言和部分交互表达不完全贴合中文简历的使用习惯。',
    approach: '在 React 与 TypeScript 项目基础上进行中文本地化，并针对中文场景调整内容与体验。',
    outcome: '完成可公开查看的二次开发源码，作为中文本地化与开源项目改造实践；未提供独立在线地址。',
    role: '二次开发与中文本地化',
    technologies: ['React', 'TypeScript'],
    image: null,
    links: [
      {
        label: '源代码',
        href: 'https://github.com/Jaxson-zip/ruili',
        kind: 'source',
      },
    ],
  },
  {
    slug: 'opc-agent-company',
    title: 'OPC Agent Company',
    category: 'AI 应用探索',
    sourceVisibility: 'private',
    status: '未完成 / 持续迭代',
    summary: '围绕 Agent 协作方式展开的私有探索项目，目前用于概念验证和持续试验。',
    problem: '探索多个 Agent 如何围绕任务分工、上下文和执行过程形成可观察的协作流程。',
    approach: '以小范围 Demo 验证交互与流程假设，并根据试验结果逐步调整实现。',
    outcome: '当前仍未完成，仅形成阶段性探索与演示，不作为已交付或成熟产品展示。',
    role: '概念验证与迭代',
    technologies: ['AI applications', 'Agent workflows'],
    image: null,
    links: [],
  },
] as const satisfies readonly Project[]

export const awards = [
  {
    id: 'gdkj-big-data-2025',
    period: '2025-2026',
    title: '广东省职业院校技能大赛（高职组）大数据应用开发赛项',
    level: '一等奖',
  },
  {
    id: 'gdkj-big-data-2023',
    period: '2023-2024',
    title: '广东省职业院校技能大赛（中职组）大数据应用与服务',
    level: '一等奖',
  },
  {
    id: 'brics-security-2023',
    period: '2023-2024',
    title: '一带一路暨金砖国家技能大赛·企业信息系统安全',
    level: '国赛二等奖',
  },
  {
    id: 'teddy-data-analysis-2023',
    period: '2023-2024',
    title: '第六届“泰迪杯”数据分析技能赛',
    level: '一等奖',
  },
  {
    id: 'computer-design-big-data-2024',
    period: '2024-2025',
    title: '中国大学生计算机设计大赛大数据实践赛',
    level: '二等奖',
  },
] as const satisfies readonly Award[]

export const skillGroups = [
  {
    id: 'frontend',
    title: '前端开发',
    items: ['React', 'TypeScript', 'Vue', 'HTML / CSS', 'PWA'],
  },
  {
    id: 'backend-data',
    title: '后端与数据',
    items: ['Go', 'Supabase', 'SQL', '大数据应用开发', '数据分析'],
  },
  {
    id: 'ai-applications',
    title: 'AI 应用',
    items: ['AI 应用原型', 'Agent 工作流探索', '大模型 API 集成'],
  },
  {
    id: 'delivery-tools',
    title: '交付与工具',
    items: ['Git', 'GitHub', 'Vercel', '接口联调', '问题诊断'],
  },
] as const satisfies readonly SkillGroup[]
