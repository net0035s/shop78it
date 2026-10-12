import { loadEnvConfig } from '@next/env'
import { Client } from 'pg'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { configurationChecks } from '../src/lib/launch-readiness'
import { DATA_API_SECURITY_SQL, assessDataApiSecurity, type DataApiTable } from '../src/lib/data-api-security'
import { getEncryptionKeyProblem, isEncryptedText, decryptTextWithKey, DELIVERY_SECRET_FIELDS } from '../src/lib/encryption'

async function main() {
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} })
  const selectedEnvironment = process.argv.find(value=>value.startsWith('--vercel-environment='))?.split('=')[1]
  if (selectedEnvironment && !['production','preview'].includes(selectedEnvironment)) throw new Error('Invalid Vercel audit environment')
  if (selectedEnvironment) process.env.VERCEL_ENV = selectedEnvironment
  const report: Record<string, unknown> = { environment: selectedEnvironment || 'local', checkedAt: new Date().toISOString(), checks: configurationChecks(), database: { checked: false }, externalTests: 'not verified by this audit' }
  if (process.argv.includes('--read-database')) {
    const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL, connectionTimeoutMillis: 15000, statement_timeout: 30000 })
    try {
      if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) throw new Error()
      await client.connect(); await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
      const tables = (await client.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")).rows.map(row => row.table_name)
      const columns = (await client.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Order'")).rows.map(row => row.column_name)
      const required = ['PaymentAttempt', 'OrderAccessSession', 'OrderAccessChallenge', 'NotificationJob', 'OrderAuditEvent', 'RateLimitBucket']
      const keyStats = { values: 0, plaintext: 0, encrypted: 0, decryptable: 0, unreadable: 0, emptyPayload: 0, invalidFormat: 0, authenticationFailures: 0, currentKeySafe: !getEncryptionKeyProblem(process.env.ENCRYPTION_KEY) }
      for (const [table, fields] of [['DigitalStock',['content']],['DigitalKey',['keyData']],['Order',['deliveredContent']],['DeliveryItem', [...DELIVERY_SECRET_FIELDS]]] as const) {
        if (!tables.includes(table)) continue
        const rows = (await client.query('SELECT ' + fields.map(field => '"' + field + '"').join(',') + ' FROM public."' + table + '"')).rows
        for (const row of rows) for (const field of fields) {
          const value = row[field]; if (!value) continue; keyStats.values++
          if (!isEncryptedText(value)) { keyStats.plaintext++; continue }
          keyStats.encrypted++
          try { decryptTextWithKey(value, process.env.ENCRYPTION_KEY, { allowUnsafeDefault: true }); keyStats.decryptable++ } catch {
            keyStats.unreadable++
            const parts = value.split(':')
            if (parts.length === 5 && parts[2] && parts[3] && parts[4] === '') keyStats.emptyPayload++
            else if (parts.length !== 5 || !parts[2] || !parts[3] || !parts[4]) keyStats.invalidFormat++
            else keyStats.authenticationFailures++
          }
        }
      }
      const statuses = (await client.query('SELECT status, count(*)::int AS count FROM public."Order" GROUP BY status ORDER BY status')).rows
      const legacy = (await client.query('SELECT count(*)::int AS count FROM public."DigitalStock" s JOIN public."Order" o ON o.id=s."orderId" WHERE s."isSold"=true AND o.status=\'pending\'')).rows[0].count
      const dataApiSecurity = assessDataApiSecurity((await client.query<DataApiTable>(DATA_API_SECURITY_SQL)).rows)
      ;(report.checks as Array<{id:string;label:string;status:string;detail:string}>).push({id:'dataApi',label:'สิทธิ์เข้าถึงฐานข้อมูลผ่าน Data API',status:dataApiSecurity.safe?'pass':'blocked',detail:dataApiSecurity.safe?'RLS enabled; public roles denied':'Review RLS and public grants'})
      report.database = { checked: true, readOnly: true, dataApiSecurity, tables, missingTables: required.filter(table => !tables.includes(table)), missingOrderColumns: ['expiresAt','paidAt','paidAtEstimated','reservationActive','discountReserved'].filter(column => !columns.includes(column)), statuses, soldStockOnPendingOrders: legacy, encryption: keyStats }
      await client.query('ROLLBACK')
    } catch { report.database = { checked: false, readOnly: true, error: 'Database audit unavailable; secret output withheld' } }
    finally { await client.end().catch(() => {}) }
  }
  mkdirSync('docs', { recursive: true })
  writeFileSync('docs/launch-audit-latest.json', JSON.stringify(report, null, 2) + '\n')
  if (selectedEnvironment) writeFileSync('docs/launch-audit-' + selectedEnvironment + '-latest.json',JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify(report, null, 2))
  const checks = report.checks as Array<{ status: string }>
  if (checks.some(check => check.status !== 'pass') || !(report.database as { checked: boolean }).checked || ((report.database as { encryption?: { unreadable: number } }).encryption?.unreadable || 0) > 0 || ((report.database as { missingTables?: string[] }).missingTables?.length || 0) > 0 || ((report.database as { missingOrderColumns?: string[] }).missingOrderColumns?.length || 0) > 0) process.exitCode = 2
}
main().catch(() => { console.error('Launch audit failed without printing secret data'); process.exitCode = 1 })
