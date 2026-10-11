# Production completion implementation plan

> Execution: continue inline in this session. The user has authorized implementation and verification.

**Goal:** Complete the deployment tooling and integrations that can be tested without production credentials.

**Architecture:** Keep CMS as the source of truth. Share one embedding implementation between the web query and production worker, record the model identity in each index row, and filter scores by that identity. Transfer content through authenticated CMS APIs rather than moving SQLite schemas into PostgreSQL. Snapshot database and media together while CMS writes are paused.

**Tech Stack:** Node.js ESM, Payload REST API, PostgreSQL/pgvector, Docker Compose, POSIX shell, Vitest, optional Payload SMTP adapter.

## 1. Embeddings and reindex

- [x] Add `apps/web/scripts/lib/index-embedding.mjs` and its TypeScript declaration. Support explicit local/semantic modes; reject missing credentials, wrong dimensions, nonfinite/zero vectors and HTTP failure in semantic mode. Use a bounded request timeout.
- [x] Write regression tests in `apps/web/src/features/ai/rag/index-embedding.test.ts`, run red, implement, run green.
- [x] Update `knowledge-loader.ts` and `run-index-worker.mjs` to share vectors and model identity. Semantic failures retry worker tasks, while query failures use lexical retrieval without mixing vector spaces.
- [x] Add `reindex-knowledge.mjs` to enqueue the current CMS records. Add the maintenance Compose service and environment validation.

## 2. Content migration

- [x] Add `scripts/lib/cms-transfer.mjs` and `scripts/cms-content.mjs`. Authenticate to the selected CMS; export only projects, experiences, credentials, knowledge and referenced cover files. Exclude accounts, tokens, source IDs and private Studio records.
- [x] Test pagination, media relationship remapping, repeated import and dry-run behavior. Default import to inspection; require `--apply` to write. Reject ambiguous record matches and unsafe media origins.
- [x] Verify export/import against the isolated production CMS without changing development data.

## 3. Backups and restore

- [x] Add `docker/lib/compose.sh`, `backup.sh`, `restore.sh`. Use restricted snapshot directories, checksums and a completion marker. Pause CMS and worker during snapshots; include PostgreSQL dump and media tar.
- [x] Require an explicit restore confirmation and valid checksums before changing data. Create a fresh recovery snapshot first; restore database transactionally and validate archive paths before replacing media.
- [x] Add a daily backup scheduler template and run a real snapshot/restore exercise on the isolated stack.

## 4. Optional email and readiness checks

- [x] Install the Payload SMTP adapter matching Payload 3.88.0. Configure it only when SMTP is explicitly supplied, with paired credentials and TLS validation.
- [x] Add configuration tests and update environment examples, deployment instructions, CI script checks and the acceptance report.
- [x] Run `pnpm --filter @jaxson/web test`, `typecheck`, `lint`, Docker build, and focused container integration checks. Stop the isolated test stack afterward.

Production DNS/TLS, real provider delivery and approved production content remain external acceptance steps.
