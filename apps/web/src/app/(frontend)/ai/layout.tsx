import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: '问我的 AI 分身',
  description: '根据张锦鹏的公开履历与项目资料，了解项目细节、实习经历与岗位方向。',
}

export default function AIPageLayout({ children }: { children: ReactNode }) {
  return children
}
