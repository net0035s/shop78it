// Disabled by default until the new deployment and notification paths are verified.
export default async () => {
  if (process.env.MAINTENANCE_ENABLED !== 'true') return new Response(null, { status: 204 })
  const rawUrl = process.env.NEXT_PUBLIC_SITE_URL
  const secret = process.env.CRON_SECRET
  if (!rawUrl || !secret || secret.length < 32) throw new Error('Maintenance configuration missing')
  const url = new URL(rawUrl)
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid maintenance origin')
  const result = await fetch(new URL('/api/cron/cancel-orders', url), {
    headers: { authorization: `Bearer ${secret}` }, redirect: 'error', signal: AbortSignal.timeout(25000),
  })
  if (!result.ok) throw new Error(`Maintenance failed: HTTP ${result.status}`)
  const body = await result.json()
  if (body.success !== true) throw new Error('Maintenance did not complete')
  return new Response(null, { status: 204 })
}
