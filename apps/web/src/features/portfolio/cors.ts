// The portfolio (jaxson.bond) reads a few public API routes from the browser. Only that origin, plus the
// local test server, may read them; no credentials are ever allowed.
function allowedOrigins() {
  const portfolio = process.env.NEXT_PUBLIC_PORTFOLIO_URL
  return new Set([
    portfolio ? new URL(portfolio).origin : '',
    'http://localhost:4174',
    'http://127.0.0.1:4174',
  ])
}

/** Adds the CORS headers for an allowed origin to `headers`, and returns it. */
export function allowPortfolioOrigin(headers: Headers, origin: string | null): Headers {
  if (origin && allowedOrigins().has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.append('Vary', 'Origin')
  }
  return headers
}

/** The answer to a preflight request for `methods`. */
export function portfolioPreflight(request: Request, methods: string): Response {
  const headers = allowPortfolioOrigin(new Headers({ 'Cache-Control': 'no-store' }), request.headers.get('origin'))
  headers.set('Access-Control-Allow-Methods', methods)
  headers.set('Access-Control-Allow-Headers', 'Content-Type')
  headers.set('Access-Control-Max-Age', '600')
  return new Response(null, { status: 204, headers })
}
