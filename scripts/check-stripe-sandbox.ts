import { readFileSync, writeFileSync } from 'node:fs'
import { cloudSandboxEnvironment } from './cloud-sandbox-config'
async function main() {
  const env = cloudSandboxEnvironment()
  const lines = readFileSync('.env.sandbox.local', 'utf8').split(/\r?\n/)
  const match = lines.map(line => line.match(/^\s*STRIPE_SECRET_KEY\s*=\s*(.*?)\s*$/)).find(Boolean)
  const raw = (match?.[1] || '').replace(/^(["'])(.*)\1$/, '$2')
  const kind = /^[rs]k_test_[A-Za-z0-9]+$/.test(raw) ? 'test-server' : /^[rs]k_live_/.test(raw) ? 'live-server' : /^pk_/.test(raw) ? 'publishable' : 'unrecognized'
  const report = { checkedAt: new Date().toISOString(), present: !!raw, keyKind: kind, testKeyFormatValid: kind === 'test-server',
    webhookSecretConfigured: !!env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_'), apiRequestSent: false, accountReadStatus: null as number | null, country: null as string | null, realPayments: false, deployed: false }
  try {
    if (!report.testKeyFormatValid) throw new Error()
    const response = await fetch('https://api.stripe.com/v1/account', { headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY }, signal: AbortSignal.timeout(20000) })
    report.apiRequestSent = true
    report.accountReadStatus = response.status
    const account = await response.json()
    report.country = response.ok && typeof account.country === 'string' ? account.country : null
  } finally {
    writeFileSync('docs/launch-stripe-config-latest.json', JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify(report))
  }
}
main().catch(() => { console.error('Sandbox Stripe check stopped; private values withheld. Check test key type and account permissions.'); process.exitCode = 1 })
