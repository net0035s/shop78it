import { deploymentUrl, hostingProvider } from './hosting'
type Environment = Record<string, string | undefined>
export function siteUrl(env: Environment = process.env) {
  if (hostingProvider(env) === 'netlify') {
    const url = new URL(deploymentUrl(env) || '')
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid Netlify deployment URL')
    return url.origin
  }
  // Preview links must return to this exact deployment, even if an older project variable names the live shop.
  if (env.VERCEL_ENV === 'preview' && env.VERCEL_URL) {
    const host = env.VERCEL_URL
    if (!/^[a-zA-Z0-9.-]+\.vercel\.app$/.test(host)) throw new Error('Invalid Preview deployment host')
    return 'https://' + host
  }
  return env.NEXT_PUBLIC_SITE_URL || env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
}
