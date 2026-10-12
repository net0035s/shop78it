import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { loadEnvConfig } from '@next/env'

// Read-only Vercel requests. Never print environment values or raw API errors.
const PROJECT = 'prj_7klbKPGuzckoZ5liEDP9UXQRxvcV'
const TEAM = 'team_vzgAheUA1bP7p02TJ8pUZvOb'
const MAGIC = Buffer.from('SHOP78RUNTIME1')
async function protect(directory: string) {
  if (process.platform !== 'win32') throw new Error('This recovery workflow requires Windows ACLs')
  const identity = (process.env.USERDOMAIN ? process.env.USERDOMAIN + '\\' : '') + process.env.USERNAME
  await new Promise<void>((ok, fail) => {
    const child = spawn('icacls.exe', [directory, '/inheritance:r', '/grant:r', identity + ':(OI)(CI)F'], { windowsHide: true, stdio: 'ignore' })
    child.on('error', () => fail(new Error('Recovery permissions failed')))
    child.on('close', code => code === 0 ? ok() : fail(new Error('Recovery permissions failed')))
  })
}
async function main() {
  if (!process.argv.includes('--read-only-backup')) throw new Error('Specify --read-only-backup')
  if (!process.env.APPDATA || !process.env.LOCALAPPDATA) throw new Error('Protected local storage is unavailable')
  const link = JSON.parse(readFileSync('.vercel/project.json', 'utf8'))
  assert.equal(link.projectId, PROJECT); assert.equal(link.orgId, TEAM)
  const auth = JSON.parse(readFileSync(join(process.env.APPDATA, 'com.vercel.cli/Data/auth.json'), 'utf8'))
  const token = auth.token || auth.accessToken || auth.access_token
  if (!token) throw new Error('Vercel authentication unavailable')
  async function get(path: string) {
    const response = await fetch('https://api.vercel.com' + path + (path.includes('?') ? '&' : '?') + 'teamId=' + TEAM, {
      headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) throw new Error('Read-only Vercel request failed: HTTP ' + response.status)
    return response.json()
  }
  const [project, environment, alias, team] = await Promise.all([
    get('/v9/projects/' + PROJECT), get('/v10/projects/' + PROJECT + '/env?decrypt=true'),
    get('/v4/aliases/shop78it.vercel.app'), get('/v2/teams/' + TEAM),
  ])
  assert.equal(project.id, PROJECT)
  const deploymentId = alias.deploymentId || alias.deployment?.id
  if (!deploymentId) throw new Error('Primary domain deployment cannot be identified')
  const active = await get('/v13/deployments/' + deploymentId)
  assert.equal(active.projectId, PROJECT); assert.equal(active.target, 'production')
  // Same read-only endpoint used by the installed Vercel CLI's env/build pull.
  // Some sensitive variables may be omitted. Never treat an omission as a backup.
  let runtimePull: { env?: Record<string, string> } | null = null
  try { runtimePull = await get('/v3/env/pull/' + deploymentId + '?source=vercel-cli:pull') } catch { /* reported below */ }
  let projectProductionPull: { env?: Record<string, string> } | null = null
  try { projectProductionPull = await get('/v3/env/pull/' + PROJECT + '/production?source=vercel-cli:pull') } catch { /* reported below */ }
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} })
  const envs = Array.isArray(environment) ? environment : environment.envs
  if (!Array.isArray(envs)) throw new Error('Unexpected environment response')
  const recoveredEnvironment: Record<string, unknown>[] = []
  for (let offset = 0; offset < envs.length; offset += 3) {
    const batch = await Promise.all(envs.slice(offset, offset + 3).map(async item => {
      if (typeof item.id !== 'string') return item
      try {
        const record = await get('/v1/projects/' + PROJECT + '/env/' + encodeURIComponent(item.id))
        assert.equal(record.key, item.key)
        return record
      } catch { return item }
    }))
    recoveredEnvironment.push(...batch)
  }
  const recoverable = recoveredEnvironment.filter(item => (item.decrypted === true || item.type === 'plain') && typeof item.value === 'string')
  const unrecoverable = recoveredEnvironment.filter(item => !recoverable.includes(item))
  const currentProductionKey = recoverable.find(item => item.key === 'ENCRYPTION_KEY' && Array.isArray(item.target) && item.target.includes('production'))
  const localFiles = Object.fromEntries(['.env', '.env.local', '.env.sandbox.local', 'vercel.json', '.vercel/project.json']
    .filter(file => existsSync(file)).map(file => [file, readFileSync(file, 'utf8')]))
  const deployments: Record<string, unknown>[] = []
  let cursor: number | undefined, complete = false
  for (let page = 0; page < 20; page++) {
    const list = await get('/v7/deployments?projectId=' + PROJECT + '&limit=100' + (cursor ? '&until=' + cursor : ''))
    if (!Array.isArray(list.deployments)) throw new Error('Unexpected deployments response')
    deployments.push(...list.deployments)
    if (!list.pagination?.next) { complete = true; break }
    if (cursor === list.pagination.next) throw new Error('Deployment pagination stalled')
    cursor = list.pagination.next
  }
  const createdAt = new Date().toISOString()
  const privatePayload = Buffer.from(JSON.stringify({ createdAt, project, environment, recoveredEnvironment, active, runtimePull, projectProductionPull, alias, team, localFiles, deployments }))
  const key = randomBytes(32), iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(MAGIC)
  const encrypted = Buffer.concat([cipher.update(privatePayload), cipher.final()])
  const archive = Buffer.concat([MAGIC, iv, cipher.getAuthTag(), encrypted])
  const recoveryRoot = join(process.env.LOCALAPPDATA, 'Shop78itRecovery')
  mkdirSync(recoveryRoot, { recursive: true })
  const keyDirectory = mkdtempSync(join(recoveryRoot, 'runtime-'))
  await protect(keyDirectory)
  const keyFile = join(keyDirectory, 'runtime.recovery-key')
  mkdirSync('backups', { recursive: true }); await protect(resolve('backups'))
  const archiveFile = resolve('backups', 'shop78it-runtime-' + createdAt.replaceAll(':', '-') + '.enc')
  writeFileSync(keyFile, key.toString('hex') + '\n', { flag: 'wx', mode: 0o600 })
  writeFileSync(archiveFile, archive, { flag: 'wx', mode: 0o600 })
  // Round trip from saved files, including authentication of every byte.
  const saved = readFileSync(archiveFile), savedKey = Buffer.from(readFileSync(keyFile, 'utf8').trim(), 'hex')
  const offset = MAGIC.length
  assert(saved.subarray(0, offset).equals(MAGIC))
  const decipher = createDecipheriv('aes-256-gcm', savedKey, saved.subarray(offset, offset + 12))
  decipher.setAAD(MAGIC); decipher.setAuthTag(saved.subarray(offset + 12, offset + 28))
  assert(Buffer.concat([decipher.update(saved.subarray(offset + 28)), decipher.final()]).equals(privatePayload))
  const aliasAfter = await get('/v4/aliases/shop78it.vercel.app')
  assert.equal(aliasAfter.deploymentId || aliasAfter.deployment?.id, deploymentId)
  const report = {
    checkedAt: createdAt, readOnly: true, projectId: PROJECT, primaryDomain: 'shop78it.vercel.app',
    productionDeploymentId: deploymentId, primaryDomainUnchanged: true, plan: team.billing?.plan || null,
    encryptedArchive: archiveFile, recoveryKeyFile: keyFile,
    archiveSha256: createHash('sha256').update(saved).digest('hex'), roundTripVerified: true,
    projectEnvironmentCount: envs.length, unrecoverableEnvironmentNames: unrecoverable.map(item => item.key),
    recoverableProjectEnvironmentCount: recoverable.length,
    currentProductionProjectKeyBackedUp: !!currentProductionKey,
    currentProductionProjectKeyMatchesLocal: currentProductionKey ? currentProductionKey.value === process.env.ENCRYPTION_KEY : null,
    projectProductionPullAvailable: !!projectProductionPull?.env,
    projectProductionPullEncryptionKeyBackedUp: !!projectProductionPull?.env?.ENCRYPTION_KEY,
    projectProductionPullKeyMatchesLocal: projectProductionPull?.env?.ENCRYPTION_KEY ? projectProductionPull.env.ENCRYPTION_KEY === process.env.ENCRYPTION_KEY : null,
    activeRuntimePullAvailable: !!runtimePull?.env,
    activeRuntimeEncryptionKeyBackedUp: !!runtimePull?.env?.ENCRYPTION_KEY,
    activeRuntimeEncryptionKeyMatchesLocal: runtimePull?.env?.ENCRYPTION_KEY ? runtimePull.env.ENCRYPTION_KEY === process.env.ENCRYPTION_KEY : null,
    activeRuntimeDatabaseUrlBackedUp: !!runtimePull?.env?.DATABASE_URL,
    localFilesBackedUp: Object.keys(localFiles), deploymentInventoryComplete: complete, deploymentCount: deployments.length,
    readyProductionCount: deployments.filter(item => item.target === 'production' && (item.readyState === 'READY' || item.state === 'READY')).length,
    readyPreviewCount: deployments.filter(item => item.target !== 'production' && (item.readyState === 'READY' || item.state === 'READY')).length,
    configurationScope: 'Project environment and settings, active deployment metadata and any values returned by CLI runtime pull, local env files. Omitted sensitive values are not recoverable from this archive; excludes Clerk/Supabase service configuration.',
    offDeviceBackupConfirmed: false, sourceWritersFrozen: false, productionChanged: false,
  }
  writeFileSync('docs/launch-runtime-backup-latest.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
}
main().catch(() => { console.error('Runtime backup failed; private details withheld; no remote changes performed'); process.exitCode = 1 })
