export function backendOrigin() {
  const raw = process.env.PORTFOLIO_API_ORIGIN || 'http://localhost:3001'
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('PORTFOLIO_API_ORIGIN must be an HTTP(S) origin without a path or credentials')
  }
  return url.origin
}

export function browserConfig() {
  return `window.JAXSON_BACKEND_ORIGIN = ${JSON.stringify(backendOrigin())};\n`
}
