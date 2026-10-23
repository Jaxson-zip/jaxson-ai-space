import type { NextRequest } from 'next/server'
import { createRemoteJWKSet, jwtVerify } from 'jose'

// Keep the verifier across requests so Access does not fetch JWKS on every page load.
const accessVerifiers = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

/**
 * The single decision for private routes. Middleware hides them; private route
 * handlers call it again so a middleware matcher mistake cannot expose data.
 */
export async function isPrivateRequestAuthorized(request: NextRequest): Promise<boolean> {
  const { pathname } = request.nextUrl
  const accessRequired = process.env.CLOUDFLARE_ACCESS_REQUIRED === 'true'

  // 1. Development Bypass (allows local dev without Cloudflare Access unless explicitly forced)
  const isDev = process.env.NODE_ENV === 'development'
  const enforceAuth = process.env.ENFORCE_STUDIO_AUTH === 'true'

  if (isDev && !enforceAuth && !accessRequired) {
    return true
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
  return accessRequired && !isInboxRoute
    ? isCfAuthorized
    : isCfAuthorized || isSecretKeyAuthorized || isPayloadTokenValid
}
