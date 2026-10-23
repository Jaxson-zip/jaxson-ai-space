import Link from 'next/link'
import { portfolioLink } from '@/components/public-site/links'

export default function NotFound() {
  return (
    <div className="jx-page jx-404">
      <div className="jx-wrap">
        <section className="jx-panel jx-404-card">
          <p className="jx-badge">404</p>
          <h1>页面未找到</h1>
          <p className="jx-muted">这个地址不存在，可能已经移动，或者是不公开的页面。</p>
          <div className="jx-actions">
            <a className="jx-btn jx-btn-primary" href={portfolioLink()}>回到作品集</a>
            <Link className="jx-btn" href="/ai">问我的 AI</Link>
          </div>
        </section>
      </div>
    </div>
  )
}
