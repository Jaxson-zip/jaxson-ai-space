import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isPrivateRequestAuthorized } from '@/features/studio/private-access'

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
  let decoded = pathname
  try { decoded = decodeURIComponent(pathname) } catch { /* Malformed paths cannot match a legacy filename. */ }
  if (decoded === '/resume/zhang-jinpeng-resume.docx' || decoded === '/assets/张锦鹏-秋招简历.docx') {
    const response = NextResponse.redirect(new URL('/resume/zhang-jinpeng-ai-product-builder.pdf', request.url), 307)
    response.headers.set('Cache-Control', 'no-store')
    return response
  }
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

  // 3. If unauthorized, strictly disguise as 404 NOT FOUND
  if (!(await isPrivateRequestAuthorized(request))) {
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
  matcher: ['/admin/:path*', '/studio/:path*', '/api/:path*', '/resume/:path*', '/assets/:path*'],
}
