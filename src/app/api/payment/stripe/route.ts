import { stripeOrderRequest, stripePublicConfiguration } from '@/lib/stripe-handlers'
export const GET = stripePublicConfiguration
export const POST = (request: Request) => stripeOrderRequest(request, 'checkout')
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
