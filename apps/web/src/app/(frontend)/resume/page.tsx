import Link from 'next/link'
import './resume.css'

const pdfUrl = '/resume/zhang-jinpeng-ai-product-builder.pdf'
const portfolioUrl = process.env.NEXT_PUBLIC_PORTFOLIO_URL || '/'

export default function ResumePage() {
  return (
    <main className="resume-download">
      <header className="resume-download__top">
        <Link className="resume-download__brand" href={portfolioUrl}>Jaxson<span>.</span></Link>
        <Link href={portfolioUrl}>返回作品集 ↗</Link>
      </header>

      <div className="resume-download__content">
        <p className="resume-download__eyebrow">张锦鹏 / AI PRODUCT BUILDER</p>
        <h1>简历，<br />直接下载<span>。</span></h1>
        <p className="resume-download__description">两页 A4 PDF，包含求职方向、项目、实习、教育与能力经历。</p>
        <a className="resume-download__button" href={pdfUrl} download="张锦鹏_AI Product Builder简历.pdf">
          下载 PDF 简历 <span aria-hidden="true">↓</span>
        </a>
        <p className="resume-download__note">这份简历是 2026 年 8 月版本，部分项目尚未更新。<Link href={`${portfolioUrl}#works`}>查看最新作品 ↗</Link></p>
      </div>
    </main>
  )
}
