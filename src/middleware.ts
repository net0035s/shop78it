import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isAdminRoute = createRouteMatcher(['/admin11(.*)', '/api/admin(.*)'])
const isAdminApiRoute = createRouteMatcher(['/api/admin(.*)'])

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

function getEmailFromClaims(sessionClaims: any) {
  const possibleEmail =
    sessionClaims?.email ||
    sessionClaims?.primary_email ||
    sessionClaims?.primaryEmail ||
    sessionClaims?.primaryEmailAddress ||
    sessionClaims?.publicMetadata?.email ||
    sessionClaims?.metadata?.email

  return typeof possibleEmail === 'string' ? possibleEmail.trim().toLowerCase() : ''
}

export default clerkMiddleware(async (auth, req) => {
  if (!isAdminRoute(req)) return

  const { userId, sessionClaims } = await auth()

  if (!userId) {
    if (isAdminApiRoute(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const signInUrl = new URL('/sign-in', req.url)
    return NextResponse.redirect(signInUrl)
  }

  const adminEmails = getAdminEmails()
  const userEmail = getEmailFromClaims(sessionClaims)
  const isAdmin = Boolean(userEmail && adminEmails.includes(userEmail))

  if (!isAdmin) {
    if (isAdminApiRoute(req)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.redirect(new URL('/', req.url))
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
