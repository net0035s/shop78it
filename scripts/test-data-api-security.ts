import assert from 'node:assert/strict'
import { randomBytes,createHash } from 'node:crypto'
import { readFileSync,writeFileSync } from 'node:fs'
import { Client } from 'pg'
import { PrismaClient } from '@prisma/client'
import { SHOP_TABLES,DATA_API_SECURITY_SQL,assessDataApiSecurity,type DataApiTable } from '../src/lib/data-api-security'
export async function testDataApiSecurity(url:string) {
  const target=new URL(url)
  assert.ok(['127.0.0.1','localhost'].includes(target.hostname) && (target.pathname==='/shop_restore_sandbox' || /^\/shop_rls_sandbox_[a-f0-9]{32}$/.test(target.pathname)),'RLS tests require a known loopback fixture database')
  const client=new Client({connectionString:url})
  await client.connect()
  const sql=readFileSync('scripts/sql/lock-down-data-api.sql','utf8')
  const digest=async()=> {
    const hashes:Record<string,string>={}
    for(const name of SHOP_TABLES) if((await client.query('SELECT to_regclass($1) AS object',['public."'+name+'"'])).rows[0].object) {
      const rows=(await client.query('SELECT to_jsonb(t)::text AS row FROM public."'+name+'" t ORDER BY to_jsonb(t)::text')).rows
      hashes[name]=createHash('sha256').update(JSON.stringify(rows)).digest('hex')
    }
    return hashes
  }
  const expectDenied=async(role:string,query:string)=>{
    await client.query('SET ROLE "'+role+'"')
    try { await assert.rejects(()=>client.query(query),(e:unknown)=>(e as {code?:string}).code==='42501') }
    finally { await client.query('RESET ROLE') }
  }
  const queryRows=async()=> (await client.query<DataApiTable>(DATA_API_SECURITY_SQL)).rows
  const groups:string[]=[]
  try {
    assert.equal((await client.query('SELECT "orderNumber" FROM "Order" WHERE id=\'o\'')).rows[0]?.orderNumber,'RESTORE-MOCK','Requires known synthetic fixture before any role changes')
    for(const role of ['anon','authenticated','fixture_public_only']) await client.query('CREATE ROLE "'+role+'" NOLOGIN NOSUPERUSER NOBYPASSRLS')
    await client.query('GRANT USAGE ON SCHEMA public TO anon,authenticated,fixture_public_only')
    // Match the real backend's non-superuser/BYPASSRLS access without altering bootstrap roles.
    const backendPassword=randomBytes(24).toString('hex')
    await client.query("CREATE ROLE fixture_backend LOGIN NOSUPERUSER BYPASSRLS PASSWORD '"+backendPassword+"'")
    await client.query('GRANT USAGE ON SCHEMA public TO fixture_backend')
    await client.query('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO fixture_backend')
    const backendUrl=new URL(url);backendUrl.username='fixture_backend';backendUrl.password=backendPassword
    assert.deepEqual((await client.query("SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname='fixture_backend'")).rows[0],{rolsuper:false,rolbypassrls:true})
    {
      await client.query('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO PUBLIC,anon,authenticated')
      const before=await digest()
      assert.equal(assessDataApiSecurity(await queryRows()).safe,false)
      await client.query('SET ROLE anon')
      assert.ok((await client.query('SELECT id FROM "Order"')).rows.length>0)
      await client.query('RESET ROLE')
      groups.push('reproduces readable order fixture before lockdown')
      await client.query(sql)
      assert.equal(assessDataApiSecurity(await queryRows()).safe,true)
      assert.deepEqual(await digest(),before)
      groups.push('locks all 15 tables without changing money, customer fixtures or encrypted bytes')
      for(const role of ['anon','authenticated','fixture_public_only']) {
        for(const name of SHOP_TABLES) await expectDenied(role,'SELECT * FROM public."'+name+'"')
        for(const query of [
          'INSERT INTO "RateLimitBucket"(key,count,"expiresAt") VALUES (\'attack\',1,NOW())',
          'UPDATE "Order" SET status=\'completed\'',
          'DELETE FROM "DigitalStock"',
          'TRUNCATE "Order" CASCADE',
          'COPY "Order" TO STDOUT'
        ]) await expectDenied(role,query)
      }
      assert.deepEqual(await digest(),before)
      groups.push('anon, authenticated and PUBLIC-only roles cannot read/insert/update/delete/truncate/copy')
      // Grant leakage must still be blocked by RLS, even if a later change accidentally grants SELECT.
      await client.query('GRANT SELECT ON "Order" TO anon')
      await client.query('SET ROLE anon')
      assert.equal((await client.query('SELECT * FROM "Order"')).rows.length,0)
      await client.query('RESET ROLE')
      assert.equal(assessDataApiSecurity(await queryRows()).safe,false)
      await client.query(sql)
      assert.equal(assessDataApiSecurity(await queryRows()).safe,true)
      groups.push('RLS blocks accidental grant; readiness flags it; repeated lockdown repairs grant')
      const db=new PrismaClient({datasources:{db:{url:backendUrl.toString()}}})
      try {
        assert.ok(await db.order.findUnique({where:{id:'o'}}))
        await db.$transaction(async tx=>{
          const fixture=await tx.product.create({data:{id:'rls-prisma-fixture',name:'RLS fixture',description:'Only sandbox',price:1.25,image:'/test.png',category:'sandbox',stockStatus:'in-stock',tags:''}})
          assert.equal(Number(fixture.price),1.25)
          await tx.product.update({where:{id:fixture.id},data:{name:'Updated fixture'}})
          await tx.product.delete({where:{id:fixture.id}})
        })
      } finally {await db.$disconnect()}
      assert.deepEqual(await digest(),before)
      groups.push('non-superuser server Prisma still reads and writes through its trusted role')
      // Existing policies require review; failure must roll back all earlier table changes.
      await client.query('CREATE POLICY fixture_policy ON "Order" TO anon USING (true)')
      await client.query('GRANT SELECT ON "Category" TO anon')
      await assert.rejects(()=>client.query(sql),/Existing RLS policy/)
      await client.query('ROLLBACK')
      assert.equal((await client.query("SELECT has_table_privilege('anon','public.\"Category\"','SELECT') AS allowed")).rows[0].allowed,true)
      await client.query('DROP POLICY fixture_policy ON "Order"')
      await client.query(sql)
      assert.deepEqual(await digest(),before)
      groups.push('unexpected existing policy aborts atomically and preserves prior permissions')
      // Legacy 9-table schema is also supported, without recreating any commerce tables.
      for(const name of SHOP_TABLES.slice(9)) await client.query('DROP TABLE public."'+name+'" CASCADE')
      await client.query(sql)
      assert.equal(assessDataApiSecurity(await queryRows()).tablesChecked,9)
      assert.equal(assessDataApiSecurity(await queryRows()).safe,true)
      await client.query('ALTER TABLE "Category" RENAME TO "CategoryMissing"')
      await assert.rejects(()=>client.query(sql),/Baseline incomplete/)
      await client.query('ROLLBACK')
      await client.query('ALTER TABLE "CategoryMissing" RENAME TO "Category"')
      groups.push('legacy 9 tables work; incomplete baseline refuses changes')
    }
    for(const name of groups) console.log('PASS RLS: '+name)
    writeFileSync('docs/launch-data-api-test-latest.json',JSON.stringify({checkedAt:new Date().toISOString(),sandboxOnly:true,productionChangesApplied:false,groups,passed:groups.length},null,2)+'\n')
  } finally {await client.end()}
}
