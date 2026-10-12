import assert from 'node:assert/strict'
import { cpSync, readFileSync, mkdirSync, mkdtempSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { loadEnvConfig } from '@next/env'
import { cloudSandboxEnvironment } from './cloud-sandbox-config'
import { previewIsIsolated } from '../src/lib/launch-readiness'

async function main() {
  const root = process.cwd()
  loadEnvConfig(root, true, { info() {}, error() {} })
  const source = cloudSandboxEnvironment()
  const project = JSON.parse(readFileSync('.vercel/project.json', 'utf8'))
  assert.equal(project.projectName, 'shop78it')
  assert.equal(project.projectId, 'prj_7klbKPGuzckoZ5liEDP9UXQRxvcV')
  assert.equal(project.orgId, 'team_vzgAheUA1bP7p02TJ8pUZvOb')
  const env: Record<string, string> = {}
  for (const key of ['DATABASE_URL', 'DIRECT_URL', 'ENCRYPTION_KEY', 'SANDBOX_DATABASE_FINGERPRINT', 'PRODUCTION_DATABASE_FINGERPRINT', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY', 'ADMIN_EMAILS']) env[key] = source[key] || ''
  Object.assign(env, { APP_MODE: 'sandbox', ORDERS_ENABLED: 'true', PAYMENTS_ENABLED: 'false', LAUNCH_APPROVED: 'false', OLD_ENCRYPTION_KEY: '',
    STRIPE_ENABLED: source.STRIPE_ENABLED || 'false', STRIPE_SECRET_KEY: source.STRIPE_SECRET_KEY || '', STRIPE_WEBHOOK_SECRET: source.STRIPE_WEBHOOK_SECRET || '',
    NEXT_PUBLIC_SITE_URL: '', NEXT_PUBLIC_BASE_URL: '', NEXT_PUBLIC_SUPPORT_EMAIL: '', NEXT_PUBLIC_LINE_URL: '', CRON_SECRET: randomBytes(32).toString('hex'),
    EMAIL_USER: '', EMAIL_PASS: '', SMTP_HOST: '', SMTP_PORT: '', TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '', TMN_RECEIVE_PHONE: '', PROMPTPAY_NUMBER: '',
    SLIPOK_API_KEY: '', SLIPOK_BRANCH_ID: '', SLIP_VERIFY_API_KEY: '', SLIP_VERIFY_API_URL: '', NEXT_PUBLIC_GA_ID: '', NEXT_PUBLIC_FB_PIXEL_ID: '',
    NEXT_TELEMETRY_DISABLED: '1', CLERK_TELEMETRY_DISABLED: '1', BACKUP_RESTORE_VERIFIED: 'false', MIGRATION_REHEARSAL_VERIFIED: 'false', PROVIDER_SANDBOX_VERIFIED: 'false',
    CLERK_ADMIN_VERIFIED: 'false', MAINTENANCE_VERIFIED: 'false', HOSTING_COMMERCIAL_CONFIRMED: 'false', BACKUP_ENCRYPTION_KEY: '', SANDBOX_RESTORE_URL: '', PG_DUMP_PATH: '', PG_RESTORE_PATH: '' })
  assert.ok(previewIsIsolated(env))
  assert.ok(!env.STRIPE_SECRET_KEY || /^[rs]k_test_[A-Za-z0-9]+$/.test(env.STRIPE_SECRET_KEY))
  mkdirSync('.cache', { recursive: true })
  const stage = mkdtempSync(join(root, '.cache/preview-deploy-'))
  for (const dir of ['src', 'public', 'scripts', 'vendor']) cpSync(join(root, dir), join(stage, dir), { recursive: true })
  mkdirSync(join(stage, 'prisma'), { recursive: true })
  for (const file of ['schema.prisma', 'baseline.prisma']) cpSync(join(root, 'prisma', file), join(stage, 'prisma', file))
  cpSync(join(root, 'prisma/migrations'), join(stage, 'prisma/migrations'), { recursive: true })
  for (const file of ['package.json', 'package-lock.json', '.npmrc', 'tsconfig.json', 'tailwind.config.js', 'postcss.config.js', 'next.config.js', 'next-env.d.ts', '.eslintrc.json', 'eslint.config.mjs']) if (existsSync(join(root, file))) cpSync(join(root, file), join(stage, file))
  mkdirSync(join(stage, '.vercel'))
  writeFileSync(join(stage, '.vercel/project.json'), JSON.stringify(project))
  writeFileSync(join(stage, 'vercel.json'), JSON.stringify({ crons: [] }))
  writeFileSync(join(stage, '.vercelignore'), 'node_modules\n.next\n.vercel\n.git\n.env\n.env.*\n.cache\ndocs\nbackups\n*.db\n*.enc\n*.bak\n*.dump\n')
  let files = 0
  const secrets = ['DATABASE_URL', 'DIRECT_URL', 'ENCRYPTION_KEY', 'CLERK_SECRET_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'].map(k => env[k]).filter(v => v.length >= 16)
  function scan(dir: string) {
    for (const name of readdirSync(dir)) {
      const file = join(dir, name), info = statSync(file)
      if (info.isDirectory()) { scan(file); continue }
      files++
      assert.ok(!/^\.env($|\.)/.test(name) && !/\.(db|bak|dump|enc|recovery-key)$/.test(name), 'Forbidden private file in stage')
      const text = readFileSync(file).toString('utf8')
      assert.ok(!secrets.some(secret => text.includes(secret)), 'Private environment value appeared in source stage')
      assert.ok(!/[rs]k_live_[A-Za-z0-9]{30,}/.test(text), 'Live Stripe key appeared in source stage')
    }
  }
  scan(stage)
  const cli = resolve(process.env.APPDATA!, 'npm/node_modules/vercel/dist/index.js')
  assert.ok(existsSync(cli), 'Installed Vercel CLI not found')
  const args = [cli, 'deploy', '--target', 'preview', '--yes', '--no-wait', '--no-color']
  // CLI reads a value-less --env/--build-env name from the child process environment. No secrets enter argv.
  for (const key of Object.keys(env)) args.push('--env', key, '--build-env', key)
  const report = { checkedAt: new Date().toISOString(), target: 'preview', projectId: project.projectId, productionSettingsChanged: false, productionDataChanged: false,
    sandboxDatabase: 'acocmsdnkpjfggycsxro', realPaymentsEnabled: false, externalMessagesEnabled: false, stripeTestEnabled: env.STRIPE_ENABLED === 'true',
    environmentScope: 'this deployment only', sourceFiles: files, sourceSecretsExcluded: true, originalCronConfigPreserved: true, stage, submitted: false, url: null as string | null }
  writeFileSync('.cache/preview-stage-info.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ target: report.target, database: report.sandboxDatabase, sourceFiles: files, stripeTestEnabled: report.stripeTestEnabled, secretFilesExcluded: true }))
  let output = ''
  const child = spawn(process.execPath, args, { cwd: stage, env: { ...process.env, ...env }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { output += data.toString() })
  const code = await new Promise<number | null>((accept, reject) => { child.on('error', reject); child.on('exit', accept) })
  let sanitized = output
  for (const secret of secrets) sanitized = sanitized.replaceAll(secret, '[private]')
  writeFileSync('.cache/preview-deploy-cli.log', sanitized)
  const urls = sanitized.match(/https:\/\/[a-z0-9.-]+\.vercel\.app/g) || []
  report.url = urls.at(-1) || null; report.submitted = code === 0 && !!report.url
  writeFileSync('docs/launch-preview-deployment-latest.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ submitted: report.submitted, exitCode: code, url: report.url, privateDetailsWithheld: true }))
  if (!report.submitted) throw new Error('Preview submission failed; inspect sanitized private log')
}
main().catch(() => { console.error('Preview stopped; private details withheld. No production deploy was requested.'); process.exitCode = 1 })
