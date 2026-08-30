import React from 'react'
import Link from 'next/link'

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <span className="footer-copyright">
          © 2027 张锦鹏 (Jaxson) · 深圳 · 全栈与 AI 应用开发
        </span>
        <div className="footer-links">
          <Link href="/ai" className="footer-link-ai">AI 岗位匹配分身</Link>
          <a href="https://github.com/Jaxson-zip" target="_blank" rel="noreferrer">GitHub</a>
          <a href="mailto:1822103245@qq.com">邮箱联系</a>
        </div>
      </div>
    </footer>
  )
}
