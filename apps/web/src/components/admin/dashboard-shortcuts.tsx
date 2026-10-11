import Link from 'next/link'

export default function DashboardShortcuts() {
  return (
    <section className="jaxson-dashboard-start" aria-labelledby="jaxson-dashboard-title">
      <div>
        <p className="jaxson-dashboard-start__eyebrow">内容管理 / CONTENT</p>
        <h1 id="jaxson-dashboard-title">从这里新增内容</h1>
        <p>项目经历和作品都在「作品与项目经历」中管理。保存并设为公开后，会出现在作品站。</p>
      </div>
      <div className="jaxson-dashboard-start__actions">
        <Link className="jaxson-dashboard-start__primary" href="/admin/collections/projects/create">
          新增项目经历 <span aria-hidden="true">↗</span>
        </Link>
        <Link href="/admin/collections/projects">查看全部项目</Link>
        <Link href="/admin/collections/ai-knowledge/create">新增 AI 知识</Link>
      </div>
    </section>
  )
}
