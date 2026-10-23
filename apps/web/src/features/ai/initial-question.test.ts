import { describe, expect, it } from 'vitest'
import { initialQuestion } from './initial-question'

describe('question passed from the portfolio', () => {
  it('reads the trimmed q parameter', () => {
    expect(initialQuestion('?q=%20你会哪些技术？%20&from=https%3A%2F%2Fjaxson.bond%2F')).toBe('你会哪些技术？')
  })

  it('is empty when there is no question', () => {
    expect(initialQuestion('')).toBe('')
    expect(initialQuestion('?from=https%3A%2F%2Fjaxson.bond%2F')).toBe('')
    expect(initialQuestion('?q=%20%20')).toBe('')
  })

  it('caps the length to what the home page form allows', () => {
    expect(initialQuestion(`?q=${'问'.repeat(500)}`)).toHaveLength(200)
  })
})
