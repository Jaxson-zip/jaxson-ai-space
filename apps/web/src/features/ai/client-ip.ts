// Caddy resolves the visitor from trusted Cloudflare hops and sends X-Real-IP;
// it strips CF-Connecting-IP and Forwarded, so callers cannot choose their
// rate-limit identity. Without the proxy, use the nearest forwarding hop: the
// first X-Forwarded-For entry is whatever the caller sent.
export function clientIpFrom(headers: Headers): string {
  const realIp = headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  const nearestHop = headers.get('x-forwarded-for')?.split(',').map((entry) => entry.trim()).filter(Boolean).at(-1)
  return nearestHop || '127.0.0.1'
}
