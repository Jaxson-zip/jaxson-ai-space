# 审查缺陷修复实施计划

> **For agentic workers:** Use test-first implementation and independent spec/code review. All edits remain in the existing isolated worktree. Commits, pushes and production deployment require the owner's approval.

**Goal:** 修复记忆编辑丢内容、项目简介不进入 AI、追问缺少上下文、复盘日期错误四项已复现缺陷。

**Architecture:** 记忆正文保持为唯一文本来源，只在可无损解析时提供结构化编辑；AI 从历史问题恢复检索主题，重新读取当前公开 CMS，不把旧回答当事实。日期以浏览器本地日历日为默认，允许明确补记。保留现有鉴权、拒答和发布边界，不新增数据库迁移。

**Tech Stack:** Next.js/React、TypeScript、Vitest/Testing Library、Playwright。

## 1. 记忆无损编辑

Files: `apps/web/src/app/(frontend)/studio/page.tsx`、`apps/web/src/features/studio/memory-editor.ts`、`apps/web/src/features/studio/studio-page.test.ts`。

- [x] 将审查时的真实提炼器→编辑→提交复现转成项目回归测试。关键断言：
  ```ts
  expect(saved.content).toContain(solution)
  ```
- [x] 执行 `pnpm --filter @jaxson/web test -- studio-page`，确认原实现失败。
- [x] 识别提炼器输出的“解决手段与架构”；不能完整解析或存在其他正文时使用纯文本。打开后原样保存保留原文，结构化修改只替换对应段落，模式切换同步编辑结果。
- [x] 增加未知分段、纯文本、两种模式来回切换及只改一段保留另一段的回归，逐项先失败再修复。

## 2. 项目简介与索引

Files: `features/ai/rag/knowledge-loader.ts`、`knowledge-merge.test.ts`、`features/cms/revalidate-hook.ts`、`revalidate-hook.test.ts`（均位于 `apps/web/src/`）。

- [x] 在现有知识加载测试中添加只填必填字段的公开项目，断言其 `content` 包含 `summary`；运行 `pnpm --filter @jaxson/web test -- knowledge-merge` 确认失败。
- [x] 将简介加入当前公开项目证据，保留其他内容和来源顺序；运行同一测试确认通过。
- [x] 在发布 hook 测试中断言索引事件正文也包含简介，先确认失败再修复。
- [x] 验证撤回事件仍无正文，私有项目不进入公开知识。

## 3. 有历史的追问检索

Files: `features/ai/retrieval-query.ts`、`retrieval-query.test.ts`、`app/api/chat/route.ts`、`route.test.ts`（均位于 `apps/web/src/`）。

- [x] 从“介绍 Todo Memo”之后追问“能再展开讲讲吗？”的失败请求开始，断言加载器和检索器收到同一个补全后查询。
- [x] 对明显依赖上文的追问，保留当前问题并附带最近的用户主题；连续追问沿用最近有效主题。仅恢复主题，不复制助手回答到事实库。
- [x] 新的独立问题不能被旧主题污染；无历史时不凭空补主题；未知问题仍执行现有无证据拒答。测试明确新主题、链式追问、话题切换和边界长度。
- [x] 执行 `pnpm --filter @jaxson/web test -- retrieval-query route rag`。

## 4. 本地日期与补记

Files: `features/studio/local-date.ts`、`studio-page.test.ts`、`features/studio/analytics.ts`、`analytics.test.ts`、`app/(frontend)/studio/page.tsx`（均位于 `apps/web/src/`）。日期通过表单提交、热力图与两种真实浏览器时区验证，不另写重复实现的辅助函数测试。

- [x] 添加浏览器本地日期与 UTC 跨日的回归，先确认失败；添加可修改日期的组件用例。
- [x] 用本地年月日生成日期键。日期为空时在提交时取当天，显式选择日期后尊重用户选择；添加有标签的日期输入，清楚展示当前日期。
- [x] 热力图使用同一种本地日期键，避免切换时区后与复盘日期不一致。跨日继续填写时默认日期更新，不覆盖用户选定的补记日期。
- [x] 在洛杉矶和上海时区验证，覆盖手动日期及页面跨日情形。

## 5. 集成验证与交接

- [x] 同步 `docs/目录索引.md` 的新模块描述和 `docs/ARCHITECTURE.md` 的追问数据流。
- [x] 执行 `pnpm test`、`pnpm lint`、`pnpm typecheck`、`pnpm build`，保留已有 25 个 lint 警告的基线，不扩展无关重构。
- [x] 执行作品站 Playwright；用本地虚构数据复核记忆编辑和两种时区日期；用当前公开内容构建的隔离 fixture 复核追问，不修改生产记录。
- [x] 独立审查需求覆盖，再审查代码质量；处理发现后再跑受影响验证。
- [x] 重新验证上次准备的四份简历文件并更新交接，明确代码和文件尚未发布。只在所有修改具体可审阅之后请求提交、推送、部署批准。

Excluded: 不改媒体公开策略、新项目默认公开策略、Cloudflare 规则或私人工作台功能范围；worker 自动监测属于单独的运维变更，不与四个缺陷混在一起发布。

## 执行结果

四个任务已按先失败、后修复、再通过的顺序完成，并通过独立需求和代码质量复核。新增关键边界：编辑模式来回切换、未知分段、主题撤回、近似名称、完整主体与查询截断分离，以及手动日期跨午夜保留。最终测试和发布边界见[缺陷修复记录](../../审查缺陷修复-2026-10-25.md)。提交、推送、部署尚待站长批准，不在此自动执行。
