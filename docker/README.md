# Production deployment

The live VPS uses existing PostgreSQL and versioned release directories. Public portfolio: `https://jaxson.bond`; CMS/AI: `https://api.jaxson.bond/admin` and `/ai`. They use separate hosts and containers.

## Current VPS layout

- `/opt/jaxson-releases/current` resolves to the active release. Read the symlink on the server before operating; `20261007` is a historical release name, not a current-version assertion. See [current handoff](../docs/CURRENT.md).
- Each release contains a root-owned, mode-600 `production.env`, `compose.yaml`, `Caddyfile`, and a media directory or link.
- Compose project: `jaxson-release`; services: web, worker, portfolio and Caddy.
- PostgreSQL remains the separately managed `jaxson-postgres-prod`. Application database: `jaxson_release_20261007`. Deployment never targets the old `jaxson_space` database or unrelated services.
- Operational tools live at `/opt/jaxson-release-tools/current`, independently of the application release. The daily `jaxson-vps-backup.timer` calls this stable entry point.

## CI and manual deployment

The October 28 security update adds migration `20261028_000000_security_update`: a nullable `owner.users.reset_password_requested_at` timestamp required by Payload 3.92 and a private default for new projects. Existing project visibility is unchanged. Upgrade/down/reapply and synthetic dump/restore passed on isolated PostgreSQL; the approved production migration was completed before the October 29 release. Production now has six migrations: **do not rerun the existing SQL**. The reviewed `docker/migrations/003-security-update.sql` is shipped with its own checksum in the release artifact, refuses a wrong database or unexpected history, and is never auto-applied by deployment. See [current handoff](../docs/CURRENT.md) for the latest production version; the [release-candidate record](../docs/上线候选验收-2026-10-28.md) preserves earlier preparation evidence.

CI now gates production dependencies at high severity and runs both portfolio and public-page browser suites. `seed:public-test` requires `PUBLIC_TEST_FIXTURE=true`, non-production SQLite named `payload-public-tests.db`, and refuses PostgreSQL or a configured database URI; use a separate `MEDIA_DIR` too. The paired-window handoff test additionally requires `HANDOFF_HOME_URL` and is checked separately when no portfolio is paired.

Release health checks now require `/ai`, a complete nonempty chat SSE response, and worker health, with bounded timeouts. The checker ships in the artifact tools and is piped into Node so a rollback image does not need to contain the new script. Repository Caddy adds a 64 KiB chat body limit and Compose adds worker healthcheck. Existing server configuration is preserved during release, so review and sync those changes separately. Purge cached historical Word URLs when activating their new no-store PDF redirects. Both actual Linux production images and 30 public-page browser cases have passed against isolated PostgreSQL. This does not replace production backup recovery, live-model checks or device acceptance.

`docker/compose.rehearsal.yaml` and `apps/web/scripts/rehearse-database.mts` reproduce synthetic local verification without loading production configuration. CI now runs PostgreSQL migrations and builds/runs both production images before release can be dispatched. Docker dependency installs default to the official npm registry; an explicit `NPM_REGISTRY` build argument can select a verified alternative. The old fixed mirror returned 404 for Payload 3.92.1 during this rehearsal.

Pushing `main` or `master` runs lint, application tests, type checking, production builds and operations checks. Deployment requires **Run workflow** (`workflow_dispatch`) on one of those branches.

Configure GitHub's `production` environment with `VPS_HOST`, `VPS_USERNAME`, `VPS_SSH_KEY`, pinned `VPS_KNOWN_HOSTS`, and optional `VPS_PORT`. Existing release tools require root; use a dedicated deployment key for that account. Variables `PORTFOLIO_URL` and `API_URL` control public hosts. [Actions run 40068661821](https://github.com/Jaxson-zip/jaxson-ai-space/actions/runs/40068661821) completed both CI and deployment successfully on October 24, 2026. An October 27 read-only server check confirmed `current` at `48b21cd`, all five migrations applied, and both running application images verified against their release artifact (see [check record](../docs/核对与完善-2026-10-27.md)).

The job builds both applications with actual hostnames, saves immutable image IDs and migration names in a checksummed artifact, and uploads over SSH with strict host-key verification. It does not pull a mutable checkout on the VPS. Actions retains the artifact for 14 days.

The VPS verifies the artifact, release scope and **exact existing migration history**. Schema changes are rejected until a separate reviewed migration and recovery plan is ready. Applying an artifact creates a fresh backup, prepares a new release, switches `current` atomically, repairs the read role's pgvector search path, and checks container and HTTP health. Failed activation switches back to the previous release. Application rollback does not automatically restore the database.

```sh
# Inspect the artifact and migration compatibility without changing services.
sh /opt/jaxson-releases/artifacts/<full-commit-sha>/tools/deploy-vps-existing.sh \
  /opt/jaxson-releases/artifacts/<full-commit-sha> --verify

# Apply a verified release artifact; a fresh backup is mandatory.
sh /opt/jaxson-releases/artifacts/<full-commit-sha>/tools/deploy-vps-existing.sh \
  /opt/jaxson-releases/artifacts/<full-commit-sha> --apply
```

## Backup and recovery on this VPS

```sh
sh /opt/jaxson-release-tools/current/backup-vps-existing.sh
sh /opt/jaxson-release-tools/current/restore-vps-existing.sh <snapshot> --verify
sh /opt/jaxson-release-tools/current/restore-vps-existing.sh <snapshot> --rehearse
```

Snapshots under `/var/backups/jaxson-ai-space/` include database, media, **private release configuration**, global-role data for manual review, metadata and checksums. Keep them private. CMS and worker stop briefly for consistency; portfolio remains running. An isolated rehearsal starts its own PostgreSQL with no published ports or external network, restores a separate database and media copy, verifies vectors and private-table denial, and removes temporary resources.

The default restore only verifies. Live restore additionally requires `--apply --confirm-database jaxson_release_20261007 --confirm-release <resolved-active-release>`, creates a fresh recovery snapshot, and limits changes to that release's database and media. Archived configuration and global roles are never replayed automatically. Use this for actual recovery after reviewing the records that would be replaced.

Daily backups run at 03:30 Asia/Shanghai, with up to 15 minutes of jitter. A systemd `OnFailure` hook sends a fixed backup-failure notification through the live 163 SMTP configuration. It includes unit/time, never raw logs or credentials. `notify-vps-failure.sh --send-test` sends only to the configured sender. The owner confirmed receipt of the backup-notification test on October 10.

The backup service also runs `/opt/jaxson-ops/current/export-private-backup.sh` as an `ExecStartPost`. It combines the original CMS snapshot with gateway configuration, WeChat login/context state, plugin sources and an online SQLite receipt snapshot. It excludes transcripts, logs and reinstallable dependencies; external Supabase Todo data is not backed up here. RSA-OAEP-SHA256 wraps an AES-256-GCM key. Only the recovery public key resides on the VPS; encrypted exports remain under root-private `/var/backups/jaxson-private-export`. Export failures trigger the original failure hook.

The owner's PC downloads to `G:\jaxson-private-backups` with a pinned SSH host key and a dedicated forced-command key. Arbitrary-command and port-forwarding denial were verified. The recovery private key and private configuration stay under `C:\Users\Jaxson\.jaxson-ops`, protected by current-user/SYSTEM ACLs. The downloader authenticates/decrypts and verifies nested snapshots before accepting a file; it does not restore production. Preserve the recovery private key.

Windows tasks `Jaxson-Encrypted-Backup` (04:30 Asia/Shanghai and user logon) and `Jaxson-Public-Monitor` (every five minutes) run as the logged-in current user. Both were executed successfully. Monitoring checks the portfolio, CMS project API, actual Todo site and backup freshness; two failing cycles trigger one owner email, followed by one recovery email. Mail failures are retried. The owner confirmed both test emails. The PC must remain awake, on and logged in; independent always-on storage/monitoring and an offline key copy are still outstanding. See [actual evidence and recovery commands](../docs/本机加密备份与告警-2026-10-10.md). Tested PC dependencies are pinned in `requirements.pc-ops.txt`.

## Content and integrations

Published CMS projects and public AI knowledge supply live content. Local SQLite and embedded demo records are not automatically copied to production. Check the portfolio count against `/api/showcase-projects`, publish/unpublish, cover uploads, AI citations and PDF attachment download.

See [mail and WeChat setup](../docs/邮件与微信接入-2026-10-08.md) for live 163 SMTP and exact channel-owner identities. Private WeChat messages do not automatically enter public RAG. An empty channel allowlist disables ingestion. Cloudflare authoritative DNS migration and Full (strict) are recorded in the [current status](../docs/当前上线状态-2026-10-09.md); historical setup records retain their original dates.

## New-server bootstrap templates

`compose.prod.yaml`, `.env.example`, `backup.sh`, `restore.sh`, and `jaxson-backup.*` are **new-server templates** with internal PostgreSQL. They are not the operational entry points for this VPS. Do not run those database or restore commands against the current release. Review hostnames, database roles, bootstrap administrator and storage layout when preparing a separate server.

## Local operations and delivery tests

Install `python -m pip install -r docker/requirements.test.txt`, then run `python -m unittest discover -s docker/tests -v` from the repository root. CI uses the same requirements. The delivery checks read both shipped resume PDFs, verify the confirmed facts and identical downloads, and prevent Caddy from overriding the portfolio server's cache policy. The PC backup tools still need only `requirements.pc-ops.txt`.
