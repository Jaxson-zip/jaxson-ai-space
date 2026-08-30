import Link from 'next/link'
import { ArrowLeft, Download, Mail, Phone, MapPin } from 'lucide-react'
import { GithubIcon } from '@/components/public-site/icons'
import { getHydratedPortfolioData } from '@/features/portfolio/data'

export default async function ResumePage() {
  const { profile, experiences, projects, awards, skillGroups } = await getHydratedPortfolioData()

  const internships = experiences.filter((e) => e.kind === 'internship')
  const campus = experiences.filter((e) => e.kind === 'campus')
  const education = experiences.filter((e) => e.kind === 'education')

  return (
    <main className="subpage-container shell" style={{ maxWidth: '900px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <Link href="/" className="back-link" style={{ marginBottom: 0 }}>
          <ArrowLeft size={16} />
          <span>返回个人主页</span>
        </Link>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <a
            href="/resume/zhang-jinpeng-resume.docx"
            download
            className="btn-primary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            <Download size={15} />
            <span>下载 Word 原件</span>
          </a>
        </div>
      </div>

      {/* Structured Resume Content */}
      <article className="credential-card" style={{ padding: '3rem 2.5rem' }}>
        {/* Header / Bio */}
        <header style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
            {profile.name}
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'var(--accent-cyan)', fontWeight: 600, marginBottom: '1rem' }}>
            {profile.title} · 2027 届求职
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <MapPin size={15} color="var(--accent-cyan)" /> {profile.location} · 可线下到岗
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Phone size={15} color="var(--accent-emerald)" /> {profile.phone}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Mail size={15} color="var(--accent-violet)" /> {profile.email}
            </span>
            <a href={profile.github} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-primary)' }}>
              <GithubIcon size={15} /> Jaxson-zip
            </a>
          </div>
        </header>

        {/* Education */}
        <section style={{ marginBottom: '2.25rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', borderLeft: '3px solid var(--accent-cyan)', paddingLeft: '0.75rem', marginBottom: '1rem' }}>
            教育背景
          </h2>
          {education.map((edu) => (
            <div key={edu.id} style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>{edu.organization} · {edu.role}</span>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{edu.period}</span>
              </div>
              <p style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem', marginTop: '0.2rem' }}>{edu.summary}</p>
              {edu.bullets.map((b) => (
                <p key={b} style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>• {b}</p>
              ))}
            </div>
          ))}
        </section>

        {/* Internship Experience */}
        <section style={{ marginBottom: '2.25rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', borderLeft: '3px solid var(--accent-cyan)', paddingLeft: '0.75rem', marginBottom: '1rem' }}>
            企业实习经历
          </h2>
          {internships.map((exp) => (
            <div key={exp.id} style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>{exp.organization} · {exp.role}</span>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{exp.period}</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.35rem 0' }}>{exp.summary}</p>
              <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                {exp.bullets.map((b) => (
                  <li key={b} style={{ marginBottom: '0.25rem' }}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* Campus & Competition Teams */}
        {campus.length > 0 && (
          <section style={{ marginBottom: '2.25rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', borderLeft: '3px solid var(--accent-cyan)', paddingLeft: '0.75rem', marginBottom: '1rem' }}>
              校园实践与技术沉淀
            </h2>
            {campus.map((exp) => (
              <div key={exp.id} style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>{exp.organization} · {exp.role}</span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{exp.period}</span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.35rem 0' }}>{exp.summary}</p>
                <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  {exp.bullets.map((b) => (
                    <li key={b} style={{ marginBottom: '0.25rem' }}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        {/* Projects */}
        <section style={{ marginBottom: '2.25rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', borderLeft: '3px solid var(--accent-cyan)', paddingLeft: '0.75rem', marginBottom: '1rem' }}>
            精选项目与原型
          </h2>
          {projects.map((p) => (
            <div key={p.slug} style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>{p.title} ({p.category} · {p.status})</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{p.role}</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>{p.summary}</p>
            </div>
          ))}
        </section>

        {/* Awards */}
        <section style={{ marginBottom: '2.25rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', borderLeft: '3px solid var(--accent-cyan)', paddingLeft: '0.75rem', marginBottom: '1rem' }}>
            竞赛荣誉与奖项
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.75rem' }}>
            {awards.map((a) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'var(--text-primary)' }}>{a.title}</span>
                <span style={{ color: '#fbbf24', fontWeight: 600, flexShrink: 0, marginLeft: '0.5rem' }}>{a.level}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Skills */}
        <section>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', borderLeft: '3px solid var(--accent-cyan)', paddingLeft: '0.75rem', marginBottom: '1rem' }}>
            专业技能
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {skillGroups.map((g) => (
              <p key={g.id} style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{g.title}：</strong> {g.items.join(' · ')}
              </p>
            ))}
          </div>
        </section>
      </article>
    </main>
  )
}
