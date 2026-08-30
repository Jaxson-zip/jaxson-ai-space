import type { Metadata } from 'next'
import React from 'react'

import { Footer } from '@/components/public-site/footer'
import { Header } from '@/components/public-site/header'

import './styles.css'

export const metadata: Metadata = {
  title: {
    default: '张锦鹏 (Jaxson) · 全栈开发与 AI 应用落地作品集',
    template: '%s · 张锦鹏 (Jaxson)',
  },
  description:
    '张锦鹏的个人工程师作品集与 AI 数字分身。深圳职业技术大学大数据技术专业（GPA 3.67 前 5%），主修 React 19、TypeScript、Vue 3 全栈开发与 RAG 智能应用落地。',
  keywords: [
    '张锦鹏',
    'Jaxson',
    '全栈开发工程师',
    'AI 应用开发',
    'React 19',
    'Next.js 16',
    'Vue 3',
    '深圳职业技术大学',
    'Todo Memo PWA',
    '锐历简历',
    '润喵云',
  ],
  authors: [{ name: '张锦鹏 (Jaxson)', url: 'https://github.com/Jaxson-zip' }],
  creator: '张锦鹏 (Jaxson)',
  openGraph: {
    title: '张锦鹏 (Jaxson) · 全栈开发与 AI 应用作品集',
    description:
      '探索张锦鹏的真实上线项目（Todo Memo PWA、锐历简历）、广东润喵云实习经历与 AI 数字分身岗位智能匹配。',
    type: 'website',
    locale: 'zh_CN',
    siteName: 'Jaxson AI Space',
  },
  twitter: {
    card: 'summary_large_image',
    title: '张锦鹏 (Jaxson) · 全栈开发与 AI 应用作品集',
    description: '深职大大数据技术（GPA 前 5%），国赛二等奖、省赛一等奖，全栈交付与 AI 应用落地。',
  },
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
