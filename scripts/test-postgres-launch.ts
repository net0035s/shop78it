import { randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join, relative, isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { Client } from 'pg'
import { createBackup, restoreBackup, decryptArchive } from './backup-archive'
import { encryptTextWithKey, decryptTextWithKey } from '../src/lib/encryption'
import { testDataApiSecurity } from './test-data-api-security'

async function freePort() {
  const server = createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port
  await new Promise<void>(resolve => server.close(() => resolve()))
  return port
}
async function main() {
  const modulePath = process.env.LOCAL_EMBEDDED_POSTGRES_PATH || '.cache/launch-postgres/node_modules/embedded-postgres/dist/index.js'
  const dump = process.env.PG_DUMP_PATH, restore = process.env.PG_RESTORE_PATH
  if (!dump || !restore) throw new Error('PG_DUMP_PATH and PG_RESTORE_PATH required')
  const { default: EmbeddedPostgres } = await import(pathToFileURL(resolve(modulePath)).href)
  const directory = mkdtempSync(join(tmpdir(), 'shop78it-pg-')), port = await freePort(), password = randomBytes(24).toString('hex')
  const cluster = new EmbeddedPostgres({ databaseDir: join(directory, 'cluster'), port, user: 'postgres', password, persistent: true, createPostgresUser: false, initdbFlags: ['--encoding=UTF8'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} })
  try {
    await cluster.initialise(); await cluster.start()
    await cluster.createDatabase('shop_sandbox'); await cluster.createDatabase('shop_backup_sandbox'); await cluster.createDatabase('shop_restore_sandbox')
    const base = 'postgresql://postgres:' + password + '@127.0.0.1:' + port + '/'
    if(process.argv.includes('--data-api-only')) {
      const code=await new Promise<number|null>((resolve,reject)=>{
        const child=spawn(process.execPath,['node_modules/tsx/dist/cli.mjs','scripts/test-data-api-postgres.ts'],{env:{...process.env,SANDBOX_POSTGRES_URL:base+'shop_sandbox'},stdio:'inherit',windowsHide:true})
        child.on('error',reject);child.on('exit',resolve)
      })
      assert.equal(code,0)
      console.log('PASS standalone RLS CI fixture runner')
      return
    }
    const env = { ...process.env, CI: 'true', SANDBOX_POSTGRES_URL: base + 'shop_sandbox', DATABASE_URL: base + 'shop_sandbox', DIRECT_URL: base + 'shop_sandbox' }
    if (!process.argv.includes('--backup-only')) for (const script of ['scripts/test-commerce.ts','scripts/test-launch.ts','scripts/test-stripe.ts']) {
      const code = await new Promise<number | null>((resolve, reject) => {
        const child = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', script], { env, stdio: 'inherit', windowsHide: true })
        child.on('error', reject); child.on('exit', resolve)
      })
      assert.equal(code, 0); console.log('PASS ' + script + ' on multi-connection PostgreSQL server')
    }
    const client = new Client({ connectionString: base + 'shop_backup_sandbox' })
    const key = randomBytes(32).toString('hex'), backupKey = randomBytes(32).toString('hex'), secret = encryptTextWithKey('MOCK-RESTORED-KEY', key)
    await client.connect()
    try {
      await client.query(readFileSync('prisma/migrations/202609050001_baseline/migration.sql', 'utf8'))
      await client.query(`INSERT INTO "Product"("id","name","description","price","image","category","stockStatus","tags") VALUES ('p','Sandbox','Only test data',10.25,'/image.png','sandbox','in-stock','')`)
      await client.query(`INSERT INTO "Order"("id","orderNumber","customerName","customerEmail","total","status","createdAt","updatedAt","deliveredContent") VALUES ('o','RESTORE-MOCK','Sandbox','mock@example.invalid',10.25,'completed',NOW(),NOW(),$1)`, [secret])
      await client.query(`INSERT INTO "OrderItem"("id","orderId","productId","quantity","price") VALUES ('line','o','p',1,8.75)`)
    } finally { await client.end() }
    const result = await createBackup(base + 'shop_backup_sandbox', dump, backupKey)
    assert.ok(!result.archive.includes(Buffer.from('MOCK-RESTORED-KEY')))
    assert.throws(() => decryptArchive(result.archive, randomBytes(32).toString('hex')))
    const corrupted = Buffer.from(result.archive); corrupted[corrupted.length - 1] ^= 1
    assert.throws(() => decryptArchive(corrupted, backupKey))
    await restoreBackup(result.archive, backupKey, base + 'shop_restore_sandbox', restore)
    await assert.rejects(() => restoreBackup(result.archive, backupKey, base + 'shop_restore_sandbox', restore))
    console.log('PASS encrypted pg_dump restore matches all public row counts and digests; refuses occupied targets, wrong keys and corruption')
    const restored = new Client({ connectionString: base + 'shop_restore_sandbox' })
    await restored.connect()
    try {
      await restored.query(readFileSync('prisma/migrations/202609050002_commerce_safety/migration.sql', 'utf8'))
      const order = (await restored.query(`SELECT "deliveredContent",total,"paidAtEstimated" FROM "Order" WHERE id='o'`)).rows[0]
      assert.equal(order.deliveredContent, secret); assert.equal(decryptTextWithKey(order.deliveredContent, key), 'MOCK-RESTORED-KEY')
      assert.equal(Number(order.total), 10.25); assert.equal(order.paidAtEstimated, true)
      const line = (await restored.query(`SELECT price,"productName" FROM "OrderItem" WHERE id='line'`)).rows[0]
      assert.equal(Number(line.price), 8.75); assert.equal(line.productName, 'Sandbox')
      console.log('PASS migration after restore preserves original money, encrypted bytes and decryptability')
    } finally { await restored.end() }
    await testDataApiSecurity(base + 'shop_restore_sandbox')
  } finally {
    await cluster.stop()
    const root=realpathSync(tmpdir()), target=realpathSync(directory), inside=relative(root,target)
    if(!isAbsolute(inside) && !inside.startsWith('..') && inside.startsWith('shop78it-pg-')) rmSync(target,{recursive:true})
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'PostgreSQL rehearsal failed'); process.exit(1) })
