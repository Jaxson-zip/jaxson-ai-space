import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: '独立简历',
  description: '张锦鹏的教育、实习、项目、奖项与技术能力简历。',
}

export default function ResumeLayout({ children }: { children: ReactNode }) {
  return children
}
