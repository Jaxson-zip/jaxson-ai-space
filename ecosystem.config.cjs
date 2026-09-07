const path = require('path')
const fs = require('fs')

function loadEnvFile(envPath) {
  const env = {}
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=')
        if (idx > 0) {
          const key = trimmed.slice(0, idx).trim()
          let val = trimmed.slice(idx + 1).trim()
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1)
          }
          env[key] = val
        }
      }
    }
  }
  return env
}

const loadedEnv = loadEnvFile(path.join(__dirname, '.env'))

module.exports = {
  apps: [
    {
      name: 'jaxson-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 0.0.0.0 -p 3000',
      cwd: path.join(__dirname, 'apps/web'),
      instances: 1,
      autorestart: true,
      max_memory_restart: '1200M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
        ...loadedEnv,
      },
    },
    {
      name: 'jaxson-worker',
      script: 'scripts/run-index-worker.mjs',
      cwd: path.join(__dirname, 'apps/web'),
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        ...loadedEnv,
      },
    },
  ],
}
