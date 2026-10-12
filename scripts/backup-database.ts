import { loadEnvConfig } from '@next/env'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createBackup, restoreBackup } from './backup-archive'

async function main() {
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} })
  const key = process.env.BACKUP_ENCRYPTION_KEY
  if (!key) throw new Error('BACKUP_ENCRYPTION_KEY is required. Keep the separate backup key outside Git and outside the backup archive.')
  const restoreIndex = process.argv.indexOf('--restore')
  if (restoreIndex >= 0) {
    const file = process.argv[restoreIndex + 1]
    if (!file || !process.env.SANDBOX_RESTORE_URL || !process.env.PG_RESTORE_PATH) throw new Error('Restore file, SANDBOX_RESTORE_URL and PG_RESTORE_PATH are required')
    const manifest = await restoreBackup(readFileSync(resolve(file)), key, process.env.SANDBOX_RESTORE_URL, process.env.PG_RESTORE_PATH)
    console.log('PASS restored public schema with exact row counts and digests. Tables: ' + Object.keys(manifest.tables).length)
  } else {
    if (!process.env.DIRECT_URL || !process.env.PG_DUMP_PATH) throw new Error('DIRECT_URL and PG_DUMP_PATH are required')
    const { archive, manifest } = await createBackup(process.env.DIRECT_URL, process.env.PG_DUMP_PATH, key)
    const directory = resolve('backups')
    mkdirSync(directory, { recursive: true })
    const file = resolve(directory, 'shop78it-' + new Date().toISOString().replaceAll(':', '-') + '.enc')
    writeFileSync(file, archive, { flag: 'wx', mode: 0o600 })
    console.log('Encrypted backup created: ' + file)
    console.log('Public business schema only. Supabase Auth, Storage objects and project settings require separate provider backups.')
    console.log('Restore rehearsal remains required. Tables: ' + Object.keys(manifest.tables).length)
  }
}
main().catch(() => { console.error('Backup/restore not completed. Check target, tools and separate backup key. No secret data printed.'); process.exitCode = 1 })
