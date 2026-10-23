import { describe, expect, it } from 'vitest'
import { safeExternalUrl } from './urls'

describe('published project links', () => {
  it('allows normal web links and rejects executable or malformed destinations', () => {
    expect(safeExternalUrl('https://example.org/demo')).toBe('https://example.org/demo')
    expect(safeExternalUrl('javascript:alert(1)')).toBe('')
    expect(safeExternalUrl('data:text/html,<script>alert(1)</script>')).toBe('')
    expect(safeExternalUrl('/relative-path')).toBe('')
  })

  it('sends links on the retired space.jaxson.bond host to the live site', () => {
    expect(safeExternalUrl('http://space.jaxson.bond/')).toBe('https://jaxson.bond/')
    expect(safeExternalUrl('https://space.jaxson.bond/#works')).toBe('https://jaxson.bond/#works')
  })
})
