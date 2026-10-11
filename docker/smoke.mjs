const siteDomain = process.env.SITE_DOMAIN
const apiDomain = process.env.API_DOMAIN

if (!siteDomain || !apiDomain) {
  throw new Error('SITE_DOMAIN and API_DOMAIN are required')
}

const checks = [
  { label: 'public portfolio', url: `https://${siteDomain}/`, contentType: 'text/html' },
  { label: 'resume PDF', url: `https://${siteDomain}/resume/zhang-jinpeng-ai-product-builder.pdf`, contentType: 'application/pdf' },
  { label: 'CMS projects API', url: `https://${apiDomain}/api/showcase-projects`, contentType: 'application/json' },
  { label: 'AI page', url: `https://${apiDomain}/ai`, contentType: 'text/html' },
  { label: 'CMS login', url: `https://${apiDomain}/admin/login`, contentType: 'text/html' },
]

async function check({ label, url, contentType }) {
  let lastError
  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
      const actualType = response.headers.get('content-type') || ''
      if (!response.ok || !actualType.includes(contentType)) {
        throw new Error(`HTTP ${response.status}, content-type ${actualType}`)
      }
      if (label === 'CMS projects API') {
        const data = await response.json()
        if (data.source !== 'cms' || !Array.isArray(data.projects)) {
          throw new Error('CMS API returned an unexpected body')
        }
      }
      console.log(`${label}: OK`)
      return
    } catch (error) {
      lastError = error
      if (attempt < 12) await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }
  throw new Error(`${label} failed at ${url}: ${lastError?.message}`)
}

for (const item of checks) await check(item)
