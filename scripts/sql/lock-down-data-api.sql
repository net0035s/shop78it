-- Approved operational SQL; applied to the shop on 2026-10-11 as lock_down_shop_data_api.
-- No row/key/schema-column changes. Migration history: 20261011064132.
-- Server Prisma role must remain postgres (the verified owner/BYPASSRLS role).
-- Run only after approval, fresh backup + permission snapshot, and target verification.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $lockdown$
DECLARE
  table_name text;
  table_oid oid;
  sequence_name text;
  baseline text[] := ARRAY['Category','DeliveryItem','DigitalKey','DigitalStock','DiscountCode','Order','OrderItem','Product','StoreSettings'];
  shop_tables text[] := baseline || ARRAY['PaymentAttempt','OrderAccessSession','OrderAccessChallenge','NotificationJob','OrderAuditEvent','RateLimitBucket'];
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Review backend/owner role before applying'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    RAISE EXCEPTION 'Expected Supabase Data API roles missing';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Public roles have privileged attributes; review first';
  END IF;
  FOREACH table_name IN ARRAY baseline LOOP
    IF to_regclass(format('public.%I',table_name)) IS NULL THEN RAISE EXCEPTION 'Baseline incomplete'; END IF;
  END LOOP;
  FOREACH table_name IN ARRAY shop_tables LOOP
    table_oid := to_regclass(format('public.%I',table_name));
    IF table_oid IS NULL THEN CONTINUE; END IF; -- New commerce tables can be added later.
    IF EXISTS(SELECT 1 FROM pg_class WHERE oid=table_oid AND (relkind NOT IN ('r','p') OR pg_get_userbyid(relowner)<>'postgres')) THEN
      RAISE EXCEPTION 'Unexpected table type/owner; review first';
    END IF;
    IF EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=table_oid) THEN
      RAISE EXCEPTION 'Existing RLS policy needs review; no policies deleted';
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated',table_name);
    FOR sequence_name IN
      SELECT format('%I.%I',n.nspname,s.relname)
      FROM pg_class s JOIN pg_namespace n ON n.oid=s.relnamespace
      JOIN pg_depend d ON d.objid=s.oid AND d.refobjid=table_oid AND d.deptype IN ('a','i')
      WHERE s.relkind='S'
    LOOP
      EXECUTE format('REVOKE ALL PRIVILEGES ON SEQUENCE %s FROM PUBLIC, anon, authenticated',sequence_name);
    END LOOP;
    IF has_table_privilege('anon',table_oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_table_privilege('authenticated',table_oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
      RAISE EXCEPTION 'Inherited public grants remain; transaction aborted';
    END IF;
  END LOOP;
END
$lockdown$;
COMMIT;
