import { NextResponse } from 'next/server'

export const JSON_UTF8_CONTENT_TYPE = 'application/json; charset=utf-8'

export function jsonUtf8<T>(body: T, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', JSON_UTF8_CONTENT_TYPE)

  return NextResponse.json(body, {
    ...init,
    headers,
  })
}
