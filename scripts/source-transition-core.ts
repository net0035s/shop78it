import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { Client } from 'pg'
import { decryptTextWithKey, encryptTextWithKey, isEncryptedText, DELIVERY_SECRET_FIELDS } from '../src/lib/encryption'
export const runtimeRole = 'shop78it_runtime_v2'
export const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"'
const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'"
export const secretFields: Record<string, readonly string[]> = { DigitalStock:['content'], DigitalKey:['keyData'], Order:['deliveredContent'], DeliveryItem:DELIVERY_SECRET_FIELDS }
export type OldRows = Record<string, { columns: string[]; rows: Record<string, unknown>[] }>
export async function tables(client: Client) {
  return (await client.query<{table_name:string}>("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name<>'_prisma_migrations' ORDER BY table_name")).rows.map(row => row.table_name)
}
export async function oldRows(client: Client): Promise<OldRows> {
  const result: OldRows = {}
  for (const table of await tables(client)) {
    const columns = (await client.query<{column_name:string}>("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position", [table])).rows.map(row => row.column_name)
    const primary = columns.includes('id') ? 'id' : 'key'
    assert(columns.includes(primary),'Unknown primary key shape')
    result[table] = { columns, rows:(await client.query('SELECT to_jsonb(t) AS row FROM public.'+quote(table)+' t ORDER BY '+quote(primary))).rows.map(row => row.row) }
  }
  return result
}
export async function verifyOldProjection(client: Client, old: OldRows) {
  for (const [table, value] of Object.entries(old)) {
    const actual = (await client.query('SELECT to_jsonb(t) AS row FROM (SELECT '+value.columns.map(quote).join(',')+' FROM public.'+quote(table)+' ORDER BY id) t')).rows.map(row => row.row)
    assert.deepEqual(actual, value.rows, 'Original business projection differs: '+table)
  }
}
export async function transitionToken(client: Client, token: string) {
  await client.query("SELECT set_config('shop78it.transition_token',$1,true)", [token])
}
export async function installFreeze(client: Client, password: string, token: string) {
  assert(/^[a-f0-9]{64}$/.test(password) && /^[a-f0-9]{64}$/.test(token))
  assert.equal((await client.query("SELECT count(*)::int AS n FROM pg_roles WHERE rolname=$1",[runtimeRole])).rows[0].n,0,'Runtime role already exists')
  assert.equal((await client.query("SELECT count(*)::int AS n FROM pg_policy WHERE polname='shop78it_runtime_access'")).rows[0].n,0,'A runtime policy already exists')
  await client.query('CREATE ROLE '+quote(runtimeRole)+' LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '+literal(password))
  await client.query('CREATE SCHEMA shop78it_ops; REVOKE ALL ON SCHEMA shop78it_ops FROM PUBLIC')
  const hash = createHash('md5').update(token).digest('hex')
  await client.query(`CREATE FUNCTION shop78it_ops.require_current_runtime() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $guard$
    BEGIN
      IF current_user <> ${literal(runtimeRole)} AND md5(coalesce(current_setting('shop78it.transition_token',true),'')) <> ${literal(hash)} THEN
        RAISE EXCEPTION 'Legacy storefront writes disabled during transition' USING ERRCODE='55000';
      END IF;
      RETURN NULL;
    END $guard$; REVOKE ALL ON FUNCTION shop78it_ops.require_current_runtime() FROM PUBLIC`)
  await client.query('GRANT USAGE ON SCHEMA shop78it_ops TO '+quote(runtimeRole)+'; GRANT EXECUTE ON FUNCTION shop78it_ops.require_current_runtime() TO '+quote(runtimeRole))
  await addGuards(client)
}
export async function addGuards(client: Client) {
  for (const table of await tables(client)) {
    const existing = (await client.query('SELECT 1 FROM pg_trigger WHERE tgrelid=$1::regclass AND tgname=$2',['public.'+quote(table),'shop78it_legacy_write_guard'])).rowCount
    if (!existing) await client.query('CREATE TRIGGER shop78it_legacy_write_guard BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.'+quote(table)+' FOR EACH STATEMENT EXECUTE FUNCTION shop78it_ops.require_current_runtime()')
  }
}
export async function grantRuntime(client: Client) {
  await client.query('GRANT CONNECT ON DATABASE '+quote((await client.query('SELECT current_database() AS name')).rows[0].name)+' TO '+quote(runtimeRole))
  await client.query('GRANT USAGE ON SCHEMA public TO '+quote(runtimeRole))
  for (const table of await tables(client)) {
    await client.query('ALTER TABLE public.'+quote(table)+' ENABLE ROW LEVEL SECURITY')
    await client.query('GRANT SELECT,INSERT,UPDATE,DELETE ON public.'+quote(table)+' TO '+quote(runtimeRole))
    await client.query('CREATE POLICY shop78it_runtime_access ON public.'+quote(table)+' FOR ALL TO '+quote(runtimeRole)+' USING (true) WITH CHECK (true)')
  }
}
export async function proveLegacyBlocked(client: Client) {
  // Statement triggers fire even when zero rows match. No customer records are modified.
  await client.query('BEGIN')
  try {
    await client.query('UPDATE public."Order" SET status=status WHERE false')
    throw new Error('Legacy writer was not blocked')
  } catch (error) {
    assert.equal((error as {code?:string}).code,'55000','Legacy freeze verification failed')
  } finally { await client.query('ROLLBACK') }
}
export type RekeyChange = {table:string;id:string;field:string;previous:string;next:string;plaintext:string;replaced:boolean}
export async function rekeyPlan(client: Client, oldKey: string, newKey: string) {
  const changes: RekeyChange[] = []; let readable=0, unreadable=0
  for (const [table,fields] of Object.entries(secretFields)) {
    const rows = (await client.query('SELECT id,'+fields.map(quote).join(',')+' FROM public.'+quote(table)+' ORDER BY id')).rows
    for (const row of rows) for (const field of fields) {
      const value=row[field]; if(!isEncryptedText(value)) continue
      let plaintext:string, replaced=false
      try { plaintext=decryptTextWithKey(value,oldKey,{allowUnsafeDefault:true}); readable++ }
      catch {
        // The owner confirmed every original item is experimental. Never restock sold rows.
        unreadable++; replaced=true; const marker='MOCK-REKEY-'+row.id
        plaintext=table==='DigitalStock' ? JSON.stringify({licenseKey:marker,expiresAt:'2099-12-31',instructions:'Test replacement; original unavailable'}) : field==='licenseKey' ? marker : field==='expiresAt' ? '2099-12-31' : 'Test replacement; original unavailable'
      }
      changes.push({table,id:row.id,field,previous:value,next:encryptTextWithKey(plaintext,newKey),plaintext,replaced})
    }
  }
  assert.equal(readable,14); assert.equal(unreadable,24); assert.equal(changes.length,38)
  return changes
}
export async function applyRekey(client: Client, changes: RekeyChange[], newKey: string) {
  const before = await oldRows(client)
  for (const change of changes) {
    const result=await client.query('UPDATE public.'+quote(change.table)+' SET '+quote(change.field)+'=$1 WHERE id=$2 AND '+quote(change.field)+'=$3',[change.next,change.id,change.previous])
    assert.equal(result.rowCount,1,'Ciphertext changed concurrently')
  }
  const after=await oldRows(client)
  for (const table of Object.keys(before)) {
    const strip=(rows:Record<string,unknown>[])=>rows.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>!(secretFields[table]||[]).includes(key))))
    assert.deepEqual(strip(after[table].rows),strip(before[table].rows),'Non-secret data changed during rekey')
  }
  for (const change of changes) {
    const row=(await client.query('SELECT '+quote(change.field)+' AS value FROM public.'+quote(change.table)+' WHERE id=$1',[change.id])).rows[0]
    assert.equal(decryptTextWithKey(row.value,newKey),change.plaintext)
  }
}
export async function restoreOldRows(client: Client, old: OldRows) {
  // Caller must first verify the exact post-transition digest, proving no subsequent writes.
  // No DROP/DELETE and no paid/stock history removed.
  for (const [table,value] of Object.entries(old)) for (const row of value.rows) {
    const columns=value.columns.filter(column=>column!=='id')
    if(!columns.length) continue
    const result=await client.query('UPDATE public.'+quote(table)+' t SET '+columns.map(column=>quote(column)+'=r.'+quote(column)).join(',')+' FROM jsonb_populate_record(NULL::public.'+quote(table)+',$1::jsonb) r WHERE t.id=r.id',[JSON.stringify(row)])
    assert.equal(result.rowCount,1)
  }
  await verifyOldProjection(client,old)
}
export function roleUrl(url: string, password: string) {
  const parsed=new URL(url), user=decodeURIComponent(parsed.username)
  assert(/^postgres(?:\.[a-z0-9]+)?$/.test(user),'Expected original postgres connection')
  parsed.username=user.replace(/^postgres/,runtimeRole); parsed.password=password
  return parsed.toString()
}
export async function removeOwnedFreeze(client: Client) {
  for (const table of await tables(client)) {
    await client.query('DROP TRIGGER shop78it_legacy_write_guard ON public.'+quote(table))
    await client.query('DROP POLICY IF EXISTS shop78it_runtime_access ON public.'+quote(table))
    await client.query('REVOKE ALL ON TABLE public.'+quote(table)+' FROM '+quote(runtimeRole))
  }
  await client.query('REVOKE ALL ON SCHEMA public FROM '+quote(runtimeRole))
  await client.query('REVOKE CONNECT ON DATABASE '+quote((await client.query('SELECT current_database() AS name')).rows[0].name)+' FROM '+quote(runtimeRole))
  // No CASCADE: unexpected dependencies cause a rollback instead of deleting them.
  await client.query('DROP FUNCTION shop78it_ops.require_current_runtime(); DROP SCHEMA shop78it_ops; DROP ROLE '+quote(runtimeRole))
}
