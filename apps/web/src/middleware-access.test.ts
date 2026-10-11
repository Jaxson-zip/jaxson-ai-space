import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'

const state = vi.hoisted(() => ({ jwks: undefined as unknown }))
vi.mock('jose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jose')>()
  return { ...actual, createRemoteJWKSet: () => actual.createLocalJWKSet(state.jwks as Parameters<typeof actual.createLocalJWKSet>[0]) }
})
import { middleware } from './middleware'

describe('Cloudflare origin perimeter', () => {
  const originalEnv = process.env
  let keys: Awaited<ReturnType<typeof generateKeyPair>>
  beforeAll(async () => {
    keys = await generateKeyPair('RS256')
    state.jwks = { keys: [{ ...await exportJWK(keys.publicKey), kid: 'access-test', alg: 'RS256' }] }
  })
  beforeEach(() => {
    process.env = { ...originalEnv, CLOUDFLARE_ACCESS_REQUIRED: 'true', ENFORCE_STUDIO_AUTH: 'true',
      OWNER_EMAIL: 'owner@example.com', CLOUDFLARE_ACCESS_TEAM_NAME: 'test-team', CLOUDFLARE_ACCESS_AUD: 'test-app',
      STUDIO_SECRET_KEY: 'private-studio-key', STUDIO_INBOX_SECRET: 'private-inbox-key' }
  })
  afterEach(() => { process.env = originalEnv })
  const request = (path: string, headers = {}) => new NextRequest(`https://api.example.com${path}`, { headers })
  async function token(audience = 'test-app', email = 'owner@example.com') {
    return new SignJWT({ email }).setProtectedHeader({ alg: 'RS256', kid: 'access-test' })
      .setIssuer('https://test-team.cloudflareaccess.com').setAudience(audience).setExpirationTime('1h').sign(keys.privateKey)
  }
  it('denies direct-origin admin access even with a studio secret or spoofed email', async () => {
    for (const headers of [{}, { 'x-studio-token': 'private-studio-key' }, { 'cf-access-authenticated-user-email': 'owner@example.com' }]) {
      expect((await middleware(request('/admin/login', headers))).status).toBe(404)
    }
  })
  it('verifies a real RSA assertion for admin, studio and memory', async () => {
    const assertion = await token()
    for (const path of ['/admin/login', '/studio', '/api/studio/memory']) {
      expect((await middleware(request(path, { 'cf-access-jwt-assertion': assertion }))).status).toBe(200)
    }
  })
  it('rejects assertions for another app or another owner', async () => {
    for (const assertion of [await token('another-app'), await token('test-app', 'other@example.com')]) {
      expect((await middleware(request('/admin', { 'cf-access-jwt-assertion': assertion }))).status).toBe(404)
    }
  })
  it('fails closed when Access configuration is incomplete', async () => {
    delete process.env.CLOUDFLARE_ACCESS_AUD
    expect((await middleware(request('/admin', { 'cf-access-jwt-assertion': await token() }))).status).toBe(404)
  })
  it('does not let a shared studio secret bypass Access on private routes', async () => {
    for (const path of ['/studio', '/api/studio/memory']) {
      expect((await middleware(request(path, { 'x-studio-token': 'private-studio-key' }))).status).toBe(404)
    }
  })
  it('protects the actual Payload data and mutation APIs from old CMS tokens', async () => {
    for (const path of ['/api/users/login', '/api/memories', '/api/reflections', '/api/ai-knowledge', '/api/graphql', '/api/projects']) {
      const req = new NextRequest(`https://api.example.com${path}`, { method: 'POST', headers: { cookie: 'payload-token=old-token' } })
      expect((await middleware(req)).status).toBe(404)
    }
  })
  it('allows public collection reads but requires Access for authenticated reads and writes', async () => {
    expect((await middleware(request('/api/projects'))).status).toBe(200)
    expect((await middleware(request('/api/projects', { cookie: 'payload-token=old-token' }))).status).toBe(404)
    const req = new NextRequest('https://api.example.com/api/projects', { method: 'POST', headers: { cookie: `CF_Authorization=${await token()}` } })
    expect((await middleware(req)).status).toBe(200)
  })
  it('keeps public requests and authenticated inbox reachable', async () => {
    for (const path of ['/ai', '/api/chat', '/api/showcase-projects']) {
      expect((await middleware(request(path))).status).toBe(200)
    }
    expect((await middleware(request('/api/studio/inbox', { 'x-bot-secret': 'private-inbox-key' }))).status).toBe(200)
    expect((await middleware(request('/api/studio/inbox'))).status).toBe(404)
  })
  it('leaves the existing admin login available before Access is enabled', async () => {
    process.env.CLOUDFLARE_ACCESS_REQUIRED = 'false'
    expect((await middleware(request('/admin/login'))).status).toBe(200)
  })
})
