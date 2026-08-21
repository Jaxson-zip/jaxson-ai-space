import type { Metadata } from 'next'
import React from 'react'

import { Footer } from '@/components/public-site/footer'
import { Header } from '@/components/public-site/header'

import './styles.css'

export const metadata: Metadata = {
  title: {
    default: '张锦鹏｜AI 应用开发 / 全栈开发',
    template: '%s｜张锦鹏',
  },
  description: '张锦鹏的中文求职作品集，记录 AI 应用与全栈开发实践、实习经历、项目案例和竞赛经历。',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <a className="skip-link" href="#main-content">
          跳到主要内容
        </a>
        <Header />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
