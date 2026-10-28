/** Match an explicit comparison request or a pasted job description, not a factual role question. */
export function isJobMatchRequest(question: string): boolean {
  return /(?:\bjd\b|岗位|职位|招聘).{0,16}(?:匹配|契合|适合|对照|分析)|(?:匹配|契合|适合|对照|分析).{0,24}(?:\bjd\b|岗位|职位|招聘)/i.test(question) ||
    /(?:\bjd\b|岗位职责|任职要求|职位要求|岗位要求|招聘要求)\s*[:：\n]/i.test(question)
}
