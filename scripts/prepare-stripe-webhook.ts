import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { cloudSandboxEnvironment } from './cloud-sandbox-config'

let step = 'sandbox configuration'
async function main() {
  const env = cloudSandboxEnvironment()
  const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET || ''
  assert.ok(bypass.length >= 16 && !/\s/.test(bypass), 'Missing automation secret')
  const project = JSON.parse(readFileSync('.vercel/project.json', 'utf8'))
  assert.equal(project.projectId, 'prj_7klbKPGuzckoZ5liEDP9UXQRxvcV')
  assert.equal(project.orgId, 'team_vzgAheUA1bP7p02TJ8pUZvOb')
  const deployment = JSON.parse(readFileSync('docs/launch-preview-deployment-latest.json', 'utf8'))
  assert.equal(deployment.target, 'preview')
  const url = new URL(deployment.url)
  assert.ok(url.hostname.startsWith('shop78it-') && url.hostname.endsWith('.vercel.app'))
  const auth = JSON.parse(readFileSync(join(process.env.APPDATA!, 'com.vercel.cli/Data/auth.json'), 'utf8'))
  const headers = { Authorization: 'Bearer ' + (auth.token || auth.accessToken || auth.access_token) }
  async function api(path: string) {
    return fetch('https://api.vercel.com' + path + (path.includes('?') ? '&' : '?') + 'teamId=' + project.orgId, { headers })
  }
  step = 'preview deployment lookup'
  const metaResponse = await api('/v13/deployments/' + url.hostname)
  assert.ok(metaResponse.ok)
  const meta = await metaResponse.json()
  assert.equal(meta.projectId, project.projectId)
  assert.equal(meta.readyState, 'READY')
  assert.notEqual(meta.target, 'production')
  step = 'primary alias lookup'
  const primaryBefore = await api('/v4/aliases/shop78it.vercel.app')
  assert.ok(primaryBefore.ok)
  const primary = await primaryBefore.json()
  step = 'automation access check'
  const probe = await fetch(new URL('/api/payment/stripe', url), { headers: { 'x-vercel-protection-bypass': bypass }, redirect: 'manual' })
  assert.equal(probe.status, 200, 'Automation secret does not reach Preview')
  assert.ok((probe.headers.get('content-type') || '').includes('application/json'))
  const alias = 'shop78it-stripe-sandbox.vercel.app'
  step = 'sandbox alias ownership check'
  const existing = await api('/v4/aliases/' + alias)
  if (existing.ok) {
    const record = await existing.json()
    assert.equal(record.projectId, project.projectId, 'Alias belongs to another project')
    assert.equal(record.deploymentId || record.deployment?.id, meta.id, 'Existing alias must not be replaced by this preparation')
  } else {
    assert.equal(existing.status, 404)
    step = 'sandbox alias creation'
    const cli = join(process.env.APPDATA!, 'npm/node_modules/vercel/dist/index.js')
    const child = spawn(process.execPath, [cli, 'alias', 'set', url.hostname, alias, '--scope', 'netnaruto0035s1-5199s-projects', '--no-color'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    // CLI output is withheld; no credential is passed in command arguments.
    child.stdout.resume(); child.stderr.resume()
    assert.equal(await new Promise((accept, reject) => { child.on('error', reject); child.on('exit', accept) }), 0)
  }
  step = 'sandbox alias verification'
  const verifyAlias = await api('/v4/aliases/' + alias)
  assert.ok(verifyAlias.ok)
  const record = await verifyAlias.json()
  assert.equal(record.deploymentId || record.deployment?.id, meta.id)
  step = 'primary alias preservation check'
  const primaryAfter = await api('/v4/aliases/shop78it.vercel.app')
  assert.ok(primaryAfter.ok)
  const after = await primaryAfter.json()
  assert.equal(after.deploymentId || after.deployment?.id, primary.deploymentId || primary.deployment?.id)
  const endpoint = new URL('https://' + alias + '/api/payment/stripe/webhook')
  endpoint.searchParams.set('x-vercel-protection-bypass', bypass)
  writeFileSync('.cache/stripe-webhook-endpoint.private.txt', endpoint.href + '\n')
  const report = { checkedAt: new Date().toISOString(), sandboxOnly: true, automationAccessVerified: true, alias, targetDeploymentId: meta.id, primaryDomainUnchanged: true, secretPrinted: false, endpointFile: '.cache/stripe-webhook-endpoint.private.txt', webhookSigningSecretConfigured: !!env.STRIPE_WEBHOOK_SECRET, stripeEnabledOnThisDeployment: (await probe.json()).enabled === true }
  writeFileSync('docs/launch-stripe-webhook-preparation-latest.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report))
}
main().catch(() => { console.error('Webhook preparation stopped at ' + step + '; private details withheld. Production was not requested.'); process.exitCode = 1 })
