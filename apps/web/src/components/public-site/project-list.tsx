import { ArrowUpRight, ExternalLink, GitFork, LockKeyhole } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import type { Project } from '@/features/portfolio/types'

type ProjectListProps = Readonly<{
  projects: readonly Project[]
}>

function ProjectVisual({ project }: Readonly<{ project: Project }>) {
  if (project.image) {
    return (
      <div className="project-media project-media-image">
        <Image
          alt="Todo Memo 待办与备忘录真实界面"
          className="project-image"
          height={1000}
          sizes="(max-width: 760px) 100vw, 52vw"
          src={project.image}
          width={900}
        />
        <span className="visual-label">真实产品界面</span>
      </div>
    )
  }

  if (project.slug === 'ruili-resume') {
    return (
      <div className="project-media project-placeholder" aria-label="Ruili Resume 界面示意">
        <span className="visual-label">界面示意 · 非产品截图</span>
        <div className="placeholder-canvas ruili-canvas" aria-hidden="true">
          <div className="ruili-sidebar">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="ruili-editor">
            <b>简历编辑</b>
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="ruili-document">
            <b>ZHANG JINPENG</b>
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="project-media project-placeholder opc-placeholder"
      aria-label="OPC Agent Company 流程示意"
    >
      <span className="visual-label">流程示意 · 非产品截图</span>
      <div className="placeholder-canvas opc-canvas" aria-hidden="true">
        <div className="opc-node opc-node-lead">任务入口</div>
        <div className="opc-connector opc-connector-one" />
        <div className="opc-connector opc-connector-two" />
        <div className="opc-node opc-node-left">上下文</div>
        <div className="opc-node opc-node-right">执行过程</div>
        <div className="opc-output">阶段结果 / 可观察</div>
      </div>
    </div>
  )
}

export function ProjectList({ projects }: ProjectListProps) {
  return (
    <div className="project-list">
      {projects.map((project, index) => {
        const visibleLinks = project.links.filter(
          (link) => link.kind !== 'source' || project.sourceVisibility === 'public',
        )

        return (
          <article className="project-row" key={project.slug}>
            <Link className="project-detail-link" href={`/projects/${project.slug}`}>
              <ProjectVisual project={project} />
              <div className="project-content">
                <div className="project-number">0{index + 1}</div>
                <div className="project-heading">
                  <div>
                    <p>{project.category}</p>
                    <h3>{project.title}</h3>
                  </div>
                  <ArrowUpRight aria-hidden="true" size={25} />
                </div>
                <p className="project-summary">{project.summary}</p>
                <dl className="project-facts">
                  <div>
                    <dt>状态</dt>
                    <dd>{project.status}</dd>
                  </div>
                  <div>
                    <dt>角色</dt>
                    <dd>{project.role}</dd>
                  </div>
                </dl>
                <p className="technology-line technology-line-light">
                  {project.technologies.join(' · ')}
                </p>
                {project.sourceVisibility === 'private' && (
                  <p className="private-notice">
                    <LockKeyhole aria-hidden="true" size={16} />
                    私有案例 / 不公开源码
                  </p>
                )}
              </div>
            </Link>

            {visibleLinks.length > 0 && (
              <div className="project-external-links" aria-label={`${project.title} 外部链接`}>
                {visibleLinks.map((link) => (
                  <a href={link.href} key={link.href} rel="noreferrer" target="_blank">
                    {link.kind === 'source' ? (
                      <GitFork aria-hidden="true" size={17} />
                    ) : (
                      <ExternalLink aria-hidden="true" size={17} />
                    )}
                    {link.label}
                    <ArrowUpRight aria-hidden="true" size={15} />
                  </a>
                ))}
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
