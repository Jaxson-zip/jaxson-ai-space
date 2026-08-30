import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ExternalLink, Code, Bot } from 'lucide-react'
import { GithubIcon } from './icons'
import type { Project } from '@/features/portfolio/types'

interface ProjectListProps {
  projects: readonly Project[]
}

export function ProjectList({ projects }: ProjectListProps) {
  return (
    <div className="projects-grid">
      {projects.map((project) => {
        const isDemo = project.status.includes('Demo')
        const isOpenSource = project.status.includes('开源')

        const statusClass = isDemo
          ? 'status-demo'
          : isOpenSource
            ? 'status-opensource'
            : 'status-private'

        return (
          <article className="project-card" key={project.slug}>
            <div className="project-preview">
              {project.image ? (
                <Image
                  src={project.image}
                  alt={`${project.title} 界面截图`}
                  width={600}
                  height={340}
                  className="project-image"
                />
              ) : (
                <div className="project-placeholder">
                  {project.slug.includes('agent') ? (
                    <Bot size={36} color="var(--accent-cyan)" />
                  ) : (
                    <Code size={36} color="var(--accent-violet)" />
                  )}
                  <span>{project.category} · 架构概念</span>
                </div>
              )}
            </div>

            <div className="project-content">
              <div className="project-meta">
                <span className="project-category">{project.category}</span>
                <span className={`project-status ${statusClass}`}>{project.status}</span>
              </div>

              <h3 className="project-title">{project.title}</h3>
              <p className="project-summary">{project.summary}</p>

              <div className="project-tags">
                {project.technologies.map((tech) => (
                  <span className="tech-tag" key={tech}>
                    {tech}
                  </span>
                ))}
              </div>

              <div className="project-footer">
                <Link
                  href={`/projects/${project.slug}`}
                  className="project-link-primary"
                >
                  <span>查看案例详情</span>
                  <ArrowRight size={16} />
                </Link>

                <div className="project-links-ext">
                  {project.links.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="link-icon"
                      title={link.label}
                    >
                      {link.kind === 'source' ? (
                        <GithubIcon size={18} />
                      ) : (
                        <ExternalLink size={18} />
                      )}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
