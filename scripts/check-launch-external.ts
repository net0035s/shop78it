import { loadEnvConfig } from '@next/env'
import { createClerkClient } from '@clerk/backend'
import nodemailer from 'nodemailer'
import { mkdirSync, writeFileSync } from 'node:fs'
import { verifiedAdminEmail } from '../src/lib/admin-identity'

async function main() {
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} })
  const report: Record<string,unknown> = { checkedAt: new Date().toISOString(), readOnly: true, messagesSent: 0, paymentRequests: 0, browserAdminLoginVerified: false }
  const allowed = (process.env.ADMIN_EMAILS || '').split(',').map(value => value.trim()).filter(Boolean)
  if (process.env.CLERK_SECRET_KEY && allowed.length) {
    try {
      const client = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
      const users = await client.users.getUserList({ emailAddress: allowed.slice(0,100), limit: 100 })
      report.clerk = { connected: true, instance: process.env.CLERK_SECRET_KEY.startsWith('sk_test_') ? 'test' : 'live', matchingUsers: users.totalCount, verifiedPrimaryAdmins: users.data.filter(user => verifiedAdminEmail(user, allowed.join(','))).length }
    } catch { report.clerk = { connected: false, error: 'Connection failed; private details withheld' } }
  } else report.clerk = { connected: false, configured: false }
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    const transport = nodemailer.createTransport(process.env.SMTP_HOST ? {
      host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true',
      requireTLS: true, auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 15000,
    } : { service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 15000 })
    try { await transport.verify(); report.smtp = { authenticated: true, deliveryVerified: false } } catch (error) { const code = (error as { code?: string }).code; report.smtp = { authenticated: false, deliveryVerified: false, category: code && ['EAUTH','ETIMEDOUT','ECONNECTION','ESOCKET','EDNS'].includes(code) ? code : 'unknown', error: 'SMTP verification failed; private details withheld' } }
    finally { transport.close() }
  } else report.smtp = { authenticated: false, configured: false }
  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      const response = await fetch('https://api.telegram.org/bot' + process.env.TELEGRAM_BOT_TOKEN + '/getMe', { signal: AbortSignal.timeout(15000) })
      const body = await response.json()
      report.telegram = { tokenVerified: response.ok && body.ok === true, deliveryVerified: false }
    } catch { report.telegram = { tokenVerified: false, deliveryVerified: false } }
  } else report.telegram = { tokenVerified: false, configured: false }
  mkdirSync('docs',{recursive:true}); writeFileSync('docs/launch-external-readonly-latest.json',JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify(report,null,2))
}
main().catch(() => { console.error('Read-only external verification failed; no secret output printed'); process.exitCode = 1 })
