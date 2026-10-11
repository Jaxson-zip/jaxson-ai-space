DO $$
BEGIN
  IF to_regclass('owner.projects') IS NOT NULL THEN
    IF to_regclass('owner.payload_migrations') IS NULL THEN
      RAISE EXCEPTION 'Existing CMS tables have no Payload migration history. Back up and reconcile this database before deployment.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM owner.payload_migrations WHERE name = '20260909_051231_init'
    ) THEN
      RAISE EXCEPTION 'Existing CMS schema was not created by the tracked Payload migrations. Back up and reconcile before deployment.';
    END IF;
  END IF;
END $$;
