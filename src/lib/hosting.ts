type Environment = Record<string, string | undefined>

// Only public build metadata is embedded; secrets remain runtime variables.
export function deploymentKind(env: Environment = process.env) {
  const kind = env === process.env ? process.env.SHOP_DEPLOYMENT_ENV : env.SHOP_DEPLOYMENT_ENV
  return kind || env.VERCEL_ENV
}

export function hostingProvider(env: Environment = process.env) {
  const provider = env === process.env ? process.env.SHOP_HOSTING_PROVIDER : env.SHOP_HOSTING_PROVIDER
  return provider || (env.VERCEL ? 'vercel' : 'local')
}

export function deploymentUrl(env: Environment = process.env) {
  return env === process.env ? process.env.SHOP_DEPLOYMENT_URL : env.SHOP_DEPLOYMENT_URL
}

export function clientAddress(request: Request, env: Environment = process.env) {
  const provider = hostingProvider(env)
  if (provider === 'netlify') return request.headers.get('x-nf-client-connection-ip') || 'unknown'
  if (provider === 'vercel') return request.headers.get('x-vercel-forwarded-for') || 'unknown'
  return 'local'
}
