import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/portfolio',
  outputDir: '../../scratch/playwright-portfolio',
  workers: 1,
  use: {
    baseURL: process.env.PORTFOLIO_TEST_URL || 'http://127.0.0.1:4174',
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'motion', use: { contextOptions: { reducedMotion: 'no-preference' } } },
    { name: 'reduced-motion', use: { contextOptions: { reducedMotion: 'reduce' } } },
  ],
  webServer: process.env.PORTFOLIO_TEST_URL ? undefined : {
    command: 'node ../portfolio/scripts/serve.mjs',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
    env: { HOST: '127.0.0.1', PORT: '4174', PORTFOLIO_API_ORIGIN: 'https://cms.example.test' },
  },
})
