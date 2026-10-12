import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'

export async function postgresSandbox(input: string) {
  const url = new URL(input)
  if (process.env.CI !== 'true' || !['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/shop_sandbox') throw Error('Postgres tests require CI=true and a loopback shop_sandbox database')
  const schema = 'audit_' + randomUUID().replaceAll('-', '')
  const client = new Client({ connectionString: input })
  await client.connect()
  let closed = false
  const close = async () => {
    if (closed) return
    closed = true
    try { await client.query('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE') } finally { await client.end() }
  }
  try {
    await client.query('CREATE SCHEMA "' + schema + '"')
    await client.query('SET search_path TO "' + schema + '"')
    for (const name of readdirSync('prisma/migrations').filter(n => /^[0-9]/.test(n)).sort()) await client.query(readFileSync('prisma/migrations/' + name + '/migration.sql', 'utf8'))
    url.searchParams.set('schema', schema); url.searchParams.set('connection_limit', '5')
    return { url: url.toString(), close }
  } catch (error) { await close(); throw error }
}
