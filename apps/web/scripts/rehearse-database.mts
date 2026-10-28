import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'
import { PgDialect } from 'drizzle-orm/pg-core'
import { migrations } from '../src/migrations/index'

// This tool only accepts a fresh loopback database with a rehearsal-only name.
// It never reads DATABASE_URI or the owner's Payload configuration.
const uri = process.env.REHEARSAL_DATABASE_URI
const target = uri ? new URL(uri) : undefined
if (process.env.RELEASE_REHEARSAL !== 'true' || !target ||
  !['postgres:', 'postgresql:'].includes(target.protocol) ||
  !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) ||
  !/^\/jaxson_rehearsal_[a-z0-9_]+$/.test(target.pathname) || target.search) {
  throw new Error('Use RELEASE_REHEARSAL=true and a loopback REHEARSAL_DATABASE_URI named jaxson_rehearsal_*')
}
const mode = process.argv[2]
if (!['prepare', 'verify'].includes(mode || '')) throw new Error('Expected prepare or verify')
const pool = new pg.Pool({ connectionString: uri, connectionTimeoutMillis: 5000, statement_timeout: 15000 })
const client = await pool.connect()
const dialect = new PgDialect()
// Run the repository's real migration SQL against PostgreSQL, not a schema mock.
const args = { db: { execute: async (query: Parameters<PgDialect['sqlToQuery']>[0]) => {
  const compiled = dialect.sqlToQuery(query)
  return client.query(compiled.sql, compiled.params)
} } } as unknown as Parameters<(typeof migrations)[number]['up']>[0]
const update = migrations.at(-1)!
assert.equal(update.name, '20261028_000000_security_update')

async function checkState(updated: boolean) {
  const columns = await client.query(`SELECT column_name FROM information_schema.columns
    WHERE table_schema='owner' AND table_name='users' AND column_name='reset_password_requested_at'`)
  assert.equal(columns.rowCount, updated ? 1 : 0)
  const defaults = await client.query(`SELECT column_default FROM information_schema.columns
    WHERE table_schema='owner' AND table_name='projects' AND column_name='visibility'`)
  assert.match(defaults.rows[0].column_default, updated ? /'private'/ : /'public'/)
  const records = await client.query(`SELECT slug,visibility FROM owner.projects ORDER BY slug`)
  assert.deepEqual(records.rows, [
    { slug: 'private-fixture', visibility: 'private' },
    { slug: 'todo-memo', visibility: 'public' },
  ])
  assert.equal((await client.query('SELECT count(*)::int AS count FROM owner.users')).rows[0].count, 1)
}

try {
  if (mode === 'prepare') {
    const existing = await client.query(`SELECT 1 FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog','information_schema') LIMIT 1`)
    assert.equal(existing.rowCount, 0, 'Refusing a nonempty rehearsal database')
    await client.query('BEGIN')
    try {
      await client.query('CREATE SCHEMA owner')
      for (const migration of migrations.slice(0, -1)) {
        await migration.up(args)
        await client.query('INSERT INTO owner.payload_migrations(name,batch) VALUES ($1,1)', [migration.name])
      }
      // Synthetic records prove that both visibility states and accounts survive.
      await client.query(`INSERT INTO owner.projects(title,slug,role,category,visibility,status,summary)
        VALUES ('待办备忘（部署演练）','todo-memo','Test fixture','全栈工程 · 真实交付','public','Test','Synthetic deployment fixture'),
          ('Private rehearsal project','private-fixture','Test fixture','全栈工程 · 真实交付','private','Test','Private synthetic fixture');
        INSERT INTO owner.users(email) VALUES ('rehearsal@example.test');
        UPDATE owner.projects SET problem='Synthetic problem',approach='Synthetic approach',outcome='Synthetic outcome' WHERE slug='todo-memo';
        INSERT INTO owner.projects_tags(_order,_parent_id,id,tag)
          SELECT 1,id,'rehearsal-tag','TypeScript' FROM owner.projects WHERE slug='todo-memo';
        INSERT INTO owner.media(alt,filename,mime_type,filesize,width,height)
          VALUES ('Public fixture','public-fixture.png','image/png',68,1,1),
            ('Private fixture','private-fixture.png','image/png',68,1,1);
        UPDATE owner.projects SET cover_image_id=(SELECT id FROM owner.media WHERE filename='public-fixture.png') WHERE slug='todo-memo';
        UPDATE owner.projects SET cover_image_id=(SELECT id FROM owner.media WHERE filename='private-fixture.png') WHERE slug='private-fixture'`)
      await checkState(false)
      await update.up(args)
      await checkState(true)
      await update.down(args)
      await checkState(false)
      await update.up(args)
      await checkState(true)
      await client.query('INSERT INTO owner.payload_migrations(name,batch) VALUES ($1,2)', [update.name])
      await client.query(`CREATE ROLE owner_app LOGIN PASSWORD 'synthetic-rehearsal-owner';
        CREATE ROLE public_agent LOGIN PASSWORD 'synthetic-rehearsal-reader';
        GRANT ALL ON SCHEMA owner TO owner_app; GRANT ALL ON ALL TABLES IN SCHEMA owner TO owner_app;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA owner TO owner_app`)
      const indexSql = await readFile(new URL('../../../docker/migrations/002-public-index.sql', import.meta.url), 'utf8')
      // Its BEGIN/COMMIT are removed so the complete rehearsal setup is atomic.
      await client.query(indexSql.replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, ''))
      await client.query(`GRANT ALL ON SCHEMA public_read TO owner_app;
        REVOKE ALL ON SCHEMA owner FROM public_agent;
        GRANT USAGE ON SCHEMA public_read,public TO public_agent`)
      await client.query('COMMIT')
    } catch (error) { await client.query('ROLLBACK'); throw error }
    console.log('PostgreSQL migration up, down and reapply passed; existing records preserved')
    if (process.env.REHEARSAL_MEDIA_DIR) {
      const mediaDir = path.resolve(process.env.REHEARSAL_MEDIA_DIR)
      assert.equal(path.basename(mediaDir), 'rehearsal-media', 'Use a separate rehearsal-media fixture directory')
      await mkdir(mediaDir, { recursive: true })
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5XcAAAAASUVORK5CYII=', 'base64')
      for (const name of ['public-fixture.png', 'private-fixture.png']) await writeFile(path.join(mediaDir, name), png, { flag: 'wx' })
    }
  }
  await checkState(true)
  const history = await client.query('SELECT name FROM owner.payload_migrations ORDER BY id')
  assert.deepEqual(history.rows.map(row => row.name), migrations.map(migration => migration.name))
  assert.equal((await client.query("SELECT has_table_privilege('public_agent','owner.memories','SELECT') AS allowed")).rows[0].allowed, false)
  assert.equal((await client.query("SELECT has_table_privilege('public_agent','public_read.knowledge_embeddings','SELECT') AS allowed")).rows[0].allowed, true)
  console.log('Rehearsal schema, migration history and private-table denial verified')
} finally { client.release(); await pool.end() }
