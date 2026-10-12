import { loadEnvConfig } from '@next/env'
import { Client } from 'pg'
import { writeFileSync } from 'node:fs'
import { DATA_API_SECURITY_SQL, assessDataApiSecurity, SHOP_TABLES, type DataApiTable } from '../src/lib/data-api-security'
async function main() {
  loadEnvConfig(process.cwd(),true,{info(){},error(){}})
  const report: Record<string,unknown> = { checkedAt:new Date().toISOString(), readOnly:true, changesAppliedByAudit:false }
  for (const [label,url] of [['backend',process.env.DATABASE_URL],['direct',process.env.DIRECT_URL]] as const) {
    if (!url) throw new Error('Database URL missing')
    const client = new Client({connectionString:url,connectionTimeoutMillis:15000,statement_timeout:30000})
    await client.connect()
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
      const role = (await client.query(`SELECT current_user AS name,rolbypassrls AS bypass_rls,rolsuper AS superuser FROM pg_roles WHERE rolname=current_user`)).rows[0]
      const rows = (await client.query<DataApiTable>(DATA_API_SECURITY_SQL)).rows
      const tables = (await client.query(`SELECT c.relname AS table_name,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity AS rls_enabled,c.relforcerowsecurity AS force_rls,c.relacl::text AS acl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND c.relkind IN ('r','p') ORDER BY c.relname`,[SHOP_TABLES])).rows
      const grants = (await client.query(`SELECT c.relname AS table_name,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND c.relkind IN ('r','p') ORDER BY c.relname,a.grantee,a.privilege_type`,[SHOP_TABLES])).rows
      const policies = (await client.query("SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename=ANY($1::text[]) ORDER BY tablename,policyname",[SHOP_TABLES])).rows
      const defaults = (await client.query("SELECT pg_get_userbyid(defaclrole) AS creator,defaclobjtype,defaclacl::text AS acl FROM pg_default_acl WHERE defaclnamespace IN (0,(SELECT oid FROM pg_namespace WHERE nspname='public'))")).rows
      report[label] = { role,assessment:assessDataApiSecurity(rows),tables,grants,policies,defaultPrivileges:defaults }
      await client.query('ROLLBACK')
    } finally { await client.end() }
  }
  writeFileSync('docs/launch-data-api-security-latest.json',JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({readOnly:true,backend:(report.backend as {role:unknown;assessment:unknown}).role,assessment:(report.backend as {assessment:unknown}).assessment,permissionSnapshotSaved:true},null,2))
}
main().catch(()=>{console.error('Read-only permission audit failed; secret output withheld');process.exit(1)})
