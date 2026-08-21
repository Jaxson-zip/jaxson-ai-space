# Local Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reproducible local foundation for Jaxson AI Space with a Payload admin application, PostgreSQL/pgvector, validated configuration, health endpoints, and CI checks.

**Architecture:** The repository is a pnpm workspace. The first application lives in `apps/web` and uses the Payload blank template with PostgreSQL. Local application code runs on the host for fast Windows development while PostgreSQL runs in Docker; later deployment plans will package the same app and database contract into production containers.

**Tech Stack:** Node.js 24, pnpm 11, Next.js, TypeScript, Payload CMS, PostgreSQL, pgvector, Docker Compose, Vitest, GitHub Actions

---

## Scope Boundary

This plan creates the local platform foundation only. It does not migrate the public portfolio, add public AI chat, configure Cloudflare, implement memory, or deploy a cloud server. Those are separate plans built on this verified base.

## Target File Structure

```text
jaxson-ai-space/
├─ .github/
│  └─ workflows/
│     └─ ci.yml
├─ apps/
│  └─ web/
│     ├─ src/
│     │  ├─ app/api/health/live/route.ts
│     │  ├─ app/api/health/ready/route.ts
│     │  ├─ config/env.test.ts
│     │  ├─ config/env.ts
│     │  ├─ features/system/health.test.ts
│     │  ├─ features/system/health.ts
│     │  └─ payload.config.ts
│     ├─ .env.example
│     └─ package.json
├─ docs/
│  ├─ development/local-setup.md
│  └─ superpowers/
├─ infra/
│  └─ postgres/init/001-extensions.sql
├─ scripts/
│  ├─ dev.ps1
│  └─ verify-foundation.ps1
├─ .gitignore
├─ compose.dev.yaml
├─ package.json
└─ pnpm-workspace.yaml
```

## Task 1: Scaffold the pnpm Workspace and Payload Application

**Files:**

- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Generate: `apps/web/**`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Create the root workspace manifest**

Create `package.json`:

```json
{
  "name": "jaxson-ai-space",
  "private": true,
  "packageManager": "pnpm@11.5.0",
  "scripts": {
    "dev": "pnpm --filter @jaxson/web dev",
    "build": "pnpm --filter @jaxson/web build",
    "lint": "pnpm --filter @jaxson/web lint",
    "test": "pnpm --filter @jaxson/web test",
    "typecheck": "pnpm --filter @jaxson/web typecheck"
  }
}
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

Create `.gitignore`:

```gitignore
node_modules/
.pnpm-store/
.next/
dist/
coverage/
.env
.env.*
!.env.example
!**/.env.example
*.log
.DS_Store
Thumbs.db
.superpowers/
```

- [ ] **Step 2: Generate the Payload blank application without a nested dependency install**

Run from the repository root:

```powershell
New-Item -ItemType Directory -Force apps | Out-Null
Push-Location apps
pnpx.cmd create-payload-app@latest -n web -t blank --use-pnpm --no-deps --no-agent
Pop-Location
```

Expected: `apps/web` contains a Next.js and Payload application, and no command has modified the existing architecture document.

- [ ] **Step 3: Normalize the generated package scripts**

Modify `apps/web/package.json` so its name and required scripts are:

```json
{
  "name": "@jaxson/web",
  "private": true,
  "scripts": {
    "build": "cross-env NODE_OPTIONS=--no-deprecation next build",
    "dev": "cross-env NODE_OPTIONS=--no-deprecation next dev",
    "lint": "eslint .",
    "payload": "cross-env NODE_OPTIONS=--no-deprecation payload",
    "start": "cross-env NODE_OPTIONS=--no-deprecation next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

Preserve all generated dependencies and add only the missing test dependencies in the next step.

- [ ] **Step 4: Install workspace dependencies and the test runner**

Run:

```powershell
pnpm.cmd install
pnpm.cmd --filter @jaxson/web add -D vitest
```

Expected: one root `pnpm-lock.yaml` is created and `pnpm list --depth 0` exits successfully.

- [ ] **Step 5: Verify the generated application compiles before customization**

Run:

```powershell
pnpm.cmd --filter @jaxson/web typecheck
```

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 6: Commit the workspace scaffold**

```powershell
git add package.json pnpm-workspace.yaml pnpm-lock.yaml .gitignore apps/web
git commit -m "chore: scaffold Payload workspace"
```

## Task 2: Add Local PostgreSQL and pgvector

**Files:**

- Create: `compose.dev.yaml`
- Create: `infra/postgres/init/001-extensions.sql`
- Create: `apps/web/.env.example`

- [ ] **Step 1: Verify the development Compose file does not exist yet**

Run:

```powershell
docker compose -f compose.dev.yaml config
```

Expected: FAIL because `compose.dev.yaml` does not exist.

- [ ] **Step 2: Create the pgvector initialization script**

Create `infra/postgres/init/001-extensions.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

- [ ] **Step 3: Create the local database Compose service**

Create `compose.dev.yaml`:

```yaml
name: jaxson-ai-space-dev

services:
  postgres:
    image: pgvector/pgvector:pg17
    environment:
      POSTGRES_DB: jaxson_ai_space
      POSTGRES_USER: jaxson
      POSTGRES_PASSWORD: jaxson_local_dev
    ports:
      - "127.0.0.1:54329:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infra/postgres/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U jaxson -d jaxson_ai_space"]
      interval: 5s
      timeout: 3s
      retries: 20
    restart: unless-stopped

volumes:
  postgres_data:
```

- [ ] **Step 4: Create the application environment example**

Create `apps/web/.env.example`:

```dotenv
DATABASE_URI=postgresql://jaxson:jaxson_local_dev@127.0.0.1:54329/jaxson_ai_space
PAYLOAD_SECRET=dev-only-change-before-deploy-32-characters
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

- [ ] **Step 5: Validate and start PostgreSQL**

Run:

```powershell
docker compose -f compose.dev.yaml config
docker compose -f compose.dev.yaml up -d postgres
docker compose -f compose.dev.yaml ps
```

Expected: `postgres` reports `healthy` after startup.

- [ ] **Step 6: Verify pgvector is installed**

Run:

```powershell
docker compose -f compose.dev.yaml exec -T postgres psql -U jaxson -d jaxson_ai_space -tAc "SELECT extversion FROM pg_extension WHERE extname = 'vector';"
```

Expected: one version value is printed and the command exits with code 0.

- [ ] **Step 7: Commit the database foundation**

```powershell
git add compose.dev.yaml infra/postgres/init/001-extensions.sql apps/web/.env.example
git commit -m "chore: add local pgvector database"
```

## Task 3: Validate Server Configuration

**Files:**

- Create: `apps/web/src/config/env.ts`
- Create: `apps/web/src/config/env.test.ts`
- Modify: `apps/web/src/payload.config.ts`

- [ ] **Step 1: Write failing environment parser tests**

Create `apps/web/src/config/env.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { parseServerEnv } from './env'

describe('parseServerEnv', () => {
  it('accepts a complete local configuration', () => {
    expect(
      parseServerEnv({
        DATABASE_URI: 'postgresql://jaxson:secret@localhost:54329/jaxson_ai_space',
        PAYLOAD_SECRET: 'a-secure-secret-with-at-least-32-characters',
        NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000',
      }),
    ).toEqual({
      databaseUri: 'postgresql://jaxson:secret@localhost:54329/jaxson_ai_space',
      payloadSecret: 'a-secure-secret-with-at-least-32-characters',
      publicServerUrl: 'http://localhost:3000',
    })
  })

  it('rejects a short Payload secret', () => {
    expect(() =>
      parseServerEnv({
        DATABASE_URI: 'postgresql://jaxson:secret@localhost:54329/jaxson_ai_space',
        PAYLOAD_SECRET: 'short',
        NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000',
      }),
    ).toThrow(/PAYLOAD_SECRET/)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```powershell
pnpm.cmd --filter @jaxson/web test -- src/config/env.test.ts
```

Expected: FAIL because `src/config/env.ts` does not exist.

- [ ] **Step 3: Add Zod and implement the parser**

Run:

```powershell
pnpm.cmd --filter @jaxson/web add zod
```

Create `apps/web/src/config/env.ts`:

```ts
import { z } from 'zod'

const serverEnvSchema = z.object({
  DATABASE_URI: z.string().url().startsWith('postgresql://'),
  PAYLOAD_SECRET: z.string().min(32, 'PAYLOAD_SECRET must contain at least 32 characters'),
  NEXT_PUBLIC_SERVER_URL: z.string().url(),
})

export type ServerEnv = {
  databaseUri: string
  payloadSecret: string
  publicServerUrl: string
}

export function parseServerEnv(
  input: Record<string, string | undefined>,
): ServerEnv {
  const parsed = serverEnvSchema.parse(input)

  return {
    databaseUri: parsed.DATABASE_URI,
    payloadSecret: parsed.PAYLOAD_SECRET,
    publicServerUrl: parsed.NEXT_PUBLIC_SERVER_URL,
  }
}

export const env = parseServerEnv(process.env)
```

- [ ] **Step 4: Use validated values in Payload configuration**

Modify `apps/web/src/payload.config.ts` to import the validated environment:

```ts
import { env } from './config/env'
```

Replace direct reads of `process.env.DATABASE_URI` and `process.env.PAYLOAD_SECRET` with:

```ts
db: postgresAdapter({
  pool: {
    connectionString: env.databaseUri,
  },
}),
secret: env.payloadSecret,
```

- [ ] **Step 5: Run environment tests and type checking**

Run:

```powershell
pnpm.cmd --filter @jaxson/web test -- src/config/env.test.ts
pnpm.cmd --filter @jaxson/web typecheck
```

Expected: both commands exit with code 0.

- [ ] **Step 6: Commit validated configuration**

```powershell
git add apps/web/package.json pnpm-lock.yaml apps/web/src/config apps/web/src/payload.config.ts
git commit -m "feat: validate server configuration"
```

## Task 4: Add Liveness and Readiness Endpoints

**Files:**

- Create: `apps/web/src/features/system/health.ts`
- Create: `apps/web/src/features/system/health.test.ts`
- Create: `apps/web/src/app/api/health/live/route.ts`
- Create: `apps/web/src/app/api/health/ready/route.ts`

- [ ] **Step 1: Write failing health behavior tests**

Create `apps/web/src/features/system/health.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import { checkReadiness, createLiveness } from './health'

describe('health', () => {
  it('creates a stable liveness payload', () => {
    const now = new Date('2026-08-21T00:00:00.000Z')

    expect(createLiveness(now)).toEqual({
      service: 'web',
      status: 'ok',
      timestamp: '2026-08-21T00:00:00.000Z',
    })
  })

  it('reports ready when the database probe succeeds', async () => {
    const probe = vi.fn().mockResolvedValue(undefined)

    await expect(checkReadiness(probe)).resolves.toEqual({
      service: 'web',
      status: 'ready',
    })
  })

  it('reports unavailable when the database probe fails', async () => {
    const probe = vi.fn().mockRejectedValue(new Error('database unavailable'))

    await expect(checkReadiness(probe)).resolves.toEqual({
      service: 'web',
      status: 'unavailable',
    })
  })
})
```

- [ ] **Step 2: Run the health tests to verify they fail**

Run:

```powershell
pnpm.cmd --filter @jaxson/web test -- src/features/system/health.test.ts
```

Expected: FAIL because `health.ts` does not exist.

- [ ] **Step 3: Implement dependency-injected health behavior**

Create `apps/web/src/features/system/health.ts`:

```ts
export type ReadinessPayload = {
  service: 'web'
  status: 'ready' | 'unavailable'
}

export function createLiveness(now = new Date()) {
  return {
    service: 'web' as const,
    status: 'ok' as const,
    timestamp: now.toISOString(),
  }
}

export async function checkReadiness(
  databaseProbe: () => Promise<void>,
): Promise<ReadinessPayload> {
  try {
    await databaseProbe()
    return { service: 'web', status: 'ready' }
  } catch {
    return { service: 'web', status: 'unavailable' }
  }
}
```

- [ ] **Step 4: Add the liveness route**

Create `apps/web/src/app/api/health/live/route.ts`:

```ts
import { createLiveness } from '../../../../features/system/health'

export const dynamic = 'force-dynamic'

export function GET(): Response {
  return Response.json(createLiveness(), { status: 200 })
}
```

- [ ] **Step 5: Add the database readiness route**

Create `apps/web/src/app/api/health/ready/route.ts`:

```ts
import config from '@payload-config'
import { getPayload } from 'payload'

import { checkReadiness } from '../../../../features/system/health'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const payload = await getPayload({ config })
  const result = await checkReadiness(async () => {
    await payload.find({
      collection: 'users',
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
  })

  return Response.json(result, {
    status: result.status === 'ready' ? 200 : 503,
  })
}
```

- [ ] **Step 6: Run tests and type checking**

Run:

```powershell
pnpm.cmd --filter @jaxson/web test -- src/features/system/health.test.ts
pnpm.cmd --filter @jaxson/web typecheck
```

Expected: tests pass and type checking exits with code 0.

- [ ] **Step 7: Commit health endpoints**

```powershell
git add apps/web/src/features/system apps/web/src/app/api/health
git commit -m "feat: add application health endpoints"
```

## Task 5: Add Local Start and Verification Scripts

**Files:**

- Create: `scripts/dev.ps1`
- Create: `scripts/verify-foundation.ps1`

- [ ] **Step 1: Create the local development launcher**

Create `scripts/dev.ps1`:

```powershell
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

Set-Location $repoRoot
docker compose -f compose.dev.yaml up -d postgres

$envPath = Join-Path $repoRoot 'apps/web/.env'
if (-not (Test-Path -LiteralPath $envPath)) {
  Copy-Item -LiteralPath (Join-Path $repoRoot 'apps/web/.env.example') -Destination $envPath
}

pnpm.cmd --filter @jaxson/web dev
```

- [ ] **Step 2: Create the foundation verification script**

Create `scripts/verify-foundation.ps1`:

```powershell
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$composeState = docker compose -f compose.dev.yaml ps --format json |
  ForEach-Object { $_ | ConvertFrom-Json }
$postgres = @($composeState) | Where-Object { $_.Service -eq 'postgres' }
if (-not $postgres -or $postgres.Health -ne 'healthy') {
  throw 'PostgreSQL is not healthy.'
}

$vectorVersion = docker compose -f compose.dev.yaml exec -T postgres `
  psql -U jaxson -d jaxson_ai_space -tAc "SELECT extversion FROM pg_extension WHERE extname = 'vector';"
if (-not $vectorVersion.Trim()) {
  throw 'pgvector extension is not installed.'
}

$live = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/health/live'
if ($live.status -ne 'ok') {
  throw 'Liveness endpoint did not report ok.'
}

$ready = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/health/ready'
if ($ready.status -ne 'ready') {
  throw 'Readiness endpoint did not report ready.'
}

Write-Output "Foundation verified. pgvector=$($vectorVersion.Trim())"
```

- [ ] **Step 3: Start the application locally**

Run in one PowerShell terminal:

```powershell
& .\scripts\dev.ps1
```

Expected: Next.js reports a local URL at `http://127.0.0.1:3000` or `http://localhost:3000`.

- [ ] **Step 4: Verify the full local foundation**

Run in a second PowerShell terminal:

```powershell
& .\scripts\verify-foundation.ps1
```

Expected:

```text
Foundation verified. pgvector=<installed version>
```

- [ ] **Step 5: Verify the Payload owner setup page**

Open `http://127.0.0.1:3000/admin`.

Expected: Payload shows the first-user setup screen. Do not create the production owner account during this local verification.

- [ ] **Step 6: Commit local scripts**

```powershell
git add scripts/dev.ps1 scripts/verify-foundation.ps1
git commit -m "chore: add local development verification"
```

## Task 6: Add Continuous Integration

**Files:**

- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg17
        env:
          POSTGRES_DB: jaxson_ai_space
          POSTGRES_USER: jaxson
          POSTGRES_PASSWORD: ci_database_password
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U jaxson -d jaxson_ai_space"
          --health-interval 5s
          --health-timeout 3s
          --health-retries 20

    env:
      DATABASE_URI: postgresql://jaxson:ci_database_password@127.0.0.1:5432/jaxson_ai_space
      PAYLOAD_SECRET: ci-only-secret-with-at-least-32-characters
      NEXT_PUBLIC_SERVER_URL: http://127.0.0.1:3000

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11.5.0
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - name: Enable and verify pgvector
        run: |
          PGPASSWORD=ci_database_password psql \
            -h 127.0.0.1 \
            -U jaxson \
            -d jaxson_ai_space \
            -c "CREATE EXTENSION IF NOT EXISTS vector;"
          PGPASSWORD=ci_database_password psql \
            -h 127.0.0.1 \
            -U jaxson \
            -d jaxson_ai_space \
            -tAc "SELECT extversion FROM pg_extension WHERE extname = 'vector';"
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm typecheck
      - run: pnpm build
```

- [ ] **Step 2: Run the same checks locally**

Run:

```powershell
pnpm.cmd test
pnpm.cmd typecheck
pnpm.cmd build
```

Expected: all commands exit with code 0.

- [ ] **Step 3: Commit CI**

```powershell
git add .github/workflows/ci.yml
git commit -m "ci: verify web foundation"
```

## Task 7: Document the Local-to-Cloud Workflow

**Files:**

- Create: `docs/development/local-setup.md`

- [ ] **Step 1: Write the local setup guide**

Create `docs/development/local-setup.md`:

````markdown
# Local Development

## Prerequisites

- Node.js 24
- pnpm 11.5.0
- Docker Desktop with Docker Compose

## First Start

```powershell
pnpm.cmd install
& .\scripts\dev.ps1
```

Open:

- Application: http://127.0.0.1:3000
- Payload admin: http://127.0.0.1:3000/admin
- Liveness: http://127.0.0.1:3000/api/health/live
- Readiness: http://127.0.0.1:3000/api/health/ready

## Verify

With the development server running:

```powershell
& .\scripts\verify-foundation.ps1
pnpm.cmd test
pnpm.cmd typecheck
```

## Stop Local Services

```powershell
docker compose -f compose.dev.yaml stop
```

`stop` preserves the database volume. Do not use `down -v` unless the local database is intentionally being discarded.

## Delivery Strategy

Development happens locally. Each completed vertical slice is committed and verified locally. After the public content and public Agent slices work, the deployment plan builds immutable images and deploys a staging instance on the cloud server. Production is updated from Git commits and database migrations; source files are never edited directly on the server.
````

- [ ] **Step 2: Check all documented commands and URLs**

Run:

```powershell
docker compose -f compose.dev.yaml config
pnpm.cmd test
pnpm.cmd typecheck
```

Expected: all commands exit with code 0 and the documented health URLs match the route files.

- [ ] **Step 3: Commit development documentation**

```powershell
git add docs/development/local-setup.md
git commit -m "docs: explain local development workflow"
```

## Task 8: Final Foundation Verification

**Files:**

- Verify only; no source changes expected

- [ ] **Step 1: Confirm the worktree contains only intended changes**

Run:

```powershell
git status --short
```

Expected: no output.

- [ ] **Step 2: Run the complete automated verification**

Run:

```powershell
pnpm.cmd test
pnpm.cmd typecheck
pnpm.cmd build
```

Expected: all commands exit with code 0.

- [ ] **Step 3: Run the live local verification**

With `scripts/dev.ps1` running, execute:

```powershell
& .\scripts\verify-foundation.ps1
```

Expected: PostgreSQL is healthy, pgvector has a version, and both health endpoints report success.

- [ ] **Step 4: Record the verified baseline**

Run:

```powershell
git log --oneline --decorate -8
```

Expected: the history contains separate commits for workspace scaffolding, pgvector, environment validation, health endpoints, local scripts, CI, and documentation.

## Follow-on Plans

After this plan passes, create and execute separate implementation plans in this order:

1. Public portfolio migration and Payload content models.
2. Public AI Agent, evidence retrieval, and JD analysis.
3. Production images, Cloudflare, cloud deployment, limits, and backups.
4. Private Studio, review workflow, approved memory, and goals.
