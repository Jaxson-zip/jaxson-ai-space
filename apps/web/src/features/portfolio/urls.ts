// space.jaxson.bond no longer serves TLS; CMS records that still name it get the live site instead.
const RETIRED_HOSTS = new Set(['space.jaxson.bond'])

export function safeExternalUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  try {
    const url = new URL(value.trim())
    if (RETIRED_HOSTS.has(url.hostname)) return new URL(`${url.pathname}${url.search}${url.hash}`, 'https://jaxson.bond').href
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : ''
  } catch {
    return ''
  }
}
