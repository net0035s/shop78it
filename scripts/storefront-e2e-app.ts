import next from 'next'
import { createServer } from 'node:http'

async function main() {
  const db = new URL(process.env.DATABASE_URL || '')
  if (process.env.APP_MODE !== 'sandbox' || process.env.SHOP_E2E_RUN !== 'true' || process.env.PAYMENTS_ENABLED !== 'false' ||
      !['127.0.0.1', 'localhost'].includes(db.hostname) ||
      !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_') || !process.env.CLERK_SECRET_KEY?.startsWith('sk_test_') ||
      process.env.SMTP_HOST !== '127.0.0.1') throw new Error('E2E server only permits a local sandbox, Clerk test, local SMTP and disabled payments')
  const port = Number(process.env.SHOP_E2E_PORT)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local test port')
  const app = next({ dev: true, hostname: 'localhost', port, conf: { distDir: '.cache/next-e2e' } })
  await app.prepare()
  const server = createServer(app.getRequestHandler())
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, 'localhost', resolve) })
  const stop = async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await app.close(); process.exit(0) }
  process.on('SIGINT', () => { void stop() })
  process.on('SIGTERM', () => { void stop() })
  console.log('SHOP_E2E_READY')
}
main().catch(() => { console.error('Local sandbox E2E server failed; private details withheld'); process.exitCode = 1 })
