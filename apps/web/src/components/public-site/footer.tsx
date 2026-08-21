import { ArrowUpRight, GitFork } from 'lucide-react'
import Link from 'next/link'

import { profile } from '@/features/portfolio/content'

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <div className="footer-identity">
          <strong>{profile.name}</strong>
          <span>深圳 Shenzhen · 2027 届 · 可接受线下机会</span>
        </div>
        <div className="footer-links">
          <a href={`mailto:${profile.email}`}>{profile.email}</a>
          <a href={profile.github} rel="noreferrer" target="_blank">
            <GitFork aria-hidden="true" size={16} />
            GitHub
          </a>
          <Link href="/resume">
            在线简历
            <ArrowUpRight aria-hidden="true" size={16} />
          </Link>
        </div>
      </div>
    </footer>
  )
}
