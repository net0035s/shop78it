/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    SHOP_HOSTING_PROVIDER: process.env.NETLIFY === 'true' ? 'netlify' : '',
    SHOP_DEPLOYMENT_ENV: process.env.NETLIFY === 'true'
      ? (process.env.CONTEXT === 'production' && process.env.APP_MODE !== 'sandbox' ? 'production' : 'preview') : '',
    SHOP_DEPLOYMENT_URL: process.env.NETLIFY === 'true'
      ? (process.env.CONTEXT === 'production' ? process.env.URL : process.env.DEPLOY_PRIME_URL) || '' : '',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'i.postimg.cc',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.in',
      },
    ],
  },
}

module.exports = nextConfig
