import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  async redirects() {
    const portfolioUrl = process.env.NEXT_PUBLIC_PORTFOLIO_URL
    const legacyManageRedirects = [
      {
        source: '/manage/projects',
        destination: '/admin/collections/projects',
        permanent: false,
      },
      {
        source: '/manage/knowledge',
        destination: '/admin/collections/ai-knowledge',
        permanent: false,
      },
    ]
    return portfolioUrl ? [...legacyManageRedirects, {
      source: '/portfolio/jaxson_biaoge_restart.html',
      destination: portfolioUrl,
      permanent: false,
    }] : legacyManageRedirects
  },
  serverExternalPackages: [
    'pino',
    'pino-pretty',
    'sharp',
    'detect-libc',
    'pg',
    'pg-types',
    '@payloadcms/db-postgres',
    '@payloadcms/db-sqlite',
    '@libsql/client',
    'drizzle-orm',
    '@payloadcms/drizzle',
  ],
  agentRules: false,
  images: {
    localPatterns: [
      {
        pathname: '/assets/**',
      },
      {
        pathname: '/projects/**',
      },
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname, '../..'),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
