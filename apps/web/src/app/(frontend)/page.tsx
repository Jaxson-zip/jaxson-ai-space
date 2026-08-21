import {
  ArrowDownRight,
  ArrowRight,
  Download,
  FileText,
  GitFork,
  Mail,
  MessageCircle,
  Phone,
} from 'lucide-react'
import Link from 'next/link'

import { ProjectList } from '@/components/public-site/project-list'
import { Reveal } from '@/components/public-site/reveal'
import { awards, experiences, profile, projects, skillGroups } from '@/features/portfolio/content'

const internships = experiences.filter((experience) => experience.kind === 'internship')
const education = experiences.filter((experience) => experience.kind === 'education')

export default function HomePage() {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="shell hero-inner">
          <p className="hero-kicker">深圳 · 2027届 · 可线下</p>
          <h1 className="hero-name" id="hero-title">
            {profile.name}
          </h1>
          <p className="hero-role">{profile.title}</p>
          <p className="hero-summary">{profile.summary}</p>
          <div className="hero-actions" aria-label="首页主要操作">
            <Link className="button button-accent" href="#projects">
              浏览项目
              <ArrowDownRight aria-hidden="true" size={18} />
            </Link>
            <Link className="button button-ghost" href="/resume">
              在线简历
              <FileText aria-hidden="true" size={18} />
            </Link>
            <Link className="button button-ghost" href="/ai">
              和我的 AI 分身聊聊
              <MessageCircle aria-hidden="true" size={18} />
            </Link>
          </div>
        </div>
      </section>

      <section className="evidence-band" aria-label="经历概览">
        <div className="shell evidence-grid">
          <div className="evidence-item">
            <span>实习</span>
            <strong>已完成 Vue + Go 开发实习</strong>
          </div>
          <div className="evidence-item">
            <span>案例</span>
            <strong>3 个公开案例说明</strong>
          </div>
          <div className="evidence-item">
            <span>竞赛</span>
            <strong>国家级5项 / 省市级6项</strong>
          </div>
        </div>
      </section>

      <section className="section section-light" id="about" aria-labelledby="about-title">
        <Reveal className="shell">
          <div className="section-heading">
            <p className="section-index">01 / 关于我</p>
            <h2 id="about-title">把想法做成可以验证的产品。</h2>
          </div>
          <div className="about-grid">
            <div>
              <p className="about-lead">
                当前把 AI
                应用原型与全栈交付作为主线，关注功能是否真正可用，也关注从界面、接口到部署的完整路径。
              </p>
              <p className="body-copy">
                我更习惯先厘清问题和边界，再用小步迭代做出可运行版本；遇到联调或运行异常时，会结合前后端现象定位问题，并把验证结果带回下一轮实现。
              </p>
            </div>
            <ol className="working-list" aria-label="工作方式">
              <li>
                <span>01</span>
                <strong>先对齐问题</strong>
                <p>明确目标、约束和可验证结果。</p>
              </li>
              <li>
                <span>02</span>
                <strong>做出运行版本</strong>
                <p>用原型和真实链路尽早验证判断。</p>
              </li>
              <li>
                <span>03</span>
                <strong>跟进到收口</strong>
                <p>联调、定位、修复，再检查最终状态。</p>
              </li>
            </ol>
          </div>
        </Reveal>
      </section>

      <section className="section section-dark" id="experience" aria-labelledby="experience-title">
        <Reveal className="shell">
          <div className="section-heading section-heading-dark">
            <p className="section-index">02 / 经历</p>
            <h2 id="experience-title">学习与实践，各自有据。</h2>
          </div>
          <div className="experience-columns">
            <div>
              <h3 className="group-title">实习经历</h3>
              <div className="experience-list">
                {internships.map((experience) => (
                  <article className="experience-item" key={experience.id}>
                    <div className="experience-meta">
                      <span>实习</span>
                      <time>{experience.period}</time>
                    </div>
                    <h4>{experience.organization}</h4>
                    <p className="experience-role">{experience.role}</p>
                    <p>{experience.summary}</p>
                    {experience.bullets.length > 0 && (
                      <ul>
                        {experience.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    )}
                    {experience.technologies.length > 0 && (
                      <p className="technology-line">{experience.technologies.join(' · ')}</p>
                    )}
                  </article>
                ))}
              </div>
            </div>
            <div>
              <h3 className="group-title">教育经历</h3>
              <div className="experience-list">
                {education.map((experience) => (
                  <article className="experience-item" key={experience.id}>
                    <div className="experience-meta">
                      <span>教育</span>
                      <time>{experience.period}</time>
                    </div>
                    <h4>{experience.organization}</h4>
                    <p className="experience-role">{experience.role}</p>
                    <p>{experience.summary}</p>
                    {experience.bullets.map((bullet) => (
                      <p className="education-note" key={bullet}>
                        {bullet}
                      </p>
                    ))}
                    <p className="technology-line">{experience.technologies.join(' · ')}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="section section-light" id="projects" aria-labelledby="projects-title">
        <Reveal className="shell">
          <div className="section-heading section-heading-split">
            <div>
              <p className="section-index">03 / 项目</p>
              <h2 id="projects-title">用案例说明做过什么。</h2>
            </div>
            <p>
              三个处于不同阶段的公开案例说明。展示真实状态、过程与限制，不把原型包装成成熟产品。
            </p>
          </div>
          <ProjectList projects={projects} />
        </Reveal>
      </section>

      <section className="section section-dark" id="awards" aria-labelledby="awards-title">
        <Reveal className="shell">
          <div className="section-heading section-heading-dark section-heading-split">
            <div>
              <p className="section-index">04 / 奖项与技能</p>
              <h2 id="awards-title">竞赛积累，落实到开发能力。</h2>
            </div>
            <p>以下展示 5 项代表性奖项，以及目前用于项目实践的能力组合。</p>
          </div>
          <div className="credentials-grid">
            <div>
              <h3 className="group-title">代表性奖项</h3>
              <ol className="award-list">
                {awards.map((award) => (
                  <li key={award.id}>
                    <time>{award.period}</time>
                    <strong>{award.title}</strong>
                    <span>{award.level}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className="group-title">技能组合</h3>
              <div className="skill-list">
                {skillGroups.map((group) => (
                  <div className="skill-group" key={group.id}>
                    <h4>{group.title}</h4>
                    <p>{group.items.join(' / ')}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="section section-contact" id="contact" aria-labelledby="contact-title">
        <Reveal className="shell contact-layout">
          <div>
            <p className="section-index">05 / 联系</p>
            <h2 id="contact-title">正在寻找深圳的开发机会。</h2>
            <p className="contact-copy">2027 届，可接受线下面试与实习沟通。</p>
          </div>
          <div className="contact-links">
            <a href={`mailto:${profile.email}`}>
              <Mail aria-hidden="true" size={20} />
              <span>
                邮箱
                <strong>{profile.email}</strong>
              </span>
              <ArrowRight aria-hidden="true" size={20} />
            </a>
            <a href={`tel:${profile.phone}`}>
              <Phone aria-hidden="true" size={20} />
              <span>
                电话
                <strong>{profile.phone}</strong>
              </span>
              <ArrowRight aria-hidden="true" size={20} />
            </a>
            <a href={profile.github} rel="noreferrer" target="_blank">
              <GitFork aria-hidden="true" size={20} />
              <span>
                GitHub
                <strong>Jaxson-zip</strong>
              </span>
              <ArrowRight aria-hidden="true" size={20} />
            </a>
            <a href="/resume/zhang-jinpeng-resume.docx" download>
              <Download aria-hidden="true" size={20} />
              <span>
                简历
                <strong>下载 Word 简历</strong>
              </span>
              <ArrowRight aria-hidden="true" size={20} />
            </a>
          </div>
        </Reveal>
      </section>
    </>
  )
}
