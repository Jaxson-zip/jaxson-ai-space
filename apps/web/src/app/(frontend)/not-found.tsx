import Link from 'next/link'
import { ArrowLeft, Compass } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="not-found-page-root">
      <div className="container not-found-container">
        <div className="not-found-card">
          <div className="not-found-badge">
            <Compass size={16} />
            <span>404 NOT FOUND</span>
          </div>

          <h1 className="not-found-title">页面未找到</h1>
          <p className="not-found-desc">
            抱歉，您访问的页面不存在、已被移动，或者该地址为私有受保护路径。
          </p>

          <div className="not-found-actions">
            <Link href="/" className="btn-not-found-home">
              <ArrowLeft size={16} />
              <span>返回前台主页</span>
            </Link>
            <Link href="/ai" className="btn-not-found-ai">
              <span>与 AI 分身聊聊 ➔</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
