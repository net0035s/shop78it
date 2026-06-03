import { clerkClient, clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isAdminRoute = createRouteMatcher(['/admin11(.*)', '/api/admin(.*)'])
const isAdminApiRoute = createRouteMatcher(['/api/admin(.*)'])

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

function getEmailFromClaims(sessionClaims: unknown) {
  const claims = sessionClaims as {
    email?: unknown
    primary_email?: unknown
    primaryEmail?: unknown
    primaryEmailAddress?: unknown
    publicMetadata?: { email?: unknown }
    metadata?: { email?: unknown }
  } | null

  const possibleEmail =
    claims?.email ||
    claims?.primary_email ||
    claims?.primaryEmail ||
    claims?.primaryEmailAddress ||
    claims?.publicMetadata?.email ||
    claims?.metadata?.email

  return typeof possibleEmail === 'string' ? possibleEmail.trim().toLowerCase() : ''
}

async function getEmailFromClerkUser(userId: string) {
  try {
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const primaryEmail = user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)
    const email = primaryEmail?.emailAddress || user.emailAddresses[0]?.emailAddress || ''

    return email.trim().toLowerCase()
  } catch (error) {
    console.error('Failed to fetch Clerk user email in middleware:', error)
    return ''
  }
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
  const userEmail = getEmailFromClaims(sessionClaims) || await getEmailFromClerkUser(userId)
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
