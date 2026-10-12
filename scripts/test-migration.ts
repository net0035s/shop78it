import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
async function main(){
 const db=new PGlite()
 try{
  await db.exec("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO PUBLIC,anon,authenticated;")
  await db.exec(readFileSync('prisma/migrations/202609050001_baseline/migration.sql','utf8'))
  await db.exec(`
   INSERT INTO "Category"("id","name","slug") VALUES ('cat','Old','old');
   INSERT INTO "Product"("id","name","description","price","image","category","stockStatus","tags") VALUES ('p','Old Product','Preserved',10.25,'/image.png','old','in-stock','');
   INSERT INTO "Order"("id","orderNumber","customerName","customerEmail","total","status","createdAt","updatedAt","deliveredContent") VALUES
   ('paid','OLD-PAID','Sandbox','x@example.invalid',10.25,'completed','2026-01-01','2026-01-02','encrypted-unchanged'),
   ('pending','OLD-PENDING','Sandbox','x@example.invalid',10.25,'pending','2026-01-01','2026-01-02',NULL);
   INSERT INTO "OrderItem"("id","orderId","productId","quantity","price") VALUES ('line','paid','p',1,8.75);
   INSERT INTO "DigitalStock"("id","productId","type","content","isSold","orderId") VALUES ('s','p','license-key','opaque-encrypted-unchanged',true,'pending');
  `)
  await db.exec(readFileSync('prisma/migrations/202609050002_commerce_safety/migration.sql','utf8'))
  const paid=(await db.query<any>('SELECT * FROM "Order" WHERE "id"=\'paid\'')).rows[0]
  assert.equal(paid.deliveredContent,'encrypted-unchanged');assert.equal(paid.paidAtEstimated,true)
  const item=(await db.query<any>('SELECT * FROM "OrderItem"')).rows[0]
  assert.equal(Number(item.price),8.75);assert.equal(item.productName,'Old Product')
  const stock=(await db.query<any>('SELECT * FROM "DigitalStock"')).rows[0]
  assert.equal(stock.content,'opaque-encrypted-unchanged');assert.equal(stock.isSold,true);assert.equal(stock.orderId,'pending')
  const pending=(await db.query<any>('SELECT * FROM "Order" WHERE "id"=\'pending\'')).rows[0]
  assert.equal(pending.status,'payment_review')
  assert.equal((await db.query<any>('SELECT * FROM "PaymentAttempt"')).rows[0].status,'review')
  const security=(await db.query<{relname:string;relrowsecurity:boolean}>("SELECT relname,relrowsecurity FROM pg_class WHERE relname IN ('PaymentAttempt','OrderAccessSession','OrderAccessChallenge','NotificationJob','OrderAuditEvent','RateLimitBucket') AND relkind='r'")).rows
  assert.equal(security.length,6);assert.ok(security.every(row=>row.relrowsecurity))
  const grants=(await db.query<{exposed:boolean}>("SELECT has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR EXISTS(SELECT 1 FROM aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a WHERE a.grantee=0) AS exposed FROM pg_class c WHERE c.relname IN ('PaymentAttempt','OrderAccessSession','OrderAccessChallenge','NotificationJob','OrderAuditEvent','RateLimitBucket') AND c.relkind='r'")).rows
  assert.equal(grants.length,6);assert.ok(grants.every(row=>!row.exposed),'Supabase-style default grants must be revoked on every new table')
  console.log('PASS additive migration preserves money, encrypted bytes and sold stock; quarantines ambiguous legacy payments and enables RLS for six new tables')
 }finally{await db.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1})
