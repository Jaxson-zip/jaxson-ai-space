import React from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { GithubIcon } from './icons'
import { ThemeToggle } from './theme-toggle'

export function Header() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="logo">
          <span className="logo-title">张锦鹏</span>
          <span className="logo-divider">/</span>
          <span className="logo-desc">全栈与 AI 应用 · 2027 届</span>
        </Link>

        <div className="header-right">
          <nav className="navbar" aria-label="页面导航">
            <Link href="/#about">关于</Link>
            <Link href="/#resume">实践</Link>
            <Link href="/#portfolio">作品</Link>
            <Link href="/#skills">技能</Link>
            <Link href="/#contact">联系</Link>
          </nav>

          <div className="header-actions">
            <Link href="/ai" className="btn-ai-pill">
              <Sparkles size={12} />
              <span>AI 分身</span>
            </Link>
            <ThemeToggle />
            <a
              href="https://github.com/Jaxson-zip"
              target="_blank"
              rel="noreferrer"
              className="github-link-btn"
              aria-label="访问 GitHub"
              title="访问 GitHub 源码主页"
            >
              <GithubIcon size={15} />
            </a>
          </div>
        </div>
      </div>
    </header>
  )
}
