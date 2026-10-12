import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { Client } from 'pg'
import { cloudSandboxEnvironment } from './cloud-sandbox-config'
import { snapshotTables } from './backup-archive'

async function main() {
  const env = cloudSandboxEnvironment()
  const apply = process.argv.includes('--apply')
  const expected = ['202609050001_baseline', '202609050002_commerce_safety']
  const client = new Client({ connectionString: env.DIRECT_URL, connectionTimeoutMillis: 15000 })
  const report = { checkedAt: new Date().toISOString(), projectId: 'acocmsdnkpjfggycsxro', productionConnected: false, apply, schemaDrift: 'unchecked', businessRowsUnchanged: false, metadataRlsEnabled: false, history: [] as string[], passed: false }
  function prisma(...args: string[]) {
    const child = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), ...args], { env, encoding: 'utf8', windowsHide: true, timeout: 60000 })
    // Do not echo CLI diagnostics; connection strings may contain credentials.
    assert.equal(child.status, 0, 'Prisma command failed: ' + args.slice(0, 2).join(' '))
  }
  await client.connect()
  try {
    const before = await snapshotTables(client)
    assert.equal(Object.keys(before).length, 15, 'Unexpected bootstrap tables')
    prisma('migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code')
    report.schemaDrift = 'none'
    const exists = (await client.query("SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS exists")).rows[0].exists
    type History = { migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null }
    const history: History[] = exists ? (await client.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations')).rows : []
    for (const row of history) {
      assert.ok(expected.includes(row.migration_name) && row.finished_at && !row.rolled_back_at, 'Unexpected or failed migration history')
      const checksum = createHash('sha256').update(readFileSync(`prisma/migrations/${row.migration_name}/migration.sql`)).digest('hex')
      assert.equal(row.checksum, checksum, 'Migration checksum mismatch')
    }
    if (apply) {
      for (const name of expected) {
        if (!history.some(row => row.migration_name === name)) prisma('migrate', 'resolve', '--applied', name)
        await client.query('ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY; REVOKE ALL ON TABLE public._prisma_migrations FROM PUBLIC, anon, authenticated')
      }
      const actual: History[] = (await client.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations ORDER BY migration_name')).rows
      assert.deepEqual(actual.map(row => row.migration_name), expected)
      for (const row of actual) {
        assert.ok(row.finished_at && !row.rolled_back_at)
        assert.equal(row.checksum, createHash('sha256').update(readFileSync(`prisma/migrations/${row.migration_name}/migration.sql`)).digest('hex'))
      }
      report.history = actual.map(row => row.migration_name)
    } else report.history = history.map(row => row.migration_name)
    if (exists || apply) {
      const metadata = (await client.query(`SELECT c.relrowsecurity AS rls_enabled,
        (SELECT count(*)::int FROM information_schema.table_privileges WHERE table_schema='public' AND table_name='_prisma_migrations' AND grantee IN ('PUBLIC','anon','authenticated')) AS public_grants
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='_prisma_migrations'`)).rows[0]
      assert.equal(metadata.rls_enabled, true); assert.equal(metadata.public_grants, 0)
      report.metadataRlsEnabled = true
    }
    assert.deepEqual(await snapshotTables(client), before)
    report.businessRowsUnchanged = true; report.passed = true
  } finally {
    await client.end()
    writeFileSync('docs/launch-cloud-sandbox-history-latest.json', JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify(report, null, 2))
  }
}
main().catch(() => { console.error('Cloud sandbox history verification failed; private details withheld'); process.exitCode = 1 })
