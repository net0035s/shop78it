import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { Client } from 'pg'
import { databaseFingerprint } from '../src/lib/launch-readiness'

const MAGIC = Buffer.from('SHOP78BACKUP1')
export type SnapshotManifest = { createdAt: string; sourceFingerprint: string; tables: Record<string, { count: number; digest: string }>; scope: 'public'; dumpSha256: string; privateSchemas?: string[]; requiredRoles?: string[] }

function keyBuffer(secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(secret)) throw new Error('A separate 32-byte backup key is required')
  return Buffer.from(secret, 'hex')
}
export function encryptArchive(dump: Buffer, manifest: SnapshotManifest, secret: string) {
  const header = Buffer.from(JSON.stringify(manifest)), length = Buffer.alloc(4)
  length.writeUInt32BE(header.length)
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', keyBuffer(secret), iv)
  cipher.setAAD(MAGIC)
  const data = Buffer.concat([cipher.update(Buffer.concat([length, header, dump])), cipher.final()])
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), data])
}
export function decryptArchive(archive: Buffer, secret: string) {
  if (!archive.subarray(0, MAGIC.length).equals(MAGIC) || archive.length < MAGIC.length + 32) throw new Error('Invalid backup archive')
  const offset = MAGIC.length, decipher = createDecipheriv('aes-256-gcm', keyBuffer(secret), archive.subarray(offset, offset + 12))
  decipher.setAAD(MAGIC)
  decipher.setAuthTag(archive.subarray(offset + 12, offset + 28))
  const plain = Buffer.concat([decipher.update(archive.subarray(offset + 28)), decipher.final()])
  const size = plain.readUInt32BE(0)
  if (size < 2 || size > plain.length - 4) throw new Error('Invalid backup metadata')
  const manifest = JSON.parse(plain.subarray(4, 4 + size).toString('utf8')) as SnapshotManifest
  const dump = plain.subarray(4 + size)
  if (manifest.scope !== 'public' || createHash('sha256').update(dump).digest('hex') !== manifest.dumpSha256) throw new Error('Backup integrity check failed')
  return { manifest, dump }
}
export function pgEnvironment(value: string): NodeJS.ProcessEnv {
  const url = new URL(value)
  if (!['postgresql:', 'postgres:'].includes(url.protocol)) throw new Error('PostgreSQL URL required')
  return { NODE_ENV: process.env.NODE_ENV || 'production', PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP,
    PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: ['localhost', '127.0.0.1'].includes(url.hostname) ? 'disable' : 'require',
    PGCONNECT_TIMEOUT: '15',
  }
}
export async function runPg(binary: string, args: string[], url: string, input?: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { env: pgEnvironment(url), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    const chunks: Buffer[] = []; let size = 0; let finished = false; let diagnostic = 'unknown'
    const stage = binary.toLowerCase().includes('pg_restore') ? 'restore' : 'dump'
    const timer = setTimeout(() => { child.kill(); fail() }, 180000)
    const fail = () => { if (!finished) { finished = true; clearTimeout(timer); reject(new Error('PostgreSQL ' + stage + ' failed (' + diagnostic + '); secret output withheld')) } }
    child.on('error', fail)
    child.stdout.on('data', chunk => { size += chunk.length; if (size > 512 * 1024 * 1024) { child.kill(); fail() } else chunks.push(chunk) })
    child.stderr.on('data', chunk => {
      const message = chunk.toString()
      if (/schema.*already exists/i.test(message)) diagnostic = 'schema-already-exists'
      else if (/permission denied/i.test(message)) diagnostic = 'permission-denied'
      else if (/password authentication failed/i.test(message)) diagnostic = 'authentication'
      else if (/could not connect|connection refused/i.test(message)) diagnostic = 'connection'
      else if (/snapshot/i.test(message)) diagnostic = 'snapshot'
      else if (/role .* does not exist/i.test(message)) diagnostic = 'missing-role'
      else if (/schema .* does not exist/i.test(message)) diagnostic = 'missing-schema'
      else if (/function .* does not exist/i.test(message)) diagnostic = 'missing-function'
      else if (/server version|version mismatch/i.test(message)) diagnostic = 'version'
      // Whitelisted categories only: raw stderr may contain customer data or credentials.
    })
    child.stdin.on('error', fail)
    child.on('close', code => { if (finished) return; if (code !== 0) return fail(); finished = true; clearTimeout(timer); resolve(Buffer.concat(chunks)) })
    child.stdin.end(input)
  })
}
export async function snapshotTables(client: Client) {
  const tables: SnapshotManifest['tables'] = {}
  const names = (await client.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name <> '_prisma_migrations' ORDER BY table_name")).rows
  for (const { table_name: name } of names) {
    const quoted = '"' + name.replaceAll('"', '""') + '"'
    const result = await client.query<{ row: string }>('SELECT to_jsonb(t)::text AS row FROM public.' + quoted + ' t ORDER BY to_jsonb(t)::text')
    const hash = createHash('sha256')
    for (const row of result.rows) hash.update(row.row).update('\n')
    tables[name] = { count: result.rowCount || 0, digest: hash.digest('hex') }
  }
  return tables
}
export async function createBackup(url: string, binary: string, secret: string) {
  keyBuffer(secret)
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 15000, statement_timeout: 60000 })
  try {
    await client.connect()
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const snapshot = (await client.query<{ snapshot: string }>('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot
    const tables = await snapshotTables(client)
    const hasOps = (await client.query("SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='shop78it_ops') AS exists")).rows[0].exists
    const hasRuntime = (await client.query("SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='shop78it_runtime_v2') AS exists")).rows[0].exists
    const privateSchemas = hasOps ? ['shop78it_ops'] : []
    const requiredRoles = hasRuntime ? ['shop78it_runtime_v2'] : []
    const dump = await runPg(binary, ['--format=custom', '--schema=public', ...privateSchemas.map(name=>'--schema='+name), '--no-owner', '--no-acl', '--snapshot=' + snapshot], url)
    const manifest: SnapshotManifest = { createdAt: new Date().toISOString(), sourceFingerprint: databaseFingerprint(url), tables, scope: 'public', dumpSha256: createHash('sha256').update(dump).digest('hex'), privateSchemas, requiredRoles }
    await client.query('ROLLBACK')
    return { archive: encryptArchive(dump, manifest, secret), manifest }
  } finally { await client.end().catch(() => {}) }
}
export function assertRestoreTarget(value: string) {
  const url = new URL(value)
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || !['127.0.0.1', 'localhost'].includes(url.hostname) || !['/shop_restore_sandbox','/shop_restore_sandbox_verify'].includes(url.pathname)) throw new Error('Restore is restricted to separate named loopback restore sandbox databases')
}
export async function restoreBackup(archive: Buffer, secret: string, target: string, binary: string) {
  assertRestoreTarget(target)
  const { manifest, dump } = decryptArchive(archive, secret)
  if (databaseFingerprint(target) === manifest.sourceFingerprint) throw new Error('Cannot restore over the source database')
  const client = new Client({ connectionString: target, connectionTimeoutMillis: 15000 })
  try {
    await client.connect()
    if ((manifest.privateSchemas||[]).some(name=>name!=='shop78it_ops') || (manifest.requiredRoles||[]).some(name=>name!=='shop78it_runtime_v2')) throw new Error('Unexpected recovery dependencies')
    for (const name of manifest.privateSchemas||[]) {
      const existing=await client.query('SELECT 1 FROM pg_namespace WHERE nspname=$1',[name])
      if(existing.rowCount) throw new Error('Restore target already contains the operations schema')
    }
    for (const role of manifest.requiredRoles||[]) {
      const exists=await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])
      if(!exists.rowCount) await client.query('CREATE ROLE "shop78it_runtime_v2" NOLOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS')
    }
    const objects = await client.query("SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')")
    if (objects.rows[0].count !== 0) throw new Error('Restore target must be empty; existing data will never be replaced')
    const functions = await client.query("SELECT count(*)::int AS count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'")
    if (functions.rows[0].count !== 0) throw new Error('Restore target contains functions')
    // A fresh PostgreSQL database already has an empty public schema. The dump recreates it.
    // No CASCADE: any unrecognised existing object makes this fail safely.
    await client.query('DROP SCHEMA IF EXISTS public')
    await runPg(binary, ['--exit-on-error', '--single-transaction', '--no-owner', '--no-acl', '--dbname='+decodeURIComponent(new URL(target).pathname.slice(1))], target, dump)
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const restored = await snapshotTables(client)
    if (JSON.stringify(restored) !== JSON.stringify(manifest.tables)) throw new Error('Restored row counts or digests do not match')
    await client.query('ROLLBACK')
    return manifest
  } finally { await client.end().catch(() => {}) }
}
