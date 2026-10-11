// Run with node --env-file=<private-file> scripts/check-deepseek.mjs.
// Report only status and timings; never print keys, provider error bodies or text.
const key = process.env.DEEPSEEK_API_KEY?.trim()
const model = process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-flash'
if (!key) {
  console.error('DEEPSEEK_API_KEY is not configured; no provider request was sent.')
  process.exit(1)
}
try {
  const base = new URL((process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '') + '/')
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
    throw new Error('The model endpoint must be HTTPS without credentials or query parameters')
  }
  const auth = { Authorization: `Bearer ${key}` }
  const models = await fetch(new URL('models', base), {
    headers: auth, redirect: 'error', signal: AbortSignal.timeout(15000),
  })
  if (!models.ok) throw new Error(`Model discovery failed (HTTP ${models.status})`)
  const available = await models.json()
  if (!available.data?.some(entry => entry.id === model)) {
    throw new Error('The selected model is not available for this account')
  }
  const started = performance.now()
  const response = await fetch(new URL('chat/completions', base), {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: '请只回答 OK。' }],
      stream: true, max_tokens: 32, thinking: { type: 'disabled' } }),
    redirect: 'error', signal: AbortSignal.timeout(20000),
  })
  if (!response.ok || !response.body) throw new Error(`Streaming test failed (HTTP ${response.status})`)
  let buffer = '', characters = 0, firstTextMs = null, doneEvent = false
  const decoder = new TextDecoder()
  for await (const bytes of response.body) {
    buffer += decoder.decode(bytes, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      const value = line.trim()
      if (value === 'data: [DONE]') { doneEvent = true; continue }
      if (!value.startsWith('data: ')) continue
      const text = JSON.parse(value.slice(6)).choices?.[0]?.delta?.content || ''
      if (text && firstTextMs === null) firstTextMs = Math.round(performance.now() - started)
      characters += text.length
    }
  }
  if (!characters || !doneEvent) throw new Error('The provider did not finish a valid text stream')
  console.log(JSON.stringify({ provider: 'deepseek', model, status: 'verified',
    firstTextMs, totalMs: Math.round(performance.now() - started), characters }))
} catch (error) {
  // These messages are generated locally. Never log provider response bodies or fetch errors.
  const known = /^(The model endpoint|Model discovery failed|The selected model|Streaming test failed|The provider did not)/
  console.error(known.test(error.message) ? error.message : 'Model connection failed or timed out; no credentials were printed.')
  process.exitCode = 1
}
