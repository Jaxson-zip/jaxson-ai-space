import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { zh } from '@payloadcms/translations/languages/zh'
import { en } from '@payloadcms/translations/languages/en'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { s3Storage } from '@payloadcms/storage-s3'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { getSmtpOptions } from './features/cms/email-config'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Projects } from './collections/Projects'
import { Experiences } from './collections/Experiences'
import { Credentials } from './collections/Credentials'
import { AIKnowledge } from './collections/AIKnowledge'
import { Reflections } from './collections/Reflections'
import { Memories } from './collections/Memories'
import { migrations } from './migrations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const isPostgres = Boolean(
  process.env.DATABASE_URI &&
    (process.env.DATABASE_URI.startsWith('postgres://') ||
      process.env.DATABASE_URI.startsWith('postgresql://')) &&
    process.env.USE_POSTGRES === 'true'
)

const payloadSecret = process.env.PAYLOAD_SECRET?.trim()
const smtpOptions = getSmtpOptions()
if (process.env.NODE_ENV === 'production' && (!payloadSecret || payloadSecret.length < 32)) {
  throw new Error('PAYLOAD_SECRET must be set to at least 32 characters in production')
}
if (process.env.NODE_ENV === 'production' && process.env.USE_POSTGRES === 'true' && !isPostgres) {
  throw new Error('USE_POSTGRES=true requires a valid PostgreSQL DATABASE_URI')
}

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || undefined,
  ...(smtpOptions ? { email: nodemailerAdapter(smtpOptions) } : {}),
  admin: {
    user: Users.slug,
    theme: 'all',
    components: {
      beforeDashboard: ['/components/admin/dashboard-shortcuts'],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: '- 张锦鹏管理工作台',
    },
  },
  i18n: {
    supportedLanguages: { zh, en },
    fallbackLanguage: 'zh',
  },
  collections: [
    Projects,
    Experiences,
    Credentials,
    AIKnowledge,
    Reflections,
    Memories,
    Media,
    Users,
  ],
  editor: lexicalEditor(),
  secret: payloadSecret || 'jaxson-space-local-development-secret-2026',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: isPostgres
    ? postgresAdapter({
        pool: {
          connectionString: process.env.DATABASE_URI || '',
        },
        schemaName: 'owner',
        prodMigrations: migrations,
      })
    : sqliteAdapter({
        transactionOptions: { behavior: 'immediate' },
        client: {
          url: `file:${process.env.SQLITE_DATABASE_FILE || './payload-local.db'}`,
        },
      }),
  sharp,
  plugins: [
    ...(process.env.S3_BUCKET
      ? [
          s3Storage({
            collections: {
              media: true,
            },
            bucket: process.env.S3_BUCKET,
            config: {
              credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
              },
              region: process.env.S3_REGION || 'auto',
              endpoint: process.env.S3_ENDPOINT,
              forcePathStyle: Boolean(process.env.S3_FORCE_PATH_STYLE === 'true'),
            },
          }),
        ]
      : []),
  ],
})
