import type { Metadata } from 'next'
import React from 'react'

import { SiteFooter } from '@/components/public-site/site-footer'
import { SiteHeader } from '@/components/public-site/site-header'

import './styles.css'
import './site.css'

export const metadata: Metadata = {
  title: {
    default: '张锦鹏 Jaxson · AI 应用开发电子简历',
    template: '%s · 张锦鹏 Jaxson',
  },
  description:
    '张锦鹏的个人电子简历与 AI 分身。2027 届，AI 应用开发为主，全栈开发为辅；通过公开经历和项目回答招聘问题，展示真实个人贡献与 AI 协作开发过程。',
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
    'Jaxson AI Space',
    '润喵云',
  ],
  authors: [{ name: '张锦鹏 (Jaxson)', url: 'https://github.com/Jaxson-zip' }],
  creator: '张锦鹏 (Jaxson)',
  openGraph: {
    title: '张锦鹏 Jaxson · AI 应用开发电子简历',
    description:
      '直接向张锦鹏的 AI 分身提问，了解 AI 应用开发方向、真实经历与持续迭代中的项目，回答附公开资料来源。',
    type: 'website',
    locale: 'zh_CN',
    siteName: '张锦鹏 Jaxson',
  },
  twitter: {
    card: 'summary_large_image',
    title: '张锦鹏 Jaxson · AI 应用开发电子简历',
    description: '2027 届，AI 应用开发为主，全栈开发为辅。通过 AI 分身了解我的经历、项目与个人贡献。',
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <a className="skip-link" href="#main-content">
          跳到主要内容
        </a>
        <SiteHeader />
        <main id="main-content">{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
