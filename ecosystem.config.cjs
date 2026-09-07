const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })

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
        DATABASE_URI: process.env.DATABASE_URI || 'postgresql://owner_app:JaxsonOwnerAppSecret2026!@127.0.0.1:5432/jaxson_space',
        PUBLIC_AGENT_DATABASE_URI: process.env.PUBLIC_AGENT_DATABASE_URI || 'postgresql://public_agent:JaxsonPublicAgentSecret2026!@127.0.0.1:5432/jaxson_space',
        USE_POSTGRES: process.env.USE_POSTGRES || 'true',
        PAYLOAD_SECRET: process.env.PAYLOAD_SECRET || 'jaxson-space-payload-secret-key-32-chars-long-2026',
        STUDIO_SECRET_KEY: process.env.STUDIO_SECRET_KEY || 'jaxson-studio-secret-key-2026-super',
        STUDIO_INBOX_SECRET: process.env.STUDIO_INBOX_SECRET || 'jaxson-studio-inbox-secret-2026',
        OWNER_EMAIL: process.env.OWNER_EMAIL || '1822103245@qq.com',
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
        DATABASE_URI: process.env.DATABASE_URI || 'postgresql://owner_app:JaxsonOwnerAppSecret2026!@127.0.0.1:5432/jaxson_space',
        USE_POSTGRES: process.env.USE_POSTGRES || 'true',
      },
    },
  ],
}
