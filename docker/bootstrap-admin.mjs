const origin = process.env.API_ORIGIN
const email = process.env.OWNER_EMAIL
const password = process.env.OWNER_INITIAL_PASSWORD

if (!origin || !email || !password || password.length < 32) {
  throw new Error('API_ORIGIN, OWNER_EMAIL and a 32+ character OWNER_INITIAL_PASSWORD are required')
}

const body = JSON.stringify({ email, password })
const options = { method: 'POST', headers: { 'content-type': 'application/json' }, body }
const register = await fetch(new URL('/api/users/first-register', origin), options)
if (register.ok) {
  console.log('First CMS administrator created')
  process.exit(0)
}

if (register.status !== 403) {
  throw new Error(`First administrator creation failed with HTTP ${register.status}`)
}

const login = await fetch(new URL('/api/users/login', origin), options)
if (!login.ok) {
  throw new Error('CMS already has an administrator; supplied credentials do not match')
}
console.log('Existing CMS administrator credentials verified')
