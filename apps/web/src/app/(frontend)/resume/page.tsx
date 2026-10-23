import { portfolioLink, resumePdf } from '@/components/public-site/links'

const contents = [
  ['求职方向', 'AI 应用与全栈开发，深圳可线下到岗'],
  ['项目', 'Jaxson AI Space、待办备忘等上线项目的难题、做法与结果'],
  ['实习', '广东润喵云科技，开发实习生'],
  ['教育与竞赛', '深圳职业技术大学 大数据技术专业，技能竞赛奖项'],
  ['技能', 'AI 应用开发、前端、后端与数据、工程交付'],
]

export default function ResumePage() {
  return (
    <div className="jx-page jx-resume">
      <div className="jx-wrap jx-resume-grid">
        <section className="jx-panel jx-resume-card">
          <p className="jx-badge">张锦鹏 · AI 应用与全栈开发</p>
          <h1>简历，<em>直接下载。</em></h1>
          <p className="jx-lead">两页 A4 PDF，包含求职方向、项目、实习、教育与技能。</p>
          <a className="jx-btn jx-btn-primary" href={resumePdf} download="张锦鹏_简历.pdf">下载 PDF 简历</a>
          <p className="jx-resume-note">
            这份简历是 2026 年 8 月的版本，部分项目还没有更新。
            <a href={portfolioLink('#works')}>查看最新作品</a>
          </p>
        </section>
        <aside className="jx-panel jx-resume-contents" aria-labelledby="resume-contents">
          <h2 id="resume-contents">简历里有什么</h2>
          <ol>
            {contents.map(([title, detail]) => (
              <li key={title}><b>{title}</b><span>{detail}</span></li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  )
}
