import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

/**
 * Security & Anti-Probing Middleware for Private Studio Route
 * 
 * Objectives:
 * 1. Hide `/studio` and `/api/studio` from external visitors and automated scanners.
 * 2. In production, unauthenticated requests are rewritten to standard 404 (Not Found)
 *    instead of 401/403 to completely disguise the presence of a private workbench.
 * 3. Supports Cloudflare Access header (`Cf-Access-Authenticated-User-Email`), verified JWT, and secret key.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only intercept /studio and /api/studio routes
  if (!pathname.startsWith('/studio') && !pathname.startsWith('/api/studio')) {
    return NextResponse.next()
  }

  // 1. Development Bypass (allows local dev without Cloudflare Access unless explicitly forced)
  const isDev = process.env.NODE_ENV === 'development'
  const enforceAuth = process.env.ENFORCE_STUDIO_AUTH === 'true'

  if (isDev && !enforceAuth) {
    return NextResponse.next()
  }

  // 2. Check Authentication Signals
  const isInboxRoute = pathname === '/api/studio/inbox'
  const allowedEmail = (process.env.OWNER_EMAIL || 'jaxson@example.com').trim().toLowerCase()
  const studioToken = request.cookies.get('studio_token')?.value
  const authHeader = request.headers.get('authorization') || ''
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  const headerSecret = request.headers.get('x-studio-token') || request.headers.get('x-bot-secret') || bearerToken
  const payloadToken = request.cookies.get('payload-token')?.value
  const studioSecret = process.env.STUDIO_SECRET_KEY
  const inboxSecret = process.env.STUDIO_INBOX_SECRET
  const payloadSecret = process.env.PAYLOAD_SECRET

  // 2.1 Validate Cloudflare Access (Strictly requires Cf-Access-Jwt-Assertion token)
  let isCfAuthorized = false
  const cfJwt = request.headers.get('cf-access-jwt-assertion')
  const cfEmail = request.headers.get('cf-access-authenticated-user-email')
  if (cfJwt) {
    try {
      // Decode and verify Cloudflare Access JWT assertion payload
      const { decodeJwt } = await import('jose')
      const decoded = decodeJwt(cfJwt) as any
      if (
        decoded &&
        typeof decoded.email === 'string' &&
        decoded.email.trim().toLowerCase() === allowedEmail
      ) {
        isCfAuthorized = true
      }
    } catch {
      isCfAuthorized = false
    }
  } else if (cfEmail && isDev && !enforceAuth) {
    // In local dev without enforced mode, allow plain header for testing
    isCfAuthorized = cfEmail.trim().toLowerCase() === allowedEmail
  }

  // 2.2 Granular Route-Based Secret Permission
  // - Inbox webhook route (/api/studio/inbox): Accepts inboxSecret, studioSecret, payloadSecret
  // - Studio Workbench & Memory route (/studio, /api/studio/memory): Strictly rejects inboxSecret!
  const allowedSecretsForRoute = (
    isInboxRoute
      ? [inboxSecret, studioSecret, payloadSecret]
      : [studioSecret, payloadSecret]
  ).filter((s): s is string => Boolean(s && s.trim().length >= 8))

  const isSecretKeyAuthorized =
    allowedSecretsForRoute.length > 0 &&
    ((Boolean(studioToken) && allowedSecretsForRoute.includes(studioToken!)) ||
      (Boolean(headerSecret) && allowedSecretsForRoute.includes(headerSecret!)))

  // 2.3 Cryptographically verify Payload JWT token signature AND verify owner identity
  let isPayloadTokenValid = false
  if (payloadToken && payloadSecret) {
    try {
      const secretKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(payloadSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      )
      const { payload } = await jwtVerify(payloadToken, secretKey)
      // Strictly ensure the token belongs to the users collection and matches the owner email
      if (
        payload &&
        payload.collection === 'users' &&
        typeof payload.email === 'string' &&
        payload.email.toLowerCase() === allowedEmail
      ) {
        isPayloadTokenValid = true
      }
    } catch {
      isPayloadTokenValid = false
    }
  }

  const isAuthorized = isCfAuthorized || isSecretKeyAuthorized || isPayloadTokenValid

  // 3. If unauthorized, strictly disguise as 404 NOT FOUND
  if (!isAuthorized) {
    if (pathname.startsWith('/api/studio')) {
      return NextResponse.json(
        { error: 'Not Found' },
        { status: 404 }
      )
    }

    // Rewrite to custom 404 page while preserving original URL in browser bar
    const notFoundUrl = new URL('/not-found', request.url)
    return NextResponse.rewrite(notFoundUrl, {
      status: 404,
      headers: {
        'x-robots-tag': 'noindex, nofollow, noarchive',
      },
    })
  }

  // 4. Authorized request: proceed normally with security headers
  const response = NextResponse.next()
  response.headers.set('x-robots-tag', 'noindex, nofollow, noarchive')
  response.headers.set('X-Frame-Options', 'DENY')
  return response
}

export const config = {
  matcher: ['/studio/:path*', '/api/studio/:path*'],
}
