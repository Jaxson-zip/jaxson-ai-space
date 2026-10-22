// The portfolio's ask box hands its question over as ?q=. The AI page prefills it and never sends it by itself,
// so a shared link cannot spend model calls on the visitor's behalf.
export const PORTFOLIO_QUESTION_CHARS = 200

export function initialQuestion(search: string): string {
  return (new URLSearchParams(search).get('q') ?? '').trim().slice(0, PORTFOLIO_QUESTION_CHARS)
}
