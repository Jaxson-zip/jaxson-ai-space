# Release hardening and channel integration implementation plan

> For agentic workers: use task-scoped parallel execution with root-only production mutations. Track acceptance below; preserve existing uncommitted work and all unrelated VPS services.

**Goal:** Fix AI interrupted responses and conversation limits, adapt release backup recovery and deployment, and prepare real SMTP plus personal WeChat, WeCom and official-account integrations. Sender service changed from QQ to 163 at the user's request after the first acceptance report.

**Architecture:** Existing separate portfolio and CMS/AI hosts remain. CMS is the source of public facts. Existing authenticated inbox/outbox contracts remain the durable private-data boundary. External-channel credentials stay in private environment files; channel callbacks must verify signatures and accepted owner identities before private ingestion. Root owns all server deployment and credential handling.

**Tech stack:** Next.js / Payload, PostgreSQL + pgvector, Docker Compose release layout, Vitest, Node 24, OpenClaw and official Tencent APIs.

## Task 1 — AI reliability

Files: `apps/web/src/app/(frontend)/ai/page.tsx`, `apps/web/src/features/ai/rag/llm-stream.ts`, `apps/web/src/app/api/chat/route.ts`, focused helpers/tests in AI feature directory.

- [x] Reproduce interrupted-before-text, interrupted-after-text, EOF without done and history exceeding 10 messages / 8000 chars.
- [x] Keep partial answers, distinguish completed/interrupted/error, offer retry, enforce bounded request history without dropping current question.
- [x] Respect client cancellation; do not claim provider success when using grounded fallback. Add safe stage timings for cold-start diagnosis.
- [x] Run focused regression tests, TypeScript, Linux production build, real short/long SSE probes and browser interaction verification.

## Task 2 — Release operations

Files: `docker/restore-vps-existing.sh`, `docker/backup-vps-existing.sh` if needed, deployment/backup verification tools, `.github/workflows/deploy.yml`, `docker/README.md`, focused operations docs/tests.

- [x] Verify current backup manifest/config/media/roles format before restore; default to verification/dry run.
- [x] Recover an isolated database and media copy; never replace production or unrelated trading databases for a rehearsal.
- [x] Add explicit guarded apply path with fresh recovery backup, correct release database and dedicated reader search path.
- [x] Adapt deployment workflow to current release layout, with backup, gated migrations, health checks, rollback and no old `jaxson_space` target. GitHub production SSH settings and a real Actions run remain unverified.
- [x] Document preparation for encrypted offsite backup and failure notification. Actual external storage/notification remain unconfigured.

## Task 3 — SMTP email and three WeChat channels

Files: mail verification scripts/SMTP config tests; `integrations/openclaw/`; new Tencent adapters only if existing supported channels cannot cover the request; dedicated channel docs/tests.

- [x] Confirm sender QQ mailbox; prepare private SMTP file and official 465/587 settings with certificate checks enabled. VPS TLS 1.3/SMTP greeting checked.
- [x] 163 SMTP authenticated locally, on VPS and in live web. Owner confirmed self-test mail and CMS reset mail with correct HTTPS URL. Reset token validity, identity/password preservation and hydrated reset form verified; no password change submitted.
- [ ] Verify official current personal-WeChat OpenClaw compatibility; inspect install target and gateway resources before setup. Prepare safe login and exact owner identity configuration.
- [ ] Research official WeCom app and official-account callbacks, credentials and account eligibility; implement verified callbacks/private-owner routing with tests if required.
- [ ] Perform real owner-to-bot round trips for every available account; state precisely which accounts remain unavailable.

163 SMTP is live with sender 15347640609@163.com; owner confirmed both actual deliveries. The QQ connection check above is historical. Pending external inputs: WeCom/official-account administrator availability unanswered; no real WeChat login or identity allowlist. Verified core/plugin versions and SDK; tested both personal/WeCom routing. Gateway installation and official-account adapter remain outstanding, not marked complete by unit tests.

## Root integration / acceptance

- [x] Ask missing sender/service/channel account questions early and continue independent tasks.
- [x] Review available agent changes and finish root integration after agents hit usage limits; 114 application tests, typecheck and Linux production builds pass. Lint has 25 existing warnings.
- [x] Take a complete release backup before production changes; upload checksummed build artifact and allowlisted config; retain rollback artifacts.
- [x] Confirm public pages, existing CMS auth boundary, PDF attachment, semantic retrieval, worker and unchanged unrelated services. SMTP later supplied: reset email received and linked correctly; original password retained.
- [x] Update live deployment/integration records with verified results and remaining external inputs; see `docs/上线收尾验收-2026-10-08.md`.

2026-10-09: DNS migration was resumed with owner authorization. Cloudflare Full (strict) is saved; Alibaba NS submission awaits owner SMS verification. Only personal WeChat is in current scope; WeCom and official account are deferred. The backup failure notification is installed and a 163 self-test was accepted; owner receipt confirmation is pending. See `docs/DNS与微信接入-2026-10-09.md` for current installation and verification status. No fabricated project publication, no production restore rehearsal, no Git reset, no credentials in tools/logs/source, no unsolicited third-party messages.
