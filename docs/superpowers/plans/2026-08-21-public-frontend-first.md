# Public Frontend First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a polished, responsive, fully navigable public portfolio and AI-agent frontend before connecting CMS, retrieval, or model APIs.

**Architecture:** Next.js App Router renders four public routes from a typed local content adapter. Components consume domain types rather than Payload directly, so the later CMS integration replaces the adapter without rewriting the UI. The AI page uses deterministic in-browser demo replies and stores no conversation history.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules/global CSS, Lucide React, Vitest, Playwright-compatible browser QA

---

## Visual Direction

- **Visual thesis:** A calm Chinese recruitment portfolio with editorial typography, warm white and near-black surfaces, one restrained yellow accent, real product evidence, and no dashboard-card clutter.
- **Content plan:** Identity and availability, evidence-backed experience, selected work, awards and skills, contact, then a separate AI conversation surface.
- **Interaction thesis:** A short hero entrance sequence, restrained section reveal and image depth on scroll, and precise project/link hover transitions. Motion must respect `prefers-reduced-motion`.

## Scope Boundary

This plan builds the public frontend only. Content is local typed data. `/ai` does not call a model, store prompts, or claim real retrieval. Payload collections, public vector search, streaming API, Studio, authentication, Cloudflare, and deployment remain separate plans.

## Target Structure

```text
apps/web/
├─ public/
│  ├─ projects/todo-memo.png
│  └─ resume/zhang-jinpeng-resume.docx
├─ src/
│  ├─ app/(frontend)/layout.tsx
│  ├─ app/(frontend)/page.tsx
│  ├─ app/(frontend)/styles.css
│  ├─ app/(frontend)/projects/[slug]/page.tsx
│  ├─ app/(frontend)/resume/page.tsx
│  ├─ app/(frontend)/ai/page.tsx
│  ├─ components/public-site/header.tsx
│  ├─ components/public-site/footer.tsx
│  ├─ components/public-site/project-list.tsx
│  ├─ components/public-site/reveal.tsx
│  ├─ features/portfolio/content.ts
│  ├─ features/portfolio/content.test.ts
│  ├─ features/portfolio/types.ts
│  ├─ features/public-agent/demo-chat.tsx
│  └─ features/public-agent/demo-responses.ts
└─ package.json
```

## Task 1: Typed Content Adapter and Public Assets

**Files:**

- Create: `apps/web/src/features/portfolio/types.ts`
- Create: `apps/web/src/features/portfolio/content.ts`
- Create: `apps/web/src/features/portfolio/content.test.ts`
- Copy: `apps/web/public/projects/todo-memo.png`
- Copy: `apps/web/public/resume/zhang-jinpeng-resume.docx`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add `lucide-react`**

Run:

```powershell
pnpm.cmd --filter @jaxson/web add lucide-react
```

- [ ] **Step 2: Define focused portfolio domain types**

Create types for `Profile`, `Experience`, `Project`, `Award`, and `SkillGroup`. `Project` must include `slug`, `visibility`, `status`, `summary`, `problem`, `approach`, `outcome`, `role`, `technologies`, `image`, and typed external links.

- [ ] **Step 3: Write failing content-contract tests**

Tests must verify:

```ts
expect(profile.name).toBe('张锦鹏')
expect(projects.map(({ slug }) => slug)).toEqual([
  'todo-memo',
  'ruili-resume',
  'opc-agent-company',
])
expect(projects.filter(({ visibility }) => visibility === 'private')).toHaveLength(1)
expect(projects.every(({ problem, approach, outcome }) =>
  Boolean(problem && approach && outcome),
)).toBe(true)
```

- [ ] **Step 4: Run the focused test and confirm RED**

```powershell
pnpm.cmd --filter @jaxson/web test -- src/features/portfolio/content.test.ts
```

Expected: fail because the content adapter does not exist.

- [ ] **Step 5: Implement the local content adapter**

Use the approved resume facts and three selected projects. Describe demos honestly. Because the user stated the internship ended today, display it as `2026.06 - 2026.08`, not `至今`. Do not invent user counts, revenue, performance percentages, or production usage.

- [ ] **Step 6: Copy real assets into stable public paths**

Copy from:

```text
G:\vibe-coding\resume-portfolio-cn\assets\todo-memo-cover.png
G:\vibe-coding\resume-portfolio-cn\assets\张锦鹏-秋招简历.docx
```

to the target paths above. Preserve binaries byte-for-byte.

- [ ] **Step 7: Run tests and commit**

```powershell
pnpm.cmd --filter @jaxson/web test -- src/features/portfolio/content.test.ts
pnpm.cmd --filter @jaxson/web typecheck
git add apps/web/public apps/web/src/features/portfolio apps/web/package.json pnpm-lock.yaml
git commit -m "feat: add typed public portfolio content"
```

## Task 2: Public Shell and Homepage

**Files:**

- Modify: `apps/web/src/app/(frontend)/layout.tsx`
- Modify: `apps/web/src/app/(frontend)/page.tsx`
- Replace: `apps/web/src/app/(frontend)/styles.css`
- Create: `apps/web/src/components/public-site/header.tsx`
- Create: `apps/web/src/components/public-site/footer.tsx`
- Create: `apps/web/src/components/public-site/project-list.tsx`
- Create: `apps/web/src/components/public-site/reveal.tsx`

- [ ] **Step 1: Build the shared public shell**

The header contains the name, section links, GitHub, resume, and a visible `和我的 AI 分身聊聊` action linking to `/ai`. On mobile it becomes a compact accessible menu. The footer contains contact links and availability, without filler copy.

- [ ] **Step 2: Build the homepage in this order**

1. Hero: `张锦鹏`, `AI 应用开发 / 全栈开发`, Shenzhen availability, project/resume/AI actions.
2. Evidence rail: internship, shipped product, competition evidence.
3. About and current focus.
4. Experience timeline with the completed Guangdong Runmiaoyun internship.
5. Selected projects rendered by `ProjectList`.
6. Awards and skill groups.
7. Contact.

Project cards open real detail routes, never a modal. The todo project uses its actual screenshot. Ruili and OPC use restrained interface compositions when no truthful screenshot exists.

- [ ] **Step 3: Implement visual system and motion**

Use CSS variables for light/dark capable surfaces, one yellow accent, maximum 8px card radius, stable responsive grids, no nested cards, no gradients, no decorative blobs, no negative letter spacing, and no viewport-scaled font sizes. Add hero entrance, reveal, and hover motion with a reduced-motion fallback.

- [ ] **Step 4: Verify the homepage**

```powershell
pnpm.cmd --filter @jaxson/web lint
pnpm.cmd --filter @jaxson/web typecheck
pnpm.cmd --filter @jaxson/web build
```

Manually verify at 1440x900, 1024x768, 390x844, and 360x800: no horizontal overflow, clipped text, overlapping header, or inaccessible menu.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/app apps/web/src/components/public-site
git commit -m "feat: build public portfolio homepage"
```

## Task 3: Project Detail Routes

**Files:**

- Create: `apps/web/src/app/(frontend)/projects/[slug]/page.tsx`
- Modify: `apps/web/src/app/(frontend)/styles.css`

- [ ] **Step 1: Implement static project routes**

Use `generateStaticParams()` from the content adapter. Unknown slugs call `notFound()`. Each page displays project status, role, honest summary, problem, approach, outcome, technologies, image or interface composition, source/live links when available, and next-project navigation.

- [ ] **Step 2: Preserve private-project boundaries**

The OPC route must visibly say `私有案例，不公开源码`, omit repository links, and avoid sensitive architecture details. It may explain product thinking, personal role, workflow, and current maturity.

- [ ] **Step 3: Verify direct navigation and commit**

```powershell
pnpm.cmd --filter @jaxson/web typecheck
pnpm.cmd --filter @jaxson/web build
git add apps/web/src/app
git commit -m "feat: add project case-study pages"
```

## Task 4: Resume Route

**Files:**

- Create: `apps/web/src/app/(frontend)/resume/page.tsx`
- Modify: `apps/web/src/app/(frontend)/styles.css`

- [ ] **Step 1: Build a scan-first online resume**

Render contact, summary, completed internship, education, projects, awards, and skills from the same typed content. Include `下载 Word 简历` and `打印 / 保存 PDF` controls. Use print CSS to remove navigation/actions and preserve readable page breaks.

- [ ] **Step 2: Verify screen and print behavior**

Check desktop, mobile, and browser print preview. Ensure phone/email remain selectable and external URLs remain visible in print.

- [ ] **Step 3: Commit**

```powershell
pnpm.cmd --filter @jaxson/web typecheck
git add apps/web/src/app
git commit -m "feat: add online resume page"
```

## Task 5: Public AI Frontend Prototype

**Files:**

- Create: `apps/web/src/app/(frontend)/ai/page.tsx`
- Create: `apps/web/src/features/public-agent/demo-chat.tsx`
- Create: `apps/web/src/features/public-agent/demo-responses.ts`
- Modify: `apps/web/src/app/(frontend)/styles.css`

- [ ] **Step 1: Implement a standalone chat surface**

The page must feel like a mature Chinese AI product, not a portfolio section. It contains no sidebar, recent conversations, login, or fake history. Show identity, privacy note, three starter questions, message stream, composer, send/stop/new-conversation controls, and source links.

- [ ] **Step 2: Add transparent demo behavior**

On first load show `前端体验版` beside the agent identity. Deterministic local responses cover projects, internship, skills, contact, and JD-like pasted text. The response module must state it is a preview and must never pretend a real model or knowledge retrieval occurred.

- [ ] **Step 3: Make JD handling implicit**

When input contains job-description signals such as `岗位职责`, `任职要求`, or more than 180 Chinese characters, render a structured match preview inside the answer: matching evidence, gaps, and questions to verify. Do not add a `JD 匹配` mode button.

- [ ] **Step 4: Verify interaction states**

Test empty composer, keyboard submit, multiline input, pending response, stop, retry/new conversation, long JD wrapping, source navigation, and mobile keyboard-width layout. No data survives refresh.

- [ ] **Step 5: Commit**

```powershell
pnpm.cmd --filter @jaxson/web lint
pnpm.cmd --filter @jaxson/web typecheck
pnpm.cmd --filter @jaxson/web build
git add apps/web/src/app apps/web/src/features/public-agent
git commit -m "feat: add public agent frontend prototype"
```

## Task 6: Browser QA and Handoff

**Files:**

- Modify only files required by verified defects

- [ ] **Step 1: Start the local stack**

Ensure `apps/web/.env` uses the current `.env.example`, start PostgreSQL without deleting its volume, then start Next.js on the first available port.

- [ ] **Step 2: Run route and interaction QA**

Exercise `/`, all three `/projects/[slug]` routes, `/resume`, `/ai`, `/admin`, and a missing project route. Check console errors, broken assets, focus order, menu behavior, theme contrast, and all links.

- [ ] **Step 3: Capture responsive screenshots**

Capture homepage and AI page at 1440x900 and 390x844. Compare content framing, text wrapping, overflow, and visual hierarchy. Fix every Critical/Important issue and rerun checks.

- [ ] **Step 4: Run final verification**

```powershell
pnpm.cmd test
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd build
git diff --check
git status --short
```

- [ ] **Step 5: Commit QA fixes if needed**

```powershell
git add apps/web
git commit -m "fix: polish public frontend responsiveness"
```

## Backend Follow-on

After this frontend is visually approved:

1. Replace the local content adapter with Payload collections while preserving its TypeScript contract.
2. Replace demo chat responses with the public-agent streaming API and evidence retrieval.
3. Implement publish-to-index workflow and public-only database role.
4. Build the private Studio and approved-memory workflow.
