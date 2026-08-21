# Payload Web Application

This package contains the Payload blank template running on Next.js with PostgreSQL.

## Local Development

1. Start PostgreSQL and create a local database.
2. Copy `.env.example` to `.env`, then set `DATABASE_URL` and `PAYLOAD_SECRET`.
3. From the workspace root, run `pnpm install` and `pnpm dev`.
4. Open `http://localhost:3000` and create the first admin user.

Run `pnpm typecheck` from the workspace root to check TypeScript.
