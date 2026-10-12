import { loadEnvConfig } from '@next/env'
import { randomBytes, createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, relative, isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { Client } from 'pg'
import assert from 'node:assert/strict'
import { createBackup, restoreBackup } from './backup-archive'
import { decryptTextWithKey, isEncryptedText, DELIVERY_SECRET_FIELDS } from '../src/lib/encryption'
import { databaseFingerprint } from '../src/lib/launch-readiness'

async function command(binary: string, args: string[], env = process.env) {
  return new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    const child = spawn(binary, args, { env, windowsHide: true, stdio: ['ignore','pipe','pipe'] })
    let output = ''
    child.stdout.on('data', chunk => { output += chunk })
    child.stderr.on('data', () => { /* Withhold private output. */ })
    child.on('error', reject)
    child.on('close', code => resolve({ code, output }))
  })
}
async function restrictDirectory(directory: string) {
  if (process.platform !== 'win32') return
  const identity = (process.env.USERDOMAIN ? process.env.USERDOMAIN + '\\' : '') + process.env.USERNAME
  const result = await command('icacls.exe', [directory, '/inheritance:r', '/grant:r', identity + ':(OI)(CI)F'])
  if (result.code !== 0) throw new Error('Cannot restrict backup directory permissions')
}
async function freePort() {
  const server = createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port
  await new Promise<void>(resolve => server.close(() => resolve()))
  return port
}
async function preservation(client: Client) {
  const fields: Record<string,string[]> = {
    Order: ['id','orderNumber','total','subTotal','discountAmount','deliveredContent'],
    OrderItem: ['id','orderId','productId','quantity','price'],
    DigitalStock: ['id','content','isSold','orderId'],
    DigitalKey: ['id','keyData','isUsed','orderId'],
    DeliveryItem: ['id','orderId', ...DELIVERY_SECRET_FIELDS],
    Product: ['id','price','stock'],
    DiscountCode: ['id','usedCount'],
  }
  const hashes: Record<string,string> = {}
  let values = 0, readable = 0, unreadable = 0
  for (const [table, requested] of Object.entries(fields)) {
    const existing = (await client.query('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2', ['public',table])).rows.map(row => row.column_name)
    const selected = requested.filter(field => existing.includes(field))
    const quote = (field: string) => '"' + field + '"'
    const rows = (await client.query('SELECT ' + selected.map(quote).join(',') + ' FROM public.' + quote(table) + ' ORDER BY id')).rows
    hashes[table] = createHash('sha256').update(JSON.stringify(rows)).digest('hex')
    for (const row of rows) for (const value of Object.values(row)) if (isEncryptedText(value)) {
      values++
      try { decryptTextWithKey(value, process.env.ENCRYPTION_KEY, { allowUnsafeDefault: true }); readable++ } catch { unreadable++ }
    }
  }
  return { hashes, encryption: { values, readable, unreadable } }
}
async function main() {
  if (!process.argv.includes('--source-backup')) throw new Error('Use --source-backup only for an authorised read-only source backup and local rehearsal')
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} })
  const source = process.env.DIRECT_URL, dump = process.env.PG_DUMP_PATH, restore = process.env.PG_RESTORE_PATH
  const modulePath = process.env.LOCAL_EMBEDDED_POSTGRES_PATH
  if (!source || !dump || !restore || !modulePath || !process.env.LOCALAPPDATA) throw new Error('Backup tools, source and local protected storage are required')
  assert.equal(databaseFingerprint(source), databaseFingerprint('postgresql://postgres@db.hddnabbhdjphjwjohvcg.supabase.co/postgres'), 'Source must be the identified shop database')
  const recoveryDirectory = mkdtempSync((mkdirSync(join(process.env.LOCALAPPDATA, 'Shop78itRecovery'), { recursive: true, mode: 0o700 }), join(process.env.LOCALAPPDATA, 'Shop78itRecovery', 'backup-')))
  await restrictDirectory(recoveryDirectory)
  const key = randomBytes(32).toString('hex'), keyFile = join(recoveryDirectory, 'backup.recovery-key')
  writeFileSync(keyFile, key + '\n', { flag: 'wx', mode: 0o600 })
  const result = await createBackup(source, dump, key)
  mkdirSync('backups', { recursive: true, mode: 0o700 })
  await restrictDirectory(resolve('backups'))
  const archiveFile = resolve('backups', 'shop78it-' + new Date().toISOString().replaceAll(':','-') + '.enc')
  writeFileSync(archiveFile, result.archive, { flag: 'wx', mode: 0o600 })
  const report: Record<string,unknown> = { checkedAt: new Date().toISOString(), sourceReadOnly: true, scope: 'public business schema; excludes Supabase Auth, Storage and project configuration', encryptedBackup: archiveFile, recoveryKeyFile: keyFile, tables: Object.fromEntries(Object.entries(result.manifest.tables).map(([name, value]) => [name,value.count])), restoreVerified: false, migrationRehearsal: 'pending', productionMigrationApplied: false, encryptionKeyChanged: false }
  const directory = mkdtempSync(join(tmpdir(), 'shop78it-source-rehearsal-'))
  await restrictDirectory(directory)
  const { default: EmbeddedPostgres } = await import(pathToFileURL(resolve(modulePath)).href)
  const port = await freePort(), password = randomBytes(24).toString('hex')
  const cluster = new EmbeddedPostgres({ databaseDir: join(directory, 'cluster'), port, user: 'postgres', password, persistent: true, createPostgresUser: false, initdbFlags: ['--encoding=UTF8'], postgresFlags: ['-h','127.0.0.1'], onLog() {}, onError() {} })
  try {
    await cluster.initialise(); await cluster.start(); await cluster.createDatabase('shop_restore_sandbox')
    const target = 'postgresql://postgres:' + password + '@127.0.0.1:' + port + '/shop_restore_sandbox'
    await restoreBackup(readFileSync(archiveFile), readFileSync(keyFile,'utf8').trim(), target, restore)
    report.restoreVerified = true
    const drift = await command(process.execPath, ['node_modules/prisma/build/index.js','migrate','diff','--from-url',target,'--to-schema-datamodel','prisma/baseline.prisma','--exit-code'])
    report.baselineDrift = drift.code === 0 ? 'none' : drift.code === 2 ? 'differences-found' : 'check-failed'
    if (drift.code !== 0) {
      report.migrationRehearsal = 'blocked: review baseline drift before applying migration'
      if (drift.code === 2) writeFileSync('docs/launch-baseline-drift.txt', drift.output)
    } else {
      const client = new Client({ connectionString: target })
      await client.connect()
      try {
        const before = await preservation(client)
        await client.query('BEGIN')
        await client.query(readFileSync('prisma/migrations/202609050002_commerce_safety/migration.sql','utf8'))
        const after = await preservation(client)
        assert.deepEqual(after, before)
        await client.query('COMMIT')
        report.preservedMoneyStockAndEncryptedBytes = true
        report.encryption = after.encryption
        report.migrationRehearsal = after.encryption.unreadable ? 'schema passed; launch blocked by pre-existing unreadable encryption' : 'passed'
        report.tableCountAfterMigration = (await client.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")).rows[0].count
      } finally { await client.end() }
    }
  } catch {
    report.rehearsalError = 'Rehearsal failed; private error output withheld. Encrypted backup preserved.'
    throw new Error('Source backup saved but rehearsal needs review')
  } finally {
    await cluster.stop()
    const root = realpathSync(tmpdir()), checked = realpathSync(directory), inside = relative(root, checked)
    if (!isAbsolute(inside) && !inside.startsWith('..') && inside.startsWith('shop78it-source-rehearsal-')) rmSync(checked, { recursive: true })
    report.temporaryCopyRemoved = true
    writeFileSync('docs/launch-backup-rehearsal-latest.json', JSON.stringify(report,null,2) + '\n')
    console.log(JSON.stringify(report,null,2))
  }
}
main().catch(() => { console.error('Source backup/rehearsal incomplete; no secret output printed'); process.exit(1) })
