import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createRemoteJWKSet, jwtVerify } from 'jose'

// Keep the verifier across requests so Access does not fetch JWKS on every page load.
const accessVerifiers = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

/**
 * Security & Anti-Probing Middleware for Private Studio Route
 * 
 * Objectives:
 * 1. Hide `/studio` and `/api/studio` from external visitors and automated scanners.
 * 2. In production, unauthenticated requests are rewritten to standard 404 (Not Found)
 *    instead of 401/403 to completely disguise the presence of a private workbench.
 * 3. Supports cryptographically verified Cloudflare Access JWTs and secret keys.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')
  const accessRequired = process.env.CLOUDFLARE_ACCESS_REQUIRED === 'true'
  const isPublicAppApi = ['/api/chat', '/api/showcase-projects', '/api/studio/inbox'].includes(pathname)
  const isAnonymousCollectionRead = /^(GET|HEAD)$/.test(request.method)
    && /^\/api\/(projects|media|experiences|credentials)(\/|$)/.test(pathname)
    && !request.cookies.get('payload-token')?.value && !request.headers.get('authorization')
  const isPrivatePayloadApi = pathname.startsWith('/api/') && !isPublicAppApi
    && !pathname.startsWith('/api/studio/') && !isAnonymousCollectionRead

  // Only intercept /studio and /api/studio routes
  if (!isAdminRoute && !(accessRequired && isPrivatePayloadApi) && !pathname.startsWith('/studio') && !pathname.startsWith('/api/studio')) {
    return NextResponse.next()
  }
  if (isAdminRoute && !accessRequired) return NextResponse.next()

  // 1. Development Bypass (allows local dev without Cloudflare Access unless explicitly forced)
  const isDev = process.env.NODE_ENV === 'development'
  const enforceAuth = process.env.ENFORCE_STUDIO_AUTH === 'true'

  if (isDev && !enforceAuth && !accessRequired) {
    return NextResponse.next()
  }

  // 2. Check Authentication Signals
  const isInboxRoute = pathname === '/api/studio/inbox'
  const allowedEmail = (process.env.OWNER_EMAIL || 'admin@example.com').trim().toLowerCase()
  const studioToken = request.cookies.get('studio_token')?.value
  const authHeader = request.headers.get('authorization') || ''
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  const headerSecret = request.headers.get('x-studio-token') || request.headers.get('x-bot-secret') || bearerToken
  const payloadToken = request.cookies.get('payload-token')?.value
  const studioSecret = process.env.STUDIO_SECRET_KEY
  const inboxSecret = process.env.STUDIO_INBOX_SECRET
  const payloadSecret = process.env.PAYLOAD_SECRET

  // 2.1 Validate Cloudflare Access (Cryptographically verified via JWKS / Secret)
  let isCfAuthorized = false
  const cfJwt = request.headers.get('cf-access-jwt-assertion') || request.cookies.get('CF_Authorization')?.value
  if (cfJwt) {
    try {
      const teamName = process.env.CLOUDFLARE_ACCESS_TEAM_NAME
      const expectedAud = process.env.CLOUDFLARE_ACCESS_AUD
      const cfSecret = process.env.CLOUDFLARE_ACCESS_SECRET

      if (teamName && expectedAud) {
        if (!/^[a-z0-9-]+$/.test(teamName)) throw new Error('Invalid Access team')
        let JWKS = accessVerifiers.get(teamName)
        if (!JWKS) {
          JWKS = createRemoteJWKSet(new URL(`https://${teamName}.cloudflareaccess.com/cdn-cgi/access/certs`))
          accessVerifiers.set(teamName, JWKS)
        }
        const { payload } = await jwtVerify(cfJwt, JWKS, {
          issuer: `https://${teamName}.cloudflareaccess.com`,
          audience: expectedAud,
          algorithms: ['RS256'],
        })
        if (
          payload &&
          typeof payload.email === 'string' &&
          payload.email.trim().toLowerCase() === allowedEmail
        ) {
          isCfAuthorized = true
        }
      } else if (cfSecret && !accessRequired && process.env.NODE_ENV !== 'production') {
        // Supported for staging/mock or custom HS256 zero trust gateway verification
        const secretKey = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(cfSecret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['verify']
        )
        const { payload } = await jwtVerify(cfJwt, secretKey, {
          audience: expectedAud,
        })
        if (
          payload &&
          typeof payload.email === 'string' &&
          payload.email.trim().toLowerCase() === allowedEmail
        ) {
          isCfAuthorized = true
        }
      }
    } catch {
      isCfAuthorized = false
    }
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
      // Payload derives its runtime signing key when initializing the CMS.
      // Verify the actual login cookie using the same derivation.
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payloadSecret.trim()))
      const signingSecret = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0'))
        .join('').slice(0, 32)
      const secretKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(signingSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      )
      const { payload } = await jwtVerify(payloadToken, secretKey, { algorithms: ['HS256'] })
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

  // The inbox keeps its separate bot authentication. Interactive private routes
  // require Access when enabled; an old CMS cookie or shared secret cannot bypass it.
  const isAuthorized = accessRequired && !isInboxRoute
    ? isCfAuthorized
    : isCfAuthorized || isSecretKeyAuthorized || isPayloadTokenValid

  // 3. If unauthorized, strictly disguise as 404 NOT FOUND
  if (!isAuthorized) {
    if (pathname.startsWith('/api/')) {
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
  matcher: ['/admin/:path*', '/studio/:path*', '/api/:path*'],
}
