import type { ReflectionInput } from './memory-extractor'

/**
 * Parses informal WeChat natural language into a structured ReflectionInput.
 */
export function parseRawMessageToReflection(rawMessage: string): ReflectionInput {
  // Strip common command prefixes like "fp", "复盘：", "复盘:", "总结", etc.
  let cleaned = rawMessage
    .replace(/^(fp|复盘|总结|心得|学习|记录|log)[\s:：,，]+/i, '')
    .trim()

  if (!cleaned) {
    cleaned = rawMessage.trim()
  }

  const today = new Date().toISOString().slice(0, 10)

  // 1. Detect challenges / pitfalls
  let challenges = ''
  const challengeMatch = cleaned.match(/(遇到[了过]|踩坑[在点为]?|难点[在是]?|问题[在是]?|痛点[在是]?)([^，。；\n]+)/i)
  if (challengeMatch) {
    challenges = challengeMatch[0].trim()
  }

  // 2. Detect solutions
  let solution = ''
  const solutionMatch = cleaned.match(/(最后用|通过|采用|使用|解决了|优化了|重构了|搞定了)([^。；\n]+)/i)
  if (solutionMatch) {
    solution = solutionMatch[0].trim()
  }

  // 3. Derive meaningful title
  let title = ''
  if (cleaned.length <= 25) {
    title = cleaned
  } else if (solution) {
    title = solution.length > 20 ? solution.slice(0, 20) + '...' : solution
  } else {
    title = cleaned.slice(0, 22) + '...'
  }

  return {
    title,
    type: challenges || solution ? 'technical' : 'daily',
    date: today,
    content: cleaned,
    challenges: challenges || undefined,
    solution: solution || undefined,
  }
}
