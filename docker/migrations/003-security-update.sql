-- Execute separately after a verified fresh backup, before activating Payload 3.92.
-- Deliberately refuses a different database, unexpected migration history or a rerun.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SELECT pg_advisory_xact_lock(hashtext('jaxson-security-update-20261028'));
DO $$
DECLARE applied text[];
BEGIN
  IF current_database() <> 'jaxson_release_20261007' THEN
    RAISE EXCEPTION 'Wrong database for the reviewed security update';
  END IF;
  SELECT array_agg(name::text ORDER BY name) INTO applied FROM owner.payload_migrations;
  IF applied IS DISTINCT FROM ARRAY[
    '20260909_051231_init',
    '20260928_000000_cinematic_project_fields',
    '20261007_000000_private_inbox_receipts',
    '20261022_000000_project_home_order',
    '20261024_000000_project_demo_video'
  ]::text[] THEN
    RAISE EXCEPTION 'Expected exactly the five reviewed prior migrations; inspect before proceeding';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='owner'
      AND table_name='users' AND column_name='reset_password_requested_at') THEN
    RAISE EXCEPTION 'Reset timestamp already exists; inspect schema before proceeding';
  END IF;
END $$;
LOCK TABLE owner.users, owner.projects IN ACCESS EXCLUSIVE MODE;
ALTER TABLE owner.users ADD COLUMN reset_password_requested_at timestamp(3) with time zone;
ALTER TABLE owner.projects ALTER COLUMN visibility SET DEFAULT 'private';
INSERT INTO owner.payload_migrations(name,batch)
  SELECT '20261028_000000_security_update', COALESCE(MAX(batch),0)+1 FROM owner.payload_migrations;
COMMIT;
