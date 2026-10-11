# Jaxson AI Space

## Local development

From the workspace root, run `pnpm install` and `pnpm dev`. This starts two separate apps: the public static portfolio on port 3000 and the CMS/AI Next.js app on port 3001. The CMS uses SQLite by default; set `USE_POSTGRES=true` and `DATABASE_URI` to use PostgreSQL.

Local addresses:

| Page | Local URL |
| --- | --- |
| Public portfolio | `http://localhost:3000/` |
| Resume PDF download | `http://localhost:3000/resume/zhang-jinpeng-ai-product-builder.pdf` |
| AI conversation | `http://localhost:3001/ai` |
| Payload CMS | `http://localhost:3001/admin` |
| Projects and project experience | `http://localhost:3001/admin/collections/projects` |
| Internship, education and campus experience | `http://localhost:3001/admin/collections/experiences` |
| AI knowledge entries | `http://localhost:3001/admin/collections/ai-knowledge` |

Sign in with a Payload administrator account. Use **Projects** to add a project experience: enter its title, unique slug, role, category, status and summary, then add the problem, your work and outcome. **Public** projects appear on the portfolio and provide facts to the AI; **private** projects stay out of both. Use **Experiences** for internships, education and campus roles.

When the local database has no administrator yet, open `/admin` to create the first account. Former `/manage/projects` and `/manage/knowledge` bookmarks redirect to their Payload collections. The old Next.js homepage experiments are stored in `archive/` and are not part of the runtime.

In **AI Knowledge**, add one verified topic per entry with a title, category, factual content and optional evidence label. Enable **是否对公开 AI 分身可见** to make it available to the next `/ai` conversation. The chat endpoint reads public `ai-knowledge` records and public `projects` from Payload, plus experience, award and skill records entered in the CMS. Empty CMS collections add no facts to the AI; the static portfolio display fallback in `src/features/portfolio/content.ts` is not an AI source. With `USE_POSTGRES=true`, the PostgreSQL `public_read.knowledge_embeddings` index supplies relevance scores, while Payload records remain the source of text. Local SQLite does not require or read pgvector. The resume PDF is a download and is not automatically imported as knowledge because its project section is older.

The public portfolio has a direct PDF download button for `apps/portfolio/public/resume/zhang-jinpeng-ai-product-builder.pdf`. The backend `/resume` route remains a compatibility landing page for existing links. The August 2026 PDF contains older project details; the current project list lives in the portfolio.

Port `4174` is kept for the locked classic portfolio comparison. Its `jaxson_biaoge_restart.html` URL reaches the separate public app on port 3000.

The cinematic HTML is generated outside this package. `pnpm --filter @jaxson/web sync:cinematic "<directory containing jaxson_biaoge_restart.html>"` copies the generated page and assets into `apps/portfolio/` and rewrites its old same-origin links for the split setup. The public app reads `PORTFOLIO_API_ORIGIN` (default `http://localhost:3001`); set it during `pnpm --filter @jaxson/portfolio build` for a static deployment. Set `NEXT_PUBLIC_PORTFOLIO_URL` on the backend to the deployed public site's origin. Its public project endpoint only allows that configured origin.

Run `pnpm --filter @jaxson/web typecheck` to check TypeScript.
