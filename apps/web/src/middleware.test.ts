import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from './middleware'

describe('Studio Security & 404 Disguise Middleware', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, ENFORCE_STUDIO_AUTH: 'true', OWNER_EMAIL: 'jaxson@example.com' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('allows public routes like / and /ai to pass through directly', async () => {
    const req = new NextRequest('http://localhost:3000/')
    const res = await middleware(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('x-middleware-rewrite')).toBeNull()
  })

  it('rewrites unauthorized /studio request to 404 not-found in enforced mode', async () => {
    const req = new NextRequest('http://localhost:3000/studio')
    const res = await middleware(req)
    expect(res.status).toBe(404)
    const rewriteHeader = res.headers.get('x-middleware-rewrite')
    expect(rewriteHeader).toContain('/not-found')
  })

  it('strictly blocks spoofed dummy JWT cookie (e.g. payload-token=a.b.c)', async () => {
    process.env.PAYLOAD_SECRET = 'super_secret_payload_key_123456789'
    const req = new NextRequest('http://localhost:3000/studio', {
      headers: {
        cookie: 'payload-token=a.b.c',
      },
    })
    const res = await middleware(req)
    expect(res.status).toBe(404)
    const rewriteHeader = res.headers.get('x-middleware-rewrite')
    expect(rewriteHeader).toContain('/not-found')
  })

  it('returns 404 JSON for unauthorized /api/studio requests', async () => {
    const req = new NextRequest('http://localhost:3000/api/studio/memory')
    const res = await middleware(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Not Found')
  })

  it('strictly blocks plain spoofed Cloudflare email header in enforced mode without assertion JWT', async () => {
    const req = new NextRequest('http://localhost:3000/studio', {
      headers: {
        'cf-access-authenticated-user-email': 'jaxson@example.com',
      },
    })
    const res = await middleware(req)
    expect(res.status).toBe(404)
    const rewriteHeader = res.headers.get('x-middleware-rewrite')
    expect(rewriteHeader).toContain('/not-found')
  })

  it('strictly blocks unverified or alg:none Cloudflare JWT token without valid signature', async () => {
    process.env.CLOUDFLARE_ACCESS_SECRET = 'cf-temp-secret-key-1234567890'
    // Create spoofed base64 token with alg: none
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ email: 'jaxson@example.com' })).toString('base64url')
    const spoofedNoneJwt = `${header}.${payload}.`

    const req = new NextRequest('http://localhost:3000/studio', {
      headers: {
        'cf-access-jwt-assertion': spoofedNoneJwt,
      },
    })
    const res = await middleware(req)
    expect(res.status).toBe(404)
    const rewriteHeader = res.headers.get('x-middleware-rewrite')
    expect(rewriteHeader).toContain('/not-found')
  })

  it('allows authorized request with valid Cloudflare Access JWT Assertion token', async () => {
    process.env.CLOUDFLARE_ACCESS_SECRET = 'cf-temp-secret-key-1234567890'
    const { SignJWT } = await import('jose')
    const secretKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(process.env.CLOUDFLARE_ACCESS_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const cfJwtToken = await new SignJWT({
      sub: 'user-1',
      email: 'jaxson@example.com',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(secretKey)

    const req = new NextRequest('http://localhost:3000/studio', {
      headers: {
        'cf-access-jwt-assertion': cfJwtToken,
      },
    })
    const res = await middleware(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive')
  })

  it('allows authorized webhook request with valid STUDIO_INBOX_SECRET on /api/studio/inbox', async () => {
    process.env.STUDIO_INBOX_SECRET = 'inbox_secret_abc123'
    const req = new NextRequest('http://localhost:3000/api/studio/inbox', {
      headers: {
        authorization: 'Bearer inbox_secret_abc123',
      },
    })
    const res = await middleware(req)
    expect(res.status).toBe(200)
  })

  it('strictly blocks STUDIO_INBOX_SECRET from accessing management workbench /studio or /api/studio/memory', async () => {
    process.env.STUDIO_INBOX_SECRET = 'inbox_secret_abc123'
    const reqStudio = new NextRequest('http://localhost:3000/studio', {
      headers: {
        authorization: 'Bearer inbox_secret_abc123',
      },
    })
    const resStudio = await middleware(reqStudio)
    expect(resStudio.status).toBe(404)

    const reqMemory = new NextRequest('http://localhost:3000/api/studio/memory', {
      headers: {
        authorization: 'Bearer inbox_secret_abc123',
      },
    })
    const resMemory = await middleware(reqMemory)
    expect(resMemory.status).toBe(404)
  })

  it('strictly blocks valid JWT belonging to non-owner email or other collection', async () => {
    process.env.PAYLOAD_SECRET = 'super_secret_payload_key_123456789'
    process.env.OWNER_EMAIL = 'jaxson@example.com'

    const { SignJWT } = await import('jose')
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(process.env.PAYLOAD_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const nonOwnerToken = await new SignJWT({
      id: 'attacker-123',
      email: 'attacker@evil.com',
      collection: 'users',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('2h')
      .sign(cryptoKey)

    const req = new NextRequest('http://localhost:3000/studio', {
      headers: {
        cookie: `payload-token=${nonOwnerToken}`,
      },
    })
    const res = await middleware(req)
    expect(res.status).toBe(404)
    const rewriteHeader = res.headers.get('x-middleware-rewrite')
    expect(rewriteHeader).toContain('/not-found')
  })

  it('allows valid JWT belonging to the verified owner account', async () => {
    process.env.PAYLOAD_SECRET = 'super_secret_payload_key_123456789'
    process.env.OWNER_EMAIL = 'jaxson@example.com'

    const { SignJWT } = await import('jose')
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(process.env.PAYLOAD_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const ownerToken = await new SignJWT({
      id: 'owner-1',
      email: 'jaxson@example.com',
      collection: 'users',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('2h')
      .sign(cryptoKey)

    const req = new NextRequest('http://localhost:3000/studio', {
      headers: {
        cookie: `payload-token=${ownerToken}`,
      },
    })
    const res = await middleware(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive')
  })
})
