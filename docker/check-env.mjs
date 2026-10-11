const required = [
  'SITE_DOMAIN', 'API_DOMAIN', 'POSTGRES_PASSWORD', 'OWNER_APP_PASSWORD',
  'PUBLIC_AGENT_PASSWORD', 'PAYLOAD_SECRET', 'STUDIO_SECRET_KEY',
  'STUDIO_INBOX_SECRET', 'OWNER_EMAIL', 'OWNER_INITIAL_PASSWORD',
]

for (const name of required) {
  const value = process.env[name]?.trim()
  if (!value || /replace|example|dummy|default/i.test(value)) {
    throw new Error(`${name} must be set to a real production value`)
  }
}

const domainPattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i
for (const name of ['SITE_DOMAIN', 'API_DOMAIN']) {
  if (!domainPattern.test(process.env[name])) {
    throw new Error(`${name} must be a hostname without a scheme or port`)
  }
}
if (process.env.SITE_DOMAIN === process.env.API_DOMAIN) {
  throw new Error('SITE_DOMAIN and API_DOMAIN must be different hostnames')
}
if (!/^\S+@\S+\.\S+$/.test(process.env.OWNER_EMAIL)) {
  throw new Error('OWNER_EMAIL must be an email address')
}

for (const name of ['POSTGRES_PASSWORD', 'OWNER_APP_PASSWORD', 'PUBLIC_AGENT_PASSWORD']) {
  if (!/^[A-Za-z0-9_-]{32,}$/.test(process.env[name])) {
    throw new Error(`${name} must be at least 32 URL-safe characters`)
  }
}
for (const name of ['PAYLOAD_SECRET', 'STUDIO_SECRET_KEY', 'STUDIO_INBOX_SECRET', 'OWNER_INITIAL_PASSWORD']) {
  if (process.env[name].length < 32) {
    throw new Error(`${name} must be at least 32 characters`)
  }
}

const secretValues = [
  ...['POSTGRES_PASSWORD', 'OWNER_APP_PASSWORD', 'PUBLIC_AGENT_PASSWORD', 'PAYLOAD_SECRET',
    'STUDIO_SECRET_KEY', 'STUDIO_INBOX_SECRET', 'OWNER_INITIAL_PASSWORD'].map((name) => process.env[name]),
]
if (new Set(secretValues).size !== secretValues.length) {
  throw new Error('Production passwords and secrets must all be different')
}

const accessTeam = process.env.CLOUDFLARE_ACCESS_TEAM_NAME?.trim()
const accessAud = process.env.CLOUDFLARE_ACCESS_AUD?.trim()
if (Boolean(accessTeam) !== Boolean(accessAud)) {
  throw new Error('Set both CLOUDFLARE_ACCESS_TEAM_NAME and CLOUDFLARE_ACCESS_AUD, or neither')
}

const embeddingMode = process.env.EMBEDDING_MODE || 'local'
if (!['local', 'semantic'].includes(embeddingMode)) throw new Error('EMBEDDING_MODE must be local or semantic')
if (embeddingMode === 'semantic') {
  if (!process.env.EMBEDDING_API_KEY?.trim() || /replace|dummy|example/i.test(process.env.EMBEDDING_API_KEY)) {
    throw new Error('Semantic indexing requires a real EMBEDDING_API_KEY')
  }
  const endpoint = new URL(process.env.EMBEDDING_BASE_URL || 'https://api.openai.com/v1')
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error('Production EMBEDDING_BASE_URL must be an HTTPS URL without credentials, query or fragment')
  }
  const timeout = Number(process.env.EMBEDDING_TIMEOUT_MS || 5000)
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 30000) throw new Error('Invalid EMBEDDING_TIMEOUT_MS')
}
if (process.env.SMTP_HOST || process.env.SMTP_FROM_ADDRESS || process.env.SMTP_USER || process.env.SMTP_PASSWORD) {
  if (!process.env.SMTP_HOST || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(process.env.SMTP_FROM_ADDRESS || '')) throw new Error('SMTP requires a host and valid from address')
  if (Boolean(process.env.SMTP_USER) !== Boolean(process.env.SMTP_PASSWORD)) throw new Error('Set both SMTP_USER and SMTP_PASSWORD')
  const port = Number(process.env.SMTP_PORT || 465)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid SMTP_PORT')
  if (process.env.SMTP_SECURE && !['true', 'false'].includes(process.env.SMTP_SECURE)) throw new Error('SMTP_SECURE must be true or false')
}

console.log('Production environment passed validation')
