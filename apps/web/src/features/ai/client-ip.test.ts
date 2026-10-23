import { describe, expect, it } from 'vitest'
import { clientIpFrom } from './client-ip'

describe('chat rate-limit client identity', () => {
  it('uses the address resolved by the edge proxy, not a caller-supplied forwarding chain', () => {
    // Caddy resolves the visitor from trusted Cloudflare hops and sets X-Real-IP.
    // The first X-Forwarded-For entry is whatever the caller sent.
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.9, 198.51.100.7, 172.70.1.1',
      'x-real-ip': '198.51.100.7',
    })
    expect(clientIpFrom(headers)).toBe('198.51.100.7')
  })

  it('ignores identity headers the edge proxy is configured to remove', () => {
    const headers = new Headers({ 'cf-connecting-ip': '203.0.113.9', forwarded: 'for=203.0.113.10', 'x-real-ip': '198.51.100.7' })
    expect(clientIpFrom(headers)).toBe('198.51.100.7')
  })

  it('falls back to the nearest forwarding hop when no proxy identity is present', () => {
    expect(clientIpFrom(new Headers({ 'x-forwarded-for': '203.0.113.9, 198.51.100.7' }))).toBe('198.51.100.7')
    expect(clientIpFrom(new Headers())).toBe('127.0.0.1')
  })
})
