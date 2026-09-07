const path = require('path')

module.exports = {
  apps: [
    {
      name: 'jaxson-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: path.join(__dirname, 'apps/web'),
      instances: 1,
      autorestart: true,
      max_memory_restart: '1200M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
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
      },
    },
  ],
}
