-- PostgREST upsert דורש CONSTRAINT (לא partial index בלבד) על (provider, external_id)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dark_pool_trades_provider_external_key'
  ) THEN
    ALTER TABLE public.dark_pool_trades
      ADD CONSTRAINT dark_pool_trades_provider_external_key
      UNIQUE (provider, external_id);
  END IF;
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE '041: could not add unique(provider,external_id) — dedupe dark_pool_trades first';
END $$;
