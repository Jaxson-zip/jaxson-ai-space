'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { portfolioLink, resumePdf } from './links'

/** The home page's header, so moving between jaxson.bond and these pages feels like one site. */
export function SiteHeader() {
  const pathname = usePathname()
  return (
    <header className="jx-header">
      <div className="jx-wrap">
        <a className="jx-brand" href={portfolioLink()}>张锦鹏 Jaxson</a>
        <nav className="jx-nav" aria-label="主导航">
          <a className="jx-section" href={portfolioLink('#works')}>作品</a>
          <a className="jx-section" href={portfolioLink('#bio')}>履历</a>
          <a className="jx-section" href={portfolioLink('#beyond')}>联系</a>
          <a href={resumePdf} download="张锦鹏_简历.pdf">简历 PDF</a>
          <Link className="jx-btn jx-btn-primary" href="/ai" aria-current={pathname === '/ai' ? 'page' : undefined}>问我的 AI</Link>
        </nav>
      </div>
    </header>
  )
}
