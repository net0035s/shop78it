// The shop uses server-side Prisma and Clerk, not the Supabase browser Data API.
export const SHOP_TABLES = ['Category','DeliveryItem','DigitalKey','DigitalStock','DiscountCode','Order','OrderItem','Product','StoreSettings','PaymentAttempt','OrderAccessSession','OrderAccessChallenge','NotificationJob','OrderAuditEvent','RateLimitBucket'] as const
export type DataApiTable = { table_name: string; rls_enabled: boolean; anon_access: boolean; authenticated_access: boolean; public_access: boolean }
export const DATA_API_SECURITY_SQL = `
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') ELSE false END AS anon_access,
CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') ELSE false END AS authenticated_access,
EXISTS(SELECT 1 FROM aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a WHERE a.grantee=0) AS public_access
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname IN ('Category','DeliveryItem','DigitalKey','DigitalStock','DiscountCode','Order','OrderItem','Product','StoreSettings','PaymentAttempt','OrderAccessSession','OrderAccessChallenge','NotificationJob','OrderAuditEvent','RateLimitBucket')
ORDER BY c.relname
`
export function assessDataApiSecurity(rows: DataApiTable[]) {
  const unsafeTables = rows.filter(row => !row.rls_enabled || row.anon_access || row.authenticated_access || row.public_access).map(row=>row.table_name)
  const missingBaseline = SHOP_TABLES.slice(0,9).filter(name=>!rows.some(row=>row.table_name===name))
  return { safe: rows.length>0 && unsafeTables.length===0 && missingBaseline.length===0, tablesChecked: rows.length, unsafeTables, missingBaseline }
}
