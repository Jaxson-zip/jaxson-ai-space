'use client'

import { portfolioLink } from '@/components/public-site/links'

export default function ProjectError({ reset }: { reset: () => void }) {
  return <div className="jx-page jx-project"><div className="jx-wrap">
    <section className="jx-panel jx-resume-card" role="alert">
      <h1>项目资料暂时无法加载</h1>
      <p>服务暂时不可用，请稍后重试。</p>
      <div className="project-links">
        <button type="button" className="jx-btn jx-btn-primary" onClick={reset}>重新加载</button>
        <a className="jx-btn" href={portfolioLink('#works')}>返回作品列表</a>
      </div>
    </section>
  </div></div>
}
