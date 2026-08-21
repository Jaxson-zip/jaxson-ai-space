'use client'

import { GitFork, Menu, MessageCircle, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { profile } from '@/features/portfolio/content'

const navigation = [
  { href: '/#about', label: '关于' },
  { href: '/#experience', label: '经历' },
  { href: '/#projects', label: '项目' },
  { href: '/#awards', label: '奖项' },
  { href: '/#contact', label: '联系' },
]

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" onClick={closeMenu}>
          <strong>{profile.name}</strong>
          <span>AI / FULL-STACK</span>
        </Link>

        <nav className="desktop-navigation" aria-label="主要导航">
          {navigation.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="desktop-actions">
          <a href={profile.github} rel="noreferrer" target="_blank">
            <GitFork aria-hidden="true" size={17} />
            GitHub
          </a>
          <Link href="/resume">简历</Link>
          <Link className="header-ai-link" href="/ai">
            <MessageCircle aria-hidden="true" size={17} />
            和我的 AI 分身聊聊
          </Link>
        </div>

        <button
          className="menu-button"
          type="button"
          aria-controls="mobile-navigation"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? '关闭导航菜单' : '打开导航菜单'}
          onClick={() => setMenuOpen((current) => !current)}
        >
          {menuOpen ? <X aria-hidden="true" size={22} /> : <Menu aria-hidden="true" size={22} />}
        </button>
      </div>

      <nav
        className="mobile-navigation"
        id="mobile-navigation"
        aria-label="移动端导航"
        hidden={!menuOpen}
      >
        <div className="shell mobile-navigation-inner">
          {navigation.map((item) => (
            <Link href={item.href} key={item.href} onClick={closeMenu}>
              {item.label}
            </Link>
          ))}
          <a href={profile.github} rel="noreferrer" target="_blank" onClick={closeMenu}>
            GitHub
          </a>
          <Link href="/resume" onClick={closeMenu}>
            在线简历
          </Link>
          <Link className="header-ai-link" href="/ai" onClick={closeMenu}>
            <MessageCircle aria-hidden="true" size={17} />
            和我的 AI 分身聊聊
          </Link>
        </div>
      </nav>
    </header>
  )
}
