import { defineConfig } from '@playwright/test'

// Browser checks for the CMS-served public pages (/ai, /resume, /projects/[slug], 404).
// They need the local CMS with its SQLite content (payload-local.db), so they run locally:
//   pnpm --filter @jaxson/web exec playwright test --config playwright.web.config.ts
export default defineConfig({
  testDir: './tests/web',
  outputDir: '../../scratch/playwright-web',
  workers: 1,
  timeout: 90_000,
  use: {
    baseURL: process.env.WEB_TEST_URL || 'http://localhost:3102',
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: process.env.WEB_TEST_URL ? undefined : {
    command: 'pnpm exec next dev -p 3102',
    url: 'http://localhost:3102/resume',
    reuseExistingServer: true,
    timeout: 180_000,
    env: { NEXT_PUBLIC_PORTFOLIO_URL: 'http://localhost:3000', NODE_OPTIONS: '--no-deprecation' },
  },
})
