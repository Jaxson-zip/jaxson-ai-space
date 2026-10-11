# VPS Migration Implementation Plan

> **For agentic workers:** Use executing-plans to implement this plan task-by-task in the current session. No delegation is required.

**Goal:** Prepare and verify the current public portfolio and CMS release on the existing VPS without disrupting trading services or losing CMS data.

**Architecture:** Preserve `/opt/jaxson-ai-space` and its PM2 processes for rollback. Back up the current PostgreSQL database, roles, public/media files and secret-bearing configuration under a root-only directory. Build release images locally, validate schema migrations against a restored database copy on the existing PostgreSQL instance, and use loopback-only ports until the public hostnames are confirmed. Do not change trading processes or global firewall rules.

**Tech Stack:** Docker Engine/Compose, PostgreSQL/pgvector, Payload/Next.js, Node.js portfolio server, existing PM2 and Cloudflare Tunnel.

## Tasks

- [x] Inspect server resources, existing application processes and PostgreSQL migration history without printing secrets.
- [x] Create and verify database/media/configuration backups; verify the dump with `pg_restore -l` and restore a copy.
- [x] Inspect the existing schema and confirm which tracked migrations are pending on the restored copy.
- [x] Confirm public hostnames; if unavailable, complete loopback-only verification and preserve the current public service.
- [x] Build and transfer immutable release images and a secret-free release source archive; retain existing release files.
- [x] Generate restricted runtime configuration on the server from existing secrets, changing only the database target and network endpoints for the verification environment.
- [x] Run new CMS and portfolio against the copied database; verify projects API, resume download, CMS login page, private API authorization and AI grounding.
- [x] Exercise the worker against the copied database and check that no failed indexing events remain unexplained.
- [x] Back up immediately before any production cutover; stop only the old portfolio web/worker processes and leave trading services running.
- [x] Switch public routing only when hostnames, configuration and acceptance checks are verified; otherwise report the remaining external configuration.
- [x] Record exact release paths, image digests, backup location, verification results and rollback instructions without secrets.

## Recovery

Before cutover, stop only the new verification containers and restart `jaxson-web` and `jaxson-worker` with PM2 if needed. The existing database and source directory remain unchanged. The verified cutover uses a separate `jaxson_release_20261007` database with release-specific credentials; `jaxson_space` remains at its previous schema. Preserve new release data before rolling back to the original database. See `docs/服务器上线记录-2026-10-07.md` for exact paths, acceptance evidence and recovery steps.
