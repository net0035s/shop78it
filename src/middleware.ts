import { clerkClient, clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { verifiedAdminEmail } from './lib/admin-identity'

const isAdminRoute = createRouteMatcher(['/admin11(.*)', '/api/admin(.*)'])
const isAdminApiRoute = createRouteMatcher(['/api/admin(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (!isAdminRoute(req)) return
  const { userId } = await auth()
  if (!userId) {
    if (isAdminApiRoute(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }
  let email = ''
  try {
    const client = await clerkClient()
    email = verifiedAdminEmail(await client.users.getUser(userId), process.env.ADMIN_EMAILS || '')
  } catch { /* Identity lookup failures never grant access. */ }
  if (!email) {
    if (isAdminApiRoute(req)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    return NextResponse.redirect(new URL('/', req.url))
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
