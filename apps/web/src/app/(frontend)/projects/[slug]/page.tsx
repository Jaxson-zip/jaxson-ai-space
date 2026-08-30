import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, ExternalLink, ShieldAlert } from 'lucide-react'
import { GithubIcon } from '@/components/public-site/icons'
import { getHydratedPortfolioData } from '@/features/portfolio/data'

interface ProjectPageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateStaticParams() {
  const { projects } = await getHydratedPortfolioData()
  return projects.map((p) => ({
    slug: p.slug,
  }))
}

export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  const { slug } = await params
  const { projects } = await getHydratedPortfolioData()
  const project = projects.find((p) => p.slug === slug)

  if (!project) {
    notFound()
  }

  const isPrivate = project.sourceVisibility === 'private'

  return (
    <main className="subpage-container shell">
      <Link href="/#projects" className="back-link">
        <ArrowLeft size={16} />
        <span>返回首页精选项目</span>
      </Link>

      <div className="detail-header">
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
          <span className="project-category">{project.category}</span>
          <span className={`project-status ${project.status.includes('Demo') ? 'status-demo' : project.status.includes('开源') ? 'status-opensource' : 'status-private'}`}>
            {project.status}
          </span>
        </div>
        <h1 className="detail-title">{project.title}</h1>
        <p className="hero-subtitle">{project.summary}</p>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          {project.image && (
            <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-subtle)', marginBottom: '1rem' }}>
              <Image
                src={project.image}
                alt={`${project.title} 界面截图`}
                width={1200}
                height={675}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>
          )}

          {isPrivate && (
            <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.25)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <ShieldAlert size={20} color="#fbbf24" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#fbbf24', fontSize: '0.95rem' }}>私有探索与架构实验说明</strong>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  本项目属于个人前沿探索与原型试验阶段，源码与架构细节暂不公开；本页面仅展示产品思考、工作流设计与验证成果。
                </p>
              </div>
            </div>
          )}

          <section className="detail-section">
            <h3>🎯 解决的问题与背景</h3>
            <p>{project.problem}</p>
          </section>

          <section className="detail-section">
            <h3>⚙️ 实现路径与技术方案</h3>
            <p>{project.approach}</p>
          </section>

          <section className="detail-section">
            <h3>📊 阶段成果与真实价值</h3>
            <p>{project.outcome}</p>
          </section>
        </div>

        <aside className="detail-sidebar">
          <div className="sidebar-card">
            <h4>个人职责 (Role)</h4>
            <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{project.role}</p>
          </div>

          <div className="sidebar-card">
            <h4>技术栈 (Tech Stack)</h4>
            <div className="project-tags">
              {project.technologies.map((t) => (
                <span className="tech-tag" key={t}>
                  {t}
                </span>
              ))}
            </div>
          </div>

          {project.links.length > 0 && (
            <div className="sidebar-card">
              <h4>项目链接 (Links)</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {project.links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary"
                    style={{ justifyContent: 'center' }}
                  >
                    {link.kind === 'source' ? <GithubIcon size={16} /> : <ExternalLink size={16} />}
                    <span>{link.label}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}
