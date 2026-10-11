import { describe, expect, it } from 'vitest'
import { safeExternalUrl } from './urls'

describe('published project links', () => {
  it('allows normal web links and rejects executable or malformed destinations', () => {
    expect(safeExternalUrl('https://example.org/demo')).toBe('https://example.org/demo')
    expect(safeExternalUrl('javascript:alert(1)')).toBe('')
    expect(safeExternalUrl('data:text/html,<script>alert(1)</script>')).toBe('')
    expect(safeExternalUrl('/relative-path')).toBe('')
  })
})
