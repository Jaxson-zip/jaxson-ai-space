import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { GithubIcon } from '@/components/public-site/icons'
import { portfolioLink } from '@/components/public-site/links'
import { getHydratedPortfolioData } from '@/features/portfolio/data'

interface ProjectPageProps {
  params: Promise<{
    slug: string
  }>
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params
  const { projects } = await getHydratedPortfolioData({ allowStaticFallback: false, projectSlug: slug })
  const project = projects.find((p) => p.slug === slug)
  return project ? { title: project.title, description: project.summary } : { title: '页面未找到' }
}

/** The home page's featured card, at full width: screenshot and story on the left, role, stack and links on the right. */
export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  const { slug } = await params
  const { projects } = await getHydratedPortfolioData({ allowStaticFallback: false, projectSlug: slug })
  const project = projects.find((p) => p.slug === slug)

  if (!project) {
    notFound()
  }

  const isPrivate = project.sourceVisibility === 'private'
  const story = [
    ['要解决的问题', project.problem],
    ['做法', project.approach],
    ['结果', project.outcome],
  ].filter(([, text]) => text)

  return (
    <div className="jx-page jx-project">
      <div className="jx-wrap">
        <a href={portfolioLink('#works')} className="jx-back">
          <ArrowLeft size={16} aria-hidden="true" />
          <span>返回作品列表</span>
        </a>

        <header className="jx-project-head">
          <p className="jx-project-kicker">
            <span className="jx-badge">{project.category}</span>
            <span className="jx-badge">{project.status}</span>
          </p>
          <h1>{project.title}</h1>
          <p className="jx-lead">{project.summary}</p>
        </header>

        <div className="jx-project-grid">
          <article className="jx-panel jx-project-main">
            {project.image && (
              <div className="jx-project-cover">
                <Image src={project.image} unoptimized alt={`${project.title} 界面截图`} width={1440} height={900} priority />
              </div>
            )}
            <div className="jx-project-body">
              {isPrivate && (
                <p className="jx-private">
                  <strong>私有探索项目</strong>
                  源码与架构细节暂不公开，这里只展示产品思考、工作流设计与验证结果。
                </p>
              )}
              {story.map(([title, text]) => (
                <section key={title}>
                  <h2>{title}</h2>
                  <p>{text}</p>
                </section>
              ))}
            </div>
          </article>

          <aside className="jx-panel jx-project-side">
            <dl>
              <dt>角色</dt>
              <dd>{project.role}</dd>
            </dl>
            {project.technologies.length > 0 && (
              <div>
                <h3>技术栈</h3>
                <ul className="jx-tags project-stack">
                  {project.technologies.map((tech) => <li key={tech}>{tech}</li>)}
                </ul>
              </div>
            )}
            {project.links.length > 0 && (
              <div className="project-links">
                {project.links.map((link, index) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={index === 0 ? 'jx-btn jx-btn-primary' : 'jx-btn'}
                  >
                    {link.kind === 'source' ? <GithubIcon size={16} /> : <ExternalLink size={16} aria-hidden="true" />}
                    <span>{link.label}</span>
                  </a>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
