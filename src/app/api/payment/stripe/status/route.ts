import { stripeOrderRequest } from '@/lib/stripe-handlers'
export const POST = (request: Request) => stripeOrderRequest(request, 'status')
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
