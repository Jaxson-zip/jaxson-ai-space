import { portfolioLink, resumePdf } from './links'

export function SiteFooter() {
  return (
    <footer className="jx-footer">
      <div className="jx-wrap">
        <span>© 2026 张锦鹏</span>
        <nav aria-label="页脚">
          <a href={portfolioLink()}>作品集</a>
          <a href={resumePdf} download="张锦鹏_简历.pdf">下载 PDF 简历</a>
          <a href="mailto:1822103245@qq.com">发邮件</a>
          <a href="https://github.com/Jaxson-zip" target="_blank" rel="noopener noreferrer">GitHub</a>
        </nav>
      </div>
    </footer>
  )
}
