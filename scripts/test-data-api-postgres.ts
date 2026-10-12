import assert from 'node:assert/strict'
import { randomUUID,randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Client } from 'pg'
import { testDataApiSecurity } from './test-data-api-security'
import { encryptTextWithKey } from '../src/lib/encryption'
async function main() {
  const value=process.env.SANDBOX_POSTGRES_URL
  if(!value) throw new Error('SANDBOX_POSTGRES_URL must explicitly identify a loopback shop_sandbox; actual environment files are never loaded')
  const url=new URL(value)
  assert.ok(['localhost','127.0.0.1'].includes(url.hostname) && url.pathname==='/shop_sandbox','RLS fixture runner refuses non-sandbox source')
  const name='shop_rls_sandbox_'+randomUUID().replaceAll('-','')
  const admin=new Client({connectionString:url.toString()});await admin.connect()
  const fixtureRoles=['anon','authenticated','fixture_public_only','fixture_backend']
  const existingRoles=(await admin.query<{rolname:string}>('SELECT rolname FROM pg_roles WHERE rolname=ANY($1::text[])',[fixtureRoles])).rows.map(row=>row.rolname)
  let created=false
  try {
    await admin.query('CREATE DATABASE "'+name+'"');created=true
    url.pathname='/'+name
    const fixture=new Client({connectionString:url.toString()});await fixture.connect()
    try {
      await fixture.query(readFileSync('prisma/migrations/202609050001_baseline/migration.sql','utf8'))
      const encrypted=encryptTextWithKey('MOCK-RLS-CONTENT',randomBytes(32).toString('hex'))
      await fixture.query(`INSERT INTO "Product"(id,name,description,price,image,category,"stockStatus",tags) VALUES ('p','RLS fixture','Only mock',10.25,'/test.png','sandbox','in-stock','')`)
      await fixture.query(`INSERT INTO "Order"(id,"orderNumber","customerName","customerEmail",total,status,"createdAt","updatedAt","deliveredContent") VALUES ('o','RESTORE-MOCK','Sandbox','mock@example.invalid',10.25,'completed',NOW(),NOW(),$1)`,[encrypted])
      await fixture.query(`INSERT INTO "OrderItem"(id,"orderId","productId",quantity,price) VALUES ('line','o','p',1,8.75)`)
      await fixture.query(readFileSync('prisma/migrations/202609050002_commerce_safety/migration.sql','utf8'))
    } finally {await fixture.end()}
    await testDataApiSecurity(url.toString())
  } finally {
    if(created) await admin.query('DROP DATABASE "'+name+'" WITH (FORCE)')
    for(const role of fixtureRoles.filter(role=>!existingRoles.includes(role))) await admin.query('DROP ROLE IF EXISTS "'+role+'"')
    await admin.end()
  }
}
main().catch(error=>{console.error(error instanceof Error?error.message:'RLS fixture failed');process.exit(1)})
