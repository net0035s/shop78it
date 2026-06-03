import { NextResponse } from 'next/server'
import { fulfillPaidOrder } from '@/lib/order-fulfillment'

type BeamWebhookPayload = {
  status?: string
  referenceId?: string
  chargeId?: string
  data?: {
    status?: string
    referenceId?: string
    chargeId?: string
  }
  charge?: {
    status?: string
    referenceId?: string
    chargeId?: string
  }
}

function getBeamStatus(payload: BeamWebhookPayload) {
  return payload.status || payload.data?.status || payload.charge?.status || ''
}

function getBeamReferenceId(payload: BeamWebhookPayload) {
  return payload.referenceId || payload.data?.referenceId || payload.charge?.referenceId || ''
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null) as BeamWebhookPayload | null

    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid webhook payload' },
        { status: 400 }
      )
    }

    const status = getBeamStatus(payload)
    const referenceId = getBeamReferenceId(payload)

    if (status !== 'SUCCEEDED') {
      return NextResponse.json({
        success: true,
        message: `Webhook ignored: ${status || 'unknown status'}`,
      })
    }

    if (!referenceId) {
      return NextResponse.json(
        { success: false, error: 'Missing referenceId' },
        { status: 400 }
      )
    }

    const result = await fulfillPaidOrder(referenceId)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Beam webhook error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process Beam webhook' },
      { status: 500 }
    )
  }
}
